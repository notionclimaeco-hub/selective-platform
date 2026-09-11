import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { estadoEncomendaValidator, motivoCancelamentoValidator } from "./schema";
import {
  assertPodeCancelar,
  assertPodeVoltarAEditar,
  assertProntaParaPagamento,
  bucketsIniciais,
  linhasRestantes,
  MAX_LINHAS_ENCOMENDA,
} from "./lib/encomendaEstados";
import { agendarRender } from "./notion/agendar";
import { EVENTOS_WEBHOOK, type EventoRevolut } from "./revolut/regras";

/**
 * Payment side of installer orders (#8). Database half only: the Revolut
 * calls live in `revolut/fluxo.ts` (actions) and call back into these
 * mutations. Rule from #5: `paga` is reached from a signed `ORDER_COMPLETED`
 * only — never from the widget's onSuccess.
 */

const eventoValidator = v.union(...EVENTOS_WEBHOOK.map((e) => v.literal(e)));

async function linhasDe(
  ctx: QueryCtx | MutationCtx,
  encomendaId: Id<"installerOrders">,
): Promise<Array<Doc<"installerOrderLines">>> {
  return await ctx.db
    .query("installerOrderLines")
    .withIndex("by_encomendaId", (q) => q.eq("encomendaId", encomendaId))
    .take(MAX_LINHAS_ENCOMENDA);
}

function dataCurta(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// --- payment page (public, token is the credential) ---------------------------

const vistaPagamentoValidator = v.object({
  numero: v.number(),
  titulo: v.string(),
  empresa: v.string(),
  estado: estadoEncomendaValidator,
  cancelReason: v.optional(motivoCancelamentoValidator),
  linhas: v.array(
    v.object({
      ref: v.string(),
      nome: v.string(),
      marca: v.string(),
      qty: v.number(),
      precoRevendaCents: v.number(),
    }),
  ),
  totalRevendaCents: v.number(),
  ivaPercent: v.number(),
  totalPagamentoCents: v.optional(v.number()),
  /** Widget `publicId`; present only while the order can be paid. */
  revolutToken: v.optional(v.string()),
  paymentExpiresAt: v.optional(v.number()),
  paidAt: v.optional(v.number()),
});

/** Null for an unknown token. The order page itself is the "pró-forma". */
export const porToken = query({
  args: { token: v.string() },
  returns: v.union(vistaPagamentoValidator, v.null()),
  handler: async (ctx, args) => {
    if (args.token.length < 32) return null;
    const encomenda = await ctx.db
      .query("installerOrders")
      .withIndex("by_pagamentoToken", (q) => q.eq("pagamentoToken", args.token))
      .unique();
    if (!encomenda) return null;
    const empresa = await ctx.db.get(encomenda.empresaId);
    const linhas = linhasRestantes(await linhasDe(ctx, encomenda._id));
    const pagavel = encomenda.estado === "aguardando_pagamento";
    return {
      numero: encomenda.numero,
      titulo: encomenda.titulo,
      empresa: empresa?.nomeLegal ?? "",
      estado: encomenda.estado,
      cancelReason: encomenda.cancelReason,
      linhas: linhas.map((l) => ({
        ref: l.ref,
        nome: l.nome,
        marca: l.marca,
        qty: l.qty,
        precoRevendaCents: l.precoRevendaCents,
      })),
      totalRevendaCents: encomenda.totalRevendaCents,
      ivaPercent: encomenda.ivaPercent,
      totalPagamentoCents: encomenda.totalPagamentoCents,
      revolutToken: pagavel ? encomenda.revolutToken : undefined,
      paymentExpiresAt: pagavel ? encomenda.paymentExpiresAt : undefined,
      paidAt: encomenda.paidAt,
    };
  },
});

// --- used by revolut/fluxo.ts ---------------------------------------------------

export const paraPedido = internalQuery({
  args: { encomendaId: v.id("installerOrders") },
  handler: async (ctx, args) => {
    const encomenda = await ctx.db.get(args.encomendaId);
    if (!encomenda) throw new Error("Order not found");
    const empresa = await ctx.db.get(encomenda.empresaId);
    if (!empresa) throw new Error("Company not found");
    const linhas = await linhasDe(ctx, encomenda._id);
    assertProntaParaPagamento(encomenda.estado, linhas);
    return { encomenda, empresa: { nomeLegal: empresa.nomeLegal, email: empresa.email } };
  },
});

/** `aguardando_stock` → `aguardando_pagamento` once the Revolut order exists. */
export const registarPedido = internalMutation({
  args: {
    encomendaId: v.id("installerOrders"),
    pagamentoToken: v.string(),
    revolutOrderId: v.string(),
    revolutToken: v.string(),
    totalPagamentoCents: v.number(),
    agora: v.number(),
    expiraEm: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const encomenda = await ctx.db.get(args.encomendaId);
    if (!encomenda) throw new Error("Order not found");
    assertProntaParaPagamento(encomenda.estado, await linhasDe(ctx, encomenda._id));
    await ctx.db.patch(encomenda._id, {
      estado: "aguardando_pagamento",
      pagamentoToken: encomenda.pagamentoToken ?? args.pagamentoToken,
      revolutOrderId: args.revolutOrderId,
      revolutToken: args.revolutToken,
      totalPagamentoCents: args.totalPagamentoCents,
      paymentRequestedAt: args.agora,
      paymentExpiresAt: args.expiraEm,
    });
    await agendarRender(
      ctx,
      encomenda._id,
      `Pagamento pedido — ${(args.totalPagamentoCents / 100).toFixed(2)} € c/IVA, link válido até ${dataCurta(args.expiraEm)}`,
    );
    return null;
  },
});

export const encomendaParaVoltarAEditar = internalQuery({
  args: { encomendaId: v.id("installerOrders") },
  returns: v.object({ revolutOrderId: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const encomenda = await ctx.db.get(args.encomendaId);
    if (!encomenda) throw new Error("Order not found");
    assertPodeVoltarAEditar(encomenda.estado);
    return { revolutOrderId: encomenda.revolutOrderId ?? null };
  },
});

/** Void-to-edit (#5): back to `aguardando_stock`; the Revolut order is gone. */
export const voltarAEditar = internalMutation({
  args: { encomendaId: v.id("installerOrders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const encomenda = await ctx.db.get(args.encomendaId);
    if (!encomenda) throw new Error("Order not found");
    assertPodeVoltarAEditar(encomenda.estado);
    await ctx.db.patch(encomenda._id, {
      estado: "aguardando_stock",
      revolutOrderId: undefined,
      revolutToken: undefined,
      totalPagamentoCents: undefined,
      paymentRequestedAt: undefined,
      paymentExpiresAt: undefined,
    });
    await agendarRender(ctx, encomenda._id, "Voltou a edição — pedido de pagamento anulado");
    return null;
  },
});

// --- webhook effects --------------------------------------------------------------

export const resultadoEventoValidator = v.union(
  v.literal("paga"),
  v.literal("expirada"),
  v.literal("cancelada"),
  v.literal("tentativa_falhada"),
  v.literal("pagamento_inesperado"),
  v.literal("repetido"),
  v.literal("ignorado"),
  v.literal("desconhecido"),
);

/**
 * Apply one Revolut event to the order that owns the Revolut order id.
 * Idempotent per (order, event). Unknown orders are ignored (another system
 * on the same merchant account).
 */
export const aplicarEvento = internalMutation({
  args: {
    revolutOrderId: v.string(),
    evento: eventoValidator,
    recebidoEm: v.number(),
  },
  returns: resultadoEventoValidator,
  handler: async (ctx, args) => {
    const encomenda = await ctx.db
      .query("installerOrders")
      .withIndex("by_revolutOrderId", (q) => q.eq("revolutOrderId", args.revolutOrderId))
      .unique();
    if (!encomenda) return "desconhecido";

    const anteriores = await ctx.db
      .query("pagamentoEventos")
      .withIndex("by_revolutOrderId", (q) => q.eq("revolutOrderId", args.revolutOrderId))
      .take(50);
    if (anteriores.some((e) => e.evento === args.evento)) return "repetido";
    await ctx.db.insert("pagamentoEventos", {
      revolutOrderId: args.revolutOrderId,
      evento: args.evento,
      encomendaId: encomenda._id,
      recebidoEm: args.recebidoEm,
    });

    return await aplicar(ctx, encomenda, args.evento, args.recebidoEm);
  },
});

async function aplicar(
  ctx: MutationCtx,
  encomenda: Doc<"installerOrders">,
  evento: EventoRevolut,
  agora: number,
): Promise<
  "paga" | "expirada" | "cancelada" | "tentativa_falhada" | "pagamento_inesperado" | "ignorado"
> {
  switch (evento) {
    case "ORDER_COMPLETED": {
      if (encomenda.estado !== "aguardando_pagamento") {
        // Paid after a cancel / void-to-edit race: money arrived, keep the
        // header, flag it loudly for the office (manual refund, #12 exceção).
        await ctx.db.patch(encomenda._id, { paidAt: agora });
        await agendarRender(
          ctx,
          encomenda._id,
          `ATENÇÃO: pagamento Revolut recebido com a encomenda em estado ${encomenda.estado} — reembolso manual necessário`,
        );
        return "pagamento_inesperado";
      }
      await ctx.db.patch(encomenda._id, { estado: "paga", paidAt: agora });
      for (const linha of linhasRestantes(await linhasDe(ctx, encomenda._id))) {
        await ctx.db.patch(linha._id, bucketsIniciais(linha.qty));
      }
      await agendarRender(ctx, encomenda._id, "Pagamento recebido (Revolut) — encomendar aos fornecedores");
      return "paga";
    }
    case "ORDER_FAILED":
    case "ORDER_CANCELLED": {
      if (encomenda.estado !== "aguardando_pagamento") return "ignorado";
      assertPodeCancelar(encomenda.estado);
      const expirou = evento === "ORDER_FAILED";
      await ctx.db.patch(encomenda._id, {
        estado: "cancelada",
        cancelReason: expirou ? "payment_expired" : "office",
        cancelledAt: agora,
        cancelledBy: "revolut",
      });
      await agendarRender(
        ctx,
        encomenda._id,
        expirou
          ? "Pagamento expirado (7 dias) — encomenda cancelada"
          : "Ordem Revolut cancelada fora da plataforma — encomenda cancelada",
      );
      return expirou ? "expirada" : "cancelada";
    }
    case "ORDER_PAYMENT_DECLINED":
    case "ORDER_PAYMENT_FAILED": {
      await agendarRender(
        ctx,
        encomenda._id,
        `Tentativa de pagamento sem sucesso (${evento === "ORDER_PAYMENT_DECLINED" ? "recusada" : "falhou"}) — o instalador pode tentar de novo`,
      );
      return "tentativa_falhada";
    }
    case "ORDER_AUTHORISED":
      return "ignorado";
  }
}

/** Orders whose payment window closed without a webhook (reconciliation). */
export const pendentesExpirados = internalQuery({
  args: { agora: v.number() },
  returns: v.array(
    v.object({ encomendaId: v.id("installerOrders"), revolutOrderId: v.string() }),
  ),
  handler: async (ctx, args) => {
    const pendentes = await ctx.db
      .query("installerOrders")
      .withIndex("by_estado", (q) => q.eq("estado", "aguardando_pagamento"))
      .take(200);
    return pendentes
      .filter(
        (e) =>
          e.revolutOrderId !== undefined &&
          e.paymentExpiresAt !== undefined &&
          e.paymentExpiresAt < args.agora,
      )
      .map((e) => ({ encomendaId: e._id, revolutOrderId: e.revolutOrderId as string }));
  },
});

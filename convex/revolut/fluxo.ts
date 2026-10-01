import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { cancelarOrdem, clienteRevolutDoAmbiente, criarOrdem, obterOrdem } from "./cliente";
import {
  eventoDoEstadoRevolut,
  PRAZO_PAGAMENTO_ISO,
  PRAZO_PAGAMENTO_MS,
  referenciaRevolut,
  totalPagamentoCents,
  urlPagamento,
} from "./regras";

/**
 * Revolut side of the payment flow. Plain async helpers so an office
 * action (staff order API, #84) can call them inside its own action; thin
 * `internalAction` wrappers for the scheduler, the cron and the CLI.
 */

function revolutOuErro() {
  const revolut = clienteRevolutDoAmbiente();
  if (!revolut) throw new Error("Pagamentos indisponíveis: REVOLUT_SECRET_KEY não configurada");
  return revolut;
}

function novoToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replaceAll("-", "");
}

/** Office `Pedir pagamento`: create the Revolut order, then move the header. */
export async function pedirPagamento(
  ctx: ActionCtx,
  encomendaId: Id<"installerOrders">,
): Promise<{ totalPagamentoCents: number; expiraEm: number }> {
  const revolut = revolutOuErro();
  const { encomenda, empresa } = await ctx.runQuery(internal.pagamentos.paraPedido, {
    encomendaId,
  });
  const agora = Date.now();
  const total = totalPagamentoCents(encomenda.totalRevendaCents, encomenda.ivaPercent);
  const pagamentoToken = encomenda.pagamentoToken ?? novoToken();
  const base = process.env.CLIENT_APP_URL;
  const ordem = await criarOrdem(revolut, {
    amountCents: total,
    referencia: referenciaRevolut(encomenda.numero),
    descricao: `${encomenda.titulo} — Climaeco Selective`,
    expiraApos: PRAZO_PAGAMENTO_ISO,
    urlEncomenda: base && !base.includes("localhost") ? urlPagamento(base, pagamentoToken) : undefined,
    email: empresa.email,
  });
  const expiraEm = agora + PRAZO_PAGAMENTO_MS;
  try {
    await ctx.runMutation(internal.pagamentos.registarPedido, {
      encomendaId,
      pagamentoToken,
      revolutOrderId: ordem.id,
      revolutToken: ordem.token,
      totalPagamentoCents: total,
      agora,
      expiraEm,
    });
  } catch (e) {
    // Header did not move (lines changed under us): do not leave a payable order behind.
    await cancelarOrdem(revolut, ordem.id).catch(() => undefined);
    throw e;
  }
  return { totalPagamentoCents: total, expiraEm };
}

/** Office `Voltar a editar`: cancel the Revolut order first, then move the header. */
export async function voltarAEditar(
  ctx: ActionCtx,
  encomendaId: Id<"installerOrders">,
): Promise<void> {
  const { revolutOrderId } = await ctx.runQuery(
    internal.pagamentos.encomendaParaVoltarAEditar,
    { encomendaId },
  );
  if (revolutOrderId) {
    const estado = await cancelarOrdem(revolutOuErro(), revolutOrderId);
    if (estado === "completed") {
      await ctx.runMutation(internal.pagamentos.aplicarEvento, {
        revolutOrderId,
        evento: "ORDER_COMPLETED",
        recebidoEm: Date.now(),
      });
      throw new Error("a encomenda já foi paga — não é possível voltar a editar");
    }
  }
  await ctx.runMutation(internal.pagamentos.voltarAEditar, { encomendaId });
}

export const pedirPagamentoAction = internalAction({
  args: { encomendaId: v.id("installerOrders") },
  returns: v.object({ totalPagamentoCents: v.number(), expiraEm: v.number() }),
  handler: async (ctx, args) => await pedirPagamento(ctx, args.encomendaId),
});

export const voltarAEditarAction = internalAction({
  args: { encomendaId: v.id("installerOrders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await voltarAEditar(ctx, args.encomendaId);
    return null;
  },
});

/** Best effort after an installer / office cancel while a Revolut order was open. */
export const cancelarOrdemRevolut = internalAction({
  args: { revolutOrderId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const revolut = clienteRevolutDoAmbiente();
    if (!revolut) return null;
    const estado = await cancelarOrdem(revolut, args.revolutOrderId);
    if (estado === "completed") {
      await ctx.runMutation(internal.pagamentos.aplicarEvento, {
        revolutOrderId: args.revolutOrderId,
        evento: "ORDER_COMPLETED",
        recebidoEm: Date.now(),
      });
    }
    return null;
  },
});

/**
 * Cron: orders past their payment window still `aguardando_pagamento` — a
 * webhook was missed. Ask Revolut for the order state and apply it.
 */
export const reconciliar = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const revolut = clienteRevolutDoAmbiente();
    if (!revolut) return null;
    const agora = Date.now();
    const pendentes = await ctx.runQuery(internal.pagamentos.pendentesExpirados, { agora });
    for (const pendente of pendentes) {
      try {
        const ordem = await obterOrdem(revolut, pendente.revolutOrderId);
        const evento = eventoDoEstadoRevolut(ordem.state);
        if (evento === null) continue;
        await ctx.runMutation(internal.pagamentos.aplicarEvento, {
          revolutOrderId: pendente.revolutOrderId,
          evento,
          recebidoEm: agora,
        });
      } catch (e) {
        console.error(`Revolut reconciliation failed for ${pendente.revolutOrderId}:`, e);
      }
    }
    return null;
  },
});

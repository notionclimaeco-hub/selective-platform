import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  estadoEncomendaValidator,
  estadoLinhaValidator,
  motivoCancelamentoValidator,
} from "./schema";
import { getInstallerContext, requireInstaller } from "./lib/auth";
import { precoRevendaCents } from "./lib/precoRevenda";
import {
  assertPodeCancelar,
  assertPodeEditarLinhas,
  assertPodePedirStock,
  assertQty,
  estadoLinhaAposQty,
  IVA_PADRAO_PERCENT,
  linhasRestantes,
  MAX_LINHAS_ENCOMENDA,
  MAX_QTY_LINHA,
  tituloEncomenda,
  totalRestanteCents,
  type MotivoCancelamento,
} from "./lib/encomendaEstados";

/**
 * Installer orders (#5). Public functions serve members of an approved
 * installer company. Office actions are `internalMutation`s for now — the
 * office desk is Notion (#12) and arrives in a later slice.
 */

const CONTADOR = "encomendas";
const MAX_CELULAS_TIER = 200;

type DbCtx = QueryCtx | MutationCtx;

// --- installer-facing shapes ------------------------------------------------

const encomendaValidator = v.object({
  _id: v.id("installerOrders"),
  numero: v.number(),
  titulo: v.string(),
  estado: estadoEncomendaValidator,
  cancelReason: v.optional(motivoCancelamentoValidator),
  placedAt: v.number(),
  totalRevendaCents: v.number(),
  ivaPercent: v.number(),
  nLinhas: v.number(),
});

// No `custoCents`, no qty buckets yet (post-pay view is a later slice).
const linhaValidator = v.object({
  _id: v.id("installerOrderLines"),
  ref: v.string(),
  marca: v.string(),
  nome: v.string(),
  qty: v.number(),
  precoRevendaCents: v.number(),
  pvpCents: v.number(),
  estadoLinha: estadoLinhaValidator,
});

const detalheValidator = encomendaValidator.extend({
  linhas: v.array(linhaValidator),
});

function paraCliente(
  doc: Doc<"installerOrders">,
  nLinhas: number,
) {
  return {
    _id: doc._id,
    numero: doc.numero,
    titulo: doc.titulo,
    estado: doc.estado,
    cancelReason: doc.cancelReason,
    placedAt: doc.placedAt,
    totalRevendaCents: doc.totalRevendaCents,
    ivaPercent: doc.ivaPercent,
    nLinhas,
  };
}

function linhaParaCliente(doc: Doc<"installerOrderLines">) {
  return {
    _id: doc._id,
    ref: doc.ref,
    marca: doc.marca,
    nome: doc.nome,
    qty: doc.qty,
    precoRevendaCents: doc.precoRevendaCents,
    pvpCents: doc.pvpCents,
    estadoLinha: doc.estadoLinha,
  };
}

// --- shared helpers -----------------------------------------------------------

async function linhasDe(
  ctx: DbCtx,
  encomendaId: Id<"installerOrders">,
): Promise<Array<Doc<"installerOrderLines">>> {
  return await ctx.db
    .query("installerOrderLines")
    .withIndex("by_encomendaId", (q) => q.eq("encomendaId", encomendaId))
    .take(MAX_LINHAS_ENCOMENDA);
}

async function encomendaOuErro(
  ctx: DbCtx,
  id: Id<"installerOrders">,
): Promise<Doc<"installerOrders">> {
  const doc = await ctx.db.get(id);
  if (!doc) throw new Error("Order not found");
  return doc;
}

async function linhaOuErro(
  ctx: DbCtx,
  id: Id<"installerOrderLines">,
): Promise<Doc<"installerOrderLines">> {
  const doc = await ctx.db.get(id);
  if (!doc) throw new Error("Order line not found");
  return doc;
}

async function vistaCliente(ctx: DbCtx, encomenda: Doc<"installerOrders">) {
  const linhas = await linhasDe(ctx, encomenda._id);
  return paraCliente(encomenda, linhasRestantes(linhas).length);
}

async function mapaDescontos(
  ctx: DbCtx,
  tierId: Id<"tiers">,
): Promise<Map<string, number>> {
  const cells = await ctx.db
    .query("tierDescontos")
    .withIndex("by_tier", (q) => q.eq("tierId", tierId))
    .take(MAX_CELULAS_TIER);
  return new Map(cells.map((c) => [c.marca, c.descontoPercent]));
}

/** Published SKU + current reseller snapshot for one line. */
async function resolverSku(
  ctx: DbCtx,
  ref: string,
  descontos: Map<string, number>,
): Promise<{
  ref: string;
  marca: string;
  nome: string;
  pvpCents: number;
  precoRevendaCents: number;
}> {
  const produto = await ctx.db
    .query("produtos")
    .withIndex("by_ref", (q) => q.eq("ref", ref))
    .unique();
  if (!produto || produto.estado !== "publicado") {
    throw new Error(`Unknown or unpublished product: ${ref}`);
  }
  return {
    ref: produto.ref,
    marca: produto.marca,
    nome: produto.nome,
    pvpCents: produto.pvpCents,
    precoRevendaCents: precoRevendaCents(
      produto.pvpCents,
      descontos.get(produto.marca) ?? 0,
    ),
  };
}

/** Merge duplicate refs from the quote list and validate qty/limits. */
function normalizarLinhas(
  entrada: ReadonlyArray<{ ref: string; qty: number }>,
): Array<{ ref: string; qty: number }> {
  const porRef = new Map<string, number>();
  for (const item of entrada) {
    const ref = item.ref.trim();
    if (ref.length === 0) throw new Error("Product ref is required");
    const qty = assertQty(item.qty);
    porRef.set(ref, Math.min(MAX_QTY_LINHA, (porRef.get(ref) ?? 0) + qty));
  }
  if (porRef.size === 0) throw new Error("Quote list is empty");
  if (porRef.size > MAX_LINHAS_ENCOMENDA) {
    throw new Error(`Too many lines (max ${MAX_LINHAS_ENCOMENDA})`);
  }
  return [...porRef].map(([ref, qty]) => ({ ref, qty }));
}

async function proximoNumero(ctx: MutationCtx): Promise<number> {
  const row = await ctx.db
    .query("counters")
    .withIndex("by_chave", (q) => q.eq("chave", CONTADOR))
    .unique();
  if (row === null) {
    await ctx.db.insert("counters", { chave: CONTADOR, valor: 1 });
    return 1;
  }
  const valor = row.valor + 1;
  await ctx.db.patch(row._id, { valor });
  return valor;
}

async function recalcularTotal(
  ctx: MutationCtx,
  encomendaId: Id<"installerOrders">,
): Promise<Array<Doc<"installerOrderLines">>> {
  const linhas = await linhasDe(ctx, encomendaId);
  await ctx.db.patch(encomendaId, {
    totalRevendaCents: totalRestanteCents(linhas),
  });
  return linhas;
}

async function cancelar_(
  ctx: MutationCtx,
  encomenda: Doc<"installerOrders">,
  cancelReason: MotivoCancelamento,
  cancelledBy: string,
): Promise<Doc<"installerOrders">> {
  assertPodeCancelar(encomenda.estado);
  await ctx.db.patch(encomenda._id, {
    estado: "cancelada",
    cancelReason,
    cancelledAt: Date.now(),
    cancelledBy,
  });
  return await encomendaOuErro(ctx, encomenda._id);
}

// --- installer member ---------------------------------------------------------

/**
 * Approved member submits the quote list → header `recebida`, every line
 * `por_confirmar`, snapshot = reseller price now.
 */
export const submeter = mutation({
  args: {
    linhas: v.array(v.object({ ref: v.string(), qty: v.number() })),
  },
  returns: v.object({
    encomendaId: v.id("installerOrders"),
    numero: v.number(),
  }),
  handler: async (ctx, args) => {
    const installer = await requireInstaller(ctx);
    const tierId = installer.company.tierId;
    if (tierId === undefined) {
      throw new Error("Approved company has no commercial tier");
    }

    const pedidas = normalizarLinhas(args.linhas);
    const descontos = await mapaDescontos(ctx, tierId);
    const skus = [];
    for (const pedida of pedidas) {
      const sku = await resolverSku(ctx, pedida.ref, descontos);
      skus.push({ ...sku, qty: pedida.qty });
    }

    const numero = await proximoNumero(ctx);
    const encomendaId = await ctx.db.insert("installerOrders", {
      empresaId: installer.company._id,
      clerkOrgId: installer.orgId,
      numero,
      titulo: tituloEncomenda(numero, installer.company.nomeLegal),
      estado: "recebida",
      placedBy: installer.identity.subject,
      placedAt: Date.now(),
      totalRevendaCents: skus.reduce(
        (acc, s) => acc + s.precoRevendaCents * s.qty,
        0,
      ),
      ivaPercent: IVA_PADRAO_PERCENT,
    });

    for (const sku of skus) {
      await ctx.db.insert("installerOrderLines", {
        encomendaId,
        ...sku,
        estadoLinha: "por_confirmar",
      });
    }

    return { encomendaId, numero };
  },
});

/** Installer cancels the whole order — only before `paga`. */
export const cancelar = mutation({
  args: { encomendaId: v.id("installerOrders") },
  returns: encomendaValidator,
  handler: async (ctx, args) => {
    const installer = await requireInstaller(ctx);
    const encomenda = await encomendaOuErro(ctx, args.encomendaId);
    if (encomenda.empresaId !== installer.company._id) {
      throw new Error("Order not found");
    }
    const cancelada = await cancelar_(
      ctx,
      encomenda,
      "installer",
      installer.identity.subject,
    );
    return await vistaCliente(ctx, cancelada);
  },
});

export const minhas = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(encomendaValidator),
  handler: async (ctx, args) => {
    const installer = await requireInstaller(ctx);
    const resultado = await ctx.db
      .query("installerOrders")
      .withIndex("by_empresaId", (q) =>
        q.eq("empresaId", installer.company._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const page = [];
    for (const encomenda of resultado.page) {
      page.push(await vistaCliente(ctx, encomenda));
    }
    return { ...resultado, page };
  },
});

/** Null when the order does not exist or belongs to another company. */
export const obter = query({
  args: { encomendaId: v.id("installerOrders") },
  returns: v.union(detalheValidator, v.null()),
  handler: async (ctx, args) => {
    const installer = await getInstallerContext(ctx);
    if (installer === null || installer.company.estadoAprovacao !== "aprovada") {
      return null;
    }
    const encomenda = await ctx.db.get(args.encomendaId);
    if (!encomenda || encomenda.empresaId !== installer.company._id) {
      return null;
    }
    const linhas = await linhasDe(ctx, encomenda._id);
    return {
      ...paraCliente(encomenda, linhasRestantes(linhas).length),
      linhas: linhas.map(linhaParaCliente),
    };
  },
});

// --- office (internal until the Notion desk lands, #12) -----------------------

export const pedirStock = internalMutation({
  args: { encomendaId: v.id("installerOrders") },
  returns: encomendaValidator,
  handler: async (ctx, args) => {
    const encomenda = await encomendaOuErro(ctx, args.encomendaId);
    assertPodePedirStock(encomenda.estado);
    await ctx.db.patch(encomenda._id, {
      estado: "aguardando_stock",
      stockRequestedAt: Date.now(),
    });
    return await vistaCliente(ctx, await encomendaOuErro(ctx, encomenda._id));
  },
});

export const cancelarPeloEscritorio = internalMutation({
  args: { encomendaId: v.id("installerOrders"), por: v.string() },
  returns: encomendaValidator,
  handler: async (ctx, args) => {
    const encomenda = await encomendaOuErro(ctx, args.encomendaId);
    const cancelada = await cancelar_(ctx, encomenda, "office", args.por);
    return await vistaCliente(ctx, cancelada);
  },
});

export const confirmarLinha = internalMutation({
  args: {
    linhaId: v.id("installerOrderLines"),
    custoCents: v.optional(v.number()),
  },
  returns: linhaValidator,
  handler: async (ctx, args) => {
    const linha = await linhaOuErro(ctx, args.linhaId);
    const encomenda = await encomendaOuErro(ctx, linha.encomendaId);
    assertPodeEditarLinhas(encomenda.estado);
    if (linha.estadoLinha === "retirada") {
      throw new Error("Cannot confirm a dropped line");
    }
    if (
      args.custoCents !== undefined &&
      (!Number.isInteger(args.custoCents) || args.custoCents < 0)
    ) {
      throw new Error("custoCents must be a non-negative integer");
    }
    await ctx.db.patch(linha._id, {
      estadoLinha: "confirmada",
      ...(args.custoCents !== undefined ? { custoCents: args.custoCents } : {}),
    });
    return linhaParaCliente(await linhaOuErro(ctx, linha._id));
  },
});

/** Drop a line. Dropping the last remaining line cancels the header. */
export const retirarLinha = internalMutation({
  args: { linhaId: v.id("installerOrderLines") },
  returns: encomendaValidator,
  handler: async (ctx, args) => {
    const linha = await linhaOuErro(ctx, args.linhaId);
    const encomenda = await encomendaOuErro(ctx, linha.encomendaId);
    assertPodeEditarLinhas(encomenda.estado);
    if (linha.estadoLinha !== "retirada") {
      await ctx.db.patch(linha._id, { estadoLinha: "retirada" });
    }
    const linhas = await recalcularTotal(ctx, encomenda._id);
    if (linhasRestantes(linhas).length === 0) {
      const cancelada = await cancelar_(
        ctx,
        await encomendaOuErro(ctx, encomenda._id),
        "all_lines_dropped",
        "system",
      );
      return await vistaCliente(ctx, cancelada);
    }
    return await vistaCliente(ctx, await encomendaOuErro(ctx, encomenda._id));
  },
});

export const alterarQtyLinha = internalMutation({
  args: { linhaId: v.id("installerOrderLines"), qty: v.number() },
  returns: linhaValidator,
  handler: async (ctx, args) => {
    const qty = assertQty(args.qty);
    const linha = await linhaOuErro(ctx, args.linhaId);
    const encomenda = await encomendaOuErro(ctx, linha.encomendaId);
    assertPodeEditarLinhas(encomenda.estado);
    await ctx.db.patch(linha._id, {
      qty,
      estadoLinha: estadoLinhaAposQty(linha.estadoLinha, linha.qty, qty),
    });
    await recalcularTotal(ctx, encomenda._id);
    return linhaParaCliente(await linhaOuErro(ctx, linha._id));
  },
});

/** Add a SKU at the *current* reseller price. Revives a dropped line of the same ref. */
export const adicionarLinha = internalMutation({
  args: {
    encomendaId: v.id("installerOrders"),
    ref: v.string(),
    qty: v.number(),
  },
  returns: linhaValidator,
  handler: async (ctx, args) => {
    const qty = assertQty(args.qty);
    const encomenda = await encomendaOuErro(ctx, args.encomendaId);
    assertPodeEditarLinhas(encomenda.estado);

    const empresa = await ctx.db.get(encomenda.empresaId);
    if (!empresa || empresa.tierId === undefined) {
      throw new Error("Company has no commercial tier");
    }
    const sku = await resolverSku(
      ctx,
      args.ref.trim(),
      await mapaDescontos(ctx, empresa.tierId),
    );

    const existente = await ctx.db
      .query("installerOrderLines")
      .withIndex("by_encomenda_and_ref", (q) =>
        q.eq("encomendaId", encomenda._id).eq("ref", sku.ref),
      )
      .unique();
    if (existente && existente.estadoLinha !== "retirada") {
      throw new Error(`SKU already on this order: ${sku.ref}`);
    }

    const campos = { ...sku, qty, estadoLinha: "por_confirmar" as const };
    let linhaId: Id<"installerOrderLines">;
    if (existente) {
      await ctx.db.patch(existente._id, { ...campos, custoCents: undefined });
      linhaId = existente._id;
    } else {
      const linhas = await linhasDe(ctx, encomenda._id);
      if (linhas.length >= MAX_LINHAS_ENCOMENDA) {
        throw new Error(`Too many lines (max ${MAX_LINHAS_ENCOMENDA})`);
      }
      linhaId = await ctx.db.insert("installerOrderLines", {
        encomendaId: encomenda._id,
        ...campos,
      });
    }

    await recalcularTotal(ctx, encomenda._id);
    return linhaParaCliente(await linhaOuErro(ctx, linhaId));
  },
});

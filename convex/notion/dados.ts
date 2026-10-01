import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { notionBaseValidator } from "../schema";
import { MAX_LINHAS_ENCOMENDA } from "../lib/encomendaEstados";

/**
 * Database access for the Notion desk actions. Actions cannot touch the
 * database, so everything they read or write goes through here.
 */

const MAX_BASES = 4;
const MAX_ENCOMENDAS_ABERTAS = 200;

export const baseValidator = v.object({
  chave: notionBaseValidator,
  databaseId: v.string(),
  dataSourceId: v.string(),
});

export async function carregarBases(
  ctx: QueryCtx,
): Promise<Array<{ chave: Doc<"notionBases">["chave"]; databaseId: string; dataSourceId: string }>> {
  const docs = await ctx.db.query("notionBases").take(MAX_BASES);
  return docs.map((d) => ({
    chave: d.chave,
    databaseId: d.databaseId,
    dataSourceId: d.dataSourceId,
  }));
}

export const bases = internalQuery({
  args: {},
  returns: v.array(baseValidator),
  handler: async (ctx) => await carregarBases(ctx),
});

export const guardarBase = internalMutation({
  args: baseValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    const existente = await ctx.db
      .query("notionBases")
      .withIndex("by_chave", (q) => q.eq("chave", args.chave))
      .unique();
    if (existente) {
      await ctx.db.patch(existente._id, {
        databaseId: args.databaseId,
        dataSourceId: args.dataSourceId,
      });
    } else {
      await ctx.db.insert("notionBases", args);
    }
    return null;
  },
});

/**
 * Everything a render needs, in one read. Internal-only; the full documents
 * are returned as typed by the schema (no `returns` validator on purpose).
 */
export const paraRender = internalQuery({
  args: { encomendaId: v.id("installerOrders") },
  handler: async (ctx, args) => {
    const encomenda = await ctx.db.get(args.encomendaId);
    if (!encomenda) return null;
    const empresa = await ctx.db.get(encomenda.empresaId);
    if (!empresa) return null;
    const linhas = await ctx.db
      .query("installerOrderLines")
      .withIndex("by_encomendaId", (q) => q.eq("encomendaId", encomenda._id))
      .take(MAX_LINHAS_ENCOMENDA);
    const marcas = await ctx.db.query("marcas").take(50);
    return {
      encomenda,
      linhas,
      empresa: { nomeLegal: empresa.nomeLegal, nif: empresa.nif },
      marcas: marcas.map((m) => ({ slug: m.slug, nome: m.nome })),
      bases: await carregarBases(ctx),
    };
  },
});

export const guardarPaginas = internalMutation({
  args: {
    encomendaId: v.id("installerOrders"),
    encomendaPageId: v.optional(v.string()),
    linhas: v.array(
      v.object({ linhaId: v.id("installerOrderLines"), pageId: v.string() }),
    ),
    agora: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const encomenda = await ctx.db.get(args.encomendaId);
    if (!encomenda) return null;
    await ctx.db.patch(encomenda._id, {
      ...(args.encomendaPageId ? { notionPageId: args.encomendaPageId } : {}),
      notionSyncAt: args.agora,
      notionErro: undefined,
    });
    for (const l of args.linhas) {
      const linha = await ctx.db.get(l.linhaId);
      if (linha && linha.encomendaId === encomenda._id) {
        await ctx.db.patch(linha._id, { notionPageId: l.pageId });
      }
    }
    return null;
  },
});

export const registarErro = internalMutation({
  args: { encomendaId: v.id("installerOrders"), erro: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const encomenda = await ctx.db.get(args.encomendaId);
    if (encomenda) {
      await ctx.db.patch(encomenda._id, { notionErro: args.erro.slice(0, 500) });
    }
    return null;
  },
});

export const encomendaPorPagina = internalQuery({
  args: { pageId: v.string() },
  returns: v.union(v.null(), v.id("installerOrders")),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("installerOrders")
      .withIndex("by_notionPageId", (q) => q.eq("notionPageId", args.pageId))
      .unique();
    return doc?._id ?? null;
  },
});

export const linhaPorPagina = internalQuery({
  args: { pageId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      linhaId: v.id("installerOrderLines"),
      encomendaId: v.id("installerOrders"),
    }),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("installerOrderLines")
      .withIndex("by_notionPageId", (q) => q.eq("notionPageId", args.pageId))
      .unique();
    return doc ? { linhaId: doc._id, encomendaId: doc.encomendaId } : null;
  },
});

/** Adopt a row the office created by hand. Returns the row it replaced, if any. */
export const ligarLinha = internalMutation({
  args: { linhaId: v.id("installerOrderLines"), pageId: v.string() },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const linha = await ctx.db.get(args.linhaId);
    if (!linha) return null;
    await ctx.db.patch(linha._id, { notionPageId: args.pageId });
    return linha.notionPageId ?? null;
  },
});

/** Orders whose desk ticket may still change — for the reconciliation sweep. */
export const encomendasAbertas = internalQuery({
  args: {},
  returns: v.array(v.id("installerOrders")),
  handler: async (ctx) => {
    const ids: Array<Doc<"installerOrders">["_id"]> = [];
    for (const estado of [
      "recebida",
      "aguardando_stock",
      "aguardando_pagamento",
      "paga",
      "pronta_a_levantar",
    ] as const) {
      const docs = await ctx.db
        .query("installerOrders")
        .withIndex("by_estado", (q) => q.eq("estado", estado))
        .take(MAX_ENCOMENDAS_ABERTAS);
      ids.push(...docs.map((d) => d._id));
    }
    // Recently closed orders whose last render failed still need a retry.
    const falhadas = await ctx.db
      .query("installerOrders")
      .withIndex("by_estado", (q) => q.eq("estado", "cancelada"))
      .order("desc")
      .take(50);
    ids.push(
      ...falhadas
        .filter((d) => d.notionErro !== undefined || d.notionPageId === undefined)
        .map((d) => d._id),
    );
    return ids;
  },
});

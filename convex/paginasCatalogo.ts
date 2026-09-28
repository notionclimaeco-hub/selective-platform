import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireStaff } from "./lib/auth";

/**
 * Idempotent upsert of a catalog page. Shared business logic (called by the
 * staff mutation and the bulk importer). Enforces uniqueness on
 * (tabelaOrigem, pagina): replaces the old file when the slot already exists so
 * re-uploads don't accumulate orphan storage files.
 */
export async function upsertPagina(
  ctx: MutationCtx,
  args: { tabelaOrigem: string; pagina: number; ficheiro: Id<"_storage"> },
): Promise<{ paginaId: Id<"paginasCatalogo">; substituido: boolean }> {
  const existente = await ctx.db
    .query("paginasCatalogo")
    .withIndex("by_tabela_pagina", (q) =>
      q.eq("tabelaOrigem", args.tabelaOrigem).eq("pagina", args.pagina),
    )
    .unique();

  if (existente) {
    if (existente.ficheiro !== undefined && existente.ficheiro !== args.ficheiro) {
      await ctx.storage.delete(existente.ficheiro);
    }
    await ctx.db.patch(existente._id, { ficheiro: args.ficheiro });
    return { paginaId: existente._id, substituido: existente.ficheiro !== undefined };
  }

  const paginaId = await ctx.db.insert("paginasCatalogo", {
    tabelaOrigem: args.tabelaOrigem,
    pagina: args.pagina,
    ficheiro: args.ficheiro,
  });
  return { paginaId, substituido: false };
}

/**
 * Staff-only: get a short-lived URL to upload a one-page catalog PDF to Convex
 * file storage. The returned storageId is then passed to `upsert`.
 */
export const gerarUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireStaff(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Staff-only: attach an uploaded PDF to a (tabelaOrigem, pagina) slot.
 *
 * Enforces uniqueness on (tabelaOrigem, pagina): if a row already exists, its
 * previous storage file is deleted and the row is repointed at the new file,
 * making re-uploads idempotent. Otherwise a new row is inserted.
 */
export const upsert = mutation({
  args: {
    tabelaOrigem: v.string(),
    pagina: v.number(),
    ficheiro: v.id("_storage"),
  },
  returns: v.object({
    paginaId: v.id("paginasCatalogo"),
    substituido: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    return await upsertPagina(ctx, args);
  },
});

/**
 * Staff-only: list uploaded pages for a table, sorted by page number, with a
 * resolved download URL so the admin can see which pages exist.
 */
export const listarPorTabela = query({
  args: { tabelaOrigem: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("paginasCatalogo"),
      pagina: v.number(),
      url: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const linhas = await ctx.db
      .query("paginasCatalogo")
      .withIndex("by_tabela_pagina", (q) =>
        q.eq("tabelaOrigem", args.tabelaOrigem),
      )
      .collect();

    linhas.sort((a, b) => a.pagina - b.pagina);

    return await Promise.all(
      linhas.map(async (linha) => ({
        _id: linha._id,
        pagina: linha.pagina,
        url:
          linha.ficheiro === undefined
            ? null
            : await ctx.storage.getUrl(linha.ficheiro),
      })),
    );
  },
});

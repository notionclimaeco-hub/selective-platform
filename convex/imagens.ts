import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireStaff } from "./lib/auth";
import { sincronizarGrupo } from "./lib/catalogoGrupos";
import { conferirSegredo } from "./lib/importSecret";
import { ficheirosEscolhidos } from "./lib/imagensGrupo";
import { fonteCandidataValidator } from "./schema";

/**
 * Staff-only image management for products.
 *
 * Images live in Convex file storage and are referenced from
 * `produtos.imagens` (ordered, first = cover). Variants of the same
 * `grupoModelo` usually share the exact same photos, so `definirImagens`
 * supports fanning the same list out to every variant of the group — the file
 * is stored once and referenced by many products.
 */

/**
 * Shared business logic for replacing a product's image list. Used by the
 * staff-gated mutation and the secret-guarded bulk importer.
 */
export async function definirImagensProduto(
  ctx: MutationCtx,
  args: {
    ref: string;
    imagens: Array<Id<"_storage">>;
    aplicarAoGrupo?: boolean;
  },
): Promise<{ produtosAtualizados: number; ficheirosRemovidos: number }> {
  const produto = await ctx.db
    .query("produtos")
    .withIndex("by_ref", (q) => q.eq("ref", args.ref))
    .unique();
  if (!produto) {
    throw new Error(`Produto "${args.ref}" não encontrado.`);
  }

  // Dedupe while preserving order (first entry stays the cover) and check
  // that every referenced file actually exists in storage.
  const novas: Array<Id<"_storage">> = [];
  for (const ficheiro of args.imagens) {
    if (novas.includes(ficheiro)) continue;
    const meta = await ctx.db.system.get(ficheiro);
    if (meta === null) {
      throw new Error(`Ficheiro ${ficheiro} não existe no storage.`);
    }
    novas.push(ficheiro);
  }

  // Which products get this list: the whole family or just the one.
  let alvos: Array<Doc<"produtos">>;
  if (args.aplicarAoGrupo === true) {
    const grupoModelo = produto.grupoModelo;
    alvos = await ctx.db
      .query("produtos")
      .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", grupoModelo))
      .collect();
  } else {
    alvos = [produto];
  }

  // Files referenced by the targets before the change — candidates for
  // deletion if nothing references them afterwards.
  const candidatos = new Set<Id<"_storage">>();
  for (const alvo of alvos) {
    for (const ficheiro of alvo.imagens) candidatos.add(ficheiro);
  }
  for (const ficheiro of novas) candidatos.delete(ficheiro);

  let produtosAtualizados = 0;
  for (const alvo of alvos) {
    const igual =
      alvo.imagens.length === novas.length &&
      alvo.imagens.every((f, i) => f === novas[i]);
    if (igual) continue;
    await ctx.db.patch(alvo._id, { imagens: novas });
    produtosAtualizados++;
  }
  // The listing's cover (and "has photo" weight) come from these images.
  if (produtosAtualizados > 0) {
    await sincronizarGrupo(ctx, produto.grupoModelo);
  }

  // Orphan cleanup. Images can be shared across products (even outside the
  // group), so only delete files no longer referenced anywhere. The catalog
  // is small (hundreds of rows), so a full read is fine here.
  let ficheirosRemovidos = 0;
  if (candidatos.size > 0) {
    const referenciados = new Set<Id<"_storage">>();
    const todos = await ctx.db.query("produtos").collect();
    for (const p of todos) {
      for (const ficheiro of p.imagens) referenciados.add(ficheiro);
    }
    for (const ficheiro of candidatos) {
      if (referenciados.has(ficheiro)) continue;
      await ctx.storage.delete(ficheiro);
      ficheirosRemovidos++;
    }
  }

  return { produtosAtualizados, ficheirosRemovidos };
}

/**
 * Staff-only: get a short-lived URL to upload a product image to Convex file
 * storage. The resulting storageId is then passed to `definirImagens`.
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
 * Staff-only: a product's current images with resolved URLs, for the admin UI.
 * Returns null when the ref doesn't exist.
 */
export const listarPorRef = query({
  args: { ref: v.string() },
  returns: v.union(
    v.object({
      ref: v.string(),
      grupoModelo: v.optional(v.string()),
      imagens: v.array(
        v.object({
          ficheiro: v.id("_storage"),
          url: v.union(v.string(), v.null()),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const produto = await ctx.db
      .query("produtos")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .unique();
    if (!produto) return null;

    const imagens = await Promise.all(
      produto.imagens.map(async (ficheiro) => ({
        ficheiro,
        url: await ctx.storage.getUrl(ficheiro),
      })),
    );

    return { ref: produto.ref, grupoModelo: produto.grupoModelo, imagens };
  },
});

/**
 * Staff-only: replace a product's image list (order matters, first = cover).
 * Thin wrapper over `definirImagensProduto`.
 */
export const definirImagens = mutation({
  args: {
    ref: v.string(),
    imagens: v.array(v.id("_storage")),
    aplicarAoGrupo: v.optional(v.boolean()),
  },
  returns: v.object({
    produtosAtualizados: v.number(),
    ficheirosRemovidos: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    return await definirImagensProduto(ctx, args);
  },
});

// --- Candidatas (secret-guarded, filled by scripts/imagens/candidatas.mjs) --

const candidataEntradaValidator = v.object({
  marca: v.string(),
  grupoModelo: v.string(),
  ficheiro: v.id("_storage"),
  fonte: fonteCandidataValidator,
  origemUrl: v.optional(v.string()),
  hash: v.string(),
  largura: v.number(),
  altura: v.number(),
  cor: v.optional(v.string()),
  // For "recorte" rows uploaded by the script: hash of the source candidate.
  origemHash: v.optional(v.string()),
});

async function candidataPorHash(ctx: MutationCtx, hash: string) {
  return await ctx.db
    .query("imagensCandidatas")
    .withIndex("by_hash", (q) => q.eq("hash", hash))
    .first();
}

/**
 * Upsert candidate photos by hash. A hash already known keeps its original
 * file (the new upload is deleted) and only refreshes origemUrl/cor. Batches
 * of ≤ 50 from the upload script.
 */
export const registarCandidatas = mutation({
  args: { secret: v.string(), candidatas: v.array(candidataEntradaValidator) },
  returns: v.object({ criadas: v.number(), repetidas: v.number() }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    let criadas = 0;
    let repetidas = 0;
    const agora = Date.now();
    for (const c of args.candidatas) {
      if (c.largura <= 0 || c.altura <= 0) {
        throw new Error(`candidata ${c.hash}: dimensões inválidas.`);
      }
      if ((await ctx.db.system.get(c.ficheiro)) === null) {
        throw new Error(`candidata ${c.hash}: ficheiro ${c.ficheiro} não existe.`);
      }
      const existente = await candidataPorHash(ctx, c.hash);
      if (existente) {
        repetidas++;
        const patch: { origemUrl?: string; cor?: string } = {};
        if (c.origemUrl !== undefined) patch.origemUrl = c.origemUrl;
        if (c.cor !== undefined) patch.cor = c.cor;
        if (Object.keys(patch).length > 0) await ctx.db.patch(existente._id, patch);
        if (existente.ficheiro !== c.ficheiro) await ctx.storage.delete(c.ficheiro);
        continue;
      }
      const origem =
        c.origemHash !== undefined
          ? ((await candidataPorHash(ctx, c.origemHash))?._id ?? undefined)
          : undefined;
      await ctx.db.insert("imagensCandidatas", {
        marca: c.marca,
        grupoModelo: c.grupoModelo,
        ficheiro: c.ficheiro,
        fonte: c.fonte,
        origemUrl: c.origemUrl,
        hash: c.hash,
        largura: c.largura,
        altura: c.altura,
        cor: c.cor,
        origem,
        criadoEm: agora,
      });
      criadas++;
    }
    return { criadas, repetidas };
  },
});

/** Files any decision or any live product still references. */
async function ficheirosEmUso(ctx: MutationCtx, marca: string): Promise<Set<Id<"_storage">>> {
  const emUso = new Set<Id<"_storage">>();
  const decisoes = await ctx.db
    .query("imagensGrupo")
    .withIndex("by_marca", (q) => q.eq("marca", marca))
    .collect();
  for (const d of decisoes) for (const f of ficheirosEscolhidos(d)) emUso.add(f);
  const produtos = await ctx.db
    .query("produtos")
    .withIndex("by_marca", (q) => q.eq("marca", marca))
    .collect();
  for (const p of produtos) for (const f of p.imagens) emUso.add(f);
  return emUso;
}

/** Delete a brand's candidates (rows + files) except chosen or live ones. */
export const limparCandidatas = mutation({
  args: { secret: v.string(), marca: v.string(), fonte: v.optional(fonteCandidataValidator) },
  returns: v.object({ removidas: v.number() }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    const emUso = await ficheirosEmUso(ctx, args.marca);
    const candidatas = await ctx.db
      .query("imagensCandidatas")
      .withIndex("by_marca", (q) => q.eq("marca", args.marca))
      .collect();
    let removidas = 0;
    for (const c of candidatas) {
      if (args.fonte !== undefined && c.fonte !== args.fonte) continue;
      if (emUso.has(c.ficheiro)) continue;
      await ctx.storage.delete(c.ficheiro);
      await ctx.db.delete(c._id);
      removidas++;
    }
    return { removidas };
  },
});

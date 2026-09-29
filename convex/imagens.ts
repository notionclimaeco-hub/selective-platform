import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireStaff } from "./lib/auth";
import { sincronizarGrupo } from "./lib/catalogoGrupos";
import { conferirSegredo } from "./lib/importSecret";
import { ficheirosEscolhidos, validarPorRef } from "./lib/imagensGrupo";
import { fonteCandidataValidator, porRefValidator } from "./schema";

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
    // Files still held as candidates or by a group decision are not orphans.
    // Scoped by brand, not group: sibling groups (conjunto vs unidade-interior)
    // can hold the same packshot.
    const candidatas = await ctx.db
      .query("imagensCandidatas")
      .withIndex("by_marca", (q) => q.eq("marca", produto.marca))
      .collect();
    for (const c of candidatas) referenciados.add(c.ficheiro);
    const decisoes = await ctx.db
      .query("imagensGrupo")
      .withIndex("by_marca", (q) => q.eq("marca", produto.marca))
      .collect();
    for (const d of decisoes) for (const f of ficheirosEscolhidos(d)) referenciados.add(f);
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
    const identity = await requireStaff(ctx);
    const r = await definirImagensProduto(ctx, args);
    if (args.aplicarAoGrupo === true) {
      const produto = await ctx.db
        .query("produtos")
        .withIndex("by_ref", (q) => q.eq("ref", args.ref))
        .unique();
      if (produto) {
        await gravarDecisao(ctx, {
          grupoModelo: produto.grupoModelo, marca: produto.marca,
          imagens: args.imagens, porRef: undefined, por: identity.subject,
        });
      }
    }
    return r;
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

/** A candidate is identified by (grupoModelo, hash): the same bytes may be a candidate in several groups. */
async function candidataPorHash(ctx: MutationCtx, grupoModelo: string, hash: string) {
  return await ctx.db
    .query("imagensCandidatas")
    .withIndex("by_grupo_hash", (q) => q.eq("grupoModelo", grupoModelo).eq("hash", hash))
    .first();
}

/**
 * Upsert candidate photos by (grupoModelo, hash). A hash already known in the
 * group keeps its original file (the new upload is deleted) and only refreshes origemUrl/cor. Batches
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
      const existente = await candidataPorHash(ctx, c.grupoModelo, c.hash);
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
          ? ((await candidataPorHash(ctx, c.grupoModelo, c.origemHash))?._id ?? undefined)
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

/** Files any decision or any product of the brand still references. */
export async function ficheirosEmUso(ctx: MutationCtx, marca: string): Promise<Set<Id<"_storage">>> {
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

/**
 * Brand-wide set of files that must not be deleted as orphans: products +
 * decisions (`ficheirosEmUso`) plus every file held as a candidate row.
 */
export async function ficheirosDaMarca(
  ctx: MutationCtx,
  marca: string,
): Promise<Set<Id<"_storage">>> {
  const out = await ficheirosEmUso(ctx, marca);
  const candidatas = await ctx.db
    .query("imagensCandidatas")
    .withIndex("by_marca", (q) => q.eq("marca", marca))
    .collect();
  for (const c of candidatas) out.add(c.ficheiro);
  return out;
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

// --- Decisão por grupo (staff, página de revisão) ---------------------------

async function gravarDecisao(
  ctx: MutationCtx,
  d: {
    grupoModelo: string;
    marca: string;
    imagens: Array<Id<"_storage">>;
    porRef: Array<{ ref: string; imagens: Array<Id<"_storage">> }> | undefined;
    por: string;
  },
): Promise<void> {
  const imagens = [...new Set(d.imagens)];
  const porRef = d.porRef?.map((p) => ({ ref: p.ref, imagens: [...new Set(p.imagens)] }));
  for (const f of [...imagens, ...(porRef ?? []).flatMap((p) => p.imagens)]) {
    if ((await ctx.db.system.get(f)) === null) {
      throw new Error(`Ficheiro ${f} não existe no storage.`);
    }
  }
  const atual = await ctx.db
    .query("imagensGrupo")
    .withIndex("by_grupo", (q) => q.eq("grupoModelo", d.grupoModelo))
    .unique();
  const doc = {
    grupoModelo: d.grupoModelo, marca: d.marca, imagens,
    porRef: porRef && porRef.length > 0 ? porRef : undefined,
    atualizadoEm: Date.now(), atualizadoPor: d.por,
  };
  if (atual) await ctx.db.replace(atual._id, doc);
  else await ctx.db.insert("imagensGrupo", doc);
}

const imagemUrlValidator = v.object({ ficheiro: v.id("_storage"), url: v.union(v.string(), v.null()) });

async function comUrls(ctx: QueryCtx, ficheiros: ReadonlyArray<Id<"_storage">>) {
  return await Promise.all(
    ficheiros.map(async (ficheiro) => ({ ficheiro, url: await ctx.storage.getUrl(ficheiro) })),
  );
}

export const obterGrupoImagens = query({
  args: { grupoModelo: v.string() },
  returns: v.object({
    candidatas: v.array(
      v.object({
        _id: v.id("imagensCandidatas"),
        ficheiro: v.id("_storage"),
        url: v.union(v.string(), v.null()),
        fonte: fonteCandidataValidator,
        origemUrl: v.optional(v.string()),
        cor: v.optional(v.string()),
        origem: v.optional(v.id("imagensCandidatas")),
        recorteId: v.optional(v.id("imagensCandidatas")),
        largura: v.number(),
        altura: v.number(),
      }),
    ),
    escolhidas: v.union(
      v.null(),
      v.object({
        imagens: v.array(imagemUrlValidator),
        porRef: v.array(v.object({ ref: v.string(), imagens: v.array(imagemUrlValidator) })),
      }),
    ),
    atuais: v.array(v.object({ ref: v.string(), imagens: v.array(imagemUrlValidator) })),
  }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const rows = await ctx.db
      .query("imagensCandidatas")
      .withIndex("by_grupo", (q) => q.eq("grupoModelo", args.grupoModelo))
      .collect();
    const recortePor = new Map<Id<"imagensCandidatas">, Id<"imagensCandidatas">>();
    for (const r of rows) if (r.origem !== undefined) recortePor.set(r.origem, r._id);
    const candidatas = [];
    for (const r of rows) {
      candidatas.push({
        _id: r._id, ficheiro: r.ficheiro, url: await ctx.storage.getUrl(r.ficheiro),
        fonte: r.fonte, origemUrl: r.origemUrl, cor: r.cor, origem: r.origem,
        recorteId: recortePor.get(r._id), largura: r.largura, altura: r.altura,
      });
    }
    const decisao = await ctx.db
      .query("imagensGrupo")
      .withIndex("by_grupo", (q) => q.eq("grupoModelo", args.grupoModelo))
      .unique();
    const escolhidas = decisao
      ? {
          imagens: await comUrls(ctx, decisao.imagens),
          porRef: await Promise.all(
            (decisao.porRef ?? []).map(async (p) => ({ ref: p.ref, imagens: await comUrls(ctx, p.imagens) })),
          ),
        }
      : null;
    const produtos = await ctx.db
      .query("produtos")
      .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", args.grupoModelo))
      .collect();
    const atuais = [];
    for (const p of produtos) {
      if (p.imagens.length === 0) continue;
      atuais.push({ ref: p.ref, imagens: await comUrls(ctx, p.imagens) });
    }
    atuais.sort((a, b) => a.ref.localeCompare(b.ref));
    return { candidatas, escolhidas, atuais };
  },
});

export const definirImagensGrupo = mutation({
  args: {
    grupoModelo: v.string(),
    marca: v.string(),
    imagens: v.array(v.id("_storage")),
    porRef: v.optional(porRefValidator),
    refsDoGrupo: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireStaff(ctx);
    if (args.porRef) {
      const erro = validarPorRef(args.porRef, new Set(args.refsDoGrupo));
      if (erro) throw new Error(erro);
    }
    await gravarDecisao(ctx, { ...args, por: identity.subject, porRef: args.porRef });
    return null;
  },
});

export const adicionarCandidata = mutation({
  args: {
    marca: v.string(),
    grupoModelo: v.string(),
    ficheiro: v.id("_storage"),
    fonte: v.union(v.literal("upload"), v.literal("recorte")),
    origem: v.optional(v.id("imagensCandidatas")),
    largura: v.number(),
    altura: v.number(),
    hash: v.string(),
  },
  returns: v.object({ candidataId: v.id("imagensCandidatas") }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    if ((await ctx.db.system.get(args.ficheiro)) === null) {
      throw new Error(`Ficheiro ${args.ficheiro} não existe no storage.`);
    }
    const existente = await candidataPorHash(ctx, args.grupoModelo, args.hash);
    if (existente) {
      if (existente.ficheiro !== args.ficheiro) await ctx.storage.delete(args.ficheiro);
      return { candidataId: existente._id };
    }
    const candidataId = await ctx.db.insert("imagensCandidatas", {
      marca: args.marca, grupoModelo: args.grupoModelo, ficheiro: args.ficheiro, fonte: args.fonte,
      hash: args.hash, largura: args.largura, altura: args.altura, origem: args.origem, criadoEm: Date.now(),
    });
    return { candidataId };
  },
});

export const removerCandidata = mutation({
  args: { candidataId: v.id("imagensCandidatas") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const c = await ctx.db.get(args.candidataId);
    if (!c) return null;
    const emUso = await ficheirosEmUso(ctx, c.marca);
    if (emUso.has(c.ficheiro)) {
      throw new Error("Imagem em uso: está escolhida num grupo ou num produto.");
    }
    // A recorte of this candidate loses its link, nothing else.
    const filhos = await ctx.db
      .query("imagensCandidatas")
      .withIndex("by_grupo", (q) => q.eq("grupoModelo", c.grupoModelo))
      .collect();
    for (const f of filhos) if (f.origem === c._id) await ctx.db.patch(f._id, { origem: undefined });
    await ctx.storage.delete(c.ficheiro);
    await ctx.db.delete(c._id);
    return null;
  },
});

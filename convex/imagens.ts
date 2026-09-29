import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireStaff } from "./lib/auth";
import { sincronizarGrupo } from "./lib/catalogoGrupos";
import { conferirSegredo } from "./lib/importSecret";
import { AGENTE, ficheirosEscolhidos, validarPorRef } from "./lib/imagensGrupo";
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
    // Who edits (decision's atualizadoPor) and whether a group edit may
    // create the group's decision when none exists yet.
    por: string;
    criarDecisao: boolean;
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

  // Keep the group's decision in step, or the next approval re-applies the
  // old list over this edit (and deletes the file it just set).
  await sincronizarDecisao(ctx, produto, novas, args);

  // Orphan cleanup: only files nothing references any more (any brand).
  const ficheirosRemovidos = await apagarSemReferencia(ctx, candidatos);

  return { produtosAtualizados, ficheirosRemovidos };
}

/**
 * Mirror a products-page edit into the group's decision. A group edit writes
 * the group list and clears the overrides (creating the decision only when
 * `criarDecisao`); a single-variant edit, when a decision exists, becomes that
 * ref's override (dropped when it equals the group list).
 */
async function sincronizarDecisao(
  ctx: MutationCtx,
  produto: Doc<"produtos">,
  imagens: Array<Id<"_storage">>,
  args: { aplicarAoGrupo?: boolean; por: string; criarDecisao: boolean },
): Promise<void> {
  const atual = await ctx.db
    .query("imagensGrupo")
    .withIndex("by_grupo", (q) => q.eq("grupoModelo", produto.grupoModelo))
    .unique();
  if (args.aplicarAoGrupo === true) {
    if (atual === null && !args.criarDecisao) return;
    await gravarDecisao(ctx, {
      grupoModelo: produto.grupoModelo, marca: produto.marca,
      imagens, porRef: undefined, por: args.por,
    });
    return;
  }
  if (atual === null) return;
  // Rewrite the rest of the decision without files deleted meanwhile, so a
  // stale entry never blocks this edit.
  const doGrupo = await ficheirosExistentes(ctx, atual.imagens);
  const porRef = [];
  for (const p of atual.porRef ?? []) {
    if (p.ref !== produto.ref) porRef.push({ ref: p.ref, imagens: await ficheirosExistentes(ctx, p.imagens) });
  }
  const igualAoGrupo =
    doGrupo.length === imagens.length && doGrupo.every((f, i) => f === imagens[i]);
  if (!igualAoGrupo) porRef.push({ ref: produto.ref, imagens });
  await gravarDecisao(ctx, {
    grupoModelo: atual.grupoModelo, marca: atual.marca,
    imagens: doGrupo, porRef, por: args.por,
  });
}

/** The files of `lista` still in storage, order kept. */
export async function ficheirosExistentes(
  ctx: { db: QueryCtx["db"] },
  lista: ReadonlyArray<Id<"_storage">>,
): Promise<Array<Id<"_storage">>> {
  const out: Array<Id<"_storage">> = [];
  for (const f of lista) if ((await ctx.db.system.get(f)) !== null) out.push(f);
  return out;
}

/**
 * Every storage file a row still points at, across all brands: product
 * images, candidates, group decisions (list and overrides), catalog page
 * files and run PDFs. Cleanup paths only delete files outside this set.
 * (`catalogoGrupos.capa` is derived from product images, so not read.)
 */
export async function ficheirosReferenciados(
  ctx: { db: QueryCtx["db"] },
): Promise<Set<Id<"_storage">>> {
  const out = new Set<Id<"_storage">>();
  for await (const p of ctx.db.query("produtos")) for (const f of p.imagens) out.add(f);
  for await (const c of ctx.db.query("imagensCandidatas")) out.add(c.ficheiro);
  for await (const d of ctx.db.query("imagensGrupo")) for (const f of ficheirosEscolhidos(d)) out.add(f);
  for await (const pg of ctx.db.query("paginasCatalogo")) {
    if (pg.ficheiro !== undefined) out.add(pg.ficheiro);
    if (pg.imagem !== undefined) out.add(pg.imagem);
  }
  for await (const r of ctx.db.query("importacoes")) if (r.pdf !== undefined) out.add(r.pdf);
  return out;
}

/** Delete the given files that still exist and nothing references. Returns how many. */
export async function apagarSemReferencia(
  ctx: MutationCtx,
  ficheiros: Iterable<Id<"_storage">>,
): Promise<number> {
  const lista = [...new Set(ficheiros)];
  if (lista.length === 0) return 0;
  const referenciados = await ficheirosReferenciados(ctx);
  let removidos = 0;
  for (const f of lista) {
    if (referenciados.has(f)) continue;
    if ((await ctx.db.system.get(f)) === null) continue;
    await ctx.storage.delete(f);
    removidos++;
  }
  return removidos;
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
    return await definirImagensProduto(ctx, { ...args, por: identity.subject, criarDecisao: true });
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
  aviso: v.optional(v.string()),
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
        const patch: { origemUrl?: string; cor?: string; aviso?: string } = {};
        if (c.origemUrl !== undefined) patch.origemUrl = c.origemUrl;
        if (c.cor !== undefined) patch.cor = c.cor;
        if (c.aviso !== undefined && c.aviso !== existente.aviso) patch.aviso = c.aviso;
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
        aviso: c.aviso,
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
        aviso: v.optional(v.string()),
      }),
    ),
    escolhidas: v.union(
      v.null(),
      v.object({
        imagens: v.array(imagemUrlValidator),
        porRef: v.array(v.object({ ref: v.string(), imagens: v.array(imagemUrlValidator) })),
        // Saved by the agent's photo picks, not yet by a person.
        porAgente: v.boolean(),
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
        recorteId: recortePor.get(r._id), largura: r.largura, altura: r.altura, aviso: r.aviso,
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
          porAgente: decisao.atualizadoPor === AGENTE,
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

// --- Escolhas do agente (script, segredo) -----------------------------------

/**
 * Every group of a brand that has candidates, with their URLs, for the
 * agent's contact sheets (scripts/imagens/folhas.mjs). `escolhaHumana`: a
 * person already saved this group, so the agent's pick would be ignored.
 */
export const candidatasDaMarca = query({
  args: { secret: v.string(), marca: v.string() },
  returns: v.array(
    v.object({
      grupoModelo: v.string(),
      escolhaHumana: v.boolean(),
      candidatas: v.array(
        v.object({
          _id: v.id("imagensCandidatas"),
          ficheiro: v.id("_storage"),
          url: v.union(v.string(), v.null()),
          fonte: fonteCandidataValidator,
          origemUrl: v.optional(v.string()),
          cor: v.optional(v.string()),
          origem: v.optional(v.id("imagensCandidatas")),
          largura: v.number(),
          altura: v.number(),
          aviso: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    const rows = await ctx.db
      .query("imagensCandidatas")
      .withIndex("by_marca", (q) => q.eq("marca", args.marca))
      .collect();
    const porGrupo = new Map<string, Array<Doc<"imagensCandidatas">>>();
    for (const r of rows) porGrupo.set(r.grupoModelo, [...(porGrupo.get(r.grupoModelo) ?? []), r]);
    const decisoes = await ctx.db
      .query("imagensGrupo")
      .withIndex("by_marca", (q) => q.eq("marca", args.marca))
      .collect();
    const humanas = new Set(decisoes.filter((d) => d.atualizadoPor !== AGENTE).map((d) => d.grupoModelo));
    const out = [];
    for (const [grupoModelo, lista] of [...porGrupo].sort(([a], [b]) => a.localeCompare(b))) {
      const candidatas = [];
      for (const r of lista) {
        candidatas.push({
          _id: r._id, ficheiro: r.ficheiro, url: await ctx.storage.getUrl(r.ficheiro),
          fonte: r.fonte, origemUrl: r.origemUrl, cor: r.cor, origem: r.origem,
          largura: r.largura, altura: r.altura, aviso: r.aviso,
        });
      }
      out.push({ grupoModelo, escolhaHumana: humanas.has(grupoModelo), candidatas });
    }
    return out;
  },
});

/**
 * Save the agent's photo picks as group decisions (first = cover), authored
 * by AGENTE. A group a person already saved is left alone (`mantidas`);
 * re-running replaces the agent's own earlier picks.
 */
export const gravarEscolhasAgente = mutation({
  args: {
    secret: v.string(),
    marca: v.string(),
    escolhas: v.array(
      v.object({ grupoModelo: v.string(), candidatas: v.array(v.id("imagensCandidatas")) }),
    ),
  },
  returns: v.object({ gravadas: v.number(), mantidas: v.number() }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    let gravadas = 0;
    let mantidas = 0;
    for (const e of args.escolhas) {
      if (e.candidatas.length === 0) throw new Error(`${e.grupoModelo}: escolha vazia.`);
      const imagens: Array<Id<"_storage">> = [];
      for (const id of e.candidatas) {
        const c = await ctx.db.get(id);
        if (c === null || c.grupoModelo !== e.grupoModelo || c.marca !== args.marca) {
          throw new Error(`${e.grupoModelo}: candidata ${id} não pertence ao grupo.`);
        }
        imagens.push(c.ficheiro);
      }
      const atual = await ctx.db
        .query("imagensGrupo")
        .withIndex("by_grupo", (q) => q.eq("grupoModelo", e.grupoModelo))
        .unique();
      if (atual !== null && atual.atualizadoPor !== AGENTE) {
        mantidas++;
        continue;
      }
      await gravarDecisao(ctx, {
        grupoModelo: e.grupoModelo, marca: args.marca, imagens, porRef: undefined, por: AGENTE,
      });
      gravadas++;
    }
    return { gravadas, mantidas };
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
    if (args.fonte === "recorte") {
      const origem = args.origem === undefined ? null : await ctx.db.get(args.origem);
      if (origem === null || origem.grupoModelo !== args.grupoModelo) {
        throw new Error("Recorte sem imagem de origem neste grupo.");
      }
    }
    const existente = await candidataPorHash(ctx, args.grupoModelo, args.hash);
    if (existente) {
      // Same bytes already held: drop the new upload unless something uses it.
      if (existente.ficheiro !== args.ficheiro) await apagarSemReferencia(ctx, [args.ficheiro]);
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

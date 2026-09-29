import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { produtoImportFields, upsertProdutoPorRef } from "./produtos";
import { upsertPagina } from "./paginasCatalogo";
import { apagarSemReferencia, definirImagensProduto } from "./imagens";
import { estadoValidator } from "./schema";
import { sincronizarGrupos } from "./lib/catalogoGrupos";
import { conferirSegredo } from "./lib/importSecret";
import { ficheirosEscolhidos } from "./lib/imagensGrupo";

// Bulk data import, driven by a trusted local script (no browser / no Clerk).
//
// These are public functions (so an external ConvexHttpClient can reach them),
// but every one is locked behind a shared secret checked against the deployment
// env var IMPORT_SECRET. They are NOT exposed to app users and can be deleted
// once the initial data load is done. The staff-gated UI functions and the
// internal `upsertPorRef` are unaffected — this file just reuses their helpers.

/**
 * Upsert a batch of products by ref (idempotent). Bad rows are collected and
 * reported without aborting the batch; the good rows in the batch still commit.
 */
export const importarProdutos = mutation({
  args: {
    secret: v.string(),
    produtos: v.array(v.object(produtoImportFields)),
  },
  returns: v.object({
    total: v.number(),
    criados: v.number(),
    atualizados: v.number(),
    erros: v.array(v.object({ ref: v.string(), erro: v.string() })),
  }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);

    let criados = 0;
    let atualizados = 0;
    const erros: Array<{ ref: string; erro: string }> = [];
    // Variants of one group arrive together, so syncing the catalog row once
    // per group at the end is much cheaper than once per SKU.
    const gruposTocados = new Set<string>();

    for (const produto of args.produtos) {
      try {
        const r = await upsertProdutoPorRef(ctx, produto, gruposTocados);
        if (r.created) criados++;
        else atualizados++;
      } catch (e) {
        erros.push({
          ref: produto.ref,
          erro: e instanceof Error ? e.message : String(e),
        });
      }
    }
    await sincronizarGrupos(ctx, gruposTocados);

    return { total: args.produtos.length, criados, atualizados, erros };
  },
});

/**
 * @deprecated v3 full-rebuild rule. Replaced by import-run promotion (#40),
 * which marks absent refs `descontinuado` instead of deleting. Kept only for
 * the v3 `catalog-brand-import` skill until the cutover (#53) removes both.
 *
 * Secret-guarded: enforce full-rebuild semantics for a brand price table.
 * Deletes every product with the given `tabelaOrigem` whose `ref` is NOT in
 * `refsMantidos` (i.e. rows dropped from the latest CSV). Orphaned image files
 * are removed from storage. Call once per brand AFTER `importarProdutos` has
 * upserted every current row.
 */
export const removerAusentes = mutation({
  args: {
    secret: v.string(),
    tabelaOrigem: v.string(),
    refsMantidos: v.array(v.string()),
  },
  returns: v.object({
    removidos: v.number(),
    ficheirosRemovidos: v.number(),
  }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);

    const manter = new Set(args.refsMantidos);
    const doTabela = await ctx.db
      .query("produtos")
      .withIndex("by_tabela", (q) => q.eq("tabelaOrigem", args.tabelaOrigem))
      .collect();

    const aRemover = doTabela.filter((p) => !manter.has(p.ref));
    const candidatos = new Set(aRemover.flatMap((p) => p.imagens));

    let removidos = 0;
    for (const p of aRemover) {
      await ctx.db.delete(p._id);
      removidos++;
    }
    await sincronizarGrupos(
      ctx,
      aRemover.map((p) => p.grupoModelo),
    );

    // Only delete storage files nothing references any more (remaining
    // products, image candidates, group decisions).
    const ficheirosRemovidos = await apagarSemReferencia(ctx, candidatos);

    return { removidos, ficheirosRemovidos };
  },
});

/** Secret-guarded upload URL for a single catalog-page PDF. */
export const gerarUploadUrl = mutation({
  args: { secret: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Secret-guarded record of an uploaded page (idempotent by tabela+pagina). */
export const registarPagina = mutation({
  args: {
    secret: v.string(),
    tabelaOrigem: v.string(),
    pagina: v.number(),
    ficheiro: v.id("_storage"),
  },
  returns: v.object({
    paginaId: v.id("paginasCatalogo"),
    substituido: v.boolean(),
  }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    return await upsertPagina(ctx, {
      tabelaOrigem: args.tabelaOrigem,
      pagina: args.pagina,
      ficheiro: args.ficheiro,
    });
  },
});

const targetImagemValidator = v.object({
  // grupoModelo of the product page.
  slug: v.string(),
  marca: v.string(),
  nome: v.string(), // group name (nomeGrupo)
  gama: v.optional(v.string()),
  familia: v.string(),
  // Canonical variant's component — used by match.mjs to prefer indoor vs
  // outdoor packshots (unidade-interior vs unidade-exterior).
  componente: v.optional(v.string()),
  // Representative ref used when attaching images (canonical variant).
  ref: v.string(),
  refs: v.array(v.string()),
  aplicarAoGrupo: v.boolean(),
  estados: v.array(estadoValidator),
  numImagens: v.number(),
});

/**
 * Secret-guarded: one image target per product page (grupoModelo). Used by the
 * local image pipeline to know what to match/upload. Every product belongs to a
 * group, so a group of one behaves like a standalone product.
 */
export const listarTargetsImagens = query({
  args: { secret: v.string() },
  returns: v.array(targetImagemValidator),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);

    const todos = await ctx.db.query("produtos").collect();
    const grupos = new Map<string, typeof todos>();
    for (const p of todos) {
      const atual = grupos.get(p.grupoModelo);
      if (atual) atual.push(p);
      else grupos.set(p.grupoModelo, [p]);
    }

    const targets: Array<{
      slug: string;
      marca: string;
      nome: string;
      gama?: string;
      familia: string;
      componente?: string;
      ref: string;
      refs: Array<string>;
      aplicarAoGrupo: boolean;
      estados: Array<(typeof todos)[number]["estado"]>;
      numImagens: number;
    }> = [];

    for (const [grupoModelo, variantes] of grupos) {
      // Canonical = cheapest, tie-broken by ref (same rule as the catalog).
      const canonica = variantes.reduce((melhor, atual) => {
        if (atual.pvpCents < melhor.pvpCents) return atual;
        if (atual.pvpCents === melhor.pvpCents && atual.ref < melhor.ref) {
          return atual;
        }
        return melhor;
      });
      targets.push({
        slug: grupoModelo,
        marca: canonica.marca,
        nome: canonica.nomeGrupo,
        gama: canonica.gama,
        familia: canonica.familia,
        componente: canonica.componente,
        ref: canonica.ref,
        refs: variantes.map((v) => v.ref),
        aplicarAoGrupo: true,
        estados: [...new Set(variantes.map((v) => v.estado))],
        numImagens: Math.max(...variantes.map((v) => v.imagens.length)),
      });
    }

    targets.sort((a, b) => {
      if (a.marca !== b.marca) return a.marca.localeCompare(b.marca);
      return a.nome.localeCompare(b.nome);
    });
    return targets;
  },
});

/**
 * Secret-guarded: replace a product's image list (same semantics as the staff
 * mutation, including family fan-out, decision sync and orphan cleanup).
 */
export const definirImagensPorRef = mutation({
  args: {
    secret: v.string(),
    ref: v.string(),
    imagens: v.array(v.id("_storage")),
    aplicarAoGrupo: v.optional(v.boolean()),
  },
  returns: v.object({
    produtosAtualizados: v.number(),
    ficheirosRemovidos: v.number(),
  }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    // Keeps an existing group decision in step (never creates one), so the
    // next approval does not revert this list.
    return await definirImagensProduto(ctx, {
      ref: args.ref,
      imagens: args.imagens,
      aplicarAoGrupo: args.aplicarAoGrupo,
      por: "importData",
      criarDecisao: false,
    });
  },
});

/**
 * Secret-guarded full catalog wipe: products + their storage images, then
 * image candidates and group decisions (rows + files), then catalog PDF pages
 * + their files. Call repeatedly until `done` is true — each call processes a
 * bounded batch to stay under mutation limits. A file is deleted only once
 * nothing references it any more. Does NOT touch the `marcas` table.
 */
export const limparCatalogo = mutation({
  args: {
    secret: v.string(),
    // When true (default), also wipe `paginasCatalogo` after products are gone.
    incluirPaginas: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    produtosApagados: v.number(),
    imagensApagadas: v.number(),
    candidatasApagadas: v.number(),
    decisoesApagadas: v.number(),
    paginasApagadas: v.number(),
    ficheirosPaginaApagados: v.number(),
    produtosRestantes: v.number(),
    paginasRestantes: v.number(),
    done: v.boolean(),
  }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    const batchSize = Math.min(Math.max(args.batchSize ?? 100, 1), 250);
    const incluirPaginas = args.incluirPaginas !== false;
    const vazio = {
      produtosApagados: 0,
      imagensApagadas: 0,
      candidatasApagadas: 0,
      decisoesApagadas: 0,
      paginasApagadas: 0,
      ficheirosPaginaApagados: 0,
      produtosRestantes: 0,
    };

    const produtos = await ctx.db.query("produtos").take(batchSize);
    if (produtos.length > 0) {
      const storageIds = new Set(produtos.flatMap((p) => p.imagens));
      for (const p of produtos) {
        await ctx.db.delete(p._id);
      }
      await sincronizarGrupos(
        ctx,
        produtos.map((p) => p.grupoModelo),
      );
      // Families share image ids across variants, and candidates/decisions
      // may hold them too (wiped next): delete only what nothing references.
      const imagensApagadas = await apagarSemReferencia(ctx, storageIds);
      const restantes = await ctx.db.query("produtos").collect();

      return {
        ...vazio,
        produtosApagados: produtos.length,
        imagensApagadas,
        produtosRestantes: restantes.length,
        paginasRestantes: -1,
        done: false,
      };
    }

    // Group decisions and image candidates would otherwise point at files
    // this wipe deletes.
    const decisoes = await ctx.db.query("imagensGrupo").take(batchSize);
    const candidatas = await ctx.db.query("imagensCandidatas").take(batchSize);
    if (decisoes.length > 0 || candidatas.length > 0) {
      const ficheiros = new Set<Id<"_storage">>();
      for (const d of decisoes) {
        for (const f of ficheirosEscolhidos(d)) ficheiros.add(f);
        await ctx.db.delete(d._id);
      }
      for (const c of candidatas) {
        ficheiros.add(c.ficheiro);
        await ctx.db.delete(c._id);
      }
      return {
        ...vazio,
        imagensApagadas: await apagarSemReferencia(ctx, ficheiros),
        candidatasApagadas: candidatas.length,
        decisoesApagadas: decisoes.length,
        paginasRestantes: -1,
        done: false,
      };
    }

    let paginasApagadas = 0;
    let ficheirosPaginaApagados = 0;
    if (incluirPaginas) {
      const paginas = await ctx.db.query("paginasCatalogo").take(batchSize);
      for (const pagina of paginas) {
        if (pagina.ficheiro !== undefined) {
          await ctx.storage.delete(pagina.ficheiro);
          ficheirosPaginaApagados++;
        }
        if (pagina.imagem !== undefined) {
          await ctx.storage.delete(pagina.imagem);
          ficheirosPaginaApagados++;
        }
        await ctx.db.delete(pagina._id);
        paginasApagadas++;
      }
    }

    const paginasLeft = incluirPaginas
      ? (await ctx.db.query("paginasCatalogo").collect()).length
      : 0;

    return {
      ...vazio,
      paginasApagadas,
      ficheirosPaginaApagados,
      paginasRestantes: paginasLeft,
      done: !incluirPaginas || paginasLeft === 0,
    };
  },
});

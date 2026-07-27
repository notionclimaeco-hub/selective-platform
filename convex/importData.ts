import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { produtoImportFields, upsertProdutoPorRef } from "./produtos";
import { upsertPagina } from "./paginasCatalogo";
import { definirImagensProduto } from "./imagens";
import { estadoValidator } from "./schema";

// Bulk data import, driven by a trusted local script (no browser / no Clerk).
//
// These are public functions (so an external ConvexHttpClient can reach them),
// but every one is locked behind a shared secret checked against the deployment
// env var IMPORT_SECRET. They are NOT exposed to app users and can be deleted
// once the initial data load is done. The staff-gated UI functions and the
// internal `upsertPorRef` are unaffected — this file just reuses their helpers.

function conferirSegredo(secret: string): void {
  const esperado = process.env.IMPORT_SECRET;
  if (!esperado) {
    throw new Error(
      "IMPORT_SECRET não está configurado no deployment (npx convex env set IMPORT_SECRET ...).",
    );
  }
  if (secret !== esperado) {
    throw new Error("Segredo de importação inválido.");
  }
}

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

    for (const produto of args.produtos) {
      try {
        const r = await upsertProdutoPorRef(ctx, produto);
        if (r.created) criados++;
        else atualizados++;
      } catch (e) {
        erros.push({
          ref: produto.ref,
          erro: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return { total: args.produtos.length, criados, atualizados, erros };
  },
});

/**
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

    // Only delete storage files no longer referenced by any remaining product.
    let ficheirosRemovidos = 0;
    if (candidatos.size > 0) {
      const restantes = await ctx.db.query("produtos").collect();
      const referenciados = new Set(restantes.flatMap((p) => p.imagens));
      for (const ficheiro of candidatos) {
        if (referenciados.has(ficheiro)) continue;
        await ctx.storage.delete(ficheiro);
        ficheirosRemovidos++;
      }
    }

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
 * mutation, including family fan-out and orphan cleanup).
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
    return await definirImagensProduto(ctx, {
      ref: args.ref,
      imagens: args.imagens,
      aplicarAoGrupo: args.aplicarAoGrupo,
    });
  },
});

/**
 * Secret-guarded full catalog wipe (products + their storage images, then
 * catalog PDF pages + their files). Call repeatedly until `done` is true —
 * each call processes a bounded batch to stay under mutation limits.
 * Does NOT touch the `marcas` table.
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

    let produtosApagados = 0;
    let imagensApagadas = 0;
    let paginasApagadas = 0;
    let ficheirosPaginaApagados = 0;

    const produtos = await ctx.db.query("produtos").take(batchSize);
    if (produtos.length > 0) {
      const storageIds = new Set(produtos.flatMap((p) => p.imagens));
      for (const p of produtos) {
        await ctx.db.delete(p._id);
        produtosApagados++;
      }
      // Only delete storage files no longer referenced by remaining products
      // (families share the same image ids across variants).
      const restantes = await ctx.db.query("produtos").collect();
      const aindaUsados = new Set(restantes.flatMap((p) => p.imagens));
      for (const id of storageIds) {
        if (aindaUsados.has(id)) continue;
        await ctx.storage.delete(id);
        imagensApagadas++;
      }

      return {
        produtosApagados,
        imagensApagadas,
        paginasApagadas: 0,
        ficheirosPaginaApagados: 0,
        produtosRestantes: restantes.length,
        paginasRestantes: -1,
        done: false,
      };
    }

    if (incluirPaginas) {
      const paginas = await ctx.db.query("paginasCatalogo").take(batchSize);
      for (const pagina of paginas) {
        await ctx.storage.delete(pagina.ficheiro);
        ficheirosPaginaApagados++;
        await ctx.db.delete(pagina._id);
        paginasApagadas++;
      }
    }

    const paginasLeft = incluirPaginas
      ? (await ctx.db.query("paginasCatalogo").collect()).length
      : 0;

    return {
      produtosApagados: 0,
      imagensApagadas: 0,
      paginasApagadas,
      ficheirosPaginaApagados,
      produtosRestantes: 0,
      paginasRestantes: paginasLeft,
      done: !incluirPaginas || paginasLeft === 0,
    };
  },
});

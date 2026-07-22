import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { produtoImportFields, upsertProdutoPorRef } from "./produtos";
import { upsertPagina } from "./paginasCatalogo";
import { definirImagensProduto } from "./imagens";
import {
  marcaValidator,
  categoriaValidator,
  estadoValidator,
} from "./schema";

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
  // grupoModelo for families, ref for standalone products.
  slug: v.string(),
  marca: marcaValidator,
  nome: v.string(),
  gama: v.optional(v.string()),
  categoria: categoriaValidator,
  // Representative ref used when attaching images (canonical / only product).
  ref: v.string(),
  refs: v.array(v.string()),
  aplicarAoGrupo: v.boolean(),
  estados: v.array(estadoValidator),
  numImagens: v.number(),
});

/**
 * Secret-guarded: one image target per family (or standalone product). Used by
 * the local image pipeline to know what to match/upload.
 */
export const listarTargetsImagens = query({
  args: { secret: v.string() },
  returns: v.array(targetImagemValidator),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);

    const todos = await ctx.db.query("produtos").collect();
    const grupos = new Map<string, typeof todos>();
    const standalone: typeof todos = [];

    for (const p of todos) {
      if (p.grupoModelo === undefined) {
        standalone.push(p);
      } else {
        const atual = grupos.get(p.grupoModelo);
        if (atual) atual.push(p);
        else grupos.set(p.grupoModelo, [p]);
      }
    }

    const targets: Array<{
      slug: string;
      marca: (typeof todos)[number]["marca"];
      nome: string;
      gama?: string;
      categoria: (typeof todos)[number]["categoria"];
      ref: string;
      refs: Array<string>;
      aplicarAoGrupo: boolean;
      estados: Array<(typeof todos)[number]["estado"]>;
      numImagens: number;
    }> = [];

    for (const p of standalone) {
      targets.push({
        slug: p.ref,
        marca: p.marca,
        nome: p.nome,
        gama: p.gama,
        categoria: p.categoria,
        ref: p.ref,
        refs: [p.ref],
        aplicarAoGrupo: false,
        estados: [p.estado],
        numImagens: p.imagens.length,
      });
    }

    for (const [grupoModelo, variantes] of grupos) {
      // Canonical = lowest capacidadeKw, then cheapest (same rule as catalog).
      const canonica = variantes.reduce((melhor, atual) => {
        const kwMelhor = melhor.capacidadeKw ?? Number.POSITIVE_INFINITY;
        const kwAtual = atual.capacidadeKw ?? Number.POSITIVE_INFINITY;
        if (kwAtual < kwMelhor) return atual;
        if (kwAtual === kwMelhor && atual.pvpCents < melhor.pvpCents) {
          return atual;
        }
        return melhor;
      });
      targets.push({
        slug: grupoModelo,
        marca: canonica.marca,
        nome: canonica.nome,
        gama: canonica.gama,
        categoria: canonica.categoria,
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

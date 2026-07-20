import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  marcaValidator,
  tipoValidator,
  categoriaValidator,
  estadoValidator,
} from "./schema";

// Public shape of a product. Contains PVP only — no reseller/discount pricing
// is ever stored on or returned from a produtos document.
const produtoPublicoValidator = v.object({
  _id: v.id("produtos"),
  _creationTime: v.number(),
  ref: v.string(),
  nome: v.string(),
  marca: marcaValidator,
  tipo: tipoValidator,
  categoria: categoriaValidator,
  gama: v.optional(v.string()),
  capacidadeKw: v.optional(v.number()),
  classeEnergetica: v.optional(v.string()),
  refrigerante: v.optional(v.string()),
  descricao: v.optional(v.string()),
  pvpCents: v.number(),
  imagens: v.array(v.id("_storage")),
  estado: estadoValidator,
  tabelaOrigem: v.string(),
});

/**
 * Public catalog listing. Returns only published products and PVP pricing.
 * Never returns reseller/discount data.
 */
export const listarCatalogo = query({
  args: {
    marca: v.optional(marcaValidator),
    categoria: v.optional(categoriaValidator),
  },
  returns: v.array(produtoPublicoValidator),
  handler: async (ctx, args) => {
    // by_catalogo is ["estado", "marca", "categoria"]. We can only constrain a
    // field in the index if all preceding fields are also constrained, so
    // `categoria` alone (without `marca`) is applied as a post-filter below.
    const produtos = await ctx.db
      .query("produtos")
      .withIndex("by_catalogo", (q) => {
        if (args.marca !== undefined && args.categoria !== undefined) {
          return q
            .eq("estado", "publicado")
            .eq("marca", args.marca)
            .eq("categoria", args.categoria);
        }
        if (args.marca !== undefined) {
          return q.eq("estado", "publicado").eq("marca", args.marca);
        }
        return q.eq("estado", "publicado");
      })
      .collect();

    if (args.marca === undefined && args.categoria !== undefined) {
      return produtos.filter((p) => p.categoria === args.categoria);
    }
    return produtos;
  },
});

/**
 * Public product detail by manufacturer reference. Only returns the product if
 * it is published, otherwise null.
 */
export const obterPorRef = query({
  args: { ref: v.string() },
  returns: v.union(produtoPublicoValidator, v.null()),
  handler: async (ctx, args) => {
    const produto = await ctx.db
      .query("produtos")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .unique();

    if (!produto || produto.estado !== "publicado") {
      return null;
    }
    return produto;
  },
});

/**
 * Idempotent import upsert, keyed by manufacturer reference.
 * - If the product exists: patch the imported fields but preserve the current
 *   `estado` and `imagens` (those are managed in the app, not by the import).
 * - If it does not exist: insert as a draft ("rascunho") with no images.
 *
 * Returns whether the row was created or updated, and whether the price changed
 * (for price-diff review). Internal only — imports run from trusted backend code.
 */
export const upsertPorRef = internalMutation({
  args: {
    ref: v.string(),
    nome: v.string(),
    marca: marcaValidator,
    tipo: tipoValidator,
    categoria: categoriaValidator,
    gama: v.optional(v.string()),
    capacidadeKw: v.optional(v.number()),
    classeEnergetica: v.optional(v.string()),
    refrigerante: v.optional(v.string()),
    descricao: v.optional(v.string()),
    pvpCents: v.number(),
    tabelaOrigem: v.string(),
  },
  returns: v.object({
    produtoId: v.id("produtos"),
    created: v.boolean(),
    updated: v.boolean(),
    precoAlterado: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // The imported fields (excludes app-managed `estado` and `imagens`).
    const campos = {
      ref: args.ref,
      nome: args.nome,
      marca: args.marca,
      tipo: args.tipo,
      categoria: args.categoria,
      gama: args.gama,
      capacidadeKw: args.capacidadeKw,
      classeEnergetica: args.classeEnergetica,
      refrigerante: args.refrigerante,
      descricao: args.descricao,
      pvpCents: args.pvpCents,
      tabelaOrigem: args.tabelaOrigem,
    };

    const existente = await ctx.db
      .query("produtos")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .unique();

    if (existente) {
      const precoAlterado = existente.pvpCents !== args.pvpCents;
      // Preserve existing `estado` and `imagens` by not including them here.
      await ctx.db.patch(existente._id, campos);
      return {
        produtoId: existente._id,
        created: false,
        updated: true,
        precoAlterado,
      };
    }

    const produtoId = await ctx.db.insert("produtos", {
      ...campos,
      estado: "rascunho",
      imagens: [],
    });
    return {
      produtoId,
      created: true,
      updated: false,
      precoAlterado: false,
    };
  },
});

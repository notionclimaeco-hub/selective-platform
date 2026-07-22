import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Reusable literal validators (shared between the schema and function files).
export const marcaValidator = v.union(
  v.literal("daikin"),
  v.literal("nipon"),
  v.literal("hisense"),
  v.literal("mitsubishi"),
  v.literal("midea"),
);

export const tipoValidator = v.union(
  v.literal("equipamento"),
  v.literal("acessorio"),
);

export const categoriaValidator = v.union(
  v.literal("ar-condicionado"),
  v.literal("bombas-calor"),
  v.literal("aqs"),
  v.literal("vmc"),
  v.literal("ventiloconvetores"),
);

export const estadoValidator = v.union(
  v.literal("rascunho"),
  v.literal("publicado"),
  v.literal("descontinuado"),
);

export default defineSchema({
  produtos: defineTable({
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
    // Price s/IVA (PVP) from the brand table, in integer cents. Never a float.
    pvpCents: v.number(),
    // First item is the cover image.
    imagens: v.array(v.id("_storage")),
    estado: estadoValidator,
    tabelaOrigem: v.string(),
    // --- Optional variant grouping (presentation metadata only) ---
    // Family slug, kebab-case, convention "marca-gama[-variante-de-cor]"
    // (e.g. "mitsubishi-msz-ap"). A group must never mix brands. When set,
    // `variante` must be set too. Ungrouped products leave both undefined and
    // behave exactly as before.
    grupoModelo: v.optional(v.string()),
    // Human label for the capacity picker, e.g. "9.000 BTU · 2,5 kW".
    variante: v.optional(v.string()),
    // Price-table page(s) this product appears on, verbatim from the import CSV
    // column `pdfPaginas`. Format: "15" (single) or "54-55" (inclusive range).
    // The actual PDFs live in `paginasCatalogo`, keyed by (tabelaOrigem, pagina).
    pdfPaginas: v.optional(v.string()),
  })
    // Import upserts + detail lookups by manufacturer reference.
    .index("by_ref", ["ref"])
    // Public catalog listing/filtering.
    .index("by_catalogo", ["estado", "marca", "categoria"])
    // Variant grouping: fetch all variants of a family.
    .index("by_grupo", ["grupoModelo"]),

  // One-page catalog PDFs, stored once per (tabelaOrigem, pagina) and shared
  // across every product that references that page. Uniqueness on
  // (tabelaOrigem, pagina) is enforced in the mutation, not by the schema.
  paginasCatalogo: defineTable({
    tabelaOrigem: v.string(),
    pagina: v.number(),
    ficheiro: v.id("_storage"),
  }).index("by_tabela_pagina", ["tabelaOrigem", "pagina"]),

  marcas: defineTable({
    slug: v.string(),
    nome: v.string(),
    // Flat discount % our company gets on this brand's whole price table.
    descontoPercent: v.number(),
    ativa: v.boolean(),
  }).index("by_slug", ["slug"]),
});

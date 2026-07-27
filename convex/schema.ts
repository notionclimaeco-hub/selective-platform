import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// --- Reusable literal validators (shared between the schema and function files) ---

// A product's role within a system. Enforced by the schema.
export const componenteValidator = v.union(
  v.literal("conjunto"),
  v.literal("unidade-interior"),
  v.literal("unidade-exterior"),
  v.literal("deposito"),
  v.literal("acessorio"),
  v.literal("comando"),
);

// Target market. Enforced by the schema.
export const segmentoValidator = v.union(
  v.literal("domestico"),
  v.literal("comercial"),
  v.literal("industrial"),
);

// App-managed publication state (never comes from the import CSV).
export const estadoValidator = v.union(
  v.literal("rascunho"),
  v.literal("publicado"),
  v.literal("descontinuado"),
);

// One ordered product attribute, e.g. { chave: "capacidade", valor: "3.5" }.
// A product's specs AND its variant axes both live here — the UI decides how
// to render each key: within a grupoModelo, keys whose values differ across
// variants become columns of the variant table; constant keys render as spec
// chips. Order = display order (axes first, specs after).
export const atributoValidator = v.object({
  chave: v.string(),
  valor: v.string(),
});

// Import-time vocabularies. `familia`/`sistema` are stored as free strings (per
// spec) but validated against these lists on import so bad rows are rejected
// with a clear error. Keep these in sync with the frontend label maps.
export const FAMILIAS = [
  "ar-condicionado",
  "bombas-de-calor",
  "aqs",
  "ventilacao",
  "chillers",
  "ventiloconvectores",
  "cortinas-de-ar",
  "purificadores-de-ar",
  "acessorios-e-controlo",
  "outros",
] as const;

export const SISTEMAS = [
  "mono-split",
  "multi-split",
  "vrf",
  "rooftop",
  "monobloco",
  "bibloco",
] as const;

export default defineSchema({
  // One row = one purchasable SKU. Product pages on the frontend are groups of
  // SKUs sharing `grupoModelo`, rendered as a variant table (one row per SKU,
  // one column per attribute key that varies within the group).
  produtos: defineTable({
    // --- identity ---
    ref: v.string(), // manufacturer reference, unique
    ean: v.optional(v.string()),
    marca: v.string(), // slug: "hisense", "mitsubishi", ...

    // --- naming ---
    nome: v.string(), // variant name, e.g. "Mural Air Master 3.5 kW"
    nomeGrupo: v.string(), // product-page name, no capacity/color

    // --- taxonomy (orthogonal dimensions) ---
    familia: v.string(), // validated against FAMILIAS on import
    segmento: v.optional(segmentoValidator),
    sistema: v.optional(v.string()), // validated against SISTEMAS on import
    tipoUnidade: v.optional(v.string()), // "mural", "cassete-4-vias", ...
    componente: componenteValidator,
    gama: v.optional(v.string()), // series, e.g. "Air Master"

    // --- variant model / specs (unified) ---
    grupoModelo: v.string(), // group slug, e.g. "hisense-air-master"
    // Ordered {chave, valor} pairs holding BOTH variant axes and specs.
    // Within a group, keys whose values differ across variants become columns
    // of the variant table on the product page; constant keys render as spec
    // chips. Order = display order (axes first, specs after).
    atributos: v.array(atributoValidator),

    descricao: v.optional(v.string()),

    // --- commerce ---
    pvpCents: v.number(), // integer cents, VAT-exclusive
    ivaIncluido: v.boolean(), // false for all brand price tables

    // --- provenance / assets ---
    tabelaOrigem: v.string(), // "hisense-2026", "mitsubishi-2026", ...
    // Pages in the brand PDF; the actual files live in `paginasCatalogo`,
    // keyed by (tabelaOrigem, pagina).
    pdfPaginas: v.array(v.number()),

    // --- app-managed (NOT from the CSV) ---
    // Ordered image list; first item is the cover. Managed via the image
    // pipeline / admin, preserved across re-imports.
    imagens: v.array(v.id("_storage")),
    // Publication state; new imports insert as "rascunho".
    estado: estadoValidator,
  })
    // Import upserts + detail lookups by manufacturer reference.
    .index("by_ref", ["ref"])
    // Variant grouping: fetch all SKUs of a product page.
    .index("by_grupoModelo", ["grupoModelo"])
    // Brand (+ familia) browse.
    .index("by_marca", ["marca", "familia"])
    // Familia (+ segmento) browse.
    .index("by_familia_segmento", ["familia", "segmento"])
    // Re-import replaces a brand's rows: find + delete stale rows.
    .index("by_tabela", ["tabelaOrigem"])
    // Public catalog listing/filtering (published only).
    .index("by_catalogo", ["estado", "marca", "familia"])
    // Familia-only public catalog filter (avoids post-filtering by_catalogo).
    .index("by_catalogo_familia", ["estado", "familia"])
    // Free-text search over the variant name, scoped by marca/familia.
    .searchIndex("search_nome", {
      searchField: "nome",
      filterFields: ["marca", "familia"],
    }),

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

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
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
  }),

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
  })
    // Import upserts + detail lookups by manufacturer reference.
    .index("by_ref", ["ref"])
    // Public catalog listing/filtering.
    .index("by_catalogo", ["estado", "marca", "categoria"]),

  marcas: defineTable({
    slug: v.string(),
    nome: v.string(),
    // Flat discount % our company gets on this brand's whole price table.
    descontoPercent: v.number(),
    ativa: v.boolean(),
  }).index("by_slug", ["slug"]),
});

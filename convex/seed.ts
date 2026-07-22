import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { WithoutSystemFields } from "convex/server";
import type { Doc } from "./_generated/dataModel";

// Example catalog rows for eyeballing the grouped listing. All are inserted as
// "publicado" so `listarCatalogo` / `obterGrupo` return them immediately.
//
// - One grouped family: a Mitsubishi MSZ-AP split with 3 capacity variants
//   sharing grupoModelo "mitsubishi-msz-ap".
// - One ungrouped accessory (no grupoModelo/variante) that behaves as today.
const EXEMPLOS: Array<WithoutSystemFields<Doc<"produtos">>> = [
  {
    ref: "MSZ-AP25VGK",
    nome: "Mitsubishi Electric MSZ-AP",
    marca: "mitsubishi",
    tipo: "equipamento",
    categoria: "ar-condicionado",
    gama: "MSZ-AP",
    capacidadeKw: 2.5,
    classeEnergetica: "A+++",
    refrigerante: "R-32",
    descricao:
      "Split mural da gama MSZ-AP. Escolha a capacidade conforme a área a climatizar.",
    pvpCents: 89900,
    imagens: [],
    estado: "publicado",
    tabelaOrigem: "mitsubishi-2026",
    grupoModelo: "mitsubishi-msz-ap",
    variante: "9.000 BTU · 2,5 kW",
  },
  {
    ref: "MSZ-AP35VGK",
    nome: "Mitsubishi Electric MSZ-AP",
    marca: "mitsubishi",
    tipo: "equipamento",
    categoria: "ar-condicionado",
    gama: "MSZ-AP",
    capacidadeKw: 3.5,
    classeEnergetica: "A+++",
    refrigerante: "R-32",
    descricao:
      "Split mural da gama MSZ-AP. Escolha a capacidade conforme a área a climatizar.",
    pvpCents: 99900,
    imagens: [],
    estado: "publicado",
    tabelaOrigem: "mitsubishi-2026",
    grupoModelo: "mitsubishi-msz-ap",
    variante: "12.000 BTU · 3,5 kW",
  },
  {
    ref: "MSZ-AP50VGK",
    nome: "Mitsubishi Electric MSZ-AP",
    marca: "mitsubishi",
    tipo: "equipamento",
    categoria: "ar-condicionado",
    gama: "MSZ-AP",
    capacidadeKw: 5.0,
    classeEnergetica: "A++",
    refrigerante: "R-32",
    descricao:
      "Split mural da gama MSZ-AP. Escolha a capacidade conforme a área a climatizar.",
    pvpCents: 129900,
    imagens: [],
    estado: "publicado",
    tabelaOrigem: "mitsubishi-2026",
    grupoModelo: "mitsubishi-msz-ap",
    variante: "18.000 BTU · 5,0 kW",
  },
  {
    ref: "NI-SUP-001",
    nome: "Suporte de parede universal (par)",
    marca: "nipon",
    tipo: "acessorio",
    categoria: "ar-condicionado",
    descricao: "Suporte de parede universal para unidades exteriores até 60 kg.",
    pvpCents: 3500,
    imagens: [],
    estado: "publicado",
    tabelaOrigem: "nipon-2025",
  },
];

/**
 * Idempotent seed for local eyeballing. Upserts the example rows by `ref` and
 * forces `estado: "publicado"` so they show up in the catalog queries. Safe to
 * run repeatedly. Internal only.
 */
export const seedCatalogoExemplo = internalMutation({
  args: {},
  returns: v.object({
    inseridos: v.number(),
    atualizados: v.number(),
  }),
  handler: async (ctx) => {
    let inseridos = 0;
    let atualizados = 0;

    for (const exemplo of EXEMPLOS) {
      const existente = await ctx.db
        .query("produtos")
        .withIndex("by_ref", (q) => q.eq("ref", exemplo.ref))
        .unique();

      if (existente) {
        await ctx.db.patch(existente._id, exemplo);
        atualizados += 1;
      } else {
        await ctx.db.insert("produtos", exemplo);
        inseridos += 1;
      }
    }

    return { inseridos, atualizados };
  },
});

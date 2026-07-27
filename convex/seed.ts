import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { WithoutSystemFields } from "convex/server";
import type { Doc } from "./_generated/dataModel";

// Example catalog rows for eyeballing the grouped listing. All are inserted as
// "publicado" so `listarCatalogo` / `obterGrupo` return them immediately.
//
// - One product page: a Mitsubishi MSZ-AP split with 3 capacity variants
//   sharing grupoModelo "mitsubishi-msz-ap". Keys that vary across variants
//   (capacidade, frio-kw, …) become columns of the variant table; constant
//   keys (refrigerante) render as spec chips.
// - One accessory as a group of one (attributes render as spec chips only).
const EXEMPLOS: Array<WithoutSystemFields<Doc<"produtos">>> = [
  {
    ref: "MSZ-AP25VGK",
    marca: "mitsubishi",
    nome: "Mitsubishi Electric MSZ-AP 2,5 kW",
    nomeGrupo: "Mitsubishi Electric MSZ-AP",
    familia: "ar-condicionado",
    segmento: "domestico",
    sistema: "mono-split",
    tipoUnidade: "mural",
    componente: "conjunto",
    gama: "MSZ-AP",
    grupoModelo: "mitsubishi-msz-ap",
    atributos: [
      { chave: "capacidade", valor: "2.5" },
      { chave: "frio-kw", valor: "2.5" },
      { chave: "calor-kw", valor: "3.2" },
      { chave: "classe-energetica", valor: "A+++/A+++" },
      { chave: "seer", valor: "8.6" },
      { chave: "scop", valor: "4.6" },
      { chave: "refrigerante", valor: "R32" },
    ],
    descricao:
      "Split mural da gama MSZ-AP. Escolha a capacidade conforme a área a climatizar.",
    pvpCents: 89900,
    ivaIncluido: false,
    tabelaOrigem: "mitsubishi-2026",
    pdfPaginas: [],
    imagens: [],
    estado: "publicado",
  },
  {
    ref: "MSZ-AP35VGK",
    marca: "mitsubishi",
    nome: "Mitsubishi Electric MSZ-AP 3,5 kW",
    nomeGrupo: "Mitsubishi Electric MSZ-AP",
    familia: "ar-condicionado",
    segmento: "domestico",
    sistema: "mono-split",
    tipoUnidade: "mural",
    componente: "conjunto",
    gama: "MSZ-AP",
    grupoModelo: "mitsubishi-msz-ap",
    atributos: [
      { chave: "capacidade", valor: "3.5" },
      { chave: "frio-kw", valor: "3.5" },
      { chave: "calor-kw", valor: "4" },
      { chave: "classe-energetica", valor: "A+++/A+++" },
      { chave: "seer", valor: "8.5" },
      { chave: "scop", valor: "4.5" },
      { chave: "refrigerante", valor: "R32" },
    ],
    descricao:
      "Split mural da gama MSZ-AP. Escolha a capacidade conforme a área a climatizar.",
    pvpCents: 99900,
    ivaIncluido: false,
    tabelaOrigem: "mitsubishi-2026",
    pdfPaginas: [],
    imagens: [],
    estado: "publicado",
  },
  {
    ref: "MSZ-AP50VGK",
    marca: "mitsubishi",
    nome: "Mitsubishi Electric MSZ-AP 5,0 kW",
    nomeGrupo: "Mitsubishi Electric MSZ-AP",
    familia: "ar-condicionado",
    segmento: "domestico",
    sistema: "mono-split",
    tipoUnidade: "mural",
    componente: "conjunto",
    gama: "MSZ-AP",
    grupoModelo: "mitsubishi-msz-ap",
    atributos: [
      { chave: "capacidade", valor: "5" },
      { chave: "frio-kw", valor: "5" },
      { chave: "calor-kw", valor: "5.8" },
      { chave: "classe-energetica", valor: "A++/A++" },
      { chave: "seer", valor: "7.8" },
      { chave: "scop", valor: "4.3" },
      { chave: "refrigerante", valor: "R32" },
    ],
    descricao:
      "Split mural da gama MSZ-AP. Escolha a capacidade conforme a área a climatizar.",
    pvpCents: 129900,
    ivaIncluido: false,
    tabelaOrigem: "mitsubishi-2026",
    pdfPaginas: [],
    imagens: [],
    estado: "publicado",
  },
  {
    ref: "NI-SUP-001",
    marca: "nipon",
    nome: "Suporte de parede universal (par)",
    nomeGrupo: "Suporte de parede universal (par)",
    familia: "acessorios-e-controlo",
    componente: "acessorio",
    grupoModelo: "nipon-suporte-parede-universal",
    atributos: [{ chave: "carga-max", valor: "60 kg" }],
    descricao: "Suporte de parede universal para unidades exteriores até 60 kg.",
    pvpCents: 3500,
    ivaIncluido: false,
    tabelaOrigem: "nipon-2025",
    pdfPaginas: [],
    imagens: [],
    estado: "publicado",
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

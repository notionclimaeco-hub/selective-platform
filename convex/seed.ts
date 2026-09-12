import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { WithoutSystemFields } from "convex/server";
import type { Doc } from "./_generated/dataModel";
import { sincronizarGrupos } from "./lib/catalogoGrupos";

// Example catalog rows for eyeballing the grouped listing. All are inserted as
// "publicado" so `catalogo.listar` / `obterGrupo` return them immediately.
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
    await sincronizarGrupos(
      ctx,
      EXEMPLOS.map((e) => e.grupoModelo),
    );

    return { inseridos, atualizados };
  },
});

// --- Payment test products ------------------------------------------------

/** Provenance tag for the €0,05 test SKUs. Its own value so brand re-imports
 * (which replace rows by `tabelaOrigem`) never touch them, and `removerProdutosTeste`
 * can find them all. */
const TABELA_TESTE = "teste-pagamentos";
const PVP_TESTE_CENTS = 5;

/**
 * Brands to create a test product for. Fixed list rather than derived from
 * `produtos` so the seed stays cheap and deterministic.
 */
const MARCAS_TESTE: ReadonlyArray<{ slug: string; nome: string }> = [
  { slug: "daikin", nome: "Daikin" },
  { slug: "hisense", nome: "Hisense" },
  { slug: "midea", nome: "Midea" },
  { slug: "mitsubishi", nome: "Mitsubishi Electric" },
  { slug: "nipon", nome: "Nipon" },
];

function produtoTeste(marca: {
  slug: string;
  nome: string;
}): WithoutSystemFields<Doc<"produtos">> {
  const refMarca = marca.slug.toUpperCase();
  return {
    ref: `TESTE-PAG-${refMarca}`,
    marca: marca.slug,
    nome: `Artigo de teste de pagamento ${marca.nome}`,
    nomeGrupo: `Artigo de teste de pagamento ${marca.nome}`,
    familia: "acessorios-e-controlo",
    componente: "acessorio",
    grupoModelo: `${marca.slug}-teste-pagamento`,
    atributos: [{ chave: "finalidade", valor: "Teste de pagamentos" }],
    descricao:
      "Artigo fictício de valor simbólico para testar o fluxo de pagamento e a emissão de faturas. Não corresponde a nenhum produto real.",
    pvpCents: PVP_TESTE_CENTS,
    ivaIncluido: false,
    tabelaOrigem: TABELA_TESTE,
    pdfPaginas: [],
    imagens: [],
    estado: "publicado",
  };
}

/**
 * Idempotent: one published €0,05 (VAT-excl) SKU per brand so payments and
 * invoicing can be exercised end-to-end for real money at negligible cost.
 * Upserts by `ref`. Undo with `seed:removerProdutosTeste`. Internal only.
 */
export const seedProdutosTeste = internalMutation({
  args: {},
  returns: v.object({
    inseridos: v.number(),
    atualizados: v.number(),
    refs: v.array(v.string()),
  }),
  handler: async (ctx) => {
    let inseridos = 0;
    let atualizados = 0;
    const docs = MARCAS_TESTE.map(produtoTeste);

    for (const doc of docs) {
      const existente = await ctx.db
        .query("produtos")
        .withIndex("by_ref", (q) => q.eq("ref", doc.ref))
        .unique();
      if (existente) {
        await ctx.db.patch(existente._id, doc);
        atualizados += 1;
      } else {
        await ctx.db.insert("produtos", doc);
        inseridos += 1;
      }
    }
    await sincronizarGrupos(
      ctx,
      docs.map((d) => d.grupoModelo),
    );

    return { inseridos, atualizados, refs: docs.map((d) => d.ref) };
  },
});

/**
 * Removes every SKU seeded by `seedProdutosTeste` (all rows with
 * `tabelaOrigem = "teste-pagamentos"`) and drops their catalog groups.
 * Orders that already reference them keep their own line snapshots.
 */
export const removerProdutosTeste = internalMutation({
  args: {},
  returns: v.object({ removidos: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("produtos")
      .withIndex("by_tabela", (q) => q.eq("tabelaOrigem", TABELA_TESTE))
      .take(100);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    await sincronizarGrupos(
      ctx,
      rows.map((r) => r.grupoModelo),
    );
    return { removidos: rows.length };
  },
});

const TIERS_SEED = [
  {
    slug: "base",
    nome: "Base",
    limiarCents: 0,
    ordem: 0,
    ativa: true,
  },
  {
    slug: "prata",
    nome: "Prata",
    // Placeholder threshold — staff edits real values in Comercial.
    limiarCents: 1_000_000, // €10 000
    ordem: 1,
    ativa: true,
  },
  {
    slug: "ouro",
    nome: "Ouro",
    limiarCents: 5_000_000, // €50 000
    ordem: 2,
    ativa: true,
  },
] as const;

/**
 * Idempotent seed of the three commercial tiers. Upserts by `slug` so later
 * staff edits to `nome` / `limiarCents` / `ativa` are preserved — only a
 * missing slug is inserted. Internal only.
 */
export const seedTiers = internalMutation({
  args: {},
  returns: v.object({
    inseridos: v.number(),
    existentes: v.number(),
  }),
  handler: async (ctx) => {
    let inseridos = 0;
    let existentes = 0;

    for (const tier of TIERS_SEED) {
      const existente = await ctx.db
        .query("tiers")
        .withIndex("by_slug", (q) => q.eq("slug", tier.slug))
        .unique();

      if (existente) {
        existentes += 1;
        continue;
      }

      await ctx.db.insert("tiers", {
        slug: tier.slug,
        nome: tier.nome,
        limiarCents: tier.limiarCents,
        ordem: tier.ordem,
        ativa: tier.ativa,
      });
      inseridos += 1;
    }

    return { inseridos, existentes };
  },
});

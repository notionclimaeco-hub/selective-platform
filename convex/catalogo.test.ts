/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const STAFF = {
  subject: "user_staff",
  issuer: "https://example.clerk.accounts.dev",
  tokenIdentifier: "https://example.clerk.accounts.dev|user_staff",
  role: "staff",
};

function t() {
  return convexTest(schema, modules);
}

function sku(
  ref: string,
  extra: Partial<{
    grupoModelo: string;
    nomeGrupo: string;
    nome: string;
    marca: string;
    familia: string;
    pvpCents: number;
    tipoUnidade: string;
    atributos: Array<{ chave: string; valor: string }>;
  }> = {},
) {
  return {
    ref,
    marca: "daikin",
    nome: `${extra.nomeGrupo ?? "Mural Perfera"} ${ref}`,
    nomeGrupo: "Mural Perfera",
    familia: "ar-condicionado",
    componente: "conjunto" as const,
    grupoModelo: "daikin-perfera",
    atributos: [{ chave: "frio-kw", valor: "2.5" }],
    pvpCents: 100000,
    ivaIncluido: false,
    tabelaOrigem: "daikin-2026",
    pdfPaginas: [],
    ...extra,
  };
}

async function importar(
  test: ReturnType<typeof t>,
  produtos: Array<ReturnType<typeof sku>>,
) {
  for (const p of produtos) {
    await test.mutation(internal.produtos.upsertPorRef, p);
  }
}

async function publicar(test: ReturnType<typeof t>, refs: Array<string>) {
  await test.mutation(internal.produtos.definirEstadoPorRefs, {
    refs,
    estado: "publicado",
  });
}

describe("catalogo.listar", () => {
  it("lists one entry per published group with the cheapest ref and price", async () => {
    const test = t();
    await importar(test, [
      sku("FTXM25", { pvpCents: 90000 }),
      sku("FTXM35", { pvpCents: 110000, atributos: [{ chave: "frio-kw", valor: "3.5" }] }),
      sku("MSZ-AP25", {
        grupoModelo: "mitsubishi-msz-ap",
        nomeGrupo: "Mural MSZ-AP",
        marca: "mitsubishi",
        pvpCents: 80000,
      }),
    ]);

    // Drafts are invisible.
    expect((await test.query(api.catalogo.listar, {})).total).toBe(0);

    await publicar(test, ["FTXM25", "FTXM35"]);
    const lista = await test.query(api.catalogo.listar, {});
    expect(lista.total).toBe(1);
    expect(lista.entradas[0]).toMatchObject({
      grupoModelo: "daikin-perfera",
      ref: "FTXM25",
      precoDesdeCents: 90000,
      precoAteCents: 110000,
      numVariantes: 2,
      frioKwMin: 2.5,
      frioKwMax: 3.5,
      capaUrl: null,
    });
    expect(lista.familias).toEqual([{ valor: "ar-condicionado", contagem: 1 }]);
    expect(lista.marcas).toEqual([{ valor: "daikin", contagem: 1 }]);
  });

  it("drops a group when its last variant is unpublished or removed", async () => {
    const test = t();
    await importar(test, [sku("FTXM25"), sku("FTXM35")]);
    await publicar(test, ["FTXM25", "FTXM35"]);

    await test.mutation(internal.produtos.definirEstadoPorRefs, {
      refs: ["FTXM35"],
      estado: "descontinuado",
    });
    let lista = await test.query(api.catalogo.listar, {});
    expect(lista.entradas[0]?.numVariantes).toBe(1);

    await test
      .withIdentity(STAFF)
      .mutation(api.produtos.remover, { ref: "FTXM25" });
    lista = await test.query(api.catalogo.listar, {});
    expect(lista.total).toBe(0);
  });

  it("searches without diacritics, by ref, and filters by familia/marca", async () => {
    const test = t();
    await importar(test, [
      sku("FTXM25"),
      sku("EKHWS200", {
        grupoModelo: "daikin-deposito",
        nomeGrupo: "Depósito Águas Quentes",
        familia: "aqs",
        pvpCents: 50000,
      }),
      sku("MSZ-AP25", {
        grupoModelo: "mitsubishi-msz-ap",
        nomeGrupo: "Mural MSZ-AP",
        marca: "mitsubishi",
        pvpCents: 80000,
      }),
    ]);
    await publicar(test, ["FTXM25", "EKHWS200", "MSZ-AP25"]);

    const aguas = await test.query(api.catalogo.listar, { busca: "aguas" });
    expect(aguas.entradas.map((e) => e.grupoModelo)).toEqual([
      "daikin-deposito",
    ]);

    const porRef = await test.query(api.catalogo.listar, { busca: "msz-ap25" });
    expect(porRef.entradas.map((e) => e.ref)).toEqual(["MSZ-AP25"]);

    // "Mural" matches both brands; the brand facet lists both, the family
    // facet (marca lifted) lists only ar-condicionado.
    const murais = await test.query(api.catalogo.listar, {
      busca: "mural",
      marca: "daikin",
    });
    expect(murais.total).toBe(1);
    expect(murais.marcas.map((m) => m.valor).sort()).toEqual([
      "daikin",
      "mitsubishi",
    ]);
    expect(murais.familias).toEqual([{ valor: "ar-condicionado", contagem: 1 }]);
  });

  it("sorts by price and clamps the page", async () => {
    const test = t();
    await importar(test, [
      sku("A", { grupoModelo: "g-a", nomeGrupo: "A", pvpCents: 300 }),
      sku("B", { grupoModelo: "g-b", nomeGrupo: "B", pvpCents: 100 }),
      sku("C", { grupoModelo: "g-c", nomeGrupo: "C", pvpCents: 200 }),
    ]);
    await publicar(test, ["A", "B", "C"]);

    const asc = await test.query(api.catalogo.listar, { ordenar: "preco-asc" });
    expect(asc.entradas.map((e) => e.ref)).toEqual(["B", "C", "A"]);

    const pagina = await test.query(api.catalogo.listar, {
      ordenar: "preco-desc",
      porPagina: 2,
      pagina: 9,
    });
    expect(pagina.numPaginas).toBe(2);
    expect(pagina.pagina).toBe(1);
    expect(pagina.entradas.map((e) => e.ref)).toEqual(["B"]);
  });

  it("reflects staff edits and re-imports that move a SKU between groups", async () => {
    const test = t();
    await importar(test, [sku("FTXM25"), sku("FTXM35")]);
    await publicar(test, ["FTXM25", "FTXM35"]);

    await test.withIdentity(STAFF).mutation(api.produtos.atualizar, {
      ref: "FTXM25",
      nome: "Mural Perfera FTXM25",
      familia: "ar-condicionado",
      pvpCents: 500000,
      atributos: [],
      pdfPaginas: [],
    });
    let lista = await test.query(api.catalogo.listar, {});
    // FTXM35 is now the cheapest, so it becomes the canonical ref.
    expect(lista.entradas[0]).toMatchObject({
      ref: "FTXM35",
      precoDesdeCents: 100000,
      precoAteCents: 500000,
    });

    // Re-import FTXM35 into another group: both groups are refreshed.
    await importar(test, [
      sku("FTXM35", { grupoModelo: "daikin-outro", nomeGrupo: "Outro" }),
    ]);
    lista = await test.query(api.catalogo.listar, { ordenar: "nome" });
    expect(lista.entradas.map((e) => [e.grupoModelo, e.numVariantes])).toEqual(
      [
        ["daikin-perfera", 1],
        ["daikin-outro", 1],
      ],
    );
  });
});

describe("hero specs (destaques)", () => {
  it("derives ar-condicionado destaques: numeric spans and distinct values in registry order", async () => {
    const test = t();
    await importar(test, [
      sku("FTXM25", {
        pvpCents: 90000,
        atributos: [
          { chave: "classe-energetica", valor: "A++/A+" },
          { chave: "frio-kw", valor: "2.5" },
          { chave: "calor-kw", valor: "3.2" },
        ],
      }),
      sku("FTXM71", {
        atributos: [
          { chave: "frio-kw", valor: "7.1" },
          { chave: "calor-kw", valor: "8,2" },
          { chave: "classe-energetica", valor: "A+++/A++" },
        ],
      }),
      sku("FTXM35", {
        atributos: [
          { chave: "frio-kw", valor: "3.5" },
          { chave: "classe-energetica", valor: "A+++/A+++" },
        ],
      }),
      sku("FTXM50", {
        atributos: [
          { chave: "frio-kw", valor: "5.0" },
          { chave: "classe-energetica", valor: "-/A+" },
        ],
      }),
    ]);
    await publicar(test, ["FTXM25", "FTXM71", "FTXM35", "FTXM50"]);

    const [entrada] = (await test.query(api.catalogo.listar, {})).entradas;
    expect(entrada?.destaques).toEqual([
      { chave: "frio-kw", tipo: "intervalo", min: 2.5, max: 7.1 },
      { chave: "calor-kw", tipo: "intervalo", min: 3.2, max: 8.2 },
      {
        chave: "classe-energetica",
        tipo: "valores",
        // Best first, cooling side then heating side; "-" sorts last.
        valores: ["A+++/A+++", "A+++/A++", "A++/A+", "-/A+"],
      },
    ]);
    // The legacy fields stay until the client reads `destaques`.
    expect(entrada).toMatchObject({ frioKwMin: 2.5, frioKwMax: 7.1 });
  });

  it("derives aqs destaques and omits a hero key no variant carries", async () => {
    const test = t();
    await importar(test, [
      sku("EKHWS150", {
        grupoModelo: "daikin-ekhws",
        nomeGrupo: "Depósito EKHWS",
        familia: "aqs",
        atributos: [{ chave: "deposito-l", valor: "150" }],
      }),
      sku("EKHWS300", {
        grupoModelo: "daikin-ekhws",
        nomeGrupo: "Depósito EKHWS",
        familia: "aqs",
        atributos: [
          { chave: "deposito-l", valor: "300" },
          { chave: "calor-kw", valor: "2.00" },
        ],
      }),
    ]);
    await publicar(test, ["EKHWS150", "EKHWS300"]);

    const [entrada] = (await test.query(api.catalogo.listar, {})).entradas;
    // No classe-energetica on any variant: the key is left out.
    expect(entrada?.destaques).toEqual([
      { chave: "deposito-l", tipo: "intervalo", min: 150, max: 300 },
      { chave: "calor-kw", tipo: "intervalo", min: 2, max: 2 },
    ]);
  });

  it("derives acessorios destaques: enum values in vocabulary order, lists split", async () => {
    const test = t();
    const acessorio = {
      grupoModelo: "daikin-comando",
      nomeGrupo: "Comando por cabo",
      familia: "acessorios-e-controlo",
    };
    await importar(test, [
      sku("BRC1-W", {
        ...acessorio,
        atributos: [
          { chave: "cor", valor: "preto" },
          { chave: "tipo", valor: "comando" },
          { chave: "compativel-com", valor: "FTXM, FTXJ" },
        ],
      }),
      sku("BRC1-B", {
        ...acessorio,
        atributos: [
          { chave: "cor", valor: "branco" },
          { chave: "tipo", valor: "comando" },
          { chave: "compativel-com", valor: "FTXJ,CTXM" },
        ],
      }),
    ]);
    await publicar(test, ["BRC1-W", "BRC1-B"]);

    const [entrada] = (await test.query(api.catalogo.listar, {})).entradas;
    expect(entrada?.destaques).toEqual([
      { chave: "tipo", tipo: "valores", valores: ["comando"] },
      {
        chave: "compativel-com",
        tipo: "valores",
        valores: ["CTXM", "FTXJ", "FTXM"],
      },
      { chave: "cor", tipo: "valores", valores: ["branco", "preto"] },
    ]);
  });

  it("only counts published variants", async () => {
    const test = t();
    await importar(test, [
      sku("FTXM25"),
      sku("FTXM71", { atributos: [{ chave: "frio-kw", valor: "7.1" }] }),
    ]);
    await publicar(test, ["FTXM25"]);

    const [entrada] = (await test.query(api.catalogo.listar, {})).entradas;
    expect(entrada?.destaques).toEqual([
      { chave: "frio-kw", tipo: "intervalo", min: 2.5, max: 2.5 },
    ]);
  });

  it("reconstruir fills destaques on rows written before the field existed", async () => {
    vi.useFakeTimers();
    try {
      const test = t();
      await importar(test, [sku("FTXM25")]);
      await publicar(test, ["FTXM25"]);
      await test.run(async (ctx) => {
        const g = await ctx.db.query("catalogoGrupos").first();
        await ctx.db.patch(g!._id, { destaques: undefined });
      });
      expect(
        (await test.query(api.catalogo.listar, {})).entradas[0]?.destaques,
      ).toEqual([]);

      await test.mutation(internal.catalogo.reconstruir, {});
      await test.finishAllScheduledFunctions(vi.runAllTimers);

      expect(
        (await test.query(api.catalogo.listar, {})).entradas[0]?.destaques,
      ).toEqual([{ chave: "frio-kw", tipo: "intervalo", min: 2.5, max: 2.5 }]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("catalogo.vitrine", () => {
  it("returns the first groups of the default order, by index, per familia", async () => {
    const test = t();
    await importar(test, [
      // peso 4: no photo, has specs.
      sku("Z1", { grupoModelo: "g-z", nomeGrupo: "Zeta" }),
      sku("M1", { grupoModelo: "g-m", nomeGrupo: "Mu" }),
      // peso 5: accessory family.
      sku("B1", {
        grupoModelo: "g-b",
        nomeGrupo: "Beta",
        familia: "acessorios-e-controlo",
      }),
      // peso 6: no specs.
      sku("A1", { grupoModelo: "g-a", nomeGrupo: "Alfa", atributos: [] }),
    ]);
    await publicar(test, ["Z1", "M1", "B1", "A1"]);

    const todos = await test.query(api.catalogo.vitrine, { limite: 3 });
    expect(todos.map((e) => e.grupoModelo)).toEqual(["g-m", "g-z", "g-b"]);
    // Same order as the catalog's default ("relevancia") listing.
    const lista = await test.query(api.catalogo.listar, { porPagina: 3 });
    expect(todos).toEqual(lista.entradas);

    const ac = await test.query(api.catalogo.vitrine, {
      familia: "ar-condicionado",
      limite: 50,
    });
    expect(ac.map((e) => e.grupoModelo)).toEqual(["g-m", "g-z", "g-a"]);
    expect(ac[0]).toMatchObject({ ref: "M1", capaUrl: null, numVariantes: 1 });
  });
});

describe("catalogo:reconstruir", () => {
  it("rebuilds in place: keeps rows, fixes stale ones, drops orphans", async () => {
    vi.useFakeTimers();
    try {
      const test = t();
      await importar(test, [
        sku("FTXM25"),
        sku("MSZ-AP25", { grupoModelo: "mitsubishi-msz-ap", marca: "mitsubishi" }),
      ]);
      await publicar(test, ["FTXM25", "MSZ-AP25"]);
      const linhas = () =>
        test.run((ctx) => ctx.db.query("catalogoGrupos").collect());
      const antes = await linhas();
      await test.run(async (ctx) => {
        const daikin = antes.find((g) => g.grupoModelo === "daikin-perfera")!;
        await ctx.db.patch(daikin._id, { precoDesdeCents: 1 });
        const { _id, _creationTime, ...campos } = daikin;
        await ctx.db.insert("catalogoGrupos", {
          ...campos,
          grupoModelo: "fantasma",
        });
      });

      await test.mutation(internal.catalogo.reconstruir, {});
      await test.finishAllScheduledFunctions(vi.runAllTimers);

      const depois = await linhas();
      expect(depois.map((g) => g.grupoModelo).sort()).toEqual([
        "daikin-perfera",
        "mitsubishi-msz-ap",
      ]);
      // Same documents, not deleted and re-inserted: the shop never sees a
      // half-empty table while rebuilding.
      expect(depois.map((g) => g._id).sort()).toEqual(
        antes.map((g) => g._id).sort(),
      );
      expect(
        depois.find((g) => g.grupoModelo === "daikin-perfera")?.precoDesdeCents,
      ).toBe(100000);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("catalogo.listar hero-spec filters", () => {
  // Four murals and one cassette, all ar-condicionado, plus an aqs tank.
  async function montar() {
    const test = t();
    const mural = (
      ref: string,
      grupoModelo: string,
      frio: Array<string>,
      classe?: string,
    ) =>
      frio.map((kw, i) =>
        sku(`${ref}${i}`, {
          grupoModelo,
          nomeGrupo: grupoModelo,
          atributos: [
            { chave: "frio-kw", valor: kw },
            ...(classe ? [{ chave: "classe-energetica", valor: classe }] : []),
          ],
        }),
      );
    const produtos = [
      ...mural("A", "g-a", ["2.5", "3.5"], "A++/A+"), // 2.5–3.5
      ...mural("B", "g-b", ["5.0", "7.1"], "A+++/A++"), // 5–7.1
      ...mural("C", "g-c", ["3.5", "5.0"], "A++/A+"), // 3.5–5
      ...mural("D", "g-d", ["10.0"]), // 10, no class
      sku("SEMKW", {
        grupoModelo: "g-sem-kw",
        nomeGrupo: "g-sem-kw",
        atributos: [{ chave: "classe-energetica", valor: "A+/A" }],
      }),
      sku("TANK", {
        grupoModelo: "g-tank",
        nomeGrupo: "g-tank",
        familia: "aqs",
        atributos: [{ chave: "deposito-l", valor: "200" }],
      }),
    ];
    await importar(test, produtos);
    await publicar(
      test,
      produtos.map((p) => p.ref),
    );
    return test;
  }

  const grupos = (lista: { entradas: Array<{ grupoModelo: string }> }) =>
    lista.entradas.map((e) => e.grupoModelo).sort();

  it("matches numeric ranges by overlap with the group's span", async () => {
    const test = await montar();
    const lista = await test.query(api.catalogo.listar, {
      familia: "ar-condicionado",
      filtros: { "frio-kw": { min: 4, max: 6 } },
    });
    // g-b (5–7.1) and g-c (3.5–5) overlap 4–6; g-a, g-d and the group
    // without frio-kw do not.
    expect(grupos(lista)).toEqual(["g-b", "g-c"]);

    const aberto = await test.query(api.catalogo.listar, {
      familia: "ar-condicionado",
      filtros: { "frio-kw": { min: 7.1 } },
    });
    expect(grupos(aberto)).toEqual(["g-b", "g-d"]);
  });

  it("matches value filters on any selected value and combines keys", async () => {
    const test = await montar();
    const lista = await test.query(api.catalogo.listar, {
      familia: "ar-condicionado",
      filtros: { "classe-energetica": { valores: ["A+++/A++", "A+/A"] } },
    });
    expect(grupos(lista)).toEqual(["g-b", "g-sem-kw"]);

    const ambos = await test.query(api.catalogo.listar, {
      familia: "ar-condicionado",
      filtros: {
        "classe-energetica": { valores: ["A+++/A++", "A+/A"] },
        "frio-kw": { max: 6 },
      },
    });
    expect(grupos(ambos)).toEqual(["g-b"]);
  });

  it("ignores filters without a familia, off-familia keys and empty filters", async () => {
    const test = await montar();
    const semFamilia = await test.query(api.catalogo.listar, {
      filtros: { "frio-kw": { min: 100 } },
    });
    expect(semFamilia.total).toBe(6);
    expect(semFamilia.facetas).toEqual([]);

    const vazios = await test.query(api.catalogo.listar, {
      familia: "ar-condicionado",
      filtros: {
        "deposito-l": { min: 1000 },
        "frio-kw": {},
        "classe-energetica": { valores: [] },
      },
    });
    expect(vazios.total).toBe(5);
  });

  it("returns facets computed after the other filters, own filter lifted", async () => {
    const test = await montar();
    const lista = await test.query(api.catalogo.listar, {
      familia: "ar-condicionado",
      filtros: {
        "frio-kw": { min: 4 },
        "classe-energetica": { valores: ["A++/A+"] },
      },
    });
    expect(grupos(lista)).toEqual(["g-c"]);
    expect(lista.facetas).toEqual([
      // frio-kw over the A++/A+ groups (g-a, g-c): its own min is lifted.
      { chave: "frio-kw", tipo: "intervalo", min: 2.5, max: 5 },
      // classe over the ≥4 kW groups (g-b, g-c, g-d): g-d has no class.
      {
        chave: "classe-energetica",
        tipo: "valores",
        valores: [
          { valor: "A+++/A++", contagem: 1 },
          { valor: "A++/A+", contagem: 1 },
        ],
      },
    ]);

    const semFiltros = await test.query(api.catalogo.listar, {
      familia: "ar-condicionado",
    });
    expect(semFiltros.facetas).toEqual([
      { chave: "frio-kw", tipo: "intervalo", min: 2.5, max: 10 },
      {
        chave: "classe-energetica",
        tipo: "valores",
        valores: [
          { valor: "A+++/A++", contagem: 1 },
          { valor: "A++/A+", contagem: 2 },
          { valor: "A+/A", contagem: 1 },
        ],
      },
    ]);
  });

  it("applies hero filters to the brand counts but not the family counts", async () => {
    const test = await montar();
    const lista = await test.query(api.catalogo.listar, {
      familia: "ar-condicionado",
      filtros: { "frio-kw": { min: 9 } },
    });
    expect(lista.marcas).toEqual([{ valor: "daikin", contagem: 1 }]);
    expect(lista.familias).toEqual([
      { valor: "ar-condicionado", contagem: 5 },
      { valor: "aqs", contagem: 1 },
    ]);
  });
});

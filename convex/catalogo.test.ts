/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { filtrarCatalogo, lerIndice } from "./lib/catalogoFiltros";
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

/** The shop's decoded index, in the default order. */
async function grupos(test: ReturnType<typeof t>) {
  const linhas = await test.query(api.catalogo.indice, {});
  return filtrarCatalogo(lerIndice(linhas), {}).grupos;
}

describe("catalogo.indice", () => {
  it("lists one line per published group with the cheapest ref and price", async () => {
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
    expect(await test.query(api.catalogo.indice, {})).toEqual([]);

    await publicar(test, ["FTXM25", "FTXM35"]);
    expect(await test.query(api.catalogo.indice, {})).toEqual([
      {
        g: "daikin-perfera",
        r: "FTXM25",
        n: "Mural Perfera",
        m: "daikin",
        f: "ar-condicionado",
        p: 90000,
        v: 2,
        x: 1,
        d: { "frio-kw": [2.5, 3.5] },
        // The other variant's ref, for search.
        b: "ftxm35",
        w: 4,
      },
    ]);
  });

  it("drops a group when its last variant is unpublished or removed", async () => {
    const test = t();
    await importar(test, [sku("FTXM25"), sku("FTXM35")]);
    await publicar(test, ["FTXM25", "FTXM35"]);

    await test.mutation(internal.produtos.definirEstadoPorRefs, {
      refs: ["FTXM35"],
      estado: "descontinuado",
    });
    expect((await grupos(test))[0]?.numVariantes).toBe(1);

    await test
      .withIdentity(STAFF)
      .mutation(api.produtos.remover, { ref: "FTXM25" });
    expect(await grupos(test)).toEqual([]);
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
    // FTXM35 is now the cheapest, so it becomes the canonical ref.
    expect((await grupos(test))[0]).toMatchObject({
      ref: "FTXM35",
      precoDesdeCents: 100000,
    });

    // Re-import FTXM35 into another group: both groups are refreshed.
    await importar(test, [
      sku("FTXM35", { grupoModelo: "daikin-outro", nomeGrupo: "Outro" }),
    ]);
    expect(
      (await grupos(test)).map((g) => [g.grupoModelo, g.numVariantes]).sort(),
    ).toEqual([
      ["daikin-outro", 1],
      ["daikin-perfera", 1],
    ]);
  });
});

describe("catalogo.capas", () => {
  it("resolves covers for the groups asked, null without a photo", async () => {
    const test = t();
    await importar(test, [
      sku("FTXM25"),
      sku("MSZ-AP25", { grupoModelo: "mitsubishi-msz-ap", marca: "mitsubishi" }),
    ]);
    await publicar(test, ["FTXM25", "MSZ-AP25"]);
    const capa = await test.run((ctx) =>
      ctx.storage.store(new Blob(["png"], { type: "image/png" })),
    );
    await test.run(async (ctx) => {
      const g = await ctx.db
        .query("catalogoGrupos")
        .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", "daikin-perfera"))
        .unique();
      await ctx.db.patch(g!._id, { capa });
    });

    const capas = await test.query(api.catalogo.capas, {
      grupos: ["daikin-perfera", "mitsubishi-msz-ap", "fantasma"],
    });
    expect(capas).toEqual([
      { grupoModelo: "daikin-perfera", url: expect.any(String) },
      { grupoModelo: "mitsubishi-msz-ap", url: null },
    ]);
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

    const [entrada] = await grupos(test);
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

    const [entrada] = await grupos(test);
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

    const [entrada] = await grupos(test);
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

    const [entrada] = await grupos(test);
    expect(entrada?.destaques).toEqual([
      { chave: "frio-kw", tipo: "intervalo", min: 2.5, max: 2.5 },
    ]);
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
        atributos: [{ chave: "tipo", valor: "comando" }],
      }),
      // peso 6: no hero specs.
      sku("A1", { grupoModelo: "g-a", nomeGrupo: "Alfa", atributos: [] }),
    ]);
    await publicar(test, ["Z1", "M1", "B1", "A1"]);

    const todos = await test.query(api.catalogo.vitrine, { limite: 3 });
    expect(todos.map((e) => e.grupoModelo)).toEqual(["g-m", "g-z", "g-b"]);
    // Same order as the catalog's default ("relevancia") listing.
    expect((await grupos(test)).slice(0, 3).map((g) => g.grupoModelo)).toEqual(
      todos.map((e) => e.grupoModelo),
    );

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

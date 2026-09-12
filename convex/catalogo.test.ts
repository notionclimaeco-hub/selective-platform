/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
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

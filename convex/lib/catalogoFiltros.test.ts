import { describe, expect, it } from "vitest";
import {
  codificarIndice,
  filtrarCatalogo,
  lerIndice,
  paginar,
  type Destaque,
  type GrupoCatalogo,
  type GrupoIndice,
  type PedidoCatalogo,
} from "./catalogoFiltros";

let relogio = 0;

function grupo(
  grupoModelo: string,
  extra: Partial<GrupoCatalogo> = {},
): GrupoCatalogo {
  relogio += 1;
  return {
    grupoModelo,
    ref: grupoModelo.toUpperCase(),
    nome: grupoModelo,
    marca: "daikin",
    familia: "ar-condicionado",
    precoDesdeCents: 100000,
    numVariantes: 1,
    destaques: [],
    capa: null,
    textoBusca: "",
    peso: 0,
    criadoEm: relogio,
    ...extra,
  };
}

const indice = (grupos: Array<GrupoCatalogo>) =>
  lerIndice(codificarIndice(grupos));

const nomes = (r: { grupos: Array<GrupoIndice> }) =>
  r.grupos.map((g) => g.grupoModelo).sort();

describe("index encoding", () => {
  it("round-trips a group, omitting defaults on the wire", () => {
    const destaques: Array<Destaque> = [
      { chave: "frio-kw", tipo: "intervalo", min: 2.5, max: 7.1 },
      { chave: "classe-energetica", tipo: "valores", valores: ["A+++/A++"] },
    ];
    const completo = grupo("daikin-perfera", {
      ref: "FTXM25",
      nome: "Mural Perfera",
      gama: "Perfera",
      tipoUnidade: "mural",
      precoDesdeCents: 90000,
      numVariantes: 4,
      destaques,
      capa: "kg2abc",
      textoBusca: "ftxm35 ftxm50",
      peso: 0,
    });
    const simples = grupo("daikin-bomba", { peso: 6 });

    const linhas = codificarIndice([completo, simples]);
    expect(linhas).toEqual([
      // Newest first.
      {
        g: "daikin-bomba",
        r: "DAIKIN-BOMBA",
        n: "daikin-bomba",
        m: "daikin",
        f: "ar-condicionado",
        p: 100000,
        w: 6,
        x: 1,
      },
      {
        g: "daikin-perfera",
        r: "FTXM25",
        n: "Mural Perfera",
        m: "daikin",
        f: "ar-condicionado",
        p: 90000,
        v: 4,
        gama: "Perfera",
        t: "mural",
        d: { "frio-kw": [2.5, 7.1], "classe-energetica": ["A+++/A++"] },
        b: "ftxm35 ftxm50",
      },
    ]);

    const [bomba, perfera] = lerIndice(linhas);
    expect(perfera).toEqual({
      grupoModelo: "daikin-perfera",
      ref: "FTXM25",
      nome: "Mural Perfera",
      marca: "daikin",
      familia: "ar-condicionado",
      gama: "Perfera",
      tipoUnidade: "mural",
      precoDesdeCents: 90000,
      numVariantes: 4,
      destaques,
      temCapa: true,
      peso: 0,
      recencia: 1,
      texto: "mural perfera ftxm25 ftxm35 ftxm50 perfera daikin daikin-perfera",
    });
    expect(bomba).toMatchObject({
      numVariantes: 1,
      destaques: [],
      temCapa: false,
      peso: 6,
      recencia: 0,
    });
  });
});

describe("search, familia and marca", () => {
  const grupos = indice([
    grupo("daikin-perfera", {
      nome: "Mural Perfera",
      ref: "FTXM25",
      textoBusca: "ftxm35",
    }),
    grupo("daikin-deposito", {
      nome: "Depósito Águas Quentes",
      familia: "aqs",
      ref: "EKHWS200",
    }),
    grupo("mitsubishi-msz-ap", {
      nome: "Mural MSZ-AP",
      marca: "mitsubishi",
      ref: "MSZ-AP25",
    }),
  ]);

  it("searches without diacritics, by any variant's ref, words in any order", () => {
    expect(nomes(filtrarCatalogo(grupos, { busca: "aguas" }))).toEqual([
      "daikin-deposito",
    ]);
    expect(nomes(filtrarCatalogo(grupos, { busca: "FTXM35" }))).toEqual([
      "daikin-perfera",
    ]);
    expect(nomes(filtrarCatalogo(grupos, { busca: "msz-ap25" }))).toEqual([
      "mitsubishi-msz-ap",
    ]);
    expect(nomes(filtrarCatalogo(grupos, { busca: "daikin mural" }))).toEqual(
      nomes(filtrarCatalogo(grupos, { busca: "mural daikin" })),
    );
  });

  it("lifts its own filter from the familia and marca counts", () => {
    // "Mural" matches both brands; the brand facet lists both, the family
    // facet (marca lifted) lists only ar-condicionado.
    const murais = filtrarCatalogo(grupos, { busca: "mural", marca: "daikin" });
    expect(nomes(murais)).toEqual(["daikin-perfera"]);
    expect(murais.marcas.map((m) => m.valor).sort()).toEqual([
      "daikin",
      "mitsubishi",
    ]);
    expect(murais.familias).toEqual([
      { valor: "ar-condicionado", contagem: 1 },
    ]);
  });
});

describe("ordering", () => {
  const grupos = indice([
    grupo("g-a", { nome: "Alfa", precoDesdeCents: 300 }),
    grupo("g-b", { nome: "Beta", precoDesdeCents: 100, peso: 4 }),
    grupo("g-c", { nome: "Águia", precoDesdeCents: 200 }),
  ]);
  const ordem = (pedido: PedidoCatalogo) =>
    filtrarCatalogo(grupos, pedido).grupos.map((g) => g.grupoModelo);

  it("sorts by price, name (Portuguese collation) and recency", () => {
    expect(ordem({ ordenar: "preco-asc" })).toEqual(["g-b", "g-c", "g-a"]);
    expect(ordem({ ordenar: "preco-desc" })).toEqual(["g-a", "g-c", "g-b"]);
    expect(ordem({ ordenar: "nome" })).toEqual(["g-c", "g-a", "g-b"]);
    expect(ordem({ ordenar: "recentes" })).toEqual(["g-c", "g-b", "g-a"]);
  });

  it("orders by weight then name by default, and by match quality when searching", () => {
    expect(ordem({})).toEqual(["g-c", "g-a", "g-b"]);
    // "beta" is a whole word of g-b's name: it leads despite its weight.
    const busca = indice([
      grupo("g-x", { nome: "Kit alfabeta" }),
      grupo("g-y", { nome: "Beta", peso: 4 }),
    ]);
    expect(
      filtrarCatalogo(busca, { busca: "beta" }).grupos.map(
        (g) => g.grupoModelo,
      ),
    ).toEqual(["g-y", "g-x"]);
  });

  it("clamps the page into range", () => {
    expect(paginar(3, 9, 2)).toEqual({
      pagina: 1,
      numPaginas: 2,
      inicio: 2,
      fim: 3,
    });
    expect(paginar(0, 0, 24)).toEqual({
      pagina: 0,
      numPaginas: 1,
      inicio: 0,
      fim: 0,
    });
  });
});

describe("hero-spec filters", () => {
  // Four murals and a group without frio-kw, all ar-condicionado, plus an
  // aqs tank.
  const mural = (
    grupoModelo: string,
    min: number,
    max: number,
    classe?: string,
  ) =>
    grupo(grupoModelo, {
      destaques: [
        { chave: "frio-kw", tipo: "intervalo", min, max },
        ...(classe
          ? [
              {
                chave: "classe-energetica",
                tipo: "valores" as const,
                valores: [classe],
              },
            ]
          : []),
      ],
    });
  const grupos = indice([
    mural("g-a", 2.5, 3.5, "A++/A+"),
    mural("g-b", 5, 7.1, "A+++/A++"),
    mural("g-c", 3.5, 5, "A++/A+"),
    mural("g-d", 10, 10),
    grupo("g-sem-kw", {
      destaques: [
        { chave: "classe-energetica", tipo: "valores", valores: ["A+/A"] },
      ],
    }),
    grupo("g-tank", {
      familia: "aqs",
      destaques: [
        { chave: "deposito-l", tipo: "intervalo", min: 200, max: 200 },
      ],
    }),
  ]);
  const ac = (filtros: PedidoCatalogo["filtros"]) =>
    filtrarCatalogo(grupos, { familia: "ar-condicionado", filtros });

  it("matches numeric ranges by overlap with the group's span", () => {
    // g-b (5–7.1) and g-c (3.5–5) overlap 4–6; g-a, g-d and the group
    // without frio-kw do not.
    expect(nomes(ac({ "frio-kw": { min: 4, max: 6 } }))).toEqual([
      "g-b",
      "g-c",
    ]);
    expect(nomes(ac({ "frio-kw": { min: 7.1 } }))).toEqual(["g-b", "g-d"]);
  });

  it("matches value filters on any selected value and combines keys", () => {
    const classes = { valores: ["A+++/A++", "A+/A"] };
    expect(nomes(ac({ "classe-energetica": classes }))).toEqual([
      "g-b",
      "g-sem-kw",
    ]);
    expect(
      nomes(ac({ "classe-energetica": classes, "frio-kw": { max: 6 } })),
    ).toEqual(["g-b"]);
  });

  it("ignores filters without a familia, off-familia keys and empty filters", () => {
    const semFamilia = filtrarCatalogo(grupos, {
      filtros: { "frio-kw": { min: 100 } },
    });
    expect(semFamilia.grupos).toHaveLength(6);
    expect(semFamilia.facetas).toEqual([]);

    const vazios = ac({
      "deposito-l": { min: 1000 },
      "frio-kw": {},
      "classe-energetica": { valores: [] },
    });
    expect(vazios.grupos).toHaveLength(5);
  });

  it("returns facets computed after the other filters, own filter lifted", () => {
    const lista = ac({
      "frio-kw": { min: 4 },
      "classe-energetica": { valores: ["A++/A+"] },
    });
    expect(nomes(lista)).toEqual(["g-c"]);
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

    expect(ac(undefined).facetas).toEqual([
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

  it("applies hero filters to the brand counts but not the family counts", () => {
    const lista = ac({ "frio-kw": { min: 9 } });
    expect(lista.marcas).toEqual([{ valor: "daikin", contagem: 1 }]);
    expect(lista.familias).toEqual([
      { valor: "ar-condicionado", contagem: 5 },
      { valor: "aqs", contagem: 1 },
    ]);
  });
});

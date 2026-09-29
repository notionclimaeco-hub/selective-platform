import { describe, expect, it } from "vitest";
import {
  classificarDiff,
  contarRun,
  dobrarCompatibilidade,
  filtrarGrupos,
  filtrarPorCriterios,
  gruposPorRever,
  resumirGrupos,
  type LinhaRevisao,
  type ResumoGrupo,
} from "./importacoes";

function linha(extra: Partial<LinhaRevisao> = {}): LinhaRevisao {
  return {
    grupoModelo: "hisense-energy",
    nomeGrupo: "Mural Energy",
    marca: "hisense",
    familia: "ar-condicionado",
    componente: "conjunto",
    avisos: [],
    diff: "igual",
    grupoRevisto: false,
    ...extra,
  };
}

describe("classificarDiff", () => {
  it("is novo without a live row", () => {
    expect(classificarDiff(null, 100)).toEqual({ diff: "novo" });
  });
  it("is alterado when the live price differs and keeps the old price", () => {
    expect(classificarDiff({ pvpCents: 90 }, 100)).toEqual({
      diff: "alterado",
      precoAnteriorCents: 90,
    });
  });
  it("is igual with the same price and still records the old price", () => {
    expect(classificarDiff({ pvpCents: 100 }, 100)).toEqual({
      diff: "igual",
      precoAnteriorCents: 100,
    });
  });
});

describe("dobrarCompatibilidade", () => {
  const base = [{ chave: "frio-kw", valor: "2.5" }];
  it("appends compativel-com as a comma list", () => {
    expect(dobrarCompatibilidade(base, ["A", " B "])).toEqual([
      ...base,
      { chave: "compativel-com", valor: "A,B" },
    ]);
  });
  it("leaves atributos alone when the list is missing or empty", () => {
    expect(dobrarCompatibilidade(base, undefined)).toEqual(base);
    expect(dobrarCompatibilidade(base, [])).toEqual(base);
  });
  it("does not add the key when every entry is blank", () => {
    expect(dobrarCompatibilidade(base, ["", "  "])).toEqual(base);
  });
  it("keeps an existing compativel-com attribute", () => {
    const com = [...base, { chave: "compativel-com", valor: "X" }];
    expect(dobrarCompatibilidade(com, ["A"])).toEqual(com);
  });
});

describe("resumirGrupos", () => {
  it("summarises each group and sorts by nomeGrupo then grupoModelo", () => {
    const resumos = resumirGrupos([
      linha({ grupoModelo: "z", nomeGrupo: "Zeta", diff: "novo" }),
      linha({ diff: "alterado", avisos: ["frio-kw: em falta"] }),
      linha({ diff: "igual", grupoRevisto: true }),
      linha({ grupoModelo: "a", nomeGrupo: "Alfa", grupoRevisto: true }),
    ]);
    expect(resumos.map((r) => r.grupoModelo)).toEqual([
      "a",
      "hisense-energy",
      "z",
    ]);
    expect(resumos[1]).toEqual({
      grupoModelo: "hisense-energy",
      nomeGrupo: "Mural Energy",
      marca: "hisense",
      familia: "ar-condicionado",
      componente: "conjunto",
      numSkus: 2,
      numAvisos: 1,
      numNovos: 0,
      numAlterados: 1,
      numIguais: 1,
      revisto: false,
      precisaRevisao: true,
      temImagens: false,
    });
    expect(resumos[0]?.precisaRevisao).toBe(false);
    expect(resumos[2]?.precisaRevisao).toBe(false);
  });

  it("carries the first row's gama, sistema, tipoUnidade and segmento", () => {
    const [r] = resumirGrupos([
      linha({
        gama: "Energy",
        sistema: "mono-split",
        tipoUnidade: "mural",
        segmento: "domestico",
      }),
      linha({ gama: "Outra" }),
    ]);
    expect(r).toMatchObject({
      gama: "Energy",
      sistema: "mono-split",
      tipoUnidade: "mural",
      segmento: "domestico",
    });
  });

  it("is revisto only when every row is revisto", () => {
    const [r] = resumirGrupos([
      linha({ grupoRevisto: true }),
      linha({ grupoRevisto: false }),
    ]);
    expect(r?.revisto).toBe(false);
  });
});

describe("gruposPorRever and filtrarGrupos", () => {
  const resumos = resumirGrupos([
    linha({ grupoModelo: "limpo", nomeGrupo: "Limpo" }),
    linha({ grupoModelo: "aviso", nomeGrupo: "Aviso", avisos: ["x"] }),
    linha({ grupoModelo: "preco", nomeGrupo: "Preco", diff: "alterado" }),
    linha({ grupoModelo: "novo", nomeGrupo: "Novo", diff: "novo" }),
    linha({
      grupoModelo: "visto",
      nomeGrupo: "Visto",
      diff: "alterado",
      grupoRevisto: true,
    }),
  ]);

  it("lists only groups that need review and are not revisto", () => {
    expect(gruposPorRever(resumos)).toEqual(["aviso", "preco"]);
  });

  it("filters by the review page's tabs", () => {
    const ids = (f: Parameters<typeof filtrarGrupos>[1]) =>
      filtrarGrupos(resumos, f).map((r) => r.grupoModelo);
    expect(ids("todos")).toEqual(["aviso", "limpo", "novo", "preco", "visto"]);
    expect(ids("por-rever")).toEqual(["aviso", "preco"]);
    expect(ids("com-avisos")).toEqual(["aviso"]);
    expect(ids("alterados")).toEqual(["preco", "visto"]);
    expect(ids("novos")).toEqual(["novo"]);
  });
});

describe("filtrarPorCriterios", () => {
  const resumos = resumirGrupos([
    linha({ grupoModelo: "limpo", nomeGrupo: "Mural Limpo", familia: "aqs" }),
    linha({ grupoModelo: "aviso", nomeGrupo: "Cassete Aviso", avisos: ["x"] }),
    linha({ grupoModelo: "preco", nomeGrupo: "Mural Preco", diff: "alterado" }),
    linha({
      grupoModelo: "visto",
      nomeGrupo: "Mural Visto",
      diff: "alterado",
      avisos: ["y"],
      grupoRevisto: true,
    }),
  ]);
  const ids = (c: Parameters<typeof filtrarPorCriterios>[1]) =>
    filtrarPorCriterios(resumos, c).map((r) => r.grupoModelo);

  it("returns everything without criteria", () => {
    expect(ids({})).toEqual(["aviso", "limpo", "preco", "visto"]);
  });
  it("matches text against nomeGrupo and grupoModelo, case-insensitively", () => {
    expect(ids({ busca: "mural" })).toEqual(["limpo", "preco", "visto"]);
    expect(ids({ busca: "AVI" })).toEqual(["aviso"]);
    expect(ids({ busca: "  " })).toEqual(["aviso", "limpo", "preco", "visto"]);
  });
  it("filters by familia", () => {
    expect(ids({ familia: "aqs" })).toEqual(["limpo"]);
  });
  it("combines the toggles with AND", () => {
    expect(ids({ soAvisos: true })).toEqual(["aviso", "visto"]);
    expect(ids({ soAlterados: true })).toEqual(["preco", "visto"]);
    expect(ids({ soPorRever: true })).toEqual(["aviso", "preco"]);
    expect(ids({ soAvisos: true, soAlterados: true })).toEqual(["visto"]);
    expect(ids({ soAvisos: true, soPorRever: true })).toEqual(["aviso"]);
    expect(ids({ busca: "mural", soAlterados: true, soPorRever: true })).toEqual([
      "preco",
    ]);
  });
});

describe("contarRun", () => {
  it("counts skus, groups, diffs and rows with avisos", () => {
    expect(
      contarRun([
        linha({ diff: "novo", avisos: ["a", "b"] }),
        linha({ diff: "alterado" }),
        linha({ grupoModelo: "outro", diff: "igual", avisos: ["c"] }),
      ]),
    ).toEqual({
      numSkus: 3,
      numGrupos: 2,
      numNovos: 1,
      numAlterados: 1,
      numIguais: 1,
      numComAvisos: 2,
    });
  });
});

describe("soSemImagens", () => {
  it("keeps only groups without images", () => {
    const r = (g: string, temImagens: boolean): ResumoGrupo => ({
      grupoModelo: g,
      nomeGrupo: g,
      marca: "m",
      familia: "f",
      componente: "conjunto",
      numSkus: 1,
      numAvisos: 0,
      numNovos: 1,
      numAlterados: 0,
      numIguais: 0,
      revisto: false,
      precisaRevisao: false,
      temImagens,
    });
    expect(
      filtrarPorCriterios([r("a", true), r("b", false)], { soSemImagens: true }).map(
        (x) => x.grupoModelo,
      ),
    ).toEqual(["b"]);
  });
});

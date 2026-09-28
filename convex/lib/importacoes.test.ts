import { describe, expect, it } from "vitest";
import {
  classificarDiff,
  contarRun,
  dobrarCompatibilidade,
  filtrarGrupos,
  gruposPorRever,
  resumirGrupos,
  type LinhaRevisao,
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
    });
    expect(resumos[0]?.precisaRevisao).toBe(false);
    expect(resumos[2]?.precisaRevisao).toBe(false);
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

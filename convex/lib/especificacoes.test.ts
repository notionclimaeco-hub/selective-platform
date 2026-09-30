import { describe, expect, it } from "vitest";
import {
  atributosComuns,
  chavesVariaveis,
  ordenarChaves,
} from "./especificacoes";

describe("ordenarChaves", () => {
  it("puts hero specs first, then registry order, then unknown keys as given", () => {
    expect(
      ordenarChaves("ar-condicionado", [
        "capacidade",
        "btu",
        "refrigerante",
        "classe-energetica",
        "modo",
        "frio-kw",
      ]),
    ).toEqual([
      "frio-kw",
      "classe-energetica",
      "btu",
      "refrigerante",
      "capacidade",
      "modo",
    ]);
  });

  it("follows each familia's own hero keys", () => {
    expect(
      ordenarChaves("aqs", [
        "cop",
        "classe-energetica",
        "calor-kw",
        "deposito-l",
      ]),
    ).toEqual(["deposito-l", "calor-kw", "classe-energetica", "cop"]);
  });
});

describe("model table and shared specs", () => {
  const skus = [
    {
      atributos: [
        { chave: "btu", valor: "9000" },
        { chave: "refrigerante", valor: "R32" },
        { chave: "classe-energetica", valor: "A+++/A++" },
        { chave: "frio-kw", valor: "2.5" },
      ],
    },
    {
      atributos: [
        { chave: "btu", valor: "12000" },
        { chave: "refrigerante", valor: "R32" },
        { chave: "classe-energetica", valor: "A+++/A++" },
        { chave: "frio-kw", valor: "3.5" },
        { chave: "wifi", valor: "sim" },
      ],
    },
  ];

  it("makes varying keys columns, hero-first rather than BTU-first", () => {
    expect(chavesVariaveis(skus, "ar-condicionado")).toEqual([
      "frio-kw",
      "btu",
      "wifi",
    ]);
    expect(chavesVariaveis(skus.slice(0, 1), "ar-condicionado")).toEqual([]);
  });

  it("lists shared attributes in registry order", () => {
    expect(atributosComuns(skus, "ar-condicionado")).toEqual([
      { chave: "classe-energetica", valor: "A+++/A++" },
      { chave: "refrigerante", valor: "R32" },
    ]);
    expect(atributosComuns([], "ar-condicionado")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest"

import {
  atributosComuns,
  avisosDoGrupo,
  chavesVariaveis,
  grupoInalterado,
  rotuloValor,
  textoAprovacao,
} from "./revisao"

const sku = (
  ref: string,
  atributos: Array<[string, string]>,
  pvpCents = 100
) => ({
  ref,
  pvpCents,
  atributos: atributos.map(([chave, valor]) => ({ chave, valor })),
})

describe("chavesVariaveis", () => {
  it("is empty for a single SKU", () => {
    expect(
      chavesVariaveis([sku("A", [["frio-kw", "2.5"]])], "ar-condicionado")
    ).toEqual([])
  })

  it("keeps only keys whose values differ, hero specs first, then registry order", () => {
    const skus = [
      sku("A", [
        ["cor", "branco"],
        ["wifi", "sim"],
        ["frio-kw", "2.5"],
        ["calor-kw", "3.2"],
        ["btu", "9000"],
      ]),
      sku("B", [
        ["cor", "preto"],
        ["wifi", "sim"],
        ["frio-kw", "3.5"],
        ["calor-kw", "3.2"],
        ["btu", "12000"],
      ]),
    ]
    expect(chavesVariaveis(skus, "ar-condicionado")).toEqual([
      "frio-kw",
      "btu",
      "cor",
    ])
  })

  it("treats a key missing on some SKUs as varying", () => {
    const skus = [
      sku("A", [
        ["frio-kw", "2.5"],
        ["seer", "6.1"],
      ]),
      sku("B", [["frio-kw", "2.5"]]),
    ]
    expect(chavesVariaveis(skus, "ar-condicionado")).toEqual(["seer"])
  })

  it("falls back to extraction order for an unknown familia", () => {
    const skus = [
      sku("A", [
        ["x", "1"],
        ["y", "1"],
      ]),
      sku("B", [
        ["x", "2"],
        ["y", "2"],
      ]),
    ]
    expect(chavesVariaveis(skus, "inexistente")).toEqual(["x", "y"])
  })
})

describe("atributosComuns", () => {
  it("returns every attribute of a single SKU", () => {
    const a = sku("A", [
      ["frio-kw", "2.5"],
      ["cor", "branco"],
    ])
    expect(atributosComuns([a], "ar-condicionado")).toEqual(a.atributos)
  })
  it("returns the attributes shared with the same value by every SKU", () => {
    const skus = [
      sku("A", [
        ["frio-kw", "2.5"],
        ["refrigerante", "R32"],
        ["wifi", "sim"],
      ]),
      sku("B", [
        ["frio-kw", "3.5"],
        ["refrigerante", "R32"],
      ]),
    ]
    expect(atributosComuns(skus, "ar-condicionado")).toEqual([
      { chave: "refrigerante", valor: "R32" },
    ])
  })
})

describe("avisosDoGrupo", () => {
  it("flattens warnings with their ref, keeping row order", () => {
    expect(
      avisosDoGrupo([
        { ref: "A", avisos: ["a1", "a2"] },
        { ref: "B", avisos: [] },
        { ref: "C", avisos: ["c1"] },
      ])
    ).toEqual([
      { ref: "A", aviso: "a1" },
      { ref: "A", aviso: "a2" },
      { ref: "C", aviso: "c1" },
    ])
  })
})

describe("grupoInalterado", () => {
  it("is true only with no warnings, no new and no changed SKUs", () => {
    expect(
      grupoInalterado({ numAvisos: 0, numNovos: 0, numAlterados: 0 })
    ).toBe(true)
    expect(
      grupoInalterado({ numAvisos: 1, numNovos: 0, numAlterados: 0 })
    ).toBe(false)
    expect(
      grupoInalterado({ numAvisos: 0, numNovos: 1, numAlterados: 0 })
    ).toBe(false)
    expect(
      grupoInalterado({ numAvisos: 0, numNovos: 0, numAlterados: 1 })
    ).toBe(false)
  })
})

describe("rotuloValor", () => {
  it("replaces slug dashes with spaces and leaves numbers and classes alone", () => {
    expect(rotuloValor("branco-perola")).toBe("branco perola")
    expect(rotuloValor("2.5")).toBe("2.5")
    expect(rotuloValor("A++/A+")).toBe("A++/A+")
  })
})

describe("textoAprovacao", () => {
  it("is the plain approval when nothing is left to review", () => {
    const t = textoAprovacao(709, "Hisense", 0)
    expect(t.confirmarLabel).toBe("Aprovar")
    expect(t.descricao).toMatch(/^Publica 709 SKUs/)
  })

  it("says how many groups are unreviewed and asks to approve anyway", () => {
    expect(textoAprovacao(709, "Hisense", 1).descricao).toMatch(
      /^1 grupo ainda por rever/
    )
    const t = textoAprovacao(709, "Hisense", 86)
    expect(t.confirmarLabel).toBe("Aprovar mesmo assim")
    expect(t.descricao).toMatch(/^86 grupos ainda por rever.*Publica 709 SKUs/)
  })
})

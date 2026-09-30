import { describe, expect, it } from "vitest"

import {
  formatarValor,
  linhaDestaques,
  rotuloChave,
  rotuloCurto,
} from "./especificacoes"

describe("linhaDestaques (card spec line)", () => {
  it("shows a mural's cooling span and best energy class, not two kW spans", () => {
    expect(
      linhaDestaques([
        { chave: "frio-kw", tipo: "intervalo", min: 2.5, max: 7.1 },
        { chave: "calor-kw", tipo: "intervalo", min: 3.2, max: 8.2 },
        {
          chave: "classe-energetica",
          tipo: "valores",
          valores: ["A+++/A+", "A++/A+"],
        },
      ])
    ).toEqual(["2,5–7,1 kW", "A+++/A+"])
  })

  it("shows a tank's litres before its heating power", () => {
    expect(
      linhaDestaques([
        { chave: "deposito-l", tipo: "intervalo", min: 200, max: 200 },
        { chave: "calor-kw", tipo: "intervalo", min: 3.5, max: 3.5 },
      ])
    ).toEqual(["200 L", "3,5 kW"])
  })

  it("stops at three specs and labels value lists", () => {
    expect(
      linhaDestaques([
        { chave: "area-m2", tipo: "intervalo", min: 40, max: 40 },
        { chave: "cadr-m3h", tipo: "intervalo", min: 300, max: 450 },
        { chave: "nivel-sonoro-db", tipo: "intervalo", min: 19, max: 53 },
      ])
    ).toEqual(["40 m²", "300–450 m³/h", "19–53 dB"])
    expect(
      linhaDestaques([
        { chave: "frio-kw", tipo: "intervalo", min: 1.5, max: 5 },
        { chave: "tubos", tipo: "valores", valores: ["2", "4"] },
      ])
    ).toEqual(["1,5–5 kW", "2/4 tubos"])
    expect(
      linhaDestaques([
        { chave: "tipo", tipo: "valores", valores: ["comando"] },
        {
          chave: "compativel-com",
          tipo: "valores",
          valores: ["CTXM", "FTXJ", "FTXM"],
        },
        { chave: "cor", tipo: "valores", valores: ["branco", "branco-perola"] },
      ])
    ).toEqual(["Comando", "CTXM/FTXJ +1", "Branco/Branco pérola"])
  })

  it("is empty for pre-registry rows without hero specs", () => {
    expect(linhaDestaques([])).toEqual([])
  })
})

describe("labels and values", () => {
  it("labels registry keys with their unit, and pre-registry keys too", () => {
    expect(rotuloChave("deposito-l")).toBe("Depósito (L)")
    expect(rotuloCurto("deposito-l")).toBe("Depósito")
    expect(rotuloChave("capacidade")).toBe("Capacidade (kW)")
    expect(rotuloChave("chave-nova")).toBe("Chave nova")
  })

  it("formats numbers, enums and dimensions; leaves free text alone", () => {
    expect(formatarValor("frio-kw", "2.5")).toBe("2,5")
    expect(formatarValor("alimentacao", "monofasica")).toBe("Monofásica")
    expect(formatarValor("wifi", "nao")).toBe("Não")
    expect(formatarValor("dimensoes-ui", "295x798.5x229")).toBe(
      "295 × 798,5 × 229"
    )
    expect(formatarValor("compativel-com", "MSZ-AP, MSZ-LN")).toBe(
      "MSZ-AP, MSZ-LN"
    )
    expect(formatarValor("modo", "so-frio")).toBe("so frio")
  })
})

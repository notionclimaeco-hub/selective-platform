import { describe, expect, it } from "vitest"

import { lerFiltroEncomendas, passosEncomenda } from "./encomendas"

describe("lerFiltroEncomendas", () => {
  it("keeps a known chip and drops anything else", () => {
    expect(lerFiltroEncomendas({ filtro: "a-pagar" })).toEqual({
      filtro: "a-pagar",
    })
    expect(lerFiltroEncomendas({ filtro: "canceladas" })).toEqual({
      filtro: "canceladas",
    })
    expect(lerFiltroEncomendas({})).toEqual({})
    expect(lerFiltroEncomendas({ filtro: "paga" })).toEqual({})
    expect(lerFiltroEncomendas({ filtro: 3 })).toEqual({})
  })
})

describe("passosEncomenda after payment (#78)", () => {
  const base = {
    placedAt: Date.UTC(2026, 8, 1),
    stockRequestedAt: Date.UTC(2026, 8, 2),
    paymentRequestedAt: Date.UTC(2026, 8, 3),
    paidAt: Date.UTC(2026, 8, 4),
  }
  const estados = (e: Parameters<typeof passosEncomenda>[0]) =>
    passosEncomenda(e).map((p) => p.estado)

  it("paga is on the suppliers step", () => {
    expect(estados({ ...base, estado: "paga" })).toEqual([
      "feito",
      "feito",
      "feito",
      "actual",
      "futuro",
    ])
  })

  it("pronta_a_levantar makes the pickup step current", () => {
    const passos = passosEncomenda({
      ...base,
      estado: "pronta_a_levantar",
      prontaAt: Date.UTC(2026, 8, 10),
    })
    expect(passos.map((p) => p.estado)).toEqual([
      "feito",
      "feito",
      "feito",
      "feito",
      "actual",
    ])
    expect(passos[4]?.detalhe).toMatch(/^No nosso armazém desde /)
  })

  it("concluida marks the pickup done with its date", () => {
    const passos = passosEncomenda({
      ...base,
      estado: "concluida",
      prontaAt: Date.UTC(2026, 8, 10),
      levantadaAt: Date.UTC(2026, 8, 12),
    })
    expect(passos.every((p) => p.estado === "feito")).toBe(true)
    expect(passos[4]?.detalhe).toMatch(/^Levantada /)
  })

  it("concluida with nothing collected says so", () => {
    const passos = passosEncomenda({ ...base, estado: "concluida" })
    expect(passos[4]?.detalhe).toBe("Nada a levantar")
  })
})

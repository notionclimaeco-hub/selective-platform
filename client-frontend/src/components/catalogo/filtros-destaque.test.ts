import { describe, expect, it } from "vitest"

import { escalaFaceta } from "./filtros-destaque"

describe("escalaFaceta (hero range slider)", () => {
  it("maps wide spans logarithmically and rounds to two significant figures", () => {
    const kw = escalaFaceta(1.2, 56)
    expect(kw.paraValor(0)).toBe(1.2)
    expect(kw.paraValor(1000)).toBe(56)
    // The middle of the track is the geometric mean (~8,2 kW), not 28,6 kW.
    expect(kw.paraValor(500)).toBe(8.2)
    expect(kw.paraValor(kw.paraPosicao(3.5))).toBe(3.5)
  })

  it("maps narrow spans linearly", () => {
    const litros = escalaFaceta(150, 500)
    expect(litros.paraValor(500)).toBe(330)
    expect(litros.paraPosicao(150)).toBe(0)
    expect(litros.paraPosicao(500)).toBe(1000)
  })
})

import { describe, expect, it } from "vitest"

import {
  ZOOM_MAX,
  ZOOM_MIN,
  scrollAncorado,
  zoomPorRoda,
  zoomSeguinte,
} from "./zoom"

describe("zoomSeguinte", () => {
  it("steps through the presets and stops at the ends", () => {
    expect(zoomSeguinte(1, 1)).toBe(1.25)
    expect(zoomSeguinte(1.25, -1)).toBe(1)
    expect(zoomSeguinte(ZOOM_MIN, -1)).toBe(ZOOM_MIN)
    expect(zoomSeguinte(ZOOM_MAX, 1)).toBe(ZOOM_MAX)
  })

  it("from an in-between zoom (wheel) goes to the next preset in that direction", () => {
    expect(zoomSeguinte(1.6, 1)).toBe(2)
    expect(zoomSeguinte(1.6, -1)).toBe(1.5)
  })
})

describe("zoomPorRoda", () => {
  it("zooms in on wheel up, out on wheel down, clamped", () => {
    expect(zoomPorRoda(1, -100)).toBeGreaterThan(1)
    expect(zoomPorRoda(2, 100)).toBeLessThan(2)
    expect(zoomPorRoda(1, 1000)).toBe(ZOOM_MIN)
    expect(zoomPorRoda(4, -1000)).toBe(ZOOM_MAX)
  })
})

describe("scrollAncorado", () => {
  it("keeps the point under the anchor still when the content grows", () => {
    // Content 500 px wide, scrolled 100, anchor 50 px into the viewport:
    // the point at 150/500 = 30% must stay 50 px from the left at 1000 px.
    expect(
      scrollAncorado({
        scroll: 100,
        ancora: 50,
        tamanho: 500,
        novoTamanho: 1000,
      })
    ).toBe(250)
  })

  it("never goes below zero", () => {
    expect(
      scrollAncorado({
        scroll: 0,
        ancora: 200,
        tamanho: 1000,
        novoTamanho: 500,
      })
    ).toBe(0)
  })
})

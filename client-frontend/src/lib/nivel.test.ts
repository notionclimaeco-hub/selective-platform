import { describe, expect, it } from "vitest"

import { faltaParaProximo, progressoNivel } from "./nivel"

describe("progressoNivel", () => {
  it("is empty at zero volume and full at the threshold", () => {
    expect(progressoNivel(0, 1_000_000)).toBe(0)
    expect(progressoNivel(1_000_000, 1_000_000)).toBe(100)
  })

  it("rounds the fraction to whole percent", () => {
    expect(progressoNivel(333_333, 1_000_000)).toBe(33)
    expect(progressoNivel(5_000, 1_000_000)).toBe(1)
  })

  it("clamps above the threshold and treats a zero threshold as full", () => {
    expect(progressoNivel(2_000_000, 1_000_000)).toBe(100)
    expect(progressoNivel(0, 0)).toBe(100)
  })

  it("never goes negative", () => {
    expect(progressoNivel(-500, 1_000_000)).toBe(0)
  })
})

describe("faltaParaProximo", () => {
  it("is the gap to the threshold, floored at zero", () => {
    expect(faltaParaProximo(300_000, 1_000_000)).toBe(700_000)
    expect(faltaParaProximo(1_200_000, 1_000_000)).toBe(0)
  })
})

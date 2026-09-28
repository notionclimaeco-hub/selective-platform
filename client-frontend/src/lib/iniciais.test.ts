import { describe, expect, it } from "vitest"

import { iniciais } from "./iniciais"

describe("iniciais", () => {
  it("takes the first letter of the first and last word", () => {
    expect(iniciais("Diogo Azevedo")).toBe("DA")
    expect(iniciais("Maria da Silva Costa")).toBe("MC")
  })
  it("uses one letter for a single word", () => {
    expect(iniciais("diogo2")).toBe("D")
  })
  it("falls back to the local part of an email", () => {
    expect(iniciais("e2e+clerk_test@climaeco.pt")).toBe("E")
    expect(iniciais("ana.costa@climaeco.pt")).toBe("AC")
  })
  it("drops accents and non-letters", () => {
    expect(iniciais("Ágata Ñandu")).toBe("AN")
    expect(iniciais("  ")).toBe("")
    expect(iniciais(null)).toBe("")
  })
})

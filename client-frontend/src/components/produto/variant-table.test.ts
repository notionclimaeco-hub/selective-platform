import { describe, expect, it } from "vitest"

import { rotuloChave } from "./variant-table"

describe("rotuloChave", () => {
  it("labels registry keys with their unit", () => {
    expect(rotuloChave("deposito-l")).toBe("Depósito (L)")
    expect(rotuloChave("nivel-sonoro-db")).toBe("Nível sonoro (dB)")
  })

  it("keeps labels for pre-registry keys still in the live catalog", () => {
    expect(rotuloChave("capacidade")).toBe("Capacidade (kW)")
  })

  it("humanises unknown keys", () => {
    expect(rotuloChave("chave-nova")).toBe("Chave nova")
  })
})

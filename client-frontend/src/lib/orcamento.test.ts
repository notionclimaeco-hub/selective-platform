import { describe, expect, it } from "vitest"

import type { Id } from "@convex/_generated/dataModel"
import { estadoCompra, totaisOrcamento } from "./orcamento"

function empresa(
  estadoAprovacao: "pendente" | "aprovada" | "rejeitada" | "suspensa"
) {
  return {
    kind: "empresa" as const,
    empresa: {
      _id: "js7" as Id<"installerCompanies">,
      clerkOrgId: "org_1",
      nomeLegal: "Clima Teste",
      nif: "500000000",
      morada: "Rua 1",
      email: "a@b.pt",
      telefone: "210000000",
      certifNumero: undefined,
      estadoAprovacao,
      tierNome: null,
    },
  }
}

describe("estadoCompra", () => {
  it("is anonymous without a session, whatever Convex says", () => {
    expect(estadoCompra(false, undefined)).toBe("anonimo")
    expect(estadoCompra(false, null)).toBe("anonimo")
  })

  it("waits while the company view is loading or Convex has no token yet", () => {
    expect(estadoCompra(true, undefined)).toBe("a-carregar")
    expect(estadoCompra(true, null)).toBe("a-carregar")
  })

  it("asks to finish the registration without a company", () => {
    expect(estadoCompra(true, { kind: "sem-org" })).toBe("registo")
    expect(estadoCompra(true, { kind: "sem-empresa", orgId: "org_1" })).toBe(
      "registo"
    )
  })

  it("follows the company's approval state", () => {
    expect(estadoCompra(true, empresa("pendente"))).toBe("pendente")
    expect(estadoCompra(true, empresa("aprovada"))).toBe("aprovada")
    expect(estadoCompra(true, empresa("rejeitada"))).toBe("rejeitada")
    expect(estadoCompra(true, empresa("suspensa"))).toBe("suspensa")
  })
})

describe("totaisOrcamento", () => {
  const itens = [
    { ref: "A", pvpCents: 10_000, quantidade: 2 },
    { ref: "B", pvpCents: 5_000, quantidade: 1 },
  ]

  it("totals at PVP without an overlay", () => {
    expect(totaisOrcamento(itens, null)).toEqual({
      pvpCents: 25_000,
      totalCents: 25_000,
      unidades: 3,
    })
  })

  it("uses reseller prices where the overlay has them, PVP elsewhere", () => {
    expect(totaisOrcamento(itens, new Map([["A", 8_000]]))).toEqual({
      pvpCents: 25_000,
      totalCents: 21_000,
      unidades: 3,
    })
  })

  it("is zero for an empty list", () => {
    expect(totaisOrcamento([], null)).toEqual({
      pvpCents: 0,
      totalCents: 0,
      unidades: 0,
    })
  })
})

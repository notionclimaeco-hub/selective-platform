import { describe, expect, it } from "vitest"

import {
  caminhoDeEntrada,
  caminhoSeguroDeRegresso,
  clientAuthRedirect,
  comRegresso,
  rotuloDeRegresso,
  viaBemVindo,
} from "./auth-gate"

describe("caminhoSeguroDeRegresso", () => {
  it("allows only environment paths", () => {
    expect(caminhoSeguroDeRegresso("/inicio")).toBe("/inicio")
    expect(caminhoSeguroDeRegresso("/empresa")).toBe("/empresa")
    expect(caminhoSeguroDeRegresso("/orcamento")).toBe("/orcamento")
    expect(caminhoSeguroDeRegresso("/encomendas")).toBe("/encomendas")
    expect(caminhoSeguroDeRegresso("/encomendas/j57abc123")).toBe(
      "/encomendas/j57abc123"
    )
    expect(caminhoSeguroDeRegresso("/encomendas/../x")).toBeUndefined()
    expect(caminhoSeguroDeRegresso("/conta")).toBeUndefined()
    expect(caminhoSeguroDeRegresso("/produtos")).toBeUndefined()
    expect(caminhoSeguroDeRegresso("//evil")).toBeUndefined()
    expect(caminhoSeguroDeRegresso("https://evil.example")).toBeUndefined()
  })
})

describe("comRegresso", () => {
  it("carries the return path as a query string", () => {
    expect(comRegresso("/registo", "/orcamento")).toBe(
      "/registo?return=%2Forcamento"
    )
    expect(comRegresso("/entrar", "/encomendas/j57abc123")).toBe(
      "/entrar?return=%2Fencomendas%2Fj57abc123"
    )
  })

  it("leaves the path alone without a return", () => {
    expect(comRegresso("/entrar", undefined)).toBe("/entrar")
  })
})

describe("caminhoDeEntrada / viaBemVindo", () => {
  it("allows the environment and the catalog, defaults to /inicio", () => {
    expect(caminhoDeEntrada("/orcamento")).toBe("/orcamento")
    expect(caminhoDeEntrada("/produtos")).toBe("/produtos")
    expect(caminhoDeEntrada("/produto/X")).toBe("/inicio")
    expect(caminhoDeEntrada("https://evil.example")).toBe("/inicio")
    expect(caminhoDeEntrada(undefined)).toBe("/inicio")
  })

  it("routes through the welcome page", () => {
    expect(viaBemVindo("/orcamento")).toBe("/bem-vindo?para=%2Forcamento")
    expect(viaBemVindo("/nope")).toBe("/bem-vindo?para=%2Finicio")
  })
})

describe("rotuloDeRegresso", () => {
  it("names the destination", () => {
    expect(rotuloDeRegresso("/orcamento")).toBe("Voltar ao orçamento")
    expect(rotuloDeRegresso("/empresa")).toBe("Ver a empresa")
    expect(rotuloDeRegresso("/encomendas")).toBe("Voltar às encomendas")
    expect(rotuloDeRegresso("/encomendas/j57abc123")).toBe(
      "Voltar às encomendas"
    )
    expect(rotuloDeRegresso("/inicio")).toBe("Ir para o início")
  })
})

describe("clientAuthRedirect", () => {
  it("keeps the catalog and the quote list public", () => {
    expect(clientAuthRedirect(null, null, "/")).toBeNull()
    expect(clientAuthRedirect(null, null, "/produtos")).toBeNull()
    expect(clientAuthRedirect(null, null, "/orcamento")).toBeNull()
    expect(clientAuthRedirect("user_1", "org_1", "/produto/X")).toBeNull()
  })

  it("sends signed-out visitors from the environment to /entrar", () => {
    expect(clientAuthRedirect(null, null, "/inicio")).toEqual({
      to: "/entrar",
      search: { return: "/inicio" },
    })
    expect(clientAuthRedirect(null, null, "/empresa")).toEqual({
      to: "/entrar",
      search: { return: "/empresa" },
    })
    expect(clientAuthRedirect(null, null, "/encomendas/abc")).toEqual({
      to: "/entrar",
      search: { return: "/encomendas/abc" },
    })
  })

  it("leaves the old /conta paths to their own redirects", () => {
    expect(clientAuthRedirect(null, null, "/conta")).toBeNull()
  })

  it("lets unsigned visitors stay on /entrar and /registo", () => {
    expect(clientAuthRedirect(null, null, "/entrar")).toBeNull()
    expect(clientAuthRedirect(null, null, "/registo")).toBeNull()
  })

  it("sends signed-in visitors from /entrar to /inicio", () => {
    expect(clientAuthRedirect("user_1", null, "/entrar")).toEqual({
      to: "/inicio",
    })
  })

  it("keeps signed-in users without an org on /registo", () => {
    expect(clientAuthRedirect("user_1", null, "/registo")).toBeNull()
  })

  it("sends signed-in org members from /registo to /empresa", () => {
    expect(clientAuthRedirect("user_1", "org_1", "/registo")).toEqual({
      to: "/empresa",
    })
  })
})

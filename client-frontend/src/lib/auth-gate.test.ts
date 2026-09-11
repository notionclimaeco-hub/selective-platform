import { describe, expect, it } from "vitest"

import {
  caminhoSeguroDeRegresso,
  clientAuthRedirect,
} from "./auth-gate"

describe("caminhoSeguroDeRegresso", () => {
  it("allows only client-area paths", () => {
    expect(caminhoSeguroDeRegresso("/conta")).toBe("/conta")
    expect(caminhoSeguroDeRegresso("/conta/encomendas")).toBe(
      "/conta/encomendas",
    )
    expect(caminhoSeguroDeRegresso("/conta/encomendas/j57abc123")).toBe(
      "/conta/encomendas/j57abc123",
    )
    expect(caminhoSeguroDeRegresso("/conta/encomendas/../x")).toBeUndefined()
    expect(caminhoSeguroDeRegresso("/conta/outra")).toBeUndefined()
    expect(caminhoSeguroDeRegresso("/produtos")).toBeUndefined()
    expect(caminhoSeguroDeRegresso("//evil")).toBeUndefined()
    expect(caminhoSeguroDeRegresso("https://evil.example")).toBeUndefined()
  })
})

describe("clientAuthRedirect", () => {
  it("keeps the catalog public", () => {
    expect(clientAuthRedirect(null, null, "/")).toBeNull()
    expect(clientAuthRedirect(null, null, "/produtos")).toBeNull()
    expect(clientAuthRedirect("user_1", "org_1", "/produto/X")).toBeNull()
  })

  it("sends signed-out visitors from /conta to /entrar", () => {
    expect(clientAuthRedirect(null, null, "/conta")).toEqual({
      to: "/entrar",
      search: { return: "/conta" },
    })
  })

  it("lets unsigned visitors stay on /entrar and /registo", () => {
    expect(clientAuthRedirect(null, null, "/entrar")).toBeNull()
    expect(clientAuthRedirect(null, null, "/registo")).toBeNull()
  })

  it("sends signed-in visitors from /entrar to /conta", () => {
    expect(clientAuthRedirect("user_1", null, "/entrar")).toEqual({
      to: "/conta",
    })
  })

  it("keeps signed-in users without an org on /registo", () => {
    expect(clientAuthRedirect("user_1", null, "/registo")).toBeNull()
  })

  it("sends signed-in org members from /registo to /conta", () => {
    expect(clientAuthRedirect("user_1", "org_1", "/registo")).toEqual({
      to: "/conta",
    })
  })
})

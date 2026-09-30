import { describe, expect, it } from "vitest"

import { lerFiltroEncomendas } from "./encomendas"

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

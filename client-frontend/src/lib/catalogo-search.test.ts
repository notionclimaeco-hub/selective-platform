import { describe, expect, it } from "vitest"

import {
  contarFiltrosAtivos,
  escreverFiltro,
  pedidoCatalogo,
  semFiltrosDestaque,
  validarBusca,
} from "./catalogo-search"

describe("hero filters in the URL", () => {
  it("keeps the chosen familia's hero filters, parsed back the same way", () => {
    const filtros = validarBusca({
      familia: "ar-condicionado",
      "frio-kw": "2.5..7.1",
      "classe-energetica-frio": "A+++,A++",
      "classe-energetica-calor": "A+",
    })
    expect(filtros).toMatchObject({
      "frio-kw": "2.5..7.1",
      "classe-energetica-frio": "A+++,A++",
      "classe-energetica-calor": "A+",
    })
    expect(pedidoCatalogo(filtros).filtros).toEqual({
      "frio-kw": { min: 2.5, max: 7.1 },
      "classe-energetica-frio": { valores: ["A+++", "A++"] },
      "classe-energetica-calor": { valores: ["A+"] },
    })
    expect(contarFiltrosAtivos(filtros)).toBe(4)
  })

  it("accepts open-ended ranges and numbers the router already parsed", () => {
    const filtros = validarBusca({
      familia: "ventiloconvectores",
      "frio-kw": "..5",
      tubos: 4,
    })
    expect(pedidoCatalogo(filtros).filtros).toEqual({
      "frio-kw": { min: undefined, max: 5 },
      tubos: { valores: ["4"] },
    })
  })

  it("drops malformed filters, other familias' keys and filters without a familia", () => {
    expect(
      validarBusca({
        familia: "ar-condicionado",
        "frio-kw": "7..2",
        "calor-kw": "abc..3",
        "deposito-l": "100..200",
        "classe-energetica-frio": " , ",
      })
    ).toEqual({ familia: "ar-condicionado" })
    expect(validarBusca({ "frio-kw": "2..3" })).toEqual({})
  })

  it("keeps only energy classes on a side, and drops pair links from before the split", () => {
    expect(
      validarBusca({
        familia: "ar-condicionado",
        "classe-energetica-frio": "A+++,A+++/A++,-,Z",
        "classe-energetica-calor": "-",
        "classe-energetica": "A+++/A++",
      })
    ).toEqual({ familia: "ar-condicionado", "classe-energetica-frio": "A+++" })
  })

  it("writes ranges and value lists, a lone number as a number, nothing when empty", () => {
    expect(escreverFiltro({ min: 2.5 })).toBe("2.5..")
    expect(escreverFiltro({ min: 2.5, max: 7.1 })).toBe("2.5..7.1")
    expect(escreverFiltro({ valores: ["A+++/A++", "A+/A"] })).toBe(
      "A+++/A++,A+/A"
    )
    expect(escreverFiltro({ valores: ["2"] })).toBe(2)
    expect(escreverFiltro({})).toBeUndefined()
    expect(escreverFiltro({ valores: [] })).toBeUndefined()
  })

  it("strips hero filters when leaving the familia", () => {
    expect(
      semFiltrosDestaque({
        q: "mural",
        familia: "ar-condicionado",
        "frio-kw": "2..3",
      })
    ).toEqual({ q: "mural", familia: "ar-condicionado" })
  })
})

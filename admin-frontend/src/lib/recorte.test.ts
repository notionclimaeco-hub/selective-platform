import { describe, expect, it } from "vitest"

import { caminhoRecursos } from "./recorte"

describe("caminhoRecursos", () => {
  it("points the library at the mirror on the admin's own origin", () => {
    expect(caminhoRecursos("https://admin.climaeco.pt", true)).toBe(
      "https://admin.climaeco.pt/imgly/"
    )
  })

  it("leaves the library on its CDN default when the mirror is absent", () => {
    expect(caminhoRecursos("http://localhost:3000", false)).toBeUndefined()
  })
})

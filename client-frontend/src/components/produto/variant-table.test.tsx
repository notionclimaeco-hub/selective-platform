import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { eurExato } from "@/lib/catalogo"
import { VariantTable, rotuloChave } from "./variant-table"
import type { Variante } from "./variant-table"

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

const variantes: Array<Variante> = [
  {
    ref: "FCAG35B",
    pvpCents: 95000,
    atributos: [{ chave: "frio-kw", valor: "3.5" }],
  },
  {
    ref: "FCAG50B",
    pvpCents: 97500,
    atributos: [{ chave: "frio-kw", valor: "5.0" }],
  },
]

function render(precosRevenda: Map<string, number> | null) {
  return renderToStaticMarkup(
    <VariantTable
      variantes={variantes}
      selectedRef="FCAG35B"
      onSelect={() => {}}
      precosRevenda={precosRevenda}
    />
  )
}

const preco = (cents: number) => eurExato.format(cents / 100)

describe("VariantTable prices per audience", () => {
  it("shows anonymous visitors PVP only, with nothing about resale", () => {
    const html = render(null)
    expect(html).toContain("PVP s/IVA")
    expect(html).toContain(preco(95000))
    expect(html).not.toContain("Revenda")
    expect(html).not.toContain("<s>")
    expect(html).not.toContain("%")
  })

  it("shows approved members Revenda s/IVA with the PVP struck through", () => {
    const html = render(
      new Map([
        ["FCAG35B", 80750],
        ["FCAG50B", 82875],
      ])
    )
    expect(html).toContain("Revenda s/IVA")
    expect(html).toContain(preco(80750))
    expect(html).toContain(`<s>${preco(95000)}</s>`)
    expect(html).toContain(`<s>${preco(97500)}</s>`)
    expect(html).not.toContain("%")
  })

  it("does not strike the PVP when the reseller price is the same", () => {
    const html = render(
      new Map([
        ["FCAG35B", 95000],
        ["FCAG50B", 97500],
      ])
    )
    expect(html).toContain("Revenda s/IVA")
    expect(html).not.toContain("<s>")
  })
})

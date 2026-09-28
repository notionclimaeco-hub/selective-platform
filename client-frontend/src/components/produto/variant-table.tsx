import { Check } from "lucide-react"

import { rotuloChave as rotuloChaveRegisto } from "@convex/lib/specRegistry"

import { eurExato } from "@/lib/catalogo"
import { cn } from "@/lib/utils"

export type Atributo = { chave: string; valor: string }

export type Variante = {
  ref: string
  atributos: Array<Atributo>
  pvpCents: number
}

// Labels come from the spec registry (schema v4). The live catalog still
// carries a few pre-registry keys until the cutover (#53); label those here
// so nothing renders as a raw slug meanwhile.
const ROTULOS_LEGADO: Record<string, string> = {
  capacidade: "Capacidade (kW)",
  deposito: "Depósito",
  comando: "Comando",
  modo: "Modo",
  caudal: "Caudal",
}

export function rotuloChave(chave: string): string {
  return ROTULOS_LEGADO[chave] ?? rotuloChaveRegisto(chave)
}

// Slug values read better with spaces ("branco-perola" -> "branco perola").
export function rotuloValor(valor: string): string {
  return valor.replace(/-/g, " ")
}

// Distinct keys across the group, ordered by first appearance (= extraction
// order: variant axes first, specs after).
function chavesOrdenadas(variantes: Array<Variante>): Array<string> {
  const vistas = new Set<string>()
  const ordem: Array<string> = []
  for (const v of variantes) {
    for (const a of v.atributos) {
      if (!vistas.has(a.chave)) {
        vistas.add(a.chave)
        ordem.push(a.chave)
      }
    }
  }
  return ordem
}

function valorDe(v: Variante, chave: string): string | undefined {
  return v.atributos.find((a) => a.chave === chave)?.valor
}

/**
 * Keys that distinguish SKUs within the group: present with ≥2 distinct
 * values, or missing on some variants. These become the table columns.
 * BTU is the axis installers scan first, so it's pinned right after the ref.
 */
export function chavesVariaveis(variantes: Array<Variante>): Array<string> {
  if (variantes.length < 2) return []
  const chaves = chavesOrdenadas(variantes).filter((chave) => {
    const valores = new Set(variantes.map((v) => valorDe(v, chave)))
    return valores.size > 1
  })
  const btuIdx = chaves.indexOf("btu")
  if (btuIdx > 0) {
    chaves.splice(btuIdx, 1)
    chaves.unshift("btu")
  }
  return chaves
}

/**
 * Attributes shared by every variant of the group (same value everywhere).
 * These render as spec chips instead of table columns. For a single variant
 * this is simply all of its attributes.
 */
export function atributosComuns(variantes: Array<Variante>): Array<Atributo> {
  const primeira = variantes[0]
  if (!primeira) return []
  if (variantes.length === 1) return primeira.atributos
  return primeira.atributos.filter((a) =>
    variantes.every((v) => valorDe(v, a.chave) === a.valor)
  )
}

/**
 * Short human label for a variant = the values of the keys that vary within
 * its group (e.g. "12 · trifasica"). Empty for groups of one.
 */
export function rotuloVariante(
  variante: Variante,
  variantes: Array<Variante>
): string {
  return chavesVariaveis(variantes)
    .map((chave) => valorDe(variante, chave))
    .filter((valor): valor is string => valor !== undefined)
    .map(rotuloValor)
    .join(" · ")
}

function RadioDot({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border",
        ativo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40"
      )}
    >
      {ativo && <Check className="size-3" strokeWidth={3} />}
    </span>
  )
}

/**
 * The product page's model picker: one row per SKU, one column per attribute
 * key that varies within the group, plus price. Clicking a row selects that
 * variant (price, gallery and CTA update).
 *
 * On narrow screens we render stacked cards (no horizontal page scroll);
 * from `md` up we keep the comparison table.
 */
export function VariantTable({
  variantes,
  selectedRef,
  onSelect,
  precosRevenda,
}: {
  variantes: Array<Variante>
  selectedRef: string
  onSelect: (ref: string) => void
  precosRevenda?: Map<string, number> | null
}) {
  const chaves = chavesVariaveis(variantes)
  const rotuloPreco = precosRevenda ? "Revenda s/IVA" : "PVP s/IVA"

  function centsDe(v: Variante): number {
    return precosRevenda?.get(v.ref) ?? v.pvpCents
  }

  return (
    <>
      {/* Mobile: stacked selectable cards — long refs wrap, no page overflow. */}
      <div
        className="flex flex-col gap-2 md:hidden"
        role="radiogroup"
        aria-label="Modelos disponíveis"
      >
        {variantes.map((v) => {
          const ativo = v.ref === selectedRef
          return (
            <button
              key={v.ref}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => onSelect(v.ref)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                ativo
                  ? "border-primary/40 bg-primary/5"
                  : "bg-card hover:bg-secondary/40"
              )}
            >
              <RadioDot ativo={ativo} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-snug font-medium break-all">
                    {v.ref}
                  </p>
                  <p className="shrink-0 text-sm font-semibold text-primary">
                    {eurExato.format(centsDe(v) / 100)}
                  </p>
                </div>
                {chaves.length > 0 && (
                  <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {chaves.map((chave) => {
                      const valor = valorDe(v, chave)
                      return (
                        <div key={chave} className="flex gap-1">
                          <dt>{rotuloChave(chave)}</dt>
                          <dd className="font-medium text-foreground">
                            {valor !== undefined ? rotuloValor(valor) : "—"}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Desktop / tablet: comparison table */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b bg-secondary/40 text-left">
              <th className="w-9 px-3 py-2.5" aria-label="Selecionado" />
              <th className="px-2.5 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Ref.
              </th>
              {chaves.map((chave) => (
                <th
                  key={chave}
                  className="px-2.5 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {rotuloChave(chave)}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {rotuloPreco}
              </th>
            </tr>
          </thead>
          <tbody role="radiogroup" aria-label="Modelos disponíveis">
            {variantes.map((v) => {
              const ativo = v.ref === selectedRef
              return (
                <tr
                  key={v.ref}
                  role="radio"
                  aria-checked={ativo}
                  tabIndex={0}
                  onClick={() => onSelect(v.ref)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSelect(v.ref)
                    }
                  }}
                  className={cn(
                    "cursor-pointer border-b transition-colors last:border-b-0",
                    ativo
                      ? "bg-primary/5"
                      : "hover:bg-secondary/40 focus-visible:bg-secondary/40"
                  )}
                >
                  <td className="px-3 py-2.5">
                    <RadioDot ativo={ativo} />
                  </td>
                  <td className="px-2.5 py-2.5 font-medium whitespace-nowrap">
                    {v.ref}
                  </td>
                  {chaves.map((chave) => {
                    const valor = valorDe(v, chave)
                    return (
                      <td
                        key={chave}
                        className={cn(
                          "px-2.5 py-2.5 whitespace-nowrap",
                          valor === undefined && "text-muted-foreground"
                        )}
                      >
                        {valor !== undefined ? rotuloValor(valor) : "—"}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-primary">
                    {eurExato.format(centsDe(v) / 100)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

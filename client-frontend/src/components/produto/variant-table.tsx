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
 * A variant's price for this audience. Anonymous visitors (and members not yet
 * approved) see PVP only; approved members see their reseller price with the
 * PVP struck through beside it. Never a discount or a percentage.
 */
export function PrecoVariante({
  pvpCents,
  revendaCents,
}: {
  pvpCents: number
  revendaCents?: number
}) {
  if (revendaCents === undefined) {
    return (
      <div className="text-right tabular-nums">
        <p className="text-sm font-semibold whitespace-nowrap">
          {eurExato.format(pvpCents / 100)}
        </p>
        <p className="text-[11px] whitespace-nowrap text-muted-foreground">
          PVP s/IVA
        </p>
      </div>
    )
  }
  return (
    <div className="text-right tabular-nums">
      <p className="text-sm font-semibold whitespace-nowrap text-primary">
        {eurExato.format(revendaCents / 100)}
      </p>
      <p className="text-[11px] whitespace-nowrap text-muted-foreground">
        Revenda s/IVA
      </p>
      {revendaCents < pvpCents && (
        <p className="text-[11px] whitespace-nowrap text-muted-foreground">
          PVP <s>{eurExato.format(pvpCents / 100)}</s>
        </p>
      )}
    </div>
  )
}

/**
 * The product page's model picker: one row per SKU, one column per attribute
 * key that varies within the group, plus price. Clicking a row selects that
 * variant (price, gallery and CTA update).
 *
 * Phones get stacked rows (no horizontal page scroll); from `md` up it is a
 * comparison table. Approved members get a Revenda column and a struck PVP.
 * `accao` renders each model's own control (the add-to-quote pill) at the
 * end of its row; clicks on it never select the row.
 */
export function VariantTable({
  variantes,
  selectedRef,
  onSelect,
  precosRevenda,
  accao,
}: {
  variantes: Array<Variante>
  selectedRef: string
  onSelect: (ref: string) => void
  precosRevenda?: Map<string, number> | null
  accao?: (variante: Variante) => React.ReactNode
}) {
  const chaves = chavesVariaveis(variantes)
  const revenda = precosRevenda != null

  return (
    <>
      {/* Phones: stacked selectable rows — long refs wrap. */}
      <div
        className="flex flex-col gap-2 md:hidden"
        role="radiogroup"
        aria-label="Modelos disponíveis"
      >
        {variantes.map((v) => {
          const ativo = v.ref === selectedRef
          return (
            <div
              key={v.ref}
              role="radio"
              aria-checked={ativo}
              tabIndex={0}
              onClick={() => onSelect(v.ref)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelect(v.ref)
                }
              }}
              className={cn(
                "flex w-full cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/25",
                ativo
                  ? "border-primary bg-primary/5"
                  : "bg-card hover:border-foreground/25"
              )}
            >
              <span className="pt-0.5">
                <RadioDot ativo={ativo} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug font-medium break-all">
                  {v.ref}
                </p>
                {chaves.length > 0 && (
                  <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
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
              <div className="flex shrink-0 flex-col items-end gap-2">
                <PrecoVariante
                  pvpCents={v.pvpCents}
                  revendaCents={precosRevenda?.get(v.ref)}
                />
                {accao && <SemSelecionar>{accao(v)}</SemSelecionar>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tablet / desktop: comparison table */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="w-9 py-2.5 pl-3.5" aria-label="Selecionado" />
              <th className="px-2.5 py-2.5 font-medium">Ref.</th>
              {chaves.map((chave) => (
                <th key={chave} className="px-2.5 py-2.5 font-medium">
                  {rotuloChave(chave)}
                </th>
              ))}
              <th className="px-2.5 py-2.5 text-right font-medium whitespace-nowrap">
                PVP s/IVA
              </th>
              {revenda && (
                <th className="py-2.5 pr-3.5 pl-2.5 text-right font-medium whitespace-nowrap text-primary">
                  Revenda s/IVA
                </th>
              )}
              {accao && (
                <th className="w-px py-2.5 pr-3" aria-label="Orçamento" />
              )}
            </tr>
          </thead>
          <tbody role="radiogroup" aria-label="Modelos disponíveis">
            {variantes.map((v) => {
              const ativo = v.ref === selectedRef
              const revendaCents = precosRevenda?.get(v.ref)
              return (
                <tr
                  key={v.ref}
                  role="radio"
                  aria-checked={ativo}
                  tabIndex={0}
                  onClick={() => onSelect(v.ref)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSelect(v.ref)
                    }
                  }}
                  className={cn(
                    "cursor-pointer border-b tabular-nums transition-colors outline-none last:border-b-0",
                    ativo
                      ? "bg-primary/5"
                      : "hover:bg-secondary/60 focus-visible:bg-secondary/60"
                  )}
                >
                  <td className="py-2.5 pl-3.5">
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
                  {revenda ? (
                    <>
                      <td className="px-2.5 py-2.5 text-right whitespace-nowrap text-muted-foreground">
                        {revendaCents !== undefined &&
                        revendaCents < v.pvpCents ? (
                          <s>{eurExato.format(v.pvpCents / 100)}</s>
                        ) : (
                          eurExato.format(v.pvpCents / 100)
                        )}
                      </td>
                      <td className="py-2.5 pr-3.5 pl-2.5 text-right font-semibold whitespace-nowrap text-primary">
                        {revendaCents !== undefined
                          ? eurExato.format(revendaCents / 100)
                          : "—"}
                      </td>
                    </>
                  ) : (
                    <td className="py-2.5 pr-3.5 pl-2.5 text-right font-semibold whitespace-nowrap">
                      {eurExato.format(v.pvpCents / 100)}
                    </td>
                  )}
                  {accao && (
                    <td className="py-1.5 pr-3 text-right">
                      <SemSelecionar>{accao(v)}</SemSelecionar>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** Keeps clicks on a row's own control from also selecting the row. */
function SemSelecionar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="inline-flex"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

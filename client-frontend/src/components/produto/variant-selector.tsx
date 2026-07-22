import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { eurExato } from "@/lib/catalogo"

export type Variante = {
  ref: string
  variante?: string
  capacidadeKw?: number
  classeEnergetica?: string
  refrigerante?: string
  pvpCents: number
}

function formatarKw(kw?: number): string {
  return kw === undefined ? "—" : `${kw.toLocaleString("pt-PT")} kW`
}

// Variant labels from the catalog often repeat the capacity ("12.000 BTU ·
// 3,5 kW"). The capacity already has its own column/summary, so drop that
// suffix when it matches — keeps each row on a single line.
function nomeVariante(v: Variante): string {
  const label = v.variante ?? v.ref
  if (v.capacidadeKw === undefined) return label
  const partes = label.split("·").map((p) => p.trim())
  if (partes.length < 2) return label
  const kw = formatarKw(v.capacidadeKw)
  const filtradas = partes.filter((p) => p !== kw)
  return filtradas.length > 0 ? filtradas.join(" · ") : label
}

export function VariantSelector({
  variantes,
  selectedRef,
  onSelect,
}: {
  variantes: Array<Variante>
  selectedRef: string
  onSelect: (ref: string) => void
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Modelos disponíveis</legend>

      {/* Column header (desktop only). First label gets extra padding to line
          up with the variant name, which sits after the radio circle. */}
      <div className="hidden grid-cols-[1.4fr_repeat(3,1fr)_auto] gap-3 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
        <span className="pl-6">Modelo</span>
        <span>Capacidade</span>
        <span>Classe</span>
        <span>Refrigerante</span>
        <span className="text-right">PVP s/IVA</span>
      </div>

      <div className="flex flex-col gap-2">
        {variantes.map((v) => {
          const ativo = v.ref === selectedRef
          // Compact one-line spec summary for the mobile card layout.
          const resumo = [
            v.capacidadeKw !== undefined ? formatarKw(v.capacidadeKw) : null,
            v.classeEnergetica ?? null,
            v.refrigerante ?? null,
          ]
            .filter(Boolean)
            .join(" · ")

          return (
            <button
              key={v.ref}
              type="button"
              onClick={() => onSelect(v.ref)}
              aria-pressed={ativo}
              className={cn(
                "grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-xl border p-4 text-left text-sm transition-colors sm:grid-cols-[1.4fr_repeat(3,1fr)_auto]",
                ativo
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:border-primary/40 hover:bg-secondary/50",
              )}
            >
              <span
                className={cn(
                  "row-span-2 flex size-4 shrink-0 items-center justify-center rounded-full border sm:hidden",
                  ativo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40",
                )}
              >
                {ativo && <Check className="size-3" />}
              </span>

              <span className="flex items-center gap-2 font-medium text-foreground">
                <span
                  className={cn(
                    "hidden size-4 shrink-0 items-center justify-center rounded-full border sm:flex",
                    ativo
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40",
                  )}
                >
                  {ativo && <Check className="size-3" />}
                </span>
                {nomeVariante(v)}
              </span>

              {/* Mobile: single muted spec line. */}
              <span className="text-xs text-muted-foreground sm:hidden">
                {resumo || "—"}
              </span>

              {/* Desktop: aligned spec columns. */}
              <span className="hidden text-muted-foreground sm:inline">
                {formatarKw(v.capacidadeKw)}
              </span>
              <span className="hidden text-muted-foreground sm:inline">
                {v.classeEnergetica ?? "—"}
              </span>
              <span className="hidden text-muted-foreground sm:inline">
                {v.refrigerante ?? "—"}
              </span>

              <span className="col-start-3 row-span-2 row-start-1 text-right font-semibold tabular-nums text-primary sm:col-start-auto sm:row-span-1 sm:row-start-auto">
                {eurExato.format(v.pvpCents / 100)}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

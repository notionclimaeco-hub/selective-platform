import { useState } from "react"
import { ChevronDown } from "lucide-react"

import type { Faceta, FiltroDestaque } from "@convex/lib/catalogoFiltros"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import {
  formatarIntervalo,
  formatarValor,
  rotuloChave,
  rotuloCurto,
} from "@/lib/especificacoes"
import { cn } from "@/lib/utils"
import { Chip } from "./filter-chips"

export type AoFiltrar = (
  chave: string,
  filtro: FiltroDestaque | undefined
) => void

/**
 * The control for one hero-spec facet: a two-thumb range for numeric keys,
 * multi-select chips with counts for the others. Used in the phone Filtros
 * sheet and inside the desktop filter pills.
 */
export function ControloDestaque({
  faceta,
  filtro,
  onFiltro,
}: {
  faceta: Faceta
  filtro: FiltroDestaque | undefined
  onFiltro: AoFiltrar
}) {
  return faceta.tipo === "intervalo" ? (
    <FiltroIntervalo
      faceta={faceta}
      filtro={filtro && !("valores" in filtro) ? filtro : undefined}
      onFiltro={(f) => onFiltro(faceta.chave, f)}
    />
  ) : (
    <FiltroValores
      faceta={faceta}
      escolhidos={filtro && "valores" in filtro ? filtro.valores : []}
      onFiltro={(f) => onFiltro(faceta.chave, f)}
    />
  )
}

/** A facet worth offering: a numeric span needs two distinct ends. */
export function facetaUtil(faceta: Faceta): boolean {
  return faceta.tipo === "intervalo"
    ? faceta.max > faceta.min
    : faceta.valores.length > 0
}

// The slider runs over positions 0…POSICOES and maps them to values. Spans
// covering an order of magnitude or more (1,2–56 kW across splits and VRF)
// map logarithmically, so the common small units get most of the track.
const POSICOES = 1000

export function escalaFaceta(min: number, max: number) {
  const log = min > 0 && max / min >= 10
  const [a, b] = log ? [Math.log(min), Math.log(max)] : [min, max]
  return {
    paraPosicao: (valor: number) =>
      Math.round((((log ? Math.log(valor) : valor) - a) / (b - a)) * POSICOES),
    // Rounded to two significant figures (2,5 · 13 · 260), clamped to the span.
    paraValor: (posicao: number) => {
      const bruto = a + ((b - a) * posicao) / POSICOES
      const valor = log ? Math.exp(bruto) : bruto
      return Math.min(max, Math.max(min, arredondar(valor)))
    },
  }
}

function arredondar(valor: number): number {
  if (valor === 0) return 0
  const passo = 10 ** (Math.floor(Math.log10(Math.abs(valor))) - 1)
  return Number((Math.round(valor / passo) * passo).toPrecision(12))
}

function FiltroIntervalo({
  faceta,
  filtro,
  onFiltro,
}: {
  faceta: Extract<Faceta, { tipo: "intervalo" }>
  filtro: { min?: number; max?: number } | undefined
  onFiltro: (filtro: FiltroDestaque | undefined) => void
}) {
  const { min, max } = faceta
  const escala = escalaFaceta(min, max)
  const aplicado: [number, number] = [
    escala.paraPosicao(Math.max(min, filtro?.min ?? min)),
    escala.paraPosicao(Math.min(max, filtro?.max ?? max)),
  ]
  // Local while dragging; the URL (and the grid) change on release.
  const [arrasto, setArrasto] = useState<[number, number] | null>(null)
  const [de, ate] = arrasto ?? aplicado
  const aberto = de <= 0 && ate >= POSICOES

  return (
    <div className="flex flex-col gap-3 px-1">
      <p className="text-sm font-medium tabular-nums">
        {aberto ? (
          <span className="text-muted-foreground">
            {formatarIntervalo(faceta.chave, min, max)}
          </span>
        ) : (
          formatarIntervalo(
            faceta.chave,
            escala.paraValor(de),
            escala.paraValor(ate)
          )
        )}
      </p>
      <Slider
        min={0}
        max={POSICOES}
        step={1}
        value={[de, ate]}
        aria-label={rotuloChave(faceta.chave)}
        getAriaValueText={(_texto, posicao) =>
          formatarIntervalo(
            faceta.chave,
            escala.paraValor(posicao),
            escala.paraValor(posicao)
          )
        }
        onValueChange={(valor) => {
          if (Array.isArray(valor) && valor.length === 2) {
            setArrasto([valor[0], valor[1]])
          }
        }}
        onValueCommitted={(valor) => {
          setArrasto(null)
          if (!Array.isArray(valor) || valor.length !== 2) return
          // A thumb left at its end leaves that side open, so the filter
          // keeps matching pages outside today's span.
          const novoMin = valor[0] <= 0 ? undefined : escala.paraValor(valor[0])
          const novoMax =
            valor[1] >= POSICOES ? undefined : escala.paraValor(valor[1])
          onFiltro(
            novoMin === undefined && novoMax === undefined
              ? undefined
              : { min: novoMin, max: novoMax }
          )
        }}
      />
    </div>
  )
}

function FiltroValores({
  faceta,
  escolhidos,
  onFiltro,
}: {
  faceta: Extract<Faceta, { tipo: "valores" }>
  escolhidos: Array<string>
  onFiltro: (filtro: FiltroDestaque | undefined) => void
}) {
  // A value already chosen stays offered even when other filters leave no
  // page carrying it, so it can be un-chosen.
  const opcoes = [
    ...faceta.valores,
    ...escolhidos
      .filter((v) => !faceta.valores.some((o) => o.valor === v))
      .map((valor) => ({ valor, contagem: 0 })),
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const ativo = escolhidos.includes(o.valor)
        return (
          <Chip
            key={o.valor}
            ativo={ativo}
            contagem={o.contagem}
            onClick={() => {
              const valores = ativo
                ? escolhidos.filter((v) => v !== o.valor)
                : [...escolhidos, o.valor]
              onFiltro(valores.length > 0 ? { valores } : undefined)
            }}
          >
            {formatarValor(faceta.chave, o.valor)}
          </Chip>
        )
      })}
    </div>
  )
}

/** "2,5–5 kW", "A+++/A++", "2 escolhidos": what a pill says once set. */
function resumo(chave: string, filtro: FiltroDestaque): string {
  if ("valores" in filtro) {
    return filtro.valores.length === 1
      ? formatarValor(chave, filtro.valores[0] ?? "")
      : `${filtro.valores.length} escolhidos`
  }
  if (filtro.min !== undefined && filtro.max !== undefined) {
    return formatarIntervalo(chave, filtro.min, filtro.max)
  }
  return filtro.min !== undefined
    ? `≥ ${formatarIntervalo(chave, filtro.min, filtro.min)}`
    : `≤ ${formatarIntervalo(chave, filtro.max ?? 0, filtro.max ?? 0)}`
}

/**
 * Desktop: one pill per hero facet next to the family and brand rows, each
 * opening its control in a popover. A set pill is lit and says its value.
 */
export function PilulasDestaque({
  facetas,
  filtros,
  onFiltro,
}: {
  facetas: Array<Faceta>
  filtros: Partial<Record<string, FiltroDestaque>>
  onFiltro: AoFiltrar
}) {
  return (
    <>
      {facetas.map((faceta) => {
        const filtro = filtros[faceta.chave]
        return (
          <Popover key={faceta.chave}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25",
                    filtro
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:border-foreground/25"
                  )}
                />
              }
            >
              {rotuloCurto(faceta.chave)}
              {filtro && (
                <span className="font-normal tabular-nums">
                  {resumo(faceta.chave, filtro)}
                </span>
              )}
              <ChevronDown className="size-3.5 opacity-60" />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="max-h-80 w-80 gap-3 overflow-y-auto rounded-2xl"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  {rotuloChave(faceta.chave)}
                </p>
                {filtro && (
                  <button
                    type="button"
                    onClick={() => onFiltro(faceta.chave, undefined)}
                    className="text-xs font-medium text-primary"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <ControloDestaque
                faceta={faceta}
                filtro={filtro}
                onFiltro={onFiltro}
              />
            </PopoverContent>
          </Popover>
        )
      })}
    </>
  )
}

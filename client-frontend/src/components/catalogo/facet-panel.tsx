import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"

import { DIMENSOES, eur } from "@/lib/catalogo"
import type { DimensaoChave } from "@/lib/catalogo"
import { alternarValor, selecionados } from "@/lib/catalogo-search"
import type { FiltrosCatalogo } from "@/lib/catalogo-search"
import { cn } from "@/lib/utils"

export type Faceta = { valor: string; contagem: number }
export type Facetas = Record<DimensaoChave, Array<Faceta>>
export type Limites = {
  precoMinCents: number
  precoMaxCents: number
  frioKwMin: number
  frioKwMax: number
}

// How many options a facet shows before "ver mais" — enough to cover the
// common values without turning the sidebar into a wall of checkboxes.
const VISIVEIS = 6

/**
 * The filter panel, rendered as-is in the desktop sidebar and inside the
 * mobile dialog. It owns no filter state: values come from the URL and changes
 * go back through `onFiltrar`.
 */
export function FacetPanel({
  filtros,
  facetas,
  limites,
  onFiltrar,
}: {
  filtros: FiltrosCatalogo
  facetas: Facetas | undefined
  limites: Limites | undefined
  onFiltrar: (patch: Partial<FiltrosCatalogo>) => void
}) {
  // Família has its own bar above the results; the sidebar refines within it.
  const dimensoes = DIMENSOES.filter((d) => d.chave !== "familia")
  const temKw = limites !== undefined && limites.frioKwMax > 0

  return (
    <div className="flex flex-col divide-y">
      {dimensoes.map(({ chave, rotulo, rotuloValor }) => {
        const opcoes = facetas?.[chave] ?? []
        const escolhidos = selecionados(filtros, chave)
        if (opcoes.length === 0 && escolhidos.length === 0) return null
        return (
          <Seccao
            key={chave}
            titulo={rotulo}
            contagem={escolhidos.length}
            aberta={
              escolhidos.length > 0 ||
              chave === "marca" ||
              chave === "tipoUnidade"
            }
          >
            <ListaOpcoes
              opcoes={opcoes}
              escolhidos={escolhidos}
              rotuloValor={rotuloValor}
              onAlternar={(valor) =>
                onFiltrar(alternarValor(filtros, chave, valor))
              }
            />
          </Seccao>
        )
      })}

      {temKw && (
        <Seccao
          titulo="Potência de frio"
          contagem={
            filtros.kwMin !== undefined || filtros.kwMax !== undefined ? 1 : 0
          }
          aberta={filtros.kwMin !== undefined || filtros.kwMax !== undefined}
        >
          <RangeNumerico
            key={`kw-${filtros.kwMin ?? ""}-${filtros.kwMax ?? ""}`}
            min={limites.frioKwMin}
            max={limites.frioKwMax}
            de={filtros.kwMin}
            ate={filtros.kwMax}
            sufixo="kW"
            formatarLimite={(n) => `${n} kW`}
            onMudar={(de, ate) => onFiltrar({ kwMin: de, kwMax: ate })}
          />
        </Seccao>
      )}

      <Seccao
        titulo="Preço"
        contagem={
          filtros.precoMin !== undefined || filtros.precoMax !== undefined
            ? 1
            : 0
        }
        aberta={
          filtros.precoMin !== undefined || filtros.precoMax !== undefined
        }
      >
        <RangeNumerico
          // Remount when the URL value changes (chip removed, "limpar
          // filtros", browser back) so the inputs never show a stale value.
          key={`preco-${filtros.precoMin ?? ""}-${filtros.precoMax ?? ""}`}
          min={limites ? Math.floor(limites.precoMinCents / 100) : undefined}
          max={limites ? Math.ceil(limites.precoMaxCents / 100) : undefined}
          de={filtros.precoMin}
          ate={filtros.precoMax}
          sufixo="€"
          formatarLimite={(n) => eur.format(n)}
          onMudar={(de, ate) => onFiltrar({ precoMin: de, precoMax: ate })}
        />
      </Seccao>

      <Seccao titulo="Outros" aberta={filtros.foto === true}>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Caixa marcada={filtros.foto === true} />
          <input
            type="checkbox"
            className="sr-only"
            checked={filtros.foto === true}
            onChange={(e) =>
              onFiltrar({ foto: e.target.checked ? true : undefined })
            }
          />
          <span className="text-muted-foreground">Apenas com fotografia</span>
        </label>
      </Seccao>
    </div>
  )
}

function Seccao({
  titulo,
  contagem,
  aberta = false,
  children,
}: {
  titulo: string
  contagem?: number
  aberta?: boolean
  children: React.ReactNode
}) {
  const [expandida, setExpandida] = useState(aberta)

  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={() => setExpandida((v) => !v)}
        aria-expanded={expandida}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          {titulo}
          {contagem !== undefined && contagem > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
              {contagem}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expandida && "rotate-180"
          )}
        />
      </button>
      {expandida && <div className="mt-3">{children}</div>}
    </section>
  )
}

function ListaOpcoes({
  opcoes,
  escolhidos,
  rotuloValor,
  onAlternar,
}: {
  opcoes: Array<Faceta>
  escolhidos: Array<string>
  rotuloValor: (valor: string) => string
  onAlternar: (valor: string) => void
}) {
  const [todas, setTodas] = useState(false)
  // A checked value must stay visible even when it falls outside the top N,
  // otherwise the only way to uncheck it is the chip row above the results.
  const visiveis = todas
    ? opcoes
    : opcoes.filter((o, i) => i < VISIVEIS || escolhidos.includes(o.valor))
  const escondidas = opcoes.length - visiveis.length

  return (
    <div className="flex flex-col gap-1">
      {visiveis.map(({ valor, contagem }) => {
        const marcada = escolhidos.includes(valor)
        return (
          <label
            key={valor}
            className="flex cursor-pointer items-center gap-2.5 rounded-md py-1 text-sm transition-colors hover:text-foreground"
          >
            <Caixa marcada={marcada} />
            <input
              type="checkbox"
              className="sr-only"
              checked={marcada}
              onChange={() => onAlternar(valor)}
            />
            <span
              className={cn(
                "flex-1 truncate",
                marcada
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {rotuloValor(valor)}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground/70 tabular-nums">
              {contagem}
            </span>
          </label>
        )
      })}
      {escondidas > 0 && (
        <button
          type="button"
          onClick={() => setTodas(true)}
          className="mt-1 self-start text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          Ver mais {escondidas}
        </button>
      )}
      {todas && opcoes.length > VISIVEIS && (
        <button
          type="button"
          onClick={() => setTodas(false)}
          className="mt-1 self-start text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          Ver menos
        </button>
      )}
    </div>
  )
}

function Caixa({ marcada }: { marcada: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
        marcada
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card"
      )}
    >
      {marcada && <Check className="size-3" strokeWidth={3} />}
    </span>
  )
}

/**
 * Min/max pair. Values only reach the URL on blur/Enter so typing "1500" does
 * not fire a query per keystroke.
 */
function RangeNumerico({
  min,
  max,
  de,
  ate,
  sufixo,
  formatarLimite,
  onMudar,
}: {
  min: number | undefined
  max: number | undefined
  de: number | undefined
  ate: number | undefined
  sufixo: string
  formatarLimite: (n: number) => string
  onMudar: (de: number | undefined, ate: number | undefined) => void
}) {
  const [deLocal, setDeLocal] = useState(de?.toString() ?? "")
  const [ateLocal, setAteLocal] = useState(ate?.toString() ?? "")

  function aplicar() {
    const a = Number.parseFloat(deLocal)
    const b = Number.parseFloat(ateLocal)
    const valA = Number.isFinite(a) && a > 0 ? a : undefined
    const valB = Number.isFinite(b) && b > 0 ? b : undefined
    // Swap instead of returning nothing when the user inverts the bounds.
    if (valA !== undefined && valB !== undefined && valA > valB) {
      setDeLocal(valB.toString())
      setAteLocal(valA.toString())
      onMudar(valB, valA)
      return
    }
    onMudar(valA, valB)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <CampoNumero
          valor={deLocal}
          onValor={setDeLocal}
          onAplicar={aplicar}
          placeholder="Mín"
          rotulo={`Mínimo (${sufixo})`}
          sufixo={sufixo}
        />
        <span className="text-muted-foreground">–</span>
        <CampoNumero
          valor={ateLocal}
          onValor={setAteLocal}
          onAplicar={aplicar}
          placeholder="Máx"
          rotulo={`Máximo (${sufixo})`}
          sufixo={sufixo}
        />
      </div>
      {min !== undefined && max !== undefined && (
        <p className="text-xs text-muted-foreground">
          No catálogo: {formatarLimite(min)} – {formatarLimite(max)}
        </p>
      )}
    </div>
  )
}

function CampoNumero({
  valor,
  onValor,
  onAplicar,
  placeholder,
  rotulo,
  sufixo,
}: {
  valor: string
  onValor: (v: string) => void
  onAplicar: () => void
  placeholder: string
  rotulo: string
  sufixo: string
}) {
  return (
    <div className="relative flex-1">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={valor}
        aria-label={rotulo}
        placeholder={placeholder}
        onChange={(e) => onValor(e.target.value)}
        onBlur={onAplicar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            onAplicar()
          }
        }}
        className="h-9 w-full [appearance:textfield] rounded-lg border bg-card pr-8 pl-2.5 text-sm transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
        {sufixo}
      </span>
    </div>
  )
}

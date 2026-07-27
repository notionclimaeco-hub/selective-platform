import { Select } from "@base-ui/react/select"
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  LayoutGrid,
  List,
  SlidersHorizontal,
} from "lucide-react"

import { ORDENACOES } from "@/lib/catalogo"
import type { Ordenacao } from "@/lib/catalogo"
import type { Vista } from "@/lib/catalogo-search"
import { cn } from "@/lib/utils"

/**
 * Row above the results: how many there are, how they are sorted, how they are
 * laid out, and (on small screens) the entry point to the filter panel.
 */
export function CatalogToolbar({
  total,
  aCarregar,
  aAtualizar,
  ordenar,
  vista,
  numFiltros,
  onOrdenar,
  onVista,
  onAbrirFiltros,
}: {
  total: number | undefined
  aCarregar: boolean
  aAtualizar: boolean
  ordenar: Ordenacao
  vista: Vista
  numFiltros: number
  onOrdenar: (valor: Ordenacao) => void
  onVista: (vista: Vista) => void
  onAbrirFiltros: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p
        className="text-sm text-muted-foreground"
        aria-live="polite"
        aria-busy={aCarregar}
      >
        {aCarregar || total === undefined ? (
          "A carregar…"
        ) : (
          <>
            <span className="font-semibold text-foreground">{total}</span>{" "}
            {total === 1 ? "produto" : "produtos"}
            {aAtualizar && <span className="ml-2 text-xs">a atualizar…</span>}
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAbrirFiltros}
          className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium transition-colors hover:bg-secondary lg:hidden"
        >
          <SlidersHorizontal className="size-4" />
          Filtros
          {numFiltros > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
              {numFiltros}
            </span>
          )}
        </button>

        <SortSelect ordenar={ordenar} onOrdenar={onOrdenar} />

        <div className="hidden rounded-lg border bg-card p-0.5 sm:flex">
          <BotaoVista
            ativo={vista === "grelha"}
            rotulo="Vista de grelha"
            onClick={() => onVista("grelha")}
          >
            <LayoutGrid className="size-4" />
          </BotaoVista>
          <BotaoVista
            ativo={vista === "lista"}
            rotulo="Vista de lista"
            onClick={() => onVista("lista")}
          >
            <List className="size-4" />
          </BotaoVista>
        </div>
      </div>
    </div>
  )
}

function BotaoVista({
  ativo,
  rotulo,
  onClick,
  children,
}: {
  ativo: boolean
  rotulo: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      aria-pressed={ativo}
      className={cn(
        "flex size-8 items-center justify-center rounded-md transition-colors",
        ativo
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function SortSelect({
  ordenar,
  onOrdenar,
}: {
  ordenar: Ordenacao
  onOrdenar: (valor: Ordenacao) => void
}) {
  return (
    <Select.Root
      value={ordenar}
      onValueChange={(valor) => onOrdenar(valor as Ordenacao)}
      items={ORDENACOES.map((o) => ({ value: o.valor, label: o.rotulo }))}
    >
      <Select.Trigger className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
        <ArrowDownUp className="size-4 text-muted-foreground" />
        <Select.Value className="hidden sm:inline" />
        <Select.Icon>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={6} align="end">
          <Select.Popup className="z-50 min-w-52 rounded-xl border bg-popover p-1 text-sm shadow-lg outline-none">
            {ORDENACOES.map((o) => (
              <Select.Item
                key={o.valor}
                value={o.valor}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 outline-none select-none data-highlighted:bg-secondary"
              >
                <Select.ItemText>{o.rotulo}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check className="size-4 text-primary" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

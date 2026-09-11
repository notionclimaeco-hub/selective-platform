import { LayoutGrid } from "lucide-react"

import { FAMILIAS, iconeFamilia, rotuloFamilia } from "@/lib/catalogo"
import type { Faceta } from "./facet-panel"
import { cn } from "@/lib/utils"

/**
 * Primary navigation of the catalog: one chip per product family, always
 * visible above the results. Behaves like a category bar (single choice),
 * while the URL keeps the same `familia` param the rest of the filters use.
 */
export function FamiliaNav({
  opcoes,
  escolhida,
  onEscolher,
}: {
  opcoes: Array<Faceta> | undefined
  /** The active family, or undefined for "all". */
  escolhida: string | undefined
  onEscolher: (familia: string | undefined) => void
}) {
  const contagens = new Map(opcoes?.map((o) => [o.valor, o.contagem]))
  // Fixed order so the bar never reshuffles as filters change; families with
  // zero matches stay visible (disabled) so the user knows they exist.
  const familias = FAMILIAS.filter((f) => contagens.has(f) || f === escolhida)
  const total = opcoes?.reduce((acc, o) => acc + o.contagem, 0)

  return (
    <nav
      aria-label="Famílias de produto"
      className="-mx-4 px-4 sm:mx-0 sm:px-0"
    >
      {/* Phones: one scrollable row. Wider screens: wrap so nothing hides. */}
      <ul className="flex snap-x [scrollbar-width:none] gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
        <li className="snap-start">
          <Chip
            activo={escolhida === undefined}
            icon={LayoutGrid}
            rotulo="Todos"
            contagem={total}
            onClick={() => onEscolher(undefined)}
          />
        </li>
        {familias.map((f) => (
          <li key={f} className="snap-start">
            <Chip
              activo={escolhida === f}
              icon={iconeFamilia(f)}
              rotulo={rotuloFamilia(f)}
              contagem={contagens.get(f) ?? 0}
              onClick={() => onEscolher(escolhida === f ? undefined : f)}
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Chip({
  activo,
  icon: Icon,
  rotulo,
  contagem,
  onClick,
}: {
  activo: boolean
  icon: typeof LayoutGrid
  rotulo: string
  contagem: number | undefined
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
        activo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary"
      )}
    >
      <Icon
        className={cn(
          "size-4",
          activo ? "text-primary-foreground/80" : "text-primary"
        )}
        strokeWidth={1.75}
      />
      {rotulo}
      {contagem !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums",
            activo
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-secondary text-muted-foreground"
          )}
        >
          {contagem}
        </span>
      )}
    </button>
  )
}

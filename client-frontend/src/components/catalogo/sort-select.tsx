import { ArrowUpDown, ChevronDown } from "lucide-react"

import { ORDENACOES } from "@/lib/catalogo"
import type { Ordenacao } from "@/lib/catalogo"
import { cn } from "@/lib/utils"

/**
 * A native <select> dressed as a button: the OS picker is the best sort menu a
 * phone can offer, and it is keyboard/screen-reader complete for free. On
 * phones it collapses to a square icon button next to the search box (the
 * select is still there, just with its text hidden); from `sm` up it shows
 * the chosen ordering.
 */
export function SortSelect({
  valor,
  onChange,
  className,
}: {
  valor: Ordenacao
  onChange: (valor: Ordenacao) => void
  className?: string
}) {
  const ativo = valor !== "relevancia"
  return (
    <label
      title="Ordenar por"
      className={cn(
        "relative inline-flex h-10 w-11 items-center rounded-xl border bg-background text-sm shadow-xs transition-colors has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/25 sm:w-auto sm:min-w-56 sm:hover:bg-muted",
        ativo ? "border-primary/40 text-primary" : "border-input",
        className
      )}
    >
      <ArrowUpDown
        className={cn(
          "pointer-events-none absolute left-1/2 size-4 -translate-x-1/2 sm:left-3 sm:translate-x-0",
          ativo ? "text-primary" : "text-muted-foreground"
        )}
      />
      <span className="sr-only">Ordenar por</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value as Ordenacao)}
        className="h-full w-full cursor-pointer appearance-none bg-transparent text-transparent outline-none sm:pr-9 sm:pl-9 sm:font-medium sm:text-current"
      >
        {ORDENACOES.map((o) => (
          <option key={o.valor} value={o.valor} className="text-foreground">
            {o.rotulo}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 hidden size-4 text-muted-foreground sm:block" />
    </label>
  )
}

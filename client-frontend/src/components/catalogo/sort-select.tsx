import { ArrowUpDown, ChevronDown } from "lucide-react"

import { ORDENACOES } from "@/lib/catalogo"
import type { Ordenacao } from "@/lib/catalogo"
import { cn } from "@/lib/utils"

/**
 * A native <select> dressed as a button, keyboard/screen-reader complete for
 * free. Wide screens only: on phones sorting lives in the Filtros sheet.
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
        "relative inline-flex h-10 min-w-56 items-center rounded-xl border bg-background text-sm transition-colors hover:border-foreground/25 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/25",
        ativo ? "border-primary/40 text-primary" : "border-input",
        className
      )}
    >
      <ArrowUpDown
        className={cn(
          "pointer-events-none absolute left-3 size-4",
          ativo ? "text-primary" : "text-muted-foreground"
        )}
      />
      <span className="sr-only">Ordenar por</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value as Ordenacao)}
        className="h-full w-full cursor-pointer appearance-none bg-transparent pr-9 pl-9 font-medium outline-none"
      >
        {ORDENACOES.map((o) => (
          <option key={o.valor} value={o.valor} className="text-foreground">
            {o.rotulo}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 size-4 text-muted-foreground" />
    </label>
  )
}

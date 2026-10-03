import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Page numbers around the current one, with the first and last always
 * reachable: [1, …, 4, 5, 6, …, 37]. `null` marks an elision. 0-based.
 */
function paginasVisiveis(
  pagina: number,
  numPaginas: number
): Array<number | null> {
  if (numPaginas <= 7) {
    return Array.from({ length: numPaginas }, (_, i) => i)
  }
  const perto = [pagina - 1, pagina, pagina + 1].filter(
    (p) => p > 0 && p < numPaginas - 1
  )
  const paginas: Array<number | null> = [0]
  if ((perto[0] ?? 1) > 1) paginas.push(null)
  paginas.push(...perto)
  if ((perto[perto.length - 1] ?? numPaginas - 2) < numPaginas - 2) {
    paginas.push(null)
  }
  paginas.push(numPaginas - 1)
  return paginas
}

/**
 * The client catalog's pager (client-frontend `catalogo/pagination.tsx`):
 * Anterior left, numbered pages in the middle, Seguinte right. 0-based
 * `pagina`; phones get "Página X de Y" instead of the numbers.
 */
export function Paginacao({
  pagina,
  numPaginas,
  onPagina,
}: {
  pagina: number
  numPaginas: number
  onPagina: (pagina: number) => void
}) {
  if (numPaginas <= 1) return null
  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-between gap-3"
    >
      <Button
        variant="outline"
        disabled={pagina <= 0}
        onClick={() => onPagina(pagina - 1)}
        aria-label="Página anterior"
      >
        <ChevronLeft data-icon="inline-start" />
        Anterior
      </Button>

      <span className="text-sm text-muted-foreground tabular-nums sm:hidden">
        Página {pagina + 1} de {numPaginas}
      </span>
      <div className="hidden items-center gap-1 sm:flex">
        {paginasVisiveis(pagina, numPaginas).map((p, i) =>
          p === null ? (
            <span
              key={`salto-${i}`}
              className="px-1 text-sm text-muted-foreground"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPagina(p)}
              aria-current={p === pagina ? "page" : undefined}
              aria-label={`Página ${p + 1}`}
              className={cn(
                "size-9 rounded-lg text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/25",
                p === pagina
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-primary"
              )}
            >
              {p + 1}
            </button>
          )
        )}
      </div>

      <Button
        variant="outline"
        disabled={pagina >= numPaginas - 1}
        onClick={() => onPagina(pagina + 1)}
        aria-label="Página seguinte"
      >
        Seguinte
        <ChevronRight data-icon="inline-end" />
      </Button>
    </nav>
  )
}

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Page numbers around the current one, with the first and last always
 * reachable: [1, …, 4, 5, 6, …, 37]. `null` marks an elision. 0-based.
 */
export function paginasVisiveis(
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
 * 0-based `pagina`; numbered pages from `sm` up. Phones use `VerMais`
 * instead, so this bar is hidden there.
 */
export function Pagination({
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
      className="mt-10 hidden items-center justify-between gap-3 border-t pt-6 sm:flex"
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

      <div className="flex items-center gap-1">
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

const numero = new Intl.NumberFormat("pt-PT")

/**
 * Phones: the grid grows instead of paging. Shows how many of the results are
 * on screen and a "Ver mais" button while there are more.
 */
export function VerMais({
  mostrados,
  total,
  aCarregar,
  onMais,
}: {
  mostrados: number
  total: number
  aCarregar: boolean
  onMais: () => void
}) {
  return (
    // Out of scroll anchoring: new cards land above this block, and the
    // reader should stay where they were, not ride the button down.
    <div className="mt-6 flex flex-col items-center gap-3 [overflow-anchor:none] sm:hidden">
      <p className="text-xs text-muted-foreground tabular-nums">
        {numero.format(mostrados)} de {numero.format(total)}
      </p>
      {mostrados < total && (
        <Button
          variant="outline"
          size="lg"
          className="h-11 w-full"
          disabled={aCarregar}
          onClick={onMais}
        >
          {aCarregar ? "A carregar…" : "Ver mais"}
        </Button>
      )}
    </div>
  )
}

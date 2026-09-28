import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

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
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pagina <= 0}
        onClick={() => onPagina(pagina - 1)}
      >
        <ChevronLeft data-icon="inline-start" />
        Anterior
      </Button>
      {/* On phones the counter drops to its own line under the buttons. */}
      <span className="order-last w-full text-center text-xs text-muted-foreground sm:order-none sm:w-auto">
        Página {pagina + 1} de {numPaginas}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={pagina >= numPaginas - 1}
        onClick={() => onPagina(pagina + 1)}
      >
        Seguinte
        <ChevronRight data-icon="inline-end" />
      </Button>
    </div>
  )
}

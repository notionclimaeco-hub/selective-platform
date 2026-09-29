import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"

export type PaginaRevisao = {
  pagina: number
  imagemUrl: string | null
  pdfUrl: string | null
}

/**
 * The price-table pages a staged group was read from, shown inside the open
 * group next to its images and table: one page at a time with previous/next,
 * the page number and a link to the one-page PDF.
 */
export function VisorPagina({
  paginas,
  pagina,
  onPagina,
}: {
  paginas: Array<PaginaRevisao>
  pagina: number
  onPagina: (pagina: number) => void
}) {
  const idx = Math.max(
    0,
    paginas.findIndex((p) => p.pagina === pagina)
  )
  const atual = paginas.at(idx)
  const anterior = idx > 0 ? paginas.at(idx - 1) : undefined
  const seguinte = paginas.at(idx + 1)

  if (!atual) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        Sem páginas da tabela para este grupo.
      </p>
    )
  }

  return (
    <section
      aria-label="Páginas da tabela de preços"
      className="flex min-w-0 flex-col gap-2 rounded-lg border bg-background p-2"
    >
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página anterior"
          disabled={!anterior}
          onClick={() => anterior && onPagina(anterior.pagina)}
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-0 flex-1 truncate text-center text-xs font-medium">
          Página {atual.pagina}
          <span className="text-muted-foreground">
            {" "}
            · {idx + 1}/{paginas.length}
          </span>
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página seguinte"
          disabled={!seguinte}
          onClick={() => seguinte && onPagina(seguinte.pagina)}
        >
          <ChevronRight />
        </Button>
        {atual.pdfUrl && (
          <a
            href={atual.pdfUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir PDF da página"
            className="ml-1 inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3" />
            PDF
          </a>
        )}
      </div>
      {atual.imagemUrl ? (
        <img
          src={atual.imagemUrl}
          alt={`Página ${atual.pagina}`}
          className="h-auto w-full rounded border bg-white"
        />
      ) : (
        <p className="p-4 text-center text-sm text-muted-foreground">
          Sem imagem da página {atual.pagina}.
        </p>
      )}
    </section>
  )
}

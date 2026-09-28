import { useEffect } from "react"
import { ExternalLink, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type PaginaRevisao = {
  pagina: number
  imagemUrl: string | null
  pdfUrl: string | null
}

export type AlvoPainel = {
  titulo: string
  paginas: Array<PaginaRevisao>
  pagina: number
}

/**
 * The price-table page a staged group was read from: a full-screen sheet on
 * phones, a fixed right-hand panel from `md` up. Shows the PNG render and
 * links to the one-page PDF.
 */
export function PainelPagina({
  alvo,
  onPagina,
  onClose,
}: {
  alvo: AlvoPainel
  onPagina: (pagina: number) => void
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const atual =
    alvo.paginas.find((p) => p.pagina === alvo.pagina) ?? alvo.paginas.at(0)

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-label={`Página ${alvo.pagina} da tabela de preços`}
      className="fixed inset-0 z-50 flex flex-col bg-background md:inset-y-0 md:right-0 md:left-auto md:w-[min(40rem,50vw)] md:border-l md:shadow-xl"
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {alvo.titulo}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Fechar"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
        {alvo.paginas.map((p) => (
          <button
            key={p.pagina}
            type="button"
            aria-pressed={p.pagina === alvo.pagina}
            onClick={() => onPagina(p.pagina)}
            className={cn(
              "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors",
              p.pagina === alvo.pagina
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {p.pagina}
          </button>
        ))}
        {atual?.pdfUrl && (
          <a
            href={atual.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3" />
            PDF
          </a>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-muted/40 p-3">
        {atual?.imagemUrl ? (
          <img
            src={atual.imagemUrl}
            alt={`Página ${atual.pagina}`}
            className="mx-auto h-auto w-full max-w-3xl rounded border bg-white shadow-sm"
          />
        ) : (
          <p className="p-4 text-center text-sm text-muted-foreground">
            Sem imagem da página {atual?.pagina ?? alvo.pagina}.
          </p>
        )}
      </div>
    </aside>
  )
}

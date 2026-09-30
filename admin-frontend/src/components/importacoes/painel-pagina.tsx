import { useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Minus,
  Plus,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ZOOM_MAX,
  ZOOM_MIN,
  scrollAncorado,
  zoomPorRoda,
  zoomSeguinte,
} from "@/lib/zoom"
import { cn } from "@/lib/utils"

export type PaginaRevisao = {
  pagina: number
  imagemUrl: string | null
  pdfUrl: string | null
}

/**
 * The price-table pages a staged group was read from, shown inside the open
 * group next to its images and table: one page at a time with previous/next,
 * the page number, zoom and a link to the one-page PDF. On wide screens the
 * page scrolls inside the viewer, which fits between the app header and the
 * decision bar. Zoom (buttons, ctrl/⌘ + wheel or pinch) keeps the point under
 * the cursor still; a zoomed page pans by dragging. It is kept across pages.
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

  const [zoom, setZoom] = useState(1)
  const caixa = useRef<HTMLDivElement>(null)
  // Scroll state and anchor captured just before a zoom, applied after layout.
  const antes = useRef<{
    sl: number
    st: number
    w: number
    h: number
    x: number
    y: number
  } | null>(null)
  const arrasto = useRef<{
    x: number
    y: number
    sl: number
    st: number
  } | null>(null)

  function aplicarZoom(novo: number, ponto?: { x: number; y: number }) {
    const el = caixa.current
    if (!el || novo === zoom) return
    antes.current = {
      sl: el.scrollLeft,
      st: el.scrollTop,
      w: el.scrollWidth,
      h: el.scrollHeight,
      x: ponto?.x ?? el.clientWidth / 2,
      y: ponto?.y ?? el.clientHeight / 2,
    }
    setZoom(novo)
  }

  useLayoutEffect(() => {
    const el = caixa.current
    const a = antes.current
    if (!el || !a) return
    el.scrollLeft = scrollAncorado({
      scroll: a.sl,
      ancora: a.x,
      tamanho: a.w,
      novoTamanho: el.scrollWidth,
    })
    el.scrollTop = scrollAncorado({
      scroll: a.st,
      ancora: a.y,
      tamanho: a.h,
      novoTamanho: el.scrollHeight,
    })
    antes.current = null
  }, [zoom])

  // ctrl/⌘ + wheel (a trackpad pinch arrives as ctrl + wheel) zooms at the
  // cursor; needs a non-passive listener to stop the browser's page zoom.
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    function roda(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = el!.getBoundingClientRect()
      aplicarZoom(zoomPorRoda(zoom, e.deltaY), {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
      })
    }
    el.addEventListener("wheel", roda, { passive: false })
    return () => el.removeEventListener("wheel", roda)
  })

  // A new page starts at its top-left corner.
  const paginaAtual = atual?.pagina
  useEffect(() => {
    caixa.current?.scrollTo(0, 0)
  }, [paginaAtual])

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
      className="flex min-w-0 flex-col gap-2 rounded-lg border bg-background p-2 lg:max-h-[calc(100svh-10rem)]"
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
        <div className="ml-1 flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Diminuir zoom"
            disabled={zoom <= ZOOM_MIN}
            onClick={() => aplicarZoom(zoomSeguinte(zoom, -1))}
          >
            <Minus />
          </Button>
          <button
            type="button"
            aria-label="Repor zoom"
            onClick={() => aplicarZoom(1)}
            className="h-7 w-11 rounded-md text-xs font-medium text-muted-foreground tabular-nums hover:bg-muted hover:text-foreground"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Aumentar zoom"
            disabled={zoom >= ZOOM_MAX}
            onClick={() => aplicarZoom(zoomSeguinte(zoom, 1))}
          >
            <Plus />
          </Button>
        </div>
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
        <div
          ref={caixa}
          onPointerDown={(e) => {
            if (zoom <= 1 || e.button !== 0) return
            const el = e.currentTarget
            el.setPointerCapture(e.pointerId)
            arrasto.current = {
              x: e.clientX,
              y: e.clientY,
              sl: el.scrollLeft,
              st: el.scrollTop,
            }
          }}
          onPointerMove={(e) => {
            const a = arrasto.current
            if (!a) return
            e.currentTarget.scrollLeft = a.sl - (e.clientX - a.x)
            e.currentTarget.scrollTop = a.st - (e.clientY - a.y)
          }}
          onPointerUp={() => (arrasto.current = null)}
          onPointerCancel={() => (arrasto.current = null)}
          className={cn(
            "min-h-0 flex-1 overflow-auto rounded border bg-white",
            zoom > 1 && "cursor-grab active:cursor-grabbing"
          )}
        >
          <img
            src={atual.imagemUrl}
            alt={`Página ${atual.pagina}`}
            draggable={false}
            style={{ width: `${zoom * 100}%` }}
            className="block h-auto max-w-none select-none"
          />
        </div>
      ) : (
        <p className="p-4 text-center text-sm text-muted-foreground">
          Sem imagem da página {atual.pagina}.
        </p>
      )}
    </section>
  )
}

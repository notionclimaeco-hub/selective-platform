import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { iconeFamilia, rotuloFamilia } from "@/lib/catalogo"

// Product gallery. Prefers resolved photo URLs; when none exist, embeds the
// first catalog PDF page (same fallback as the catalog cards); otherwise shows
// a family placeholder.
//
// Photos sit in one scroll-snap strip: phones swipe it and follow the dots,
// wide screens click the thumbnails (which scroll the same strip).
export function ProductGallery({
  familia,
  imagens = [],
  pdfCapaUrl = null,
}: {
  familia: string
  imagens?: Array<string>
  pdfCapaUrl?: string | null
}) {
  const [ativa, setAtiva] = useState(0)
  const faixa = useRef<HTMLDivElement>(null)
  const chave = imagens.join("|")

  // Back to the first photo when the image set changes (switching variants).
  useEffect(() => {
    setAtiva(0)
    faixa.current?.scrollTo({ left: 0 })
  }, [chave])

  if (imagens.length === 0) {
    if (pdfCapaUrl) {
      return <GaleriaPdf familia={familia} url={pdfCapaUrl} />
    }
    return <GaleriaPlaceholder familia={familia} />
  }

  const indice = Math.min(ativa, imagens.length - 1)

  function irPara(i: number) {
    const el = faixa.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div
          ref={faixa}
          onScroll={(e) => {
            const el = e.currentTarget
            setAtiva(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
          }}
          className="sem-scrollbar flex aspect-4/3 snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl border bg-secondary/60"
        >
          {imagens.map((url, i) => (
            <div
              key={url}
              className="flex size-full shrink-0 snap-center items-center justify-center p-6 sm:p-10"
            >
              <img
                src={url}
                alt={`${rotuloFamilia(familia)}, imagem ${i + 1} de ${imagens.length}`}
                loading={i === 0 ? "eager" : "lazy"}
                draggable={false}
                className="max-h-full max-w-full object-contain mix-blend-multiply"
              />
            </div>
          ))}
        </div>

        {imagens.length > 1 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 lg:hidden"
          >
            {imagens.map((url, i) => (
              <span
                key={url}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === indice
                    ? "w-4 bg-foreground/70"
                    : "w-1.5 bg-foreground/20"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {imagens.length > 1 && (
        <div className="hidden flex-wrap gap-2 lg:flex">
          {imagens.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => irPara(i)}
              aria-label={`Ver imagem ${i + 1}`}
              aria-current={i === indice}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-xl border bg-secondary/60 p-1.5 transition-colors",
                i === indice
                  ? "border-foreground/50"
                  : "hover:border-foreground/25"
              )}
            >
              <img
                src={url}
                alt=""
                className="size-full object-contain mix-blend-multiply"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GaleriaPdf({ familia, url }: { familia: string; url: string }) {
  return (
    <div className="relative aspect-4/3 overflow-hidden rounded-2xl border bg-white">
      <iframe
        src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        title={`Ficha do catálogo: ${rotuloFamilia(familia)}`}
        className="absolute inset-0 size-full border-0"
      />
    </div>
  )
}

function GaleriaPlaceholder({ familia }: { familia: string }) {
  const Icon = iconeFamilia(familia)
  return (
    <div className="flex aspect-4/3 items-center justify-center rounded-2xl border bg-secondary/60 text-muted-foreground/60">
      <Icon className="size-16" strokeWidth={1.25} />
    </div>
  )
}

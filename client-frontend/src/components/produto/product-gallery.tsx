import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"
import { iconeFamilia, rotuloFamilia } from "@/lib/catalogo"

// Product gallery. Prefers resolved photo URLs; when none exist, embeds the
// first catalog PDF page (same fallback as the catalog cards); otherwise shows
// a family placeholder.
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

  // Reset selection when the image set changes (e.g. switching variants).
  useEffect(() => {
    setAtiva(0)
  }, [imagens.join("|")])

  if (imagens.length === 0) {
    if (pdfCapaUrl) {
      return <GaleriaPdf familia={familia} url={pdfCapaUrl} />
    }
    return <GaleriaPlaceholder familia={familia} />
  }

  const indice = Math.min(ativa, imagens.length - 1)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-xl border bg-muted">
        <img
          src={imagens[indice]}
          alt={rotuloFamilia(familia)}
          className="size-full object-contain"
        />
        <span className="absolute top-4 left-4 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-primary shadow-sm backdrop-blur">
          {rotuloFamilia(familia)}
        </span>
      </div>

      {imagens.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {imagens.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setAtiva(i)}
              aria-label={`Ver imagem ${i + 1}`}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-xl border bg-card transition-all",
                i === indice
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "opacity-70 hover:opacity-100"
              )}
            >
              <img src={url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GaleriaPdf({ familia, url }: { familia: string; url: string }) {
  return (
    <div className="relative aspect-4/3 overflow-hidden rounded-3xl border bg-white">
      <iframe
        src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        title={`Ficha do catálogo: ${rotuloFamilia(familia)}`}
        className="absolute inset-0 size-full border-0"
      />
      <span className="pointer-events-none absolute top-4 left-4 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-primary shadow-sm backdrop-blur">
        {rotuloFamilia(familia)}
      </span>
    </div>
  )
}

function GaleriaPlaceholder({ familia }: { familia: string }) {
  const Icon = iconeFamilia(familia)

  return (
    <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-xl border bg-muted">
      {/* Soft decorative glows echoing the hero section. */}
      <div className="absolute -top-20 -left-20 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-16 -bottom-24 size-72 rounded-full bg-brand/25 blur-3xl" />

      <div className="relative flex size-36 items-center justify-center rounded-full bg-background/70 shadow-sm ring-1 ring-primary/15 backdrop-blur-sm">
        <Icon className="size-16 text-primary/70" strokeWidth={1.25} />
      </div>

      <span className="absolute top-4 left-4 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-primary shadow-sm backdrop-blur">
        {rotuloFamilia(familia)}
      </span>
    </div>
  )
}

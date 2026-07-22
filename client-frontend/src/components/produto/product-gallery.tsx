import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"
import { iconeCategoria, rotuloCategoria } from "@/lib/catalogo"

// Product gallery. When the product has resolved image URLs (first = cover) it
// renders a main image with an optional thumbnail strip; otherwise it falls back
// to an elegant category placeholder consistent with the catalog cards.
export function ProductGallery({
  categoria,
  imagens = [],
}: {
  categoria: string
  imagens?: Array<string>
}) {
  const [ativa, setAtiva] = useState(0)

  // Reset selection when the image set changes (e.g. switching variants).
  useEffect(() => {
    setAtiva(0)
  }, [imagens.join("|")])

  if (imagens.length === 0) {
    return <GaleriaPlaceholder categoria={categoria} />
  }

  const indice = Math.min(ativa, imagens.length - 1)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-3xl border bg-gradient-to-br from-accent via-secondary to-brand/15">
        <img
          src={imagens[indice]}
          alt={rotuloCategoria(categoria)}
          className="size-full object-contain"
        />
        <span className="absolute left-4 top-4 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-primary shadow-sm backdrop-blur">
          {rotuloCategoria(categoria)}
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
                  : "opacity-70 hover:opacity-100",
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

function GaleriaPlaceholder({ categoria }: { categoria: string }) {
  const Icon = iconeCategoria(categoria)

  return (
    <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-3xl border bg-gradient-to-br from-accent via-secondary to-brand/15">
      {/* Soft decorative glows echoing the hero section. */}
      <div className="absolute -left-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-24 -right-16 size-72 rounded-full bg-brand/25 blur-3xl" />

      <div className="relative flex size-36 items-center justify-center rounded-full bg-background/70 shadow-sm ring-1 ring-primary/15 backdrop-blur-sm">
        <Icon className="size-16 text-primary/70" strokeWidth={1.25} />
      </div>

      <span className="absolute left-4 top-4 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-primary shadow-sm backdrop-blur">
        {rotuloCategoria(categoria)}
      </span>
    </div>
  )
}

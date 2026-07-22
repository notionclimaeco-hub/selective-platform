import { Suspense } from "react"
import { Link } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { useSuspenseQuery } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"

import { api } from "@convex/_generated/api"
import {
  eur,
  iconeCategoria,
  rotuloCategoria,
  rotuloMarca,
} from "@/lib/catalogo"

export function ProductShowcase() {
  return (
    <section id="produtos" className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Catálogo
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Produtos em destaque
          </h2>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Uma seleção do nosso catálogo de equipamentos — do split
            residencial à bomba de calor comercial. Preços de tabela (PVP),
            sem IVA.
          </p>
        </div>

        <Suspense fallback={<ShowcaseSkeleton />}>
          <ShowcaseGrid />
        </Suspense>
      </div>
    </section>
  )
}

function ShowcaseGrid() {
  const { data: entradas } = useSuspenseQuery(
    convexQuery(api.produtos.listarCatalogo, {}),
  )

  if (entradas.length === 0) {
    return (
      <p className="mt-10 text-sm text-muted-foreground">
        O catálogo será publicado em breve. Contacte-nos para conhecer a nossa
        oferta completa.
      </p>
    )
  }

  return (
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {entradas.map((entrada) => (
        <Link
          key={entrada.grupoModelo ?? entrada.ref}
          to="/produto/$ref"
          params={{ ref: entrada.ref }}
          className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
        >
          <CardMedia
            categoria={entrada.categoria}
            capaUrl={entrada.capaUrl}
            capaPdfUrl={entrada.capaPdfUrl}
            nome={entrada.nome}
          />

          <div className="flex flex-1 flex-col gap-1.5 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {rotuloMarca(entrada.marca)}
              {entrada.gama ? ` · ${entrada.gama}` : ""}
            </p>
            <h3 className="line-clamp-2 font-semibold leading-snug">
              {entrada.nome}
            </h3>

            <div className="mt-auto flex items-end justify-between pt-4">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">desde</span>
                <span className="text-lg font-semibold text-primary">
                  {eur.format(entrada.precoDesdeCents / 100)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    s/IVA
                  </span>
                </span>
              </div>
              {entrada.numVariantes > 1 && (
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                  {entrada.numVariantes} modelos
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t px-5 py-3 text-sm font-medium text-primary">
            Ver detalhes
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      ))}
    </div>
  )
}

function CardMedia({
  categoria,
  capaUrl,
  capaPdfUrl,
  nome,
}: {
  categoria: string
  capaUrl: string | null
  capaPdfUrl: string | null
  nome: string
}) {
  const Icon = iconeCategoria(categoria)

  return (
    <div className="relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-accent via-secondary to-brand/15">
      {capaUrl ? (
        <img
          src={capaUrl}
          alt={nome}
          className="size-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
        />
      ) : capaPdfUrl ? (
        // Catalog PDFs aren't raster images — embed the first page as a
        // visual preview. pointer-events-none keeps the card link clickable.
        <iframe
          src={`${capaPdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          title={`Catálogo — ${nome}`}
          className="pointer-events-none absolute inset-0 size-full border-0 bg-white"
          loading="lazy"
        />
      ) : (
        <Icon
          className="size-12 text-primary/50 transition-transform duration-300 group-hover:scale-110"
          strokeWidth={1.5}
        />
      )}
      <span className="absolute left-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-primary backdrop-blur">
        {rotuloCategoria(categoria)}
      </span>
    </div>
  )
}

function ShowcaseSkeleton() {
  return (
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="h-72 animate-pulse rounded-2xl border bg-secondary/60"
        />
      ))}
    </div>
  )
}

import { Suspense } from "react"
import { Link } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { useSuspenseQuery } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"

import { api } from "@convex/_generated/api"
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/catalogo/product-card"
import { Button } from "@/components/ui/button"
import { Etiqueta, Reveal } from "./reveal"

export function ProductShowcase() {
  return (
    <section id="produtos" className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <Etiqueta>Catálogo</Etiqueta>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              Produtos em destaque.{" "}
              <span className="text-muted-foreground">
                Preços de tabela, sem IVA.
              </span>
            </h2>
            <p className="max-w-2xl leading-relaxed text-pretty text-muted-foreground">
              Uma seleção do nosso catálogo de equipamentos, do split
              residencial à bomba de calor comercial.
            </p>
          </div>
          <Button
            render={<Link to="/produtos" />}
            nativeButton={false}
            variant="outline"
            className="shrink-0 self-start sm:self-auto"
          >
            Ver catálogo completo
            <ArrowRight data-icon="inline-end" />
          </Button>
        </Reveal>

        <Suspense fallback={<ShowcaseSkeleton />}>
          <ShowcaseGrid />
        </Suspense>
      </div>
    </section>
  )
}

function ShowcaseGrid() {
  const { data } = useSuspenseQuery(
    convexQuery(api.catalogo.listar, {
      pagina: 0,
      porPagina: 8,
    })
  )

  if (data.entradas.length === 0) {
    return (
      <p className="mt-10 text-sm text-muted-foreground">
        O catálogo será publicado em breve. Contacte-nos para conhecer a nossa
        oferta completa.
      </p>
    )
  }

  return (
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {data.entradas.map((entrada, i) => (
        <Reveal
          key={entrada.grupoModelo}
          atraso={(i % 4) * 80}
          className="grid"
        >
          <ProductCard entrada={entrada} />
        </Reveal>
      ))}
    </div>
  )
}

function ShowcaseSkeleton() {
  return (
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

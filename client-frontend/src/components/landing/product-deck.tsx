import { Suspense } from "react"
import { Link } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { useSuspenseQueries } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"

import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { iconeFamilia, rotuloFamilia, rotuloMarca } from "@/lib/catalogo"
import { cn } from "@/lib/utils"
import { Etiqueta, Reveal, useInView } from "./reveal"

/**
 * One card of the deck: a family of the catalog, illustrated by a real
 * product photo when the catalog has one. No names, no prices — the deck
 * shows the breadth of the range, the catalog page does the selling.
 */
type Carta = {
  familia: string
  marca?: string
  capaUrl?: string
}

// Families the deck wants to show, in fan order (centre card last to settle).
// Also the fallback while the catalog loads or when it has no photo for one.
const FAMILIAS_DO_BARALHO = [
  "ventilacao",
  "bombas-de-calor",
  "ar-condicionado",
  "ventiloconvectores",
  "aqs",
]
const FALLBACK: Array<Carta> = FAMILIAS_DO_BARALHO.map((familia) => ({
  familia,
}))

export function ProductDeck() {
  return (
    <section
      id="produtos"
      className="scroll-mt-20 overflow-hidden border-t py-16 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Etiqueta>Catálogo</Etiqueta>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Mais de mil equipamentos.{" "}
            <span className="text-muted-foreground">
              Do split mural à central VRF.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-pretty text-muted-foreground">
            Ar condicionado, bombas de calor, ventilação, águas quentes
            sanitárias e acessórios de cinco marcas, com fichas técnicas em
            cada modelo para anexar às suas propostas.
          </p>
        </Reveal>

        <Suspense fallback={<Baralho cartas={FALLBACK} />}>
          <BaralhoComDados />
        </Suspense>

        <Reveal className="mt-10 flex justify-center md:mt-12">
          <Button render={<Link to="/produtos" />} nativeButton={false} size="lg">
            Ver produtos
            <ArrowRight data-icon="inline-end" />
          </Button>
        </Reveal>
      </div>
    </section>
  )
}

function BaralhoComDados() {
  // One small query per family (the catalog's first page is mostly one
  // family, so a single page rarely has a photo for all five). Each takes the
  // first product with a photo; a family without one keeps its icon.
  const paginas = useSuspenseQueries({
    queries: FAMILIAS_DO_BARALHO.map((familia) =>
      convexQuery(api.catalogo.listar, { familia, pagina: 0, porPagina: 6 })
    ),
  })
  const cartas = FAMILIAS_DO_BARALHO.map((familia, i): Carta => {
    const produto = paginas[i]?.data.entradas.find((p) => p.capaUrl)
    return produto
      ? { familia, marca: produto.marca, capaUrl: produto.capaUrl ?? undefined }
      : { familia }
  })
  return <Baralho cartas={cartas} />
}

/**
 * A hand of cards. They start stacked and, when the deck scrolls into view,
 * fan out left and right (see `.baralho` in styles.css). The centre card
 * sits on top; hovering lifts a card out of the fan.
 */
function Baralho({ cartas }: { cartas: Array<Carta> }) {
  const { ref, visivel } = useInView<HTMLDivElement>("0px 0px -12% 0px", 0.3)
  const meio = (cartas.length - 1) / 2

  return (
    <div
      ref={ref}
      data-on={visivel}
      className="baralho relative mx-auto mt-10 h-56 max-w-3xl sm:mt-14 sm:h-80"
    >
      {cartas.map((carta, i) => {
        const t = i - meio
        const centro = t === 0
        const Icon = iconeFamilia(carta.familia)
        return (
          <Link
            key={carta.familia}
            to="/produtos"
            search={{ familia: carta.familia }}
            aria-label={`Ver ${rotuloFamilia(carta.familia)}`}
            style={
              {
                "--t": t,
                "--abs": Math.abs(t),
                zIndex: cartas.length - Math.abs(t) * 2,
              } as React.CSSProperties
            }
            className={cn(
              "baralho-carta flex h-44 w-32 flex-col overflow-hidden rounded-xl border bg-card shadow-[0_18px_40px_-28px_rgb(0_0_0/0.45)] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none sm:h-64 sm:w-48",
              "hover:border-foreground/25"
            )}
          >
            <div className="flex flex-1 items-center justify-center bg-muted">
              {carta.capaUrl ? (
                <img
                  src={carta.capaUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-contain p-3 sm:p-5"
                />
              ) : (
                <Icon
                  className="size-8 text-primary/50 sm:size-10"
                  strokeWidth={1.5}
                />
              )}
            </div>
            {/* Side cards overlap too much on phones for a label to read, so
                only the centre card keeps its strip there. */}
            <div
              className={cn(
                "border-t px-3 py-2.5 sm:block sm:px-4 sm:py-3",
                !centro && "hidden"
              )}
            >
              <p className="overflow-hidden text-xs font-semibold whitespace-nowrap sm:text-sm">
                {rotuloFamilia(carta.familia)}
              </p>
              <p className="overflow-hidden text-[10px] font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase">
                {carta.marca ? rotuloMarca(carta.marca) : "Cinco marcas"}
              </p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

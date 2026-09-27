import { ArrowUpRight, MapPin } from "lucide-react"

import { MAPS_ARMAZEM, MORADA_ARMAZEM } from "@/components/shell/nav"

import { cn } from "@/lib/utils"
import { CountUp, Etiqueta, Reveal, useInView } from "./reveal"

/**
 * About block in the page's own language: a short intro, then three hairline
 * tiles (years, PME distinction, and the warehouse on a real map across the
 * full width), each with an illustration built from the same tokens and
 * reveal motion as the vignettes and the deck. The full story lives on
 * /sobre; this only says who is behind the prices.
 */
export function Sobre() {
  return (
    <section id="sobre" className="scroll-mt-20 border-t py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Etiqueta>Sobre nós</Etiqueta>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Um parceiro de distribuição,{" "}
            <span className="text-muted-foreground">há mais de 20 anos.</span>
          </h2>
          <p className="mt-4 leading-relaxed text-pretty text-muted-foreground">
            A Clima Eco Selective fornece equipamento das marcas líderes a
            empresas instaladoras e gabinetes de projeto em todo o país.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 md:mt-12 lg:grid-cols-3">
          <Tile
            atraso={0}
            className="sm:col-span-2"
            titulo="Há mais de 20 anos no mercado português"
            texto="Ao lado de empresas instaladoras e gabinetes de projeto, obra após obra."
          >
            <Anos />
          </Tile>
          <Tile
            atraso={80}
            titulo="Top 5% PME Portugal"
            texto="Distinguidos entre as melhores PME do país no ranking Scoring 2024."
          >
            <Distincao />
          </Tile>
          <Armazem />
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------- tile --- */

function Tile({
  titulo,
  texto,
  atraso,
  className,
  children,
}: {
  titulo: string
  texto: string
  atraso: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <Reveal
      atraso={atraso}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card",
        className
      )}
    >
      <div className="flex h-36 items-center justify-center border-b bg-muted/50 px-5">
        {children}
      </div>
      <div className="p-5">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {texto}
        </p>
      </div>
    </Reveal>
  )
}

/* ----------------------------------------------------- illustrations --- */

/** A ruler of years that lights up left to right, ending on today. */
function Anos() {
  const { ref, visivel } = useInView<HTMLDivElement>()
  const anos = 24
  return (
    <div
      ref={ref}
      aria-hidden
      className="flex w-full items-end justify-between gap-4 sm:gap-8"
    >
      <span className="text-5xl font-semibold tracking-tight sm:text-6xl">
        <CountUp ate={20} sufixo="+" />
      </span>
      <div className="flex flex-1 items-end justify-between">
        {Array.from({ length: anos }, (_, i) => {
          const ultimo = i === anos - 1
          return (
            <span
              key={i}
              className={cn(
                "surge w-1 shrink-0 rounded-full sm:w-1.5 lg:w-2",
                ultimo ? "h-10 bg-primary" : "bg-foreground/20",
                i % 6 === 5 ? "h-7" : "h-4"
              )}
              data-on={visivel}
              style={{ transitionDelay: `${i * 45}ms` }}
            />
          )
        })}
      </div>
    </div>
  )
}

/**
 * Full-width warehouse tile: a static map of Belas (OpenStreetMap tiles,
 * rendered once by scripts/dev/osm-static-map.mjs and toned to the page)
 * with our pin and the address on top. The map opens the Google Maps pin.
 */
function Armazem() {
  const { ref, visivel } = useInView<HTMLDivElement>()
  return (
    <Reveal
      atraso={160}
      className="flex flex-col overflow-hidden rounded-xl border bg-card sm:col-span-2 lg:col-span-3"
    >
      <div ref={ref} className="relative h-64 border-b sm:h-72 lg:h-80">
        <a
          href={MAPS_ARMAZEM}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir o armazém no Google Maps: ${MORADA_ARMAZEM.rua}, ${MORADA_ARMAZEM.localidade}`}
          className="group/mapa absolute inset-0 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
        >
          <img
            src="/mapa-armazem.jpg"
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover opacity-70 grayscale transition-opacity duration-500 group-hover/mapa:opacity-90"
          />
          {/* Soft vignette so the pin and label read over any street density. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_45%_60%_at_50%_50%,transparent,color-mix(in_oklch,var(--card),transparent_45%))]"
          />
          <span
            className="surge relative flex flex-col items-center"
            data-on={visivel}
            style={{ transitionDelay: "150ms" }}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-primary/20 transition-transform group-hover/mapa:-translate-y-0.5">
              <MapPin className="size-4.5" />
            </span>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-2xl border bg-background py-1.5 pr-2.5 pl-3 text-xs font-medium shadow-xs transition-colors group-hover/mapa:border-foreground/25 sm:rounded-full">
              {/* Two lines on phones, one line from `sm` up. */}
              <span className="flex flex-col items-center gap-0.5 text-center leading-tight sm:flex-row sm:gap-1">
                <span>{MORADA_ARMAZEM.rua}</span>
                <span aria-hidden className="hidden sm:inline">·</span>
                <span>{MORADA_ARMAZEM.localidade}</span>
              </span>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
            </span>
          </span>
        </a>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-2 bottom-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          © OpenStreetMap
        </a>
      </div>
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Levantamento no nosso armazém</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Stock confirmado junto dos fornecedores e pronto a levantar em
            Belas, Sintra.
          </p>
        </div>
        <a
          href={MAPS_ARMAZEM}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Abrir no Google Maps
          <ArrowUpRight className="size-3.5 text-muted-foreground" />
        </a>
      </div>
    </Reveal>
  )
}

function Distincao() {
  return (
    <img
      src="/certificacoes/pme2024.png"
      alt="Scoring TOP 5%, Melhores PME Portugal 2024"
      className="h-20 w-auto"
    />
  )
}

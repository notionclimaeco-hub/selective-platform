import { ArrowUpRight, Download, FileText, MapPin } from "lucide-react"

import { MAPS_ARMAZEM, MORADA_ARMAZEM } from "@/components/shell/nav"

import { cn } from "@/lib/utils"
import { LogoMascara, MARCAS } from "./brand-marquee"
import { CountUp, Etiqueta, Reveal, useInView } from "./reveal"

/**
 * About block in the page's own language: a short intro, then a bento of
 * hairline tiles, each with a small illustration built from the same tokens
 * and reveal motion as the vignettes and the deck. The full story lives on
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
            titulo="Cinco marcas em distribuição oficial"
            texto="Mitsubishi Electric, Daikin, Nipon, Hisense e Midea, com garantia de fabricante."
          >
            <Marcas />
          </Tile>
          <Tile
            atraso={160}
            titulo="Documentação técnica em cada modelo"
            texto="Fichas técnicas e páginas de catálogo prontas a anexar às suas propostas."
          >
            <Documentos />
          </Tile>
          <Tile
            atraso={240}
            titulo="Levantamento no nosso armazém"
            texto="Stock confirmado junto dos fornecedores e pronto a levantar em Belas, Sintra."
          >
            <Armazem />
          </Tile>
          <Tile
            atraso={320}
            titulo="Top 5% PME Portugal"
            texto="Distinguidos entre as melhores PME do país no ranking Scoring 2024."
          >
            <Distincao />
          </Tile>
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

/** The five partner logos in the page's single tone. */
function Marcas() {
  return (
    <div className="grid w-full grid-cols-3 items-center gap-x-4 gap-y-3 text-muted-foreground/70">
      {MARCAS.map((marca) => (
        <div
          key={marca.nome}
          className="flex h-6 items-center justify-center"
          aria-label={marca.nome}
        >
          {marca.logo ? (
            <LogoMascara src={marca.logo} className="h-full w-full max-w-24" />
          ) : (
            <span className="text-base font-semibold tracking-tight italic">
              nipon
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/** Two document rows, revealed one after the other. */
function Documentos() {
  const { ref, visivel } = useInView<HTMLDivElement>()
  const linhas = ["Ficha técnica", "Página de catálogo"]
  return (
    <div ref={ref} aria-hidden className="w-full max-w-xs space-y-2">
      {linhas.map((nome, i) => (
        <div
          key={nome}
          className="surge flex items-center gap-3 rounded-lg border bg-background px-3 py-2"
          data-on={visivel}
          style={{ transitionDelay: `${i * 220}ms` }}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted text-primary">
            <FileText className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">{nome}</span>
            <span className="block text-[10px] text-muted-foreground">
              PDF · do fabricante
            </span>
          </span>
          <Download className="size-3.5 text-muted-foreground" />
        </div>
      ))}
    </div>
  )
}

/** A stylised map: thin guides, one pin, the address; opens the real pin. */
function Armazem() {
  const { ref, visivel } = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className="size-full">
      <a
        href={MAPS_ARMAZEM}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Abrir o armazém no Google Maps: ${MORADA_ARMAZEM.rua}, ${MORADA_ARMAZEM.localidade}`}
        className="group/mapa relative flex size-full flex-col items-center justify-center bg-[linear-gradient(to_right,color-mix(in_oklch,var(--border),transparent_35%)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--border),transparent_35%)_1px,transparent_1px)] bg-[size:2.5rem_2.5rem] bg-center focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
      >
        <span
          className="surge flex flex-col items-center"
          data-on={visivel}
          style={{ transitionDelay: "150ms" }}
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-primary/15 transition-transform group-hover/mapa:-translate-y-0.5">
            <MapPin className="size-4" />
          </span>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full border bg-background py-1 pr-2 pl-2.5 text-[11px] font-medium transition-colors group-hover/mapa:border-foreground/25">
            {MORADA_ARMAZEM.rua} · {MORADA_ARMAZEM.localidade}
            <ArrowUpRight className="size-3 text-muted-foreground" />
          </span>
        </span>
      </a>
    </div>
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

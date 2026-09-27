import { Link } from "@tanstack/react-router"
import { ArrowRight, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PriceReveal } from "./price-reveal"

/**
 * Centered hero on plain white. Copy fades up in a stagger on load; below it,
 * a fanned stack of real catalog cards at list price, a sign-in node and the
 * same cards at reseller price play out as the stage scrolls into view.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-16 text-center sm:px-6 md:pt-24">
        <a
          href="#marcas"
          style={{ "--delay": "0ms" } as React.CSSProperties}
          className="animate-rise group inline-flex items-center gap-1.5 rounded-full border bg-background py-1 pr-2 pl-3 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
        >
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
          Distribuidor oficial de cinco marcas líderes
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </a>

        <h1
          style={{ "--delay": "80ms" } as React.CSSProperties}
          className="animate-rise mt-6 text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl md:leading-[1.02]"
        >
          Distribuição seletiva de climatização para profissionais.
        </h1>

        <p
          style={{ "--delay": "160ms" } as React.CSSProperties}
          className="animate-rise mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg"
        >
          Ar condicionado, bombas de calor, ventiloconvetores e ventilação para
          empresas instaladoras, gabinetes de projeto e obras de grande
          dimensão. Catálogo público a preço de tabela; preços de distribuidor
          para empresas aprovadas.
        </p>

        <div
          style={{ "--delay": "240ms" } as React.CSSProperties}
          className="animate-rise mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            render={<Link to="/registo" />}
            nativeButton={false}
            variant="outline"
            size="lg"
          >
            Registar empresa
          </Button>
          <Button
            render={<Link to="/produtos" />}
            nativeButton={false}
            size="lg"
          >
            Ver catálogo
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>

      <div
        style={{ "--delay": "420ms" } as React.CSSProperties}
        className="animate-rise relative mx-auto mt-12 max-w-6xl px-4 pb-16 sm:px-6 md:mt-20 md:pb-24"
      >
        {/* Soft tinted glow that grounds the cards against the white page. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[34rem] bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,color-mix(in_oklch,var(--primary),transparent_88%),transparent)]"
        />
        <PriceReveal />
      </div>
    </section>
  )
}

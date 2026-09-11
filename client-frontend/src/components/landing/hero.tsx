import { Link } from "@tanstack/react-router"
import { ArrowRight, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Centered hero on plain white: eyebrow pill, one big statement, one line of
 * support, two actions. No decoration competing with the copy.
 */
export function Hero() {
  return (
    <section className="border-b">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-16 pb-14 text-center sm:px-6 md:pt-24 md:pb-20">
        <Link
          to="/produtos"
          className="group inline-flex items-center gap-1.5 rounded-full border bg-background py-1 pr-2 pl-3 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
        >
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
          Mais de 20 anos ao lado de instaladores
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>

        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl md:leading-[1.02]">
          Distribuição seletiva de climatização para profissionais.
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          Ar condicionado, bombas de calor, ventiloconvetores e ventilação das
          marcas líderes, com preços de revenda e apoio técnico para
          instaladores e projetistas em Portugal.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            render={<a href="#contactos" />}
            nativeButton={false}
            variant="outline"
            size="lg"
          >
            Falar com a equipa
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
    </section>
  )
}

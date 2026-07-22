import { BadgeCheck, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft brand-green washes; decorative only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/80 via-background to-background"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] size-[480px] rounded-full bg-brand/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-56 left-[-12%] size-[480px] rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-20 sm:px-6 md:py-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-sm font-medium text-primary">
          <BadgeCheck className="size-4" />
          Mais de 20 anos de experiência em climatização
        </span>

        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          Distribuição seletiva de{" "}
          <span className="text-primary">climatização</span> para profissionais
        </h1>

        <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
          Ar condicionado, bombas de calor, ventiloconvetores e ventilação das
          marcas líderes do mercado. Parceiro de confiança de instaladores e
          projetistas em Portugal, com apoio técnico especializado em cada
          projeto.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            render={<a href="#produtos" />}
            nativeButton={false}
            size="lg"
            className="px-6"
          >
            Ver produtos
            <ChevronRight data-icon="inline-end" />
          </Button>
          <Button
            render={<a href="#contactos" />}
            nativeButton={false}
            variant="outline"
            size="lg"
            className="px-6"
          >
            Contacte-nos
          </Button>
        </div>
      </div>
    </section>
  )
}

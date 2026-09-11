import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Reveal } from "./reveal"

/** Landing-only closing call-to-action, rendered right before the footer. */
export function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-t">
      {/* Same soft glow as the hero, closing the loop. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[18rem] bg-[radial-gradient(ellipse_55%_60%_at_50%_100%,color-mix(in_oklch,var(--primary),transparent_90%),transparent)]"
      />
      <Reveal className="relative mx-auto flex max-w-2xl flex-col items-center px-4 py-14 text-center sm:px-6 md:py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          O seu próximo projeto,{" "}
          <span className="text-muted-foreground">ao preço certo.</span>
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
          Registe a sua empresa em poucos minutos. Aprovamos o acesso e passa a
          encomendar com preços de distribuidor, stock confirmado e levantamento
          no nosso armazém.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            render={<Link to="/registo" />}
            nativeButton={false}
            size="lg"
          >
            Registar empresa
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button
            render={<a href="mailto:geral@climaeco.pt" />}
            nativeButton={false}
            variant="outline"
            size="lg"
          >
            Falar com a equipa
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Já tem conta?{" "}
          <Link
            to="/entrar"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Entrar na área de cliente
          </Link>
        </p>
      </Reveal>
    </section>
  )
}

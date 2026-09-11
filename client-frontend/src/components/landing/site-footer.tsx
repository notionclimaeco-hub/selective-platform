import { Link } from "@tanstack/react-router"
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Reveal } from "./reveal"

export function SiteFooter({
  cta = true,
}: {
  /** The closing call-to-action is for visitors; signed-in pages skip it. */
  cta?: boolean
}) {
  return (
    <footer id="contactos" className="scroll-mt-20">
      {cta && (
        <div className="relative overflow-hidden border-t">
          {/* Same soft glow as the hero, closing the loop. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[28rem] bg-[radial-gradient(ellipse_55%_60%_at_50%_100%,color-mix(in_oklch,var(--primary),transparent_90%),transparent)]"
          />
          <Reveal className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 md:py-28">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl md:text-5xl">
              O seu próximo projeto,{" "}
              <span className="text-muted-foreground">ao preço certo.</span>
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-pretty text-muted-foreground sm:text-lg">
              Registe a sua empresa em poucos minutos. Aprovamos o acesso e
              passa a encomendar com preços de distribuidor, stock confirmado e
              levantamento no nosso armazém.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
            <p className="mt-6 text-xs text-muted-foreground">
              Já tem conta?{" "}
              <Link
                to="/entrar"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Entrar na área de cliente
              </Link>
            </p>
          </Reveal>
        </div>
      )}

      {/* Footer body */}
      <div className="border-t bg-background">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <img
              src="/logo-climaeco.png"
              alt="Clima Eco Selective"
              className="h-12 w-auto self-start"
            />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Distribuição seletiva de equipamentos de climatização. Mais de 20
              anos ao lado de instaladores e projetistas em Portugal.
            </p>
            <div className="mt-2 flex items-center gap-5">
              <img
                src="/certificacoes/pme2024.png"
                alt="Scoring TOP 5%, Melhores PME Portugal 2024"
                className="h-14 w-auto opacity-80 transition-opacity hover:opacity-100"
              />
              <img
                src="/certificacoes/certif.png"
                alt="CERTIF, Serviço certificado SAC-601/2015"
                className="h-10 w-auto opacity-80 transition-opacity hover:opacity-100"
              />
            </div>
          </div>

          <nav className="flex flex-col gap-2 text-sm">
            <p className="mb-1 font-semibold">Navegação</p>
            <Link
              to="/produtos"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Produtos
            </Link>
            <a
              href="/#marcas"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Marcas
            </a>
            <a
              href="/#sobre"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Sobre nós
            </a>
            <Link
              to="/entrar"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Área de Cliente
            </Link>
          </nav>

          {/* Placeholder contacts: swap for the real ones. */}
          <div className="flex flex-col gap-2 text-sm">
            <p className="mb-1 font-semibold">Contactos</p>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4 shrink-0" /> +351 210 000 000
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4 shrink-0" /> geral@climaeco.pt
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4 shrink-0" /> Lisboa, Portugal
            </span>
          </div>
        </div>

        <div className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-6 md:flex-row">
            <span>
              © {new Date().getFullYear()} Clima Eco Selective. Todos os
              direitos reservados.
            </span>
            <span>Parceiro oficial · Portugal</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

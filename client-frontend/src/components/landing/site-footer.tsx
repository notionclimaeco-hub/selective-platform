import { Link } from "@tanstack/react-router"
import { Mail, MapPin, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"

export function SiteFooter({
  cta = true,
}: {
  /** The green "talk to us" band is for visitors; signed-in pages skip it. */
  cta?: boolean
}) {
  return (
    <footer id="contactos" className="scroll-mt-20">
      {cta && (
        <div className="bg-primary">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight text-balance text-primary-foreground sm:text-3xl">
                Vamos falar sobre o seu próximo projeto?
              </h2>
              <p className="mt-2 text-pretty text-primary-foreground/80">
                Peça acesso à área de cliente ou fale diretamente com a nossa
                equipa comercial.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                render={<Link to="/entrar" />}
                nativeButton={false}
                size="lg"
                className="border-background bg-background px-5 text-foreground hover:border-background/90 hover:bg-background/90"
              >
                Área de Cliente
              </Button>
              <Button
                render={<a href="mailto:geral@climaeco.pt" />}
                nativeButton={false}
                size="lg"
                className="border-primary-foreground/30 bg-transparent px-5 text-primary-foreground shadow-none hover:border-primary-foreground/50 hover:bg-primary-foreground/10"
              >
                Contacte-nos
              </Button>
            </div>
          </div>
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

import { useEffect, useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { ExternalLink, Menu } from "lucide-react"

import { Wordmark } from "@/components/brand/wordmark"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  EMAIL_GERAL,
  LINKS_LEGAIS,
  LIVRO_RECLAMACOES,
  MAILTO_GERAL,
  MAPS_ARMAZEM,
  MORADA_ARMAZEM,
  NAV_MARKETING,
} from "./nav"

/**
 * Chrome for signed-out visitors: a slim 56px bar (wordmark, Produtos, Sobre,
 * Entrar, Registar empresa) and a compact footer with the contact
 * and legal links. On phones the nav collapses into a hamburger sheet.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <BarraMarketing />
      <main className="flex flex-1 flex-col">{children}</main>
      <RodapeMarketing />
    </div>
  )
}

function BarraMarketing() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center" aria-label="Início">
          <Wordmark className="h-7" />
        </Link>

        <nav
          className="ml-4 hidden items-center gap-0.5 md:flex"
          aria-label="Principal"
        >
          {NAV_MARKETING.map((item) => (
            <LigacaoMarketing key={item.label} item={item} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            render={<Link to="/entrar" />}
            nativeButton={false}
            variant="outline"
            className="hidden sm:inline-flex"
          >
            Entrar
          </Button>
          <Button
            render={<Link to="/registo" />}
            nativeButton={false}
            className="hidden md:inline-flex"
          >
            Registar empresa
          </Button>
          <MenuMovel />
        </div>
      </div>
    </header>
  )
}

const LIGACAO =
  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
const LIGACAO_ACTIVA = "text-foreground"
const LIGACAO_MOVEL =
  "flex items-center rounded-lg px-3 py-2.5 text-[15px] font-medium text-foreground transition-colors hover:bg-muted"

function LigacaoMarketing({
  item,
  movel = false,
}: {
  item: (typeof NAV_MARKETING)[number]
  movel?: boolean
}) {
  const classe = movel ? LIGACAO_MOVEL : LIGACAO
  if (item.kind === "route") {
    return (
      <Link
        to={item.to}
        className={classe}
        activeProps={{ className: movel ? "bg-muted" : LIGACAO_ACTIVA }}
      >
        {item.label}
      </Link>
    )
  }
  return (
    <a href={item.href} className={classe}>
      {item.label}
    </a>
  )
}

function MenuMovel() {
  const [aberto, setAberto] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // Close the sheet whenever navigation happens.
  useEffect(() => {
    setAberto(false)
  }, [pathname])

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            aria-label="Abrir menu"
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,85vw)] gap-0 p-0">
        <div className="flex h-14 items-center border-b px-4">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Navegação principal
          </SheetDescription>
          <Wordmark className="h-7" />
        </div>
        <nav
          className="flex flex-col gap-1 p-3"
          aria-label="Principal (telemóvel)"
        >
          {NAV_MARKETING.map((item) => (
            <LigacaoMarketing key={item.label} item={item} movel />
          ))}
          <Link to="/orcamento" className={LIGACAO_MOVEL}>
            Lista de orçamento
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            render={<Link to="/registo" />}
            nativeButton={false}
            size="lg"
          >
            Registar empresa
          </Button>
          <Button
            render={<Link to="/entrar" />}
            nativeButton={false}
            variant="outline"
            size="lg"
          >
            Entrar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

const LIGACAO_RODAPE =
  "text-sm text-muted-foreground transition-colors hover:text-foreground"

/** One footer column: a small heading and a stack of links. */
function ColunaRodape({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
        {titulo}
      </p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  )
}

function RodapeMarketing() {
  return (
    <footer id="contactos" className="mt-auto border-t">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-14">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] md:gap-8">
          {/* Brand */}
          <div className="flex max-w-xs flex-col gap-4">
            <Wordmark className="h-7 self-start" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Distribuição seletiva de climatização para empresas instaladoras e
              gabinetes de projeto.
            </p>
          </div>

          <ColunaRodape titulo="Navegação">
            <Link to="/produtos" className={LIGACAO_RODAPE}>
              Produtos
            </Link>
            <a href="/sobre" className={LIGACAO_RODAPE}>
              Sobre
            </a>
            <Link to="/registo" className={LIGACAO_RODAPE}>
              Registar empresa
            </Link>
            <Link to="/entrar" className={LIGACAO_RODAPE}>
              Entrar
            </Link>
          </ColunaRodape>

          <ColunaRodape titulo="Contactos">
            <a href={MAILTO_GERAL} className={LIGACAO_RODAPE}>
              {EMAIL_GERAL}
            </a>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {MORADA_ARMAZEM.rua}
              <br />
              {MORADA_ARMAZEM.loja} · {MORADA_ARMAZEM.localidade}
            </p>
            <a
              href={MAPS_ARMAZEM}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                LIGACAO_RODAPE,
                "inline-flex items-center gap-1 font-medium text-foreground"
              )}
            >
              Ver no mapa
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </ColunaRodape>

          <ColunaRodape titulo="Legal">
            {LINKS_LEGAIS.map((l) => (
              <a key={l.href} href={l.href} className={LIGACAO_RODAPE}>
                {l.label}
              </a>
            ))}
            <a
              href={LIVRO_RECLAMACOES}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(LIGACAO_RODAPE, "inline-flex items-center gap-1")}
            >
              Livro de Reclamações
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </ColunaRodape>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:mt-12">
          <p>
            © {new Date().getFullYear()} Climaeco. Todos os direitos reservados.
          </p>
          <p>Belas, Sintra · Portugal</p>
        </div>
      </div>
    </footer>
  )
}

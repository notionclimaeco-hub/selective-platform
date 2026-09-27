import { useEffect, useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { ExternalLink, Menu } from "lucide-react"

import { Wordmark } from "@/components/brand/wordmark"
import { QuoteTrigger } from "@/components/orcamento/quote-trigger"
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
  NAV_MARKETING,
} from "./nav"

/**
 * Chrome for signed-out visitors: a slim 56px bar (wordmark, Produtos, Sobre,
 * quote list, Entrar, Registar empresa) and a compact footer with the contact
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
          <QuoteTrigger />
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

function RodapeMarketing() {
  return (
    <footer id="contactos" className="mt-auto border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <Wordmark className="h-7 self-start" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Distribuição de equipamentos de climatização para empresas
            instaladoras.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:gap-12">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Contactos</p>
            <a href={MAILTO_GERAL} className={LIGACAO_RODAPE}>
              {EMAIL_GERAL}
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Legal</p>
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
          </div>
        </div>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} Climaeco. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}

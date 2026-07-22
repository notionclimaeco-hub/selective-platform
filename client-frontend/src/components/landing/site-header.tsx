import { Link } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { QuoteTrigger } from "@/components/orcamento/quote-trigger"

// Root-anchored so the nav also works from sub-pages (e.g. /produto/$ref),
// jumping back to the landing sections.
const NAV = [
  { href: "/#produtos", label: "Produtos" },
  { href: "/#marcas", label: "Marcas" },
  { href: "/#sobre", label: "Sobre" },
  { href: "/#contactos", label: "Contactos" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <img
            src="/logo-climaeco.png"
            alt="Clima Eco Selective"
            className="h-10 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <QuoteTrigger />
          {/* Placeholder until the authenticated client area exists. */}
          <Button
            render={<a href="/#contactos" />}
            nativeButton={false}
            size="lg"
            className="hidden sm:inline-flex"
          >
            Área de Cliente
          </Button>
        </div>
      </div>
    </header>
  )
}

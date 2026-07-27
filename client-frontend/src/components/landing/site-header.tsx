import { Link } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { QuoteTrigger } from "@/components/orcamento/quote-trigger"

const NAV = [
  { to: "/produtos" as const, label: "Produtos", kind: "route" as const },
  { href: "/#marcas", label: "Marcas", kind: "hash" as const },
  { href: "/#sobre", label: "Sobre", kind: "hash" as const },
  { href: "/#contactos", label: "Contactos", kind: "hash" as const },
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
          {NAV.map((item) =>
            item.kind === "route" ? (
              <Link
                key={item.label}
                to={item.to}
                className="transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ),
          )}
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

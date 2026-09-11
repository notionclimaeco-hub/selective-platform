import { useEffect, useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { SignOutButton, UserButton, useAuth } from "@clerk/tanstack-react-start"
import { Building2, ClipboardList, LogOut, Menu, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { QuoteTrigger } from "@/components/orcamento/quote-trigger"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/produtos" as const, label: "Produtos", kind: "route" as const },
  { href: "/#marcas", label: "Marcas", kind: "hash" as const },
  { href: "/#sobre", label: "Sobre", kind: "hash" as const },
  { href: "/#contactos", label: "Contactos", kind: "hash" as const },
]

const CONTA = [
  { to: "/conta" as const, label: "A minha empresa", icon: Building2 },
  {
    to: "/conta/encomendas" as const,
    label: "Encomendas",
    icon: ClipboardList,
  },
]

/**
 * The one and only chrome bar. Logo and primary nav on the left, utilities on
 * the right — the layout every SaaS/e-commerce site uses, so nothing has to be
 * learned. Signed-in users get their avatar (Clerk `UserButton`) with the
 * account pages in its menu instead of a second navbar.
 */
export function SiteHeader() {
  const { isSignedIn } = useAuth()
  const [aberto, setAberto] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // Close the phone menu whenever navigation happens.
  useEffect(() => {
    setAberto(false)
  }, [pathname])

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center" aria-label="Início">
          <img
            src="/logo-climaeco.png"
            alt="Clima Eco Selective"
            className="h-8 w-auto"
          />
        </Link>

        <nav
          className="ml-4 hidden items-center gap-0.5 md:flex"
          aria-label="Principal"
        >
          {NAV.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
          {isSignedIn && (
            <Link
              to="/conta/encomendas"
              className={NAV_LINK}
              activeProps={{ className: NAV_LINK_ACTIVE }}
            >
              Encomendas
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <QuoteTrigger />

          {isSignedIn ? (
            <div className="flex size-9 items-center justify-center">
              <UserButton appearance={{ elements: { avatarBox: "size-8" } }}>
                <UserButton.MenuItems>
                  {CONTA.map(({ to, label, icon: Icon }) => (
                    <UserButton.Link
                      key={to}
                      label={label}
                      href={to}
                      labelIcon={<Icon className="size-4" />}
                    />
                  ))}
                  <UserButton.Action label="manageAccount" />
                  <UserButton.Action label="signOut" />
                </UserButton.MenuItems>
              </UserButton>
            </div>
          ) : (
            <>
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
            </>
          )}

          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-controls="menu-movel"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-input bg-background text-foreground shadow-xs transition-colors hover:bg-muted md:hidden"
          >
            {aberto ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Phone menu: a panel dropping from the bar, the pattern people expect. */}
      <div
        id="menu-movel"
        hidden={!aberto}
        className="absolute inset-x-0 top-full border-y bg-background shadow-lg md:hidden"
      >
        <nav
          className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6"
          aria-label="Principal (telemóvel)"
        >
          {NAV.map((item) => (
            <NavItem key={item.label} item={item} movel />
          ))}
          <div className="my-2 border-t" />
          {isSignedIn ? (
            <>
              {CONTA.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={MOVEL_LINK}
                  activeProps={{ className: MOVEL_LINK_ACTIVE }}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  {label}
                </Link>
              ))}
              <SignOutButton>
                <button
                  type="button"
                  className={cn(MOVEL_LINK, "text-muted-foreground")}
                >
                  <LogOut className="size-4" />
                  Terminar sessão
                </button>
              </SignOutButton>
            </>
          ) : (
            <div className="flex gap-2 pt-1">
              <Button
                render={<Link to="/entrar" />}
                nativeButton={false}
                variant="outline"
                className="flex-1"
              >
                Entrar
              </Button>
              <Button
                render={<Link to="/registo" />}
                nativeButton={false}
                className="flex-1"
              >
                Registar empresa
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}

const NAV_LINK =
  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
const NAV_LINK_ACTIVE = "text-foreground"
const MOVEL_LINK =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-foreground transition-colors hover:bg-muted"
const MOVEL_LINK_ACTIVE = "bg-muted"

function NavItem({
  item,
  movel = false,
}: {
  item: (typeof NAV)[number]
  movel?: boolean
}) {
  const classe = movel ? MOVEL_LINK : NAV_LINK
  const activa = movel ? MOVEL_LINK_ACTIVE : NAV_LINK_ACTIVE
  return item.kind === "route" ? (
    <Link to={item.to} className={classe} activeProps={{ className: activa }}>
      {item.label}
    </Link>
  ) : (
    <a href={item.href} className={classe}>
      {item.label}
    </a>
  )
}

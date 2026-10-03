import { useEffect, useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { UserButton } from "@clerk/tanstack-react-start"
import { Authenticated, usePaginatedQuery, useQuery } from "convex/react"
import {
  Building2,
  ClipboardList,
  FileText,
  House,
  Import,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { api } from "@convex/_generated/api"
import { Wordmark } from "@/components/brand/wordmark"
import { useContagemAccao } from "@/components/prototype-encomendas/fixtures"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useAvatarUtilizador } from "./avatar-clerk"

const CHAVE_SIDEBAR = "climaeco-admin:sidebar:colapsada"

type Destino = {
  to:
    | "/"
    | "/prototype/encomendas"
    | "/empresas"
    | "/comercial"
    | "/produtos"
    | "/paginas-catalogo"
    | "/importacoes"
  label: string
  icon: LucideIcon
}

/** The Admin app destinations, in sidebar order. */
const NAV: ReadonlyArray<Destino> = [
  { to: "/", label: "Painel", icon: House },
  // PROTOTYPE (#86): orders prototype on fixtures.
  { to: "/prototype/encomendas", label: "Encomendas", icon: ClipboardList },
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/comercial", label: "Comercial", icon: Percent },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/paginas-catalogo", label: "Páginas do catálogo", icon: FileText },
  { to: "/importacoes", label: "Importações", icon: Import },
]

function destinoActivo(pathname: string): Destino["to"] | null {
  if (pathname === "/") return "/"
  for (const item of NAV) {
    if (item.to === "/") continue
    if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
      return item.to
    }
  }
  return null
}

/**
 * Chrome for staff, ported from the client app's `AppShell`
 * (client-frontend/src/components/shell/app-shell.tsx). Desktop: a
 * collapsible sidebar (wordmark, destinations with queue counts, account).
 * Phones: a compact top bar whose menu opens the same destinations.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const activo = destinoActivo(pathname)

  return (
    <TooltipProvider>
      <div className="flex min-h-svh md:flex-row">
        <Sidebar activo={activo} />
        <div className="flex min-w-0 flex-1 flex-col">
          <BarraMovel activo={activo} />
          <div className="flex flex-1 flex-col">{children}</div>
        </div>
      </div>
    </TooltipProvider>
  )
}

/* ------------------------------------------------------------------------ */
/* Desktop sidebar                                                           */
/* ------------------------------------------------------------------------ */

function Sidebar({ activo }: { activo: Destino["to"] | null }) {
  const avatarUtilizador = useAvatarUtilizador()
  const [colapsada, setColapsada] = useState(false)

  // Read the stored preference after mount so SSR and hydration agree.
  useEffect(() => {
    try {
      setColapsada(window.localStorage.getItem(CHAVE_SIDEBAR) === "1")
    } catch {
      // Storage unavailable: stay expanded.
    }
  }, [])

  function alternar() {
    setColapsada((v) => {
      try {
        window.localStorage.setItem(CHAVE_SIDEBAR, v ? "0" : "1")
      } catch {
        // Ignore quota / private-mode write failures.
      }
      return !v
    })
  }

  return (
    <aside
      data-colapsada={colapsada}
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        colapsada ? "w-14" : "w-60"
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center gap-1 border-b px-2",
          colapsada ? "justify-center" : "pl-3"
        )}
      >
        {!colapsada && (
          <Link to="/" aria-label="Painel" className="shrink-0">
            <Wordmark className="h-6" />
          </Link>
        )}
        <button
          type="button"
          onClick={alternar}
          aria-label={colapsada ? "Expandir menu" : "Recolher menu"}
          aria-pressed={colapsada}
          className={cn(
            "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
            !colapsada && "ml-auto"
          )}
        >
          {colapsada ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 p-2" aria-label="Administração">
        {NAV.map((item) => (
          <ItemSidebar
            key={item.to}
            item={item}
            activo={activo === item.to}
            colapsada={colapsada}
          />
        ))}
      </nav>

      <div
        className={cn(
          "mt-auto flex flex-col gap-0.5 border-t p-2",
          colapsada && "items-center"
        )}
      >
        <div
          className={cn(
            "flex h-10 items-center",
            colapsada ? "justify-center" : "px-2"
          )}
        >
          <UserButton
            showName={!colapsada}
            appearance={{
              elements: {
                ...avatarUtilizador,
                rootBox: { width: colapsada ? "auto" : "100%" },
                userButtonTrigger: { width: "100%", justifyContent: "start" },
                userButtonBox: {
                  flexDirection: "row-reverse",
                  gap: "0.5rem",
                  fontSize: "0.875rem",
                },
                userButtonOuterIdentifier: {
                  fontWeight: 500,
                  paddingLeft: 0,
                },
                userButtonAvatarBox: { width: "1.75rem", height: "1.75rem" },
              },
            }}
          />
        </div>
      </div>
    </aside>
  )
}

const LIGACAO_SIDEBAR =
  "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
const LIGACAO_SIDEBAR_COLAPSADA = "w-10 justify-center px-0"
const LIGACAO_SIDEBAR_ACTIVA =
  "bg-sidebar-accent text-sidebar-accent-foreground"

function ItemSidebar({
  item,
  activo,
  colapsada,
}: {
  item: Destino
  activo: boolean
  colapsada: boolean
}) {
  const Icon = item.icon
  return (
    <ComTooltip label={item.label} activo={colapsada}>
      <Link
        to={item.to}
        aria-current={activo ? "page" : undefined}
        aria-label={colapsada ? item.label : undefined}
        className={cn(
          LIGACAO_SIDEBAR,
          colapsada && LIGACAO_SIDEBAR_COLAPSADA,
          activo && LIGACAO_SIDEBAR_ACTIVA
        )}
      >
        <span className="relative shrink-0">
          <Icon className="size-4" />
          {colapsada && (
            <Authenticated>
              <Contagem
                to={item.to}
                className="absolute -top-2 -right-2.5 min-w-4 px-1 text-[10px] leading-4"
              />
            </Authenticated>
          )}
        </span>
        {!colapsada && (
          <>
            <span className="truncate">{item.label}</span>
            <Authenticated>
              <Contagem to={item.to} className="ml-auto" />
            </Authenticated>
          </>
        )}
      </Link>
    </ComTooltip>
  )
}

function ComTooltip({
  label,
  activo,
  children,
}: {
  label: string
  activo: boolean
  children: React.ReactElement
}) {
  if (!activo) return children
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

/* ------------------------------------------------------------------------ */
/* Queue counts (the client's quote-list counter pill)                        */
/* ------------------------------------------------------------------------ */

function Contagem({
  to,
  className,
}: {
  to: Destino["to"]
  className?: string
}) {
  if (to === "/prototype/encomendas")
    return <ContagemEncomendas className={className} />
  if (to === "/empresas") return <ContagemEmpresas className={className} />
  if (to === "/importacoes")
    return <ContagemImportacoes className={className} />
  return null
}

function ContagemEncomendas({ className }: { className?: string }) {
  return <Pilula valor={useContagemAccao()} className={className} />
}

function ContagemEmpresas({ className }: { className?: string }) {
  const { results, status } = usePaginatedQuery(
    api.empresas.listar,
    { estado: "pendente" },
    { initialNumItems: 50 }
  )
  if (status === "LoadingFirstPage") return null
  return (
    <Pilula
      valor={results.length}
      mais={status === "CanLoadMore"}
      className={className}
    />
  )
}

function ContagemImportacoes({ className }: { className?: string }) {
  const runs = useQuery(api.importacoes.listar, {})
  if (runs === undefined) return null
  return (
    <Pilula
      valor={runs.filter((r) => r.estado === "em-revisao").length}
      className={className}
    />
  )
}

function Pilula({
  valor,
  mais,
  className,
}: {
  valor: number
  mais?: boolean
  className?: string
}) {
  if (valor === 0) return null
  return (
    <span
      className={cn(
        "flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground tabular-nums",
        className
      )}
    >
      {valor}
      {mais ? "+" : ""}
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Phone chrome                                                              */
/* ------------------------------------------------------------------------ */

function BarraMovel({ activo }: { activo: Destino["to"] | null }) {
  const avatarUtilizador = useAvatarUtilizador()
  const [aberto, setAberto] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // Close the menu on every navigation.
  useEffect(() => setAberto(false), [pathname])

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link to="/" aria-label="Painel" className="flex items-center">
          <Wordmark variant="mark" className="h-7" />
        </Link>
        <div className="flex items-center gap-2">
          <UserButton
            appearance={{
              elements: {
                ...avatarUtilizador,
                userButtonAvatarBox: { width: "2rem", height: "2rem" },
              },
            }}
          />
          <button
            type="button"
            aria-expanded={aberto}
            aria-label="Menu"
            onClick={() => setAberto((v) => !v)}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {aberto ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {aberto && (
        <nav
          aria-label="Administração"
          className="flex flex-col gap-0.5 border-t bg-background p-2"
        >
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={activo === item.to ? "page" : undefined}
                className={cn(
                  LIGACAO_SIDEBAR,
                  "h-10",
                  activo === item.to && LIGACAO_SIDEBAR_ACTIVA
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                <Authenticated>
                  <Contagem to={item.to} className="ml-auto" />
                </Authenticated>
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}

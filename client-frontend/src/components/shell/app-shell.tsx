import { useEffect, useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { OrganizationSwitcher, UserButton } from "@clerk/tanstack-react-start"
import { useQuery } from "convex/react"
import { CircleHelp, PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { api } from "@convex/_generated/api"
import { Wordmark } from "@/components/brand/wordmark"
import { ContadorOrcamento } from "@/components/orcamento/quote-trigger"
import { useOrcamento } from "@/components/orcamento/orcamento-store"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { EMAIL_GERAL, MAILTO_GERAL, NAV_APP, destinoActivo } from "./nav"
import type { DestinoApp } from "./nav"

const CHAVE_SIDEBAR = "climaeco:sidebar:colapsada"

/**
 * Chrome for signed-in installer members, Attio-style. Desktop: a collapsible
 * sidebar (organization switcher, the five destinations, Ajuda + account).
 * Phones: a compact top bar and a bottom tab bar with the same five
 * destinations. A banner slot above the content reports company status.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const activo = destinoActivo(pathname)

  return (
    <TooltipProvider>
      <div className="flex min-h-svh md:flex-row">
        <Sidebar activo={activo} />
        <div className="flex min-w-0 flex-1 flex-col">
          <BarraMovel />
          <BannerEmpresa />
          {/* Bottom padding keeps the last content row above the phone tab bar. */}
          <main className="flex flex-1 flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        </div>
        <TabsMovel activo={activo} />
      </div>
    </TooltipProvider>
  )
}

/* ------------------------------------------------------------------------ */
/* Desktop sidebar                                                           */
/* ------------------------------------------------------------------------ */

function Sidebar({ activo }: { activo: DestinoApp | null }) {
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
          <Link to="/inicio" aria-label="Início" className="shrink-0">
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

      <div className={cn("border-b p-2", colapsada && "px-1.5")}>
        <SeletorOrganizacao colapsada={colapsada} />
      </div>

      <nav className="flex flex-col gap-0.5 p-2" aria-label="Ambiente">
        {NAV_APP.map((item) => (
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
        <ComTooltip label="Ajuda" activo={colapsada}>
          <a
            href={MAILTO_GERAL}
            aria-label={colapsada ? "Ajuda" : undefined}
            className={cn(
              LIGACAO_SIDEBAR,
              colapsada && LIGACAO_SIDEBAR_COLAPSADA
            )}
          >
            <CircleHelp className="size-4 shrink-0" />
            {!colapsada && <span className="truncate">Ajuda</span>}
          </a>
        </ComTooltip>
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
                avatarBox: "size-7",
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
  item: (typeof NAV_APP)[number]
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
          {item.to === "/orcamento" && colapsada && (
            <SlotContador className="absolute -top-2 -right-2.5 min-w-4 px-1 text-[10px] leading-4" />
          )}
        </span>
        {!colapsada && (
          <>
            <span className="truncate">{item.label}</span>
            {item.to === "/orcamento" && <SlotContador className="ml-auto" />}
          </>
        )}
      </Link>
    </ComTooltip>
  )
}

/** Quote-list count next to Orçamento; empty until hydrated or when zero. */
function SlotContador({ className }: { className?: string }) {
  const { totalLinhas, hidratado } = useOrcamento()
  if (!hidratado || totalLinhas === 0) return null
  return <ContadorOrcamento valor={totalLinhas} className={className} />
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

function SeletorOrganizacao({ colapsada }: { colapsada: boolean }) {
  return (
    <OrganizationSwitcher
      hidePersonal
      afterSelectOrganizationUrl="/inicio"
      appearance={{
        // Clerk's own stylesheet outranks utility classes, so use CSS objects.
        elements: {
          rootBox: { width: "100%" },
          organizationSwitcherTrigger: {
            width: "100%",
            justifyContent: colapsada ? "center" : "space-between",
            border: "1px solid var(--input)",
            borderRadius: "var(--radius-md)",
            padding: colapsada ? "6px 0" : "6px 8px 6px 6px",
            backgroundColor: "var(--background)",
          },
          organizationPreviewMainIdentifier: {
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: colapsada ? "none" : undefined,
          },
          organizationPreview: colapsada ? { gap: 0 } : undefined,
          organizationSwitcherTriggerIcon: {
            display: colapsada ? "none" : undefined,
          },
        },
      }}
    />
  )
}

/* ------------------------------------------------------------------------ */
/* Phone chrome                                                              */
/* ------------------------------------------------------------------------ */

function BarraMovel() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden">
      <Link to="/inicio" aria-label="Início" className="flex items-center">
        <Wordmark variant="mark" className="h-7" />
      </Link>
      <UserButton appearance={{ elements: { avatarBox: "size-8" } }} />
    </header>
  )
}

function TabsMovel({ activo }: { activo: DestinoApp | null }) {
  return (
    <nav
      aria-label="Ambiente"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {NAV_APP.map((item) => {
          const Icon = item.icon
          const lit = activo === item.to
          return (
            <li key={item.to} className="min-w-0">
              <Link
                to={item.to}
                aria-current={lit ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  lit ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={lit ? 2.25 : 2} />
                  {item.to === "/orcamento" && (
                    <SlotContador className="absolute -top-1.5 -right-2.5 min-w-4 px-1 text-[10px] leading-4" />
                  )}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/* ------------------------------------------------------------------------ */
/* Company-status banner                                                     */
/* ------------------------------------------------------------------------ */

type Tom = "aviso" | "info" | "erro"

const TOM: Record<Tom, string> = {
  info: "border-accent-foreground/20 bg-accent text-accent-foreground",
  aviso: "border-amber-200 bg-amber-50 text-amber-900",
  erro: "border-destructive/30 bg-destructive/10 text-destructive",
}

function BannerEmpresa() {
  const vista = useQuery(api.empresas.minha)
  if (vista === undefined || vista === null) return null

  if (vista.kind === "sem-org") {
    return (
      <Banner tom="info">
        Complete o registo da empresa para pedirmos a aprovação comercial.{" "}
        <Link
          to="/registo"
          className="font-semibold underline underline-offset-4"
        >
          Registar empresa
        </Link>
      </Banner>
    )
  }
  if (vista.kind === "sem-empresa") {
    return (
      <Banner tom="erro">
        Empresa não encontrada para esta organização. Contacte <Contacto />.
      </Banner>
    )
  }

  switch (vista.empresa.estadoAprovacao) {
    case "pendente":
      return (
        <Banner tom="aviso">
          Empresa em aprovação. Até lá o catálogo mostra o PVP e a lista de
          orçamento não pode ser submetida.
        </Banner>
      )
    case "rejeitada":
      return (
        <Banner tom="erro">
          Pedido de aprovação rejeitado. Para esclarecimentos contacte{" "}
          <Contacto />.
        </Banner>
      )
    case "suspensa":
      return (
        <Banner tom="erro">
          Empresa suspensa: preços de revenda e novas encomendas estão
          bloqueados. Contacte <Contacto />.
        </Banner>
      )
    default:
      return null
  }
}

function Banner({ tom, children }: { tom: Tom; children: React.ReactNode }) {
  return (
    <div role="status" className={cn("border-b", TOM[tom])}>
      <p className="mx-auto max-w-6xl px-4 py-2.5 text-sm sm:px-6">
        {children}
      </p>
    </div>
  )
}

function Contacto() {
  return (
    <a
      href={MAILTO_GERAL}
      className="font-semibold underline underline-offset-4"
    >
      {EMAIL_GERAL}
    </a>
  )
}

import {
  OrganizationSwitcher,
  Show,
  UserButton,
} from "@clerk/tanstack-react-start"
import { Link } from "@tanstack/react-router"
import { Building2, ClipboardList } from "lucide-react"

import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { cn } from "@/lib/utils"

const SECCOES = [
  { to: "/conta", label: "Empresa", icon: Building2, exact: true },
  { to: "/conta/encomendas", label: "Encomendas", icon: ClipboardList, exact: false },
] as const

/**
 * Shell for every signed-in page: site header, the client-area tab bar with
 * the Clerk org/user menus, and the page body. Pages only bring their content,
 * so moving between Empresa and Encomendas always looks like the same place.
 */
export function AreaCliente({
  largura = "normal",
  children,
}: {
  /** `larga` for pages with a two-column body (order detail). */
  largura?: "normal" | "larga"
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <div className="border-b bg-secondary/40">
        <div
          className={cn(
            "mx-auto flex w-full items-end justify-between gap-4 px-4 sm:px-6",
            largura === "larga" ? "max-w-6xl" : "max-w-4xl",
          )}
        >
          <nav aria-label="Área de cliente" className="-mb-px flex gap-1">
            {SECCOES.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact }}
                className="group flex items-center gap-2 border-b-2 border-transparent px-2 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-3"
                activeProps={{ className: "border-primary text-foreground" }}
              >
                <Icon className="hidden size-4 text-muted-foreground/70 transition-colors group-hover:text-foreground group-data-[status=active]:text-primary sm:block" />
                {label}
              </Link>
            ))}
          </nav>
          <Show when="signed-in">
            <div className="flex items-center gap-2 py-2">
              <OrganizationSwitcher
                hidePersonal
                afterSelectOrganizationUrl="/conta"
                appearance={{
                  elements: {
                    // Long company names must not push the tab bar past a phone's width.
                    organizationSwitcherTrigger: "max-w-[7.5rem] overflow-hidden sm:max-w-none",
                    organizationPreviewMainIdentifier: "truncate",
                  },
                }}
              />
              <UserButton />
            </div>
          </Show>
        </div>
      </div>
      <main
        className={cn(
          "mx-auto flex w-full flex-1 flex-col gap-8 px-4 py-10 sm:px-6",
          largura === "larga" ? "max-w-6xl" : "max-w-4xl",
        )}
      >
        <Show when="signed-out">
          <p className="text-sm text-muted-foreground">A redirecionar…</p>
        </Show>
        <Show when="signed-in">{children}</Show>
      </main>
      <SiteFooter />
    </div>
  )
}

/** Page title block used inside `AreaCliente`. */
export function CabecalhoPagina({
  titulo,
  descricao,
  voltar,
  acoes,
}: {
  titulo: React.ReactNode
  descricao?: React.ReactNode
  voltar?: { to: "/conta/encomendas" | "/conta"; label: string }
  acoes?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {voltar && (
          <Link
            to={voltar.to}
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {voltar.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-1.5 text-sm text-muted-foreground">{descricao}</p>
        )}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </div>
  )
}

/** Muted card for "nothing here yet" / "not allowed yet" messages. */
export function Aviso({
  titulo,
  children,
  accao,
}: {
  titulo?: string
  children: React.ReactNode
  accao?: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      {titulo && <h2 className="font-semibold">{titulo}</h2>}
      <p className={cn("text-sm text-muted-foreground", titulo && "mt-2")}>
        {children}
      </p>
      {accao && <div className="mt-4">{accao}</div>}
    </section>
  )
}

import { OrganizationSwitcher, Show } from "@clerk/tanstack-react-start"
import { Link } from "@tanstack/react-router"
import { Building2, ChevronLeft, ClipboardList } from "lucide-react"

import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { cn } from "@/lib/utils"

const SECCOES = [
  { to: "/conta", label: "Empresa", icon: Building2, exact: true },
  {
    to: "/conta/encomendas",
    label: "Encomendas",
    icon: ClipboardList,
    exact: false,
  },
] as const

/**
 * Shell for every signed-in page. One global header (with the user's avatar),
 * then a settings-style layout: a slim section nav on the left on desktop that
 * collapses to segmented tabs on phones, and the page body on the right. This
 * is the layout of every account area people already know (GitHub, Stripe,
 * Shopify), so there is nothing new to learn.
 */
export function AreaCliente({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <Show when="signed-out">
          <p className="text-sm text-muted-foreground">A redirecionar…</p>
        </Show>
        <Show when="signed-in">
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-12">
            <NavConta />
            <div className="flex min-w-0 flex-col gap-6">{children}</div>
          </div>
        </Show>
      </main>
      <SiteFooter />
    </div>
  )
}

function NavConta() {
  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
      <OrganizationSwitcher
        hidePersonal
        afterSelectOrganizationUrl="/conta"
        appearance={{
          // Clerk's own stylesheet outranks utility classes, so use CSS objects.
          elements: {
            rootBox: { width: "100%" },
            organizationSwitcherTrigger: {
              width: "100%",
              justifyContent: "space-between",
              border: "1px solid var(--input)",
              borderRadius: "var(--radius-lg)",
              padding: "6px 10px 6px 8px",
              backgroundColor: "var(--background)",
              boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            },
            organizationPreviewMainIdentifier: {
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          },
        }}
      />
      <nav
        aria-label="Área de cliente"
        className="flex gap-1 rounded-lg bg-muted p-1 lg:flex-col lg:bg-transparent lg:p-0"
      >
        {SECCOES.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            className="group flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:flex-none lg:justify-start lg:py-2 lg:hover:bg-muted"
            activeProps={{
              className:
                "bg-background text-foreground shadow-xs lg:bg-muted lg:shadow-none",
            }}
          >
            <Icon className="hidden size-4 text-muted-foreground group-data-[status=active]:text-foreground lg:block" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
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
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> {voltar.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
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
    <section className="rounded-xl border bg-card p-6">
      {titulo && <h2 className="font-semibold">{titulo}</h2>}
      <p className={cn("text-sm text-muted-foreground", titulo && "mt-2")}>
        {children}
      </p>
      {accao && <div className="mt-4">{accao}</div>}
    </section>
  )
}

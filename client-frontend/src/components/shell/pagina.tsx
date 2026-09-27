import { Link } from "@tanstack/react-router"
import { ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Standard page container inside either shell: the shells own the chrome and
 * the page owns its width and padding. Environment pages (Início, Orçamento,
 * Encomendas, Empresa) all sit in this one.
 */
export function Pagina({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8",
        className
      )}
    >
      {children}
    </div>
  )
}

/** Page title block used inside `Pagina`. */
export function CabecalhoPagina({
  titulo,
  descricao,
  voltar,
  acoes,
}: {
  titulo: React.ReactNode
  descricao?: React.ReactNode
  voltar?: { to: "/encomendas" | "/empresa" | "/inicio"; label: string }
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

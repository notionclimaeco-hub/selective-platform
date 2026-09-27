import { Link } from "@tanstack/react-router"
import { FileText } from "lucide-react"

import { cn } from "@/lib/utils"
import { useOrcamento } from "./orcamento-store"

/**
 * Marketing-bar entry to the quote list: a link to `/orcamento` with the
 * current line count. The count only renders after hydration so SSR and the
 * first client render match.
 */
export function QuoteTrigger({ className }: { className?: string }) {
  const { totalLinhas, hidratado } = useOrcamento()
  const mostrarBadge = hidratado && totalLinhas > 0

  return (
    <Link
      to="/orcamento"
      className={cn(
        "relative inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:border-foreground/25 hover:bg-muted",
        className
      )}
      aria-label={`Lista de orçamento${mostrarBadge ? ` (${totalLinhas})` : ""}`}
    >
      <FileText className="size-4" />
      <span className="hidden sm:inline">Orçamento</span>
      {mostrarBadge && <ContadorOrcamento valor={totalLinhas} />}
    </Link>
  )
}

/** Small primary pill with the number of lines in the quote list. */
export function ContadorOrcamento({
  valor,
  className,
}: {
  valor: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground",
        className
      )}
    >
      {valor}
    </span>
  )
}

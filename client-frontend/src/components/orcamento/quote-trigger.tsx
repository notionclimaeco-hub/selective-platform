import { FileText } from "lucide-react"

import { useOrcamento } from "./orcamento-store"

// Header button that opens the quote drawer and shows the current line count.
// Count only renders after hydration so SSR and first client render match.
export function QuoteTrigger() {
  const { abrir, totalLinhas, hidratado } = useOrcamento()
  const mostrarBadge = hidratado && totalLinhas > 0

  return (
    <button
      type="button"
      onClick={abrir}
      className="relative inline-flex h-11 items-center gap-2 rounded-xl border bg-card px-3.5 text-sm font-medium shadow-sm transition-colors hover:border-primary/40 hover:bg-secondary/50"
      aria-label={`Lista de orçamento${mostrarBadge ? ` (${totalLinhas})` : ""}`}
    >
      <FileText className="size-4 text-primary" />
      <span className="hidden sm:inline">Orçamento</span>
      {mostrarBadge && (
        <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold leading-5 text-primary-foreground">
          {totalLinhas}
        </span>
      )}
    </button>
  )
}

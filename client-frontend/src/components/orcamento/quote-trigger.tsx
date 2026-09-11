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
      className="relative inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-muted"
      aria-label={`Lista de orçamento${mostrarBadge ? ` (${totalLinhas})` : ""}`}
    >
      <FileText className="size-4" />
      <span className="hidden sm:inline">Orçamento</span>
      {mostrarBadge && (
        <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground">
          {totalLinhas}
        </span>
      )}
    </button>
  )
}

import { Minus, Plus, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Uber Eats-style add control for one model: a small round "+" while the
 * model is not in the quote list; once added it opens into a pill with
 * remove/minus, the quantity and plus. At 1 the left button is a bin, so
 * the pill collapses back to "+" when the last unit goes.
 */
export function ControloQuantidade({
  quantidade,
  rotulo,
  onAdicionar,
  onDefinir,
  onRemover,
  className,
}: {
  /** Units of this model already in the quote list (0 = not there). */
  quantidade: number
  /** What is being added, for screen readers ("NI0188224"). */
  rotulo: string
  onAdicionar: () => void
  onDefinir: (quantidade: number) => void
  onRemover: () => void
  className?: string
}) {
  if (quantidade <= 0) {
    return (
      <button
        type="button"
        onClick={onAdicionar}
        aria-label={`Adicionar ${rotulo} ao orçamento`}
        className={cn(BOTAO, "size-8 border bg-background", className)}
      >
        <Plus className="size-4" strokeWidth={2.25} />
      </button>
    )
  }

  return (
    <div
      role="group"
      aria-label={`${rotulo} no orçamento`}
      className={cn(
        "inline-flex h-8 origin-right animate-in items-center rounded-full border bg-background duration-150 zoom-in-90 fade-in",
        className
      )}
    >
      {quantidade === 1 ? (
        <button
          type="button"
          onClick={onRemover}
          aria-label={`Remover ${rotulo} do orçamento`}
          className={cn(BOTAO, "size-8")}
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onDefinir(quantidade - 1)}
          aria-label="Diminuir quantidade"
          className={cn(BOTAO, "size-8")}
        >
          <Minus className="size-4" />
        </button>
      )}
      <span
        aria-live="polite"
        className="min-w-5 text-center text-sm font-semibold tabular-nums"
      >
        {quantidade}
      </span>
      <button
        type="button"
        onClick={() => onDefinir(quantidade + 1)}
        aria-label="Aumentar quantidade"
        className={cn(BOTAO, "size-8")}
      >
        <Plus className="size-4" strokeWidth={2.25} />
      </button>
    </div>
  )
}

const BOTAO =
  "flex shrink-0 items-center justify-center rounded-full text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/25"

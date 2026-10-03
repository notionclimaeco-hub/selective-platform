import { useRef, useState } from "react"
import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Copied from client-frontend/src/components/orcamento/quantity-stepper.tsx.
 * Quantity pill for an order product: − · typed quantity · +, the same
 * shape as the product page's `ControloQuantidade`. The number can be typed
 * (installers order in tens); it commits on blur or Enter, and an empty or
 * invalid entry snaps back. Removing the line is a separate control, so −
 * stops at 1.
 */
export function QuantityStepper({
  value,
  onChange,
  label = "Quantidade",
  className,
}: {
  value: number
  onChange: (value: number) => void
  label?: string
  className?: string
}) {
  // What is being typed, until it is committed; null shows `value`.
  const [rascunho, setRascunho] = useState<string | null>(null)
  // Escape blurs too; the blur must not commit what was being typed.
  const descartar = useRef(false)

  function confirmar() {
    const n = Number.parseInt(rascunho ?? "", 10)
    if (!descartar.current && !Number.isNaN(n) && n !== value) onChange(n)
    descartar.current = false
    setRascunho(null)
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex h-8 items-center rounded-full border bg-background",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Diminuir quantidade"
        className={cn(
          BOTAO,
          "disabled:pointer-events-none disabled:opacity-35"
        )}
      >
        <Minus className="size-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={rascunho ?? String(value)}
        onChange={(e) => setRascunho(e.target.value.replace(/\D/g, ""))}
        onFocus={(e) => e.target.select()}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") {
            descartar.current = true
            e.currentTarget.blur()
          }
        }}
        aria-label={label}
        className="h-full w-9 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="Aumentar quantidade"
        className={BOTAO}
      >
        <Plus className="size-4" strokeWidth={2.25} />
      </button>
    </div>
  )
}

const BOTAO =
  "flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/25"

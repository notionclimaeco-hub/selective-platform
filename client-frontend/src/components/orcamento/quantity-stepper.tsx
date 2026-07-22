import { Minus, Plus } from "lucide-react"

// Small +/- quantity control shared by the product CTA and the quote drawer.
export function QuantityStepper({
  value,
  onChange,
  size = "md",
  label = "Quantidade",
}: {
  value: number
  onChange: (value: number) => void
  size?: "sm" | "md"
  label?: string
}) {
  const btn =
    size === "sm"
      ? "size-8"
      : "size-10"
  const box = size === "sm" ? "h-8 w-10 text-sm" : "h-10 w-12"

  return (
    <div
      className="inline-flex items-center rounded-xl border bg-card"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Diminuir quantidade"
        className={`${btn} flex items-center justify-center rounded-l-xl text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <Minus className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10)
          if (!Number.isNaN(n)) onChange(n)
        }}
        aria-label={label}
        className={`${box} border-x bg-transparent text-center font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="Aumentar quantidade"
        className={`${btn} flex items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

// PROTOTYPE (#86) — throwaway. Small pieces shared by the board and the order
// page.

import { createContext, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Copies a value; reads "Copiado" for a moment. Same size as a `sm` button. */
export function CopiarBotao({
  texto,
  rotulo = "Copiar",
  size = "sm",
  className,
}: {
  texto: string
  rotulo?: string
  size?: "xs" | "sm"
  className?: string
}) {
  const [copiado, setCopiado] = useState(false)
  return (
    <Button
      variant="outline"
      size={size}
      className={className}
      onClick={() => {
        void navigator.clipboard.writeText(texto)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1500)
      }}
    >
      {copiado ? (
        <Check data-icon="inline-start" className="text-primary" />
      ) : (
        <Copy data-icon="inline-start" />
      )}
      {copiado ? "Copiado" : rotulo}
    </Button>
  )
}

/** The client's filter `Chip`: a rounded-full toggle, filled green when on. */
export const chipCls = (activo: boolean) =>
  cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-40",
    activo
      ? "border-primary bg-primary text-primary-foreground"
      : "bg-background text-foreground hover:border-foreground/25"
  )

type Valor = { rotulo: string; valor: ReactNode; className?: string }

/**
 * Label left / value right rows on the card gutter, like the client's
 * `Valores` in the order page's Detalhes card. `false` items are skipped.
 */
export function Valores({
  itens,
  className,
}: {
  itens: ReadonlyArray<Valor | false | null | undefined>
  className?: string
}) {
  return (
    <dl className={cn("flex flex-col gap-2.5 px-5 py-4 text-sm", className)}>
      {itens
        .filter((i): i is Valor => Boolean(i))
        .map((i) => (
          <div
            key={i.rotulo}
            className={cn(
              "flex items-baseline justify-between gap-4",
              i.className
            )}
          >
            <dt className="shrink-0 text-muted-foreground">{i.rotulo}</dt>
            <dd className="min-w-0 text-right [overflow-wrap:anywhere] tabular-nums">
              {i.valor}
            </dd>
          </div>
        ))}
    </dl>
  )
}

/** Back link above a page title, as on the client's order page. */
export const voltarCls =
  "inline-flex items-center gap-1 self-start text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"

/**
 * Entrance for things that appear because of an action (a row added, a step
 * card swapped, a confirmed cost): a short fade and 4px rise on insertion,
 * via @starting-style. Nothing animates on first paint — the provider turns
 * it on after the page has mounted, so opening an order stays still.
 */
const ENTRADA =
  "transition-[opacity,translate] duration-200 ease-out starting:translate-y-1 starting:opacity-0"

const EntradasCtx = createContext(false)

export function ProvedorEntradas({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return <EntradasCtx.Provider value={montado}>{children}</EntradasCtx.Provider>
}

/** `ENTRADA` once the page has mounted, "" before. */
export function useEntrada() {
  return useContext(EntradasCtx) ? ENTRADA : ""
}

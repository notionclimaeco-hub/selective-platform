import { Check, X } from "lucide-react"

import type { Passo } from "@/lib/encomendas"
import { cn } from "@/lib/utils"

/**
 * The order lifecycle as a stepper: a compact vertical rail on phones,
 * horizontal from `sm`. Purely presentational —
 * `passosEncomenda` decides the states.
 */
export function LinhaDoTempo({ passos }: { passos: Array<Passo> }) {
  return (
    <ol className="flex flex-col sm:grid sm:grid-cols-5 sm:gap-2">
      {passos.map((passo, i) => (
        <li
          key={passo.chave}
          aria-current={passo.estado === "actual" ? "step" : undefined}
          className="relative flex items-start gap-3 pb-3 last:pb-0 sm:flex-col sm:gap-2.5 sm:pb-0"
        >
          {/* Connector to the next step (vertical on phones, horizontal on sm+). */}
          {i < passos.length - 1 && (
            <span
              aria-hidden
              className={cn(
                "absolute top-6 left-[11px] h-[calc(100%-1.5rem)] w-0.5 sm:top-[13px] sm:left-7 sm:h-0.5 sm:w-[calc(100%-1.75rem)]",
                passo.estado === "feito" ? "bg-primary" : "bg-border"
              )}
            />
          )}
          <Marcador estado={passo.estado} indice={i + 1} />
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm leading-6 font-medium sm:leading-tight",
                passo.estado === "futuro" && "text-muted-foreground",
                passo.estado === "cancelado" && "text-destructive"
              )}
            >
              {passo.titulo}
            </p>
            <p
              className={cn(
                "-mt-0.5 text-xs text-muted-foreground sm:mt-1",
                passo.estado === "actual" && "font-medium text-primary"
              )}
            >
              {passo.detalhe}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Marcador({
  estado,
  indice,
}: {
  estado: Passo["estado"]
  indice: number
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-4 ring-card sm:size-7 sm:text-xs",
        estado === "feito" && "bg-primary text-primary-foreground",
        estado === "actual" &&
          "bg-background text-primary shadow-[inset_0_0_0_2px_var(--color-primary)]",
        estado === "futuro" &&
          "bg-background text-muted-foreground shadow-[inset_0_0_0_1.5px_var(--color-border)]",
        estado === "cancelado" && "bg-destructive text-white"
      )}
    >
      {estado === "feito" ? (
        <Check className="size-3 sm:size-3.5" strokeWidth={3} />
      ) : estado === "cancelado" ? (
        <X className="size-3 sm:size-3.5" strokeWidth={3} />
      ) : (
        indice
      )}
    </span>
  )
}

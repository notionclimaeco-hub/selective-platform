import { Check, X } from "lucide-react"

import type { Passo } from "@/lib/encomendas"
import { cn } from "@/lib/utils"

/**
 * The order lifecycle as a stepper: horizontal on wide screens, a vertical
 * rail on phones. Purely presentational — `passosEncomenda` decides the states.
 */
export function LinhaDoTempo({ passos }: { passos: Array<Passo> }) {
  return (
    <ol className="flex flex-col gap-0 sm:grid sm:grid-cols-5 sm:gap-2">
      {passos.map((passo, i) => (
        <li
          key={passo.chave}
          aria-current={passo.estado === "actual" ? "step" : undefined}
          className="relative flex gap-3 sm:flex-col sm:gap-2.5"
        >
          {/* Connector to the next step (horizontal on sm+, vertical below). */}
          {i < passos.length - 1 && (
            <span
              aria-hidden
              className={cn(
                "absolute top-7 left-[13px] h-[calc(100%-1.75rem)] w-0.5 sm:top-[13px] sm:left-7 sm:h-0.5 sm:w-[calc(100%-1.75rem)]",
                passo.estado === "feito" ? "bg-primary" : "bg-border",
              )}
            />
          )}
          <Marcador estado={passo.estado} indice={i + 1} />
          <div className="min-w-0 pb-5 sm:pb-0">
            <p
              className={cn(
                "text-sm leading-7 font-medium sm:leading-tight",
                passo.estado === "futuro" && "text-muted-foreground",
                passo.estado === "cancelado" && "text-destructive",
              )}
            >
              {passo.titulo}
            </p>
            <p
              className={cn(
                "text-xs text-muted-foreground sm:mt-1",
                passo.estado === "actual" && "font-medium text-primary",
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

function Marcador({ estado, indice }: { estado: Passo["estado"]; indice: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-background",
        estado === "feito" && "bg-primary text-primary-foreground",
        estado === "actual" &&
          "bg-background text-primary shadow-[inset_0_0_0_2px_var(--color-primary)]",
        estado === "futuro" &&
          "bg-background text-muted-foreground shadow-[inset_0_0_0_1.5px_var(--color-border)]",
        estado === "cancelado" && "bg-destructive text-white",
      )}
    >
      {estado === "feito" ? (
        <Check className="size-3.5" strokeWidth={3} />
      ) : estado === "cancelado" ? (
        <X className="size-3.5" strokeWidth={3} />
      ) : (
        indice
      )}
    </span>
  )
}

/** Compact five-dot progress used in list rows. */
export function PontosProgresso({ passos }: { passos: Array<Passo> }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {passos.map((passo) => (
        <span
          key={passo.chave}
          className={cn(
            "h-1.5 w-4 rounded-full",
            passo.estado === "feito" && "bg-primary",
            passo.estado === "actual" && "bg-primary/40",
            passo.estado === "futuro" && "bg-border",
            passo.estado === "cancelado" && "bg-destructive/60",
          )}
        />
      ))}
    </span>
  )
}

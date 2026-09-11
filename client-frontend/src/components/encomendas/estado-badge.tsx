import type { EstadoEncomenda } from "@convex/lib/encomendaEstados"
import {
  ESTADO_ENCOMENDA_CLASSES,
  ESTADO_ENCOMENDA_LABELS,
  ESTADO_ENCOMENDA_PONTO,
} from "@/lib/encomendas"
import { cn } from "@/lib/utils"

export function EstadoBadge({
  estado,
  tamanho = "sm",
  className,
}: {
  estado: EstadoEncomenda
  tamanho?: "sm" | "md"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset",
        tamanho === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        ESTADO_ENCOMENDA_CLASSES[estado],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          ESTADO_ENCOMENDA_PONTO[estado],
          estado === "aguardando_pagamento" && "animate-pulse",
        )}
      />
      {ESTADO_ENCOMENDA_LABELS[estado]}
    </span>
  )
}

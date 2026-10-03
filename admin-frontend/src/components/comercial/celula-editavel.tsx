import { useRef, useState } from "react"
import type { ReactNode } from "react"
import { Check, Loader2, Pencil, X } from "lucide-react"
import { toast } from "sonner"

import { campoCls } from "@/components/ui/tabela"
import { cn } from "@/lib/utils"

/**
 * One editable table cell, with the client app's row-edit controls
 * (client-frontend `empresa/conta-dialog.tsx`): the value and a small accent
 * pencil; the cell swaps it for an input with X (cancel) and check (save).
 * Enter saves, Escape cancels. A save confirms with a toast whose "Reverter"
 * writes the previous value back.
 */
export function CelulaEditavel<T>({
  valor,
  mostrar,
  paraRascunho,
  ler,
  onGuardar,
  mensagem,
  rotulo,
  sufixo,
  alinhar = "direita",
  discreto,
  bloqueado,
  inputMode = "decimal",
  larguraEditor = "w-16",
}: {
  valor: T
  /** How the saved value reads. */
  mostrar: ReactNode
  /** The value as editable text. */
  paraRascunho: (v: T) => string
  /** Parses the draft, or explains why it can't be saved. */
  ler: (texto: string) => { valor: T } | { erro: string }
  onGuardar: (novo: T) => Promise<unknown>
  /** Toast text on success. */
  mensagem: (novo: T) => string
  /** Accessible name, e.g. "Desconto Daikin, Prata". */
  rotulo: string
  /** Unit after the input ("%", "€"). */
  sufixo?: string
  alinhar?: "esquerda" | "direita"
  /** Pencil only on hover/focus (dense grids). Always shown on touch. */
  discreto?: boolean
  /** Reason the value can't be edited (shown as a tooltip). */
  bloqueado?: string
  inputMode?: "decimal" | "text"
  larguraEditor?: string
}) {
  const [aEditar, setAEditar] = useState(false)
  const [rascunho, setRascunho] = useState("")
  const [aGuardar, setAGuardar] = useState(false)
  const celulaRef = useRef<HTMLButtonElement>(null)

  function fechar() {
    setAEditar(false)
    requestAnimationFrame(() => celulaRef.current?.focus())
  }

  async function guardar() {
    const lido = ler(rascunho)
    if ("erro" in lido) {
      toast.error(lido.erro)
      return
    }
    const anterior = valor
    if (Object.is(lido.valor, anterior)) {
      fechar()
      return
    }
    setAGuardar(true)
    try {
      await onGuardar(lido.valor)
      fechar()
      toast(mensagem(lido.valor), {
        action: {
          label: "Reverter",
          onClick: () => {
            onGuardar(anterior).catch((err: unknown) =>
              toast.error(
                err instanceof Error
                  ? err.message
                  : "Não foi possível reverter."
              )
            )
          },
        },
      })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível guardar."
      )
    } finally {
      setAGuardar(false)
    }
  }

  const direita = alinhar === "direita"

  if (bloqueado) {
    return (
      <span
        title={bloqueado}
        className={cn(
          "flex items-center gap-2 pr-8",
          direita ? "justify-end" : "justify-start"
        )}
      >
        {mostrar}
      </span>
    )
  }

  if (!aEditar) {
    return (
      <button
        ref={celulaRef}
        type="button"
        aria-label={`Editar ${rotulo}`}
        onClick={() => {
          setRascunho(paraRascunho(valor))
          setAEditar(true)
        }}
        className={cn(
          "group/celula -my-1 flex w-full items-center gap-2 rounded-lg py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/25",
          direita ? "justify-end text-right" : "justify-start text-left"
        )}
      >
        <span className="min-w-0 truncate">{mostrar}</span>
        <span
          aria-hidden
          className={cn(
            BOTAO_LINHA,
            "bg-accent text-accent-foreground transition-[background-color,color,opacity] group-hover/celula:bg-primary group-hover/celula:text-primary-foreground",
            discreto &&
              "opacity-0 group-hover/celula:opacity-100 group-focus-visible/celula:opacity-100 [@media(hover:none)]:opacity-100"
          )}
        >
          <Pencil className="size-3" />
        </span>
      </button>
    )
  }

  return (
    <span
      className={cn(
        "flex items-center gap-1",
        direita ? "justify-end" : "justify-start"
      )}
    >
      <input
        autoFocus
        aria-label={rotulo}
        inputMode={inputMode}
        value={rascunho}
        disabled={aGuardar}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setRascunho(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") fechar()
          if (e.key === "Enter") void guardar()
        }}
        className={cn(
          campoCls,
          "h-8 min-w-0 px-2 tabular-nums",
          direita && "text-right",
          larguraEditor
        )}
      />
      {sufixo && (
        <span className="text-sm text-muted-foreground">{sufixo}</span>
      )}
      <button
        type="button"
        aria-label="Cancelar"
        disabled={aGuardar}
        onClick={fechar}
        className={cn(
          BOTAO_LINHA,
          "text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        )}
      >
        <X className="size-3" />
      </button>
      <button
        type="button"
        aria-label="Guardar"
        disabled={aGuardar}
        onClick={() => void guardar()}
        className={cn(
          BOTAO_LINHA,
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_10%)] disabled:opacity-50"
        )}
      >
        {aGuardar ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Check className="size-3" strokeWidth={2.5} />
        )}
      </button>
    </span>
  )
}

const BOTAO_LINHA =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/25 disabled:pointer-events-none"

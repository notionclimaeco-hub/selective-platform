import { useState } from "react"
import type { ReactNode } from "react"
import { Check, Loader2, Pencil, X } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

/**
 * One editable property row, as in the client app's account editor
 * (client-frontend `empresa/conta-dialog.tsx`): label, value, and one small
 * button. The pencil swaps the value for an editor and becomes X (cancel) +
 * check (save); Enter saves, Escape cancels. The row saves itself and confirms
 * with a toast whose "Reverter" writes the previous value back.
 */
export function CampoEditavel<T>({
  rotulo,
  valor,
  mostrar,
  editor,
  onGuardar,
  mensagem,
  bloco,
}: {
  rotulo: string
  valor: T
  /** How the saved value reads. */
  mostrar: (v: T) => ReactNode
  /** The editor for the draft value. */
  editor: (rascunho: T, setRascunho: (v: T) => void) => ReactNode
  onGuardar: (novo: T) => Promise<unknown>
  /** Toast text on success, e.g. "Notas guardadas." */
  mensagem: string
  /** Multi-line editor (textarea): Enter does not save. */
  bloco?: boolean
}) {
  const [aEditar, setAEditar] = useState(false)
  const [rascunho, setRascunho] = useState<T>(valor)
  const [aGuardar, setAGuardar] = useState(false)

  async function guardar() {
    const anterior = valor
    setAGuardar(true)
    try {
      await onGuardar(rascunho)
      setAEditar(false)
      toast(mensagem, {
        action: {
          label: "Reverter",
          onClick: () => void onGuardar(anterior),
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

  return (
    <div
      className={cn(
        "grid min-h-14 grid-cols-[7.5rem_minmax(0,1fr)_auto] gap-x-3 px-5 py-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)_auto]",
        bloco && aEditar ? "items-start" : "items-center"
      )}
      onKeyDown={(e) => {
        if (!aEditar) return
        if (e.key === "Enter" && !bloco && !aGuardar) {
          e.preventDefault()
          void guardar()
        } else if (e.key === "Escape") {
          e.stopPropagation()
          setAEditar(false)
        }
      }}
    >
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">
        {aEditar ? editor(rascunho, setRascunho) : mostrar(valor)}
      </dd>
      {aEditar ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Cancelar edição de ${rotulo.toLowerCase()}`}
            disabled={aGuardar}
            onClick={() => setAEditar(false)}
            className={cn(
              BOTAO_LINHA,
              "text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            )}
          >
            <X className="size-3" />
          </button>
          <button
            type="button"
            aria-label={`Guardar ${rotulo.toLowerCase()}`}
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
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Editar ${rotulo.toLowerCase()}`}
          onClick={() => {
            setRascunho(valor)
            setAEditar(true)
          }}
          className={BOTAO_EDITAR}
        >
          <Pencil className="size-3" />
        </button>
      )}
    </div>
  )
}

/** The small square row button of the client's account editor. */
export const BOTAO_LINHA =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/25 disabled:pointer-events-none"

/** The lime pencil tile: the one look for "edit" across the app. */
export const BOTAO_EDITAR = cn(
  BOTAO_LINHA,
  "bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground"
)

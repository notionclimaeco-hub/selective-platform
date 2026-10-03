import { useState } from "react"
import { Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

// Minimal confirm dialog for destructive actions, on the client app's dialog
// (client-frontend `ui/dialog.tsx`). `onConfirmar` may be async; the
// dialog shows a spinner until it resolves, then closes. While it runs,
// neither Escape, the backdrop nor the X close it.
export function ConfirmDialog({
  titulo,
  descricao,
  confirmarLabel = "Confirmar",
  variante = "destructive",
  onConfirmar,
  onCancelar,
}: {
  titulo: string
  descricao: string
  confirmarLabel?: string
  variante?: "destructive" | "default"
  onConfirmar: () => Promise<void> | void
  onCancelar: () => void
}) {
  const [aProcessar, setAProcessar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar() {
    setErro(null)
    setAProcessar(true)
    try {
      await onConfirmar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Ocorreu um erro.")
    } finally {
      setAProcessar(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto && !aProcessar) onCancelar()
      }}
    >
      <DialogContent role="alertdialog" showCloseButton={false}>
        <div className="flex flex-col gap-1.5 pr-8">
          <DialogTitle className="text-lg font-semibold break-words">
            {titulo}
          </DialogTitle>
          <DialogDescription className="break-words">
            {descricao}
          </DialogDescription>
          {erro && (
            <p role="alert" className="mt-1.5 break-words text-destructive">
              {erro}
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancelar} disabled={aProcessar}>
            Cancelar
          </Button>
          <Button
            variant={variante}
            onClick={() => void confirmar()}
            disabled={aProcessar}
          >
            {aProcessar && <Loader2 className="animate-spin" />}
            {aProcessar ? "A processar…" : confirmarLabel}
          </Button>
        </div>
        <DialogClose
          disabled={aProcessar}
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 right-4 bg-secondary"
            />
          }
        >
          <X />
          <span className="sr-only">Fechar</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

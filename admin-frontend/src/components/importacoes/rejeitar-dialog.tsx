import { useState } from "react"
import { Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { campoCls } from "@/components/ui/tabela"
import { cn } from "@/lib/utils"

/** Reject an import run with an optional free-text reason. */
export function RejeitarDialog({
  titulo,
  onConfirmar,
  onCancelar,
}: {
  titulo: string
  onConfirmar: (motivo: string) => Promise<void>
  onCancelar: () => void
}) {
  const [motivo, setMotivo] = useState("")
  const [aProcessar, setAProcessar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar() {
    setErro(null)
    setAProcessar(true)
    try {
      await onConfirmar(motivo.trim())
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
      <DialogContent
        showCloseButton={false}
        className="block rounded-2xl sm:max-w-sm"
      >
        <DialogTitle className="pr-8 text-lg font-semibold tracking-tight break-words">
          {titulo}
        </DialogTitle>
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
        <label className="mt-4 flex flex-col gap-1.5">
          <span className="font-medium">Motivo</span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            className={cn(campoCls, "h-auto w-full py-2")}
          />
        </label>
        {erro && (
          <p className="mt-3 text-sm break-words text-destructive">{erro}</p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancelar} disabled={aProcessar}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => void confirmar()}
            disabled={aProcessar}
          >
            {aProcessar && <Loader2 className="animate-spin" />}
            {aProcessar ? "A processar…" : "Rejeitar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

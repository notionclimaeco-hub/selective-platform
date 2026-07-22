import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

// Minimal confirm dialog for destructive actions. `onConfirmar` may be async;
// the dialog shows a spinner until it resolves, then closes.
export function ConfirmDialog({
  titulo,
  descricao,
  confirmarLabel = "Confirmar",
  onConfirmar,
  onCancelar,
}: {
  titulo: string
  descricao: string
  confirmarLabel?: string
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={aProcessar ? undefined : onCancelar}
      />
      <div className="relative w-full max-w-sm rounded-xl border bg-background p-5 shadow-xl">
        <h2 className="font-medium">{titulo}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{descricao}</p>
        {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onCancelar} disabled={aProcessar}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => void confirmar()}
            disabled={aProcessar}
          >
            {aProcessar && <Loader2 className="animate-spin" />}
            {aProcessar ? "A processar…" : confirmarLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

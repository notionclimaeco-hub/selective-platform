import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={aProcessar ? undefined : onCancelar}
      />
      <div className="relative w-full max-w-sm rounded-xl border bg-background p-5 shadow-xl">
        <h2 className="font-medium break-words">{titulo}</h2>
        <label className="mt-3 flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Motivo</span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </label>
        {erro && (
          <p className="mt-3 text-sm break-words text-destructive">{erro}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
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
      </div>
    </div>
  )
}

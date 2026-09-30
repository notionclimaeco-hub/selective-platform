import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { useTelemovel } from "@/lib/telemovel"

const TEXTO = "Os preços congelados perdem-se. Não é possível desfazer."

/**
 * Cancel confirmation: a bottom sheet on phones, a dialog from `md`, like the
 * sign-in prompt on the Orçamento page.
 */
export function CancelarEncomenda({
  numero,
  aberto,
  onAbertoChange,
  onConfirmar,
  aCancelar,
  erro,
}: {
  numero: number
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  onConfirmar: () => void
  aCancelar: boolean
  erro: string | null
}) {
  const telemovel = useTelemovel()
  const titulo = `Cancelar ENC-${numero}?`
  const accoes = (
    <div className="mt-5 flex flex-col gap-2">
      <Button
        variant="destructive"
        size="lg"
        className="h-11"
        disabled={aCancelar}
        onClick={onConfirmar}
      >
        {aCancelar ? "A cancelar…" : "Cancelar encomenda"}
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="h-11"
        disabled={aCancelar}
        onClick={() => onAbertoChange(false)}
      >
        Manter
      </Button>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  )

  if (telemovel) {
    return (
      <Sheet open={aberto} onOpenChange={onAbertoChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-2xl px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div
            aria-hidden
            className="mx-auto mb-4 h-1 w-9 rounded-full bg-muted-foreground/25"
          />
          <SheetTitle className="text-lg font-semibold tracking-tight">
            {titulo}
          </SheetTitle>
          <SheetDescription className="mt-1.5">{TEXTO}</SheetDescription>
          {accoes}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="gap-0 rounded-2xl p-6 sm:max-w-sm">
        <DialogTitle className="text-lg font-semibold tracking-tight">
          {titulo}
        </DialogTitle>
        <DialogDescription className="mt-1.5 pr-6">{TEXTO}</DialogDescription>
        {accoes}
      </DialogContent>
    </Dialog>
  )
}

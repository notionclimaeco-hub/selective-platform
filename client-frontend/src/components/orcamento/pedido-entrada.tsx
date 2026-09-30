import { useSyncExternalStore } from "react"
import { Link } from "@tanstack/react-router"

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

const TITULO = "Entre para encomendar"
const TEXTO =
  "A lista fica guardada. Depois de aprovada, a sua empresa vê os preços de revenda e encomenda aqui."

/**
 * The sign-in prompt when a signed-out visitor submits the quote list: a
 * bottom sheet on phones, a dialog from `md`. Both ways in return to
 * `/orcamento`, where the list is still waiting (localStorage).
 */
export function PedidoEntrada({
  aberto,
  onAbertoChange,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
}) {
  const telemovel = useTelemovel()

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
            {TITULO}
          </SheetTitle>
          <SheetDescription className="mt-1.5">{TEXTO}</SheetDescription>
          <Accoes />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="gap-0 rounded-2xl p-6 sm:max-w-sm">
        <DialogTitle className="text-lg font-semibold tracking-tight">
          {TITULO}
        </DialogTitle>
        <DialogDescription className="mt-1.5 pr-6">{TEXTO}</DialogDescription>
        <Accoes />
      </DialogContent>
    </Dialog>
  )
}

function Accoes() {
  return (
    <div className="mt-5 flex flex-col gap-2">
      <Button
        render={<Link to="/entrar" search={{ return: "/orcamento" }} />}
        nativeButton={false}
        size="lg"
        className="h-11"
      >
        Entrar
      </Button>
      <Button
        render={<Link to="/registo" search={{ return: "/orcamento" }} />}
        nativeButton={false}
        variant="outline"
        size="lg"
        className="h-11"
      >
        Registar empresa
      </Button>
    </div>
  )
}

/**
 * Below `md` (48rem, where the app shell switches to the tab bar). False on
 * the server; the prompt only opens after a tap, long after hydration.
 */
function useTelemovel(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia("(width < 48rem)")
      mq.addEventListener("change", avisar)
      return () => mq.removeEventListener("change", avisar)
    },
    () => window.matchMedia("(width < 48rem)").matches,
    () => false
  )
}

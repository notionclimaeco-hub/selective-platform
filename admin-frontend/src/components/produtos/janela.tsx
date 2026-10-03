import type { ReactNode } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/**
 * Modal sheet on the client app's dialog look (client-frontend
 * `empresa/conta-dialog.tsx`): white popover card, a header row with the
 * title left and a close button right, a body that scrolls, and an optional
 * footer row. While `bloqueada` (saving/uploading) neither Escape, the
 * backdrop nor the X close it.
 */
export function Janela({
  titulo,
  onFechar,
  bloqueada,
  rodape,
  children,
  className,
}: {
  titulo: string
  onFechar: () => void
  bloqueada?: boolean
  rodape?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto && !bloqueada) onFechar()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl",
          className
        )}
      >
        <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b px-5">
          <DialogTitle className="text-sm font-semibold">{titulo}</DialogTitle>
          <DialogClose
            disabled={bloqueada}
            render={<Button type="button" variant="ghost" size="icon-sm" />}
          >
            <X />
            <span className="sr-only">Fechar</span>
          </DialogClose>
        </div>
        {children}
        {rodape && (
          <footer className="shrink-0 border-t px-5 py-4">{rodape}</footer>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** One data line under the header row: who/what this sheet is about. */
export function JanelaMeta({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b px-5 py-3 text-sm">
      {children}
    </div>
  )
}

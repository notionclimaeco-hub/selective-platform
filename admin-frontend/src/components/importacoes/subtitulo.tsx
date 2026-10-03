import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Sub-heading inside an open group of the review page: the client card
 * title (small semibold, muted count) without a rule, since the group row
 * is already the card's. Controls sit right on the same line.
 */
export function Subtitulo({
  children,
  contagem,
  accoes,
  className,
}: {
  children: ReactNode
  contagem?: ReactNode
  accoes?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-2.5 flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1.5",
        className
      )}
    >
      <h3 className="flex items-baseline gap-2 text-sm font-semibold">
        {children}
        {contagem !== undefined && (
          <span className="font-normal text-muted-foreground tabular-nums">
            {contagem}
          </span>
        )}
      </h3>
      {accoes && (
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
          {accoes}
        </div>
      )}
    </div>
  )
}

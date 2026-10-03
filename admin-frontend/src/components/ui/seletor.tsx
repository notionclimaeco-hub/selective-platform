import type { ComponentProps } from "react"
import { ChevronDown } from "lucide-react"

import { campoCls } from "@/components/ui/tabela"
import { cn } from "@/lib/utils"

/**
 * The one select of the admin app: a native <select> on the input look with
 * its own chevron, like the client's catalog sort select. Keyboard and
 * screen-reader complete for free. `className` sizes the wrapper (width,
 * flex); `ativo` marks a filter that is narrowing the list; `tamanho="sm"`
 * is the h-8 variant for header rows.
 */
export function Seletor({
  className,
  ativo,
  tamanho,
  ...props
}: ComponentProps<"select"> & { ativo?: boolean; tamanho?: "sm" }) {
  return (
    <span className={cn("relative inline-flex min-w-0", className)}>
      <select
        {...props}
        className={cn(
          campoCls,
          "peer w-full min-w-0 cursor-pointer appearance-none truncate pr-8",
          tamanho === "sm" && "h-8",
          ativo &&
            "border-primary/40 font-medium text-primary [&>option]:font-normal [&>option]:text-foreground"
        )}
      />
      <ChevronDown
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground peer-disabled:opacity-50",
          ativo && "text-primary"
        )}
      />
    </span>
  )
}

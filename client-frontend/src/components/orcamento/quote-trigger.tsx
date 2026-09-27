import { cn } from "@/lib/utils"

/** Small primary pill with the number of lines in the quote list. */
export function ContadorOrcamento({
  valor,
  className,
}: {
  valor: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground",
        className
      )}
    >
      {valor}
    </span>
  )
}

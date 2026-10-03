import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-2xl bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }

/*
 * Admin-only shapes built on `Skeleton`, for "query still loading" states
 * inside the card the content will fill (like the client's
 * `ProductCardSkeleton`). Each carries a screen-reader "A carregar…".
 */

const barraCls = "h-4 rounded-md"

/** List rows on the `Td` rhythm (h-14, px-5 gutters, divide-y). `colunas`
 * are the bars of one row, left to right (add `ml-auto` to push right). */
function LinhasEsqueleto({
  linhas = 4,
  colunas = ["w-2/5", "ml-auto w-16"],
  className,
}: {
  linhas?: number
  colunas?: ReadonlyArray<string>
  className?: string
}) {
  return (
    <div role="status" className={cn("divide-y", className)}>
      <span className="sr-only">A carregar…</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} aria-hidden className="flex h-14 items-center gap-4 px-5">
          {colunas.map((c, j) => (
            <Skeleton key={j} className={cn(barraCls, c)} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Label / value rows on the `Ficha` rhythm. */
function FichaEsqueleto({ linhas = 4 }: { linhas?: number }) {
  return (
    <div role="status" className="py-3.5">
      <span className="sr-only">A carregar…</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 px-5 py-2 sm:grid-cols-[10rem_minmax(0,1fr)]"
        >
          <Skeleton className={cn(barraCls, "w-20")} />
          <Skeleton className={cn(barraCls, i % 2 ? "w-1/2" : "w-3/4")} />
        </div>
      ))}
    </div>
  )
}

/** Page title block (`Cabecalho`): title and its data line. */
function CabecalhoEsqueleto() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="h-8 w-64 max-w-full rounded-lg" />
      <Skeleton className={cn(barraCls, "w-48 max-w-full")} />
    </div>
  )
}

export { CabecalhoEsqueleto, FichaEsqueleto, LinhasEsqueleto }

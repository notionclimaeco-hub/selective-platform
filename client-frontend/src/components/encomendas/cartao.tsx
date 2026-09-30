import { cn } from "@/lib/utils"

/**
 * The order page's card: a header row (title left, value or action right)
 * over an optional body, like the Empresa sections. `corpo={false}` lets the
 * body run edge to edge (tables, row lists).
 */
export function Cartao({
  titulo,
  direita,
  children,
  corpo = true,
  className,
}: {
  titulo: string
  direita?: React.ReactNode
  children?: React.ReactNode
  corpo?: boolean
  className?: string
}) {
  return (
    <section
      className={cn("overflow-hidden rounded-xl border bg-card", className)}
    >
      <div
        className={cn(
          "flex min-h-14 items-center justify-between gap-4 px-5",
          children ? "border-b" : ""
        )}
      >
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {direita && (
          <div className="flex items-center gap-2 text-sm">{direita}</div>
        )}
      </div>
      {children &&
        (corpo ? <div className="px-5 py-4">{children}</div> : children)}
    </section>
  )
}

type Valor = { label: string; valor: React.ReactNode }

/** Label/value rows with the value right-aligned; `false` items are skipped. */
export function Valores({ itens }: { itens: ReadonlyArray<Valor | false> }) {
  return (
    <dl className="flex flex-col gap-2.5 text-sm">
      {itens
        .filter((item): item is Valor => item !== false)
        .map((item) => (
          <div
            key={item.label}
            className="flex items-baseline justify-between gap-4"
          >
            <dt className="shrink-0 text-muted-foreground">{item.label}</dt>
            <dd className="min-w-0 text-right [overflow-wrap:anywhere]">
              {item.valor}
            </dd>
          </div>
        ))}
    </dl>
  )
}

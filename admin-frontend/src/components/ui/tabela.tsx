import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

/*
 * Page building blocks in the Climaeco Pro client app's language
 * (client-frontend: `shell/pagina.tsx`, `empresa/seccao.tsx`,
 * `encomendas/lista-encomendas.tsx`, `encomendas/estado-badge.tsx`):
 * a plain page title, settings-style cards with a title-left / value-right
 * header row, column tables inside a card, and pill badges with a dot.
 */

/** Page title block: optional back link, title, one data line, actions right. */
export function Cabecalho({
  titulo,
  meta,
  voltar,
  children,
}: {
  titulo: ReactNode
  /** One line of data under the title (count, NIF, dates). Never prose. */
  meta?: ReactNode
  /** Back link rendered above the title. */
  voltar?: ReactNode
  /** Actions, right-aligned on the title row. */
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col">
        {voltar && <div className="mb-3">{voltar}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {meta && (
          <div className="mt-1.5 text-sm text-muted-foreground">{meta}</div>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  )
}

/** Plain card for a list whose filter chips already name it (no header row). */
export function Cartao({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn("overflow-hidden rounded-xl border bg-card", className)}
    >
      {children}
    </section>
  )
}

/** Card header row: title left, count / values / actions right. */
export function Banda({
  titulo,
  contagem,
  children,
  className,
}: {
  titulo: ReactNode
  contagem?: ReactNode
  /** Right side of the row: small actions or values. */
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-14 items-center justify-between gap-4 border-b px-5",
        className
      )}
    >
      <h2 className="flex items-baseline gap-2 text-sm font-semibold">
        {titulo}
        {contagem !== undefined && (
          <span className="font-normal text-muted-foreground tabular-nums">
            {contagem}
          </span>
        )}
      </h2>
      {children && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  )
}

/** A settings-style card: header row, then its body on the same gutter. */
export function Seccao({
  titulo,
  contagem,
  accoes,
  children,
  className,
}: {
  titulo: ReactNode
  contagem?: ReactNode
  accoes?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card",
        className
      )}
    >
      <Banda titulo={titulo} contagem={contagem}>
        {accoes}
      </Banda>
      {children}
    </section>
  )
}

/** Column table inside a card. Scrolls sideways inside itself, never the page. */
export function Tabela({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      />
    </div>
  )
}

export function Th({
  className,
  num,
  ...props
}: ComponentProps<"th"> & { num?: boolean }) {
  return (
    <th
      className={cn(
        "border-b bg-secondary/40 px-4 py-2.5 text-left text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-5 last:pr-5",
        num && "text-right",
        className
      )}
      {...props}
    />
  )
}

export function Td({
  className,
  num,
  ...props
}: ComponentProps<"td"> & { num?: boolean }) {
  return (
    <td
      className={cn(
        "h-14 border-b px-4 py-2.5 align-middle first:pl-5 last:pr-5 [tr:last-child>&]:border-b-0",
        num && "text-right whitespace-nowrap tabular-nums",
        className
      )}
      {...props}
    />
  )
}

/** Body row hover, as on the client's orders table. */
export const linhaCls = "transition-colors hover:bg-secondary/40"

export type Tom =
  "neutro" | "aviso" | "progresso" | "feito" | "perigo" | "inativo"

const TOM_BADGE: Record<Tom, string> = {
  neutro: "bg-secondary text-secondary-foreground ring-border",
  aviso: "bg-warning text-warning-foreground ring-warning-foreground/20",
  progresso: "bg-primary/10 text-primary ring-primary/20",
  feito: "bg-primary/10 text-primary ring-primary/20",
  perigo: "bg-destructive/10 text-destructive ring-destructive/20",
  inativo: "bg-secondary text-muted-foreground ring-border",
}

const TOM_PONTO: Record<Tom, string> = {
  neutro: "bg-muted-foreground/60",
  aviso: "bg-amber-500",
  progresso: "bg-primary/50",
  feito: "bg-primary",
  perigo: "bg-destructive",
  inativo: "bg-muted-foreground/40",
}

/** State badge: a pill with a dot, like the client's `EstadoBadge`. */
export function Marcador({
  tom,
  children,
  className,
}: {
  tom: Tom
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TOM_BADGE[tom],
        className
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", TOM_PONTO[tom])}
      />
      {children}
    </span>
  )
}

/** Lime dot that marks "needs the office". */
export function Destaque({ className }: { className?: string }) {
  return (
    <span
      aria-label="Ação necessária"
      className={cn(
        "inline-block size-2 shrink-0 rounded-full bg-brand",
        className
      )}
    />
  )
}

// Same rhythm as the client's `Linhas` (gap-y-3 between 20px lines).
export const fichaLinhaCls =
  "grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-4 px-5 py-1.5 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]"
export const fichaRotuloCls = "text-muted-foreground"

/** Aligned label / value rows, like the client's `Linhas`. */
export function Ficha({
  linhas,
  className,
  children,
}: {
  linhas: Array<{ rotulo: ReactNode; valor: ReactNode; chave?: string }>
  className?: string
  /** Extra rows (e.g. `CampoEditavel`) after the static ones. */
  children?: ReactNode
}) {
  return (
    <dl className={cn("py-3.5 text-sm", className)}>
      {linhas.map((l, i) => (
        <div key={l.chave ?? i} className={fichaLinhaCls}>
          <dt className={fichaRotuloCls}>{l.rotulo}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere]">{l.valor}</dd>
        </div>
      ))}
      {children}
    </dl>
  )
}

/** One muted line inside a card when it has no rows. */
export function Vazio({ children }: { children: ReactNode }) {
  return <p className="px-5 py-6 text-sm text-muted-foreground">{children}</p>
}

/** Text inputs and selects, on the client `Input` look at table density. */
export const campoCls =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm transition-[color,box-shadow,border-color] outline-none placeholder:text-muted-foreground hover:border-[color-mix(in_oklch,var(--input),var(--foreground)_15%)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50"

/** Filter chips, like the client's orders and catalog chips. */
export function Filtros<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: ReadonlyArray<{ valor: T | undefined; rotulo: string }>
  valor: T | undefined
  onChange: (v: T | undefined) => void
}) {
  return (
    <div
      role="tablist"
      className="sem-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {opcoes.map((o) => {
        const activo = o.valor === valor
        return (
          <button
            key={o.rotulo}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => onChange(o.valor)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25",
              activo
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-foreground hover:border-foreground/25"
            )}
          >
            {o.rotulo}
          </button>
        )
      })}
    </div>
  )
}

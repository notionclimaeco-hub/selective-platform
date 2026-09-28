import { cn } from "@/lib/utils"

/** The Empresa page sections, in page and side-nav order. */
export const SECCOES_EMPRESA = [
  { id: "estado", label: "Estado" },
  { id: "nivel", label: "Nível" },
  { id: "dados", label: "Dados da empresa" },
  { id: "membros", label: "Membros" },
  { id: "conta", label: "A minha conta" },
] as const

export type SeccaoId = (typeof SECCOES_EMPRESA)[number]["id"]

/**
 * One settings-style card: a header row with the title on the left and an
 * optional value or action on the right, then the body on the same gutter.
 * Sections stack on phones; the desktop side nav jumps between them.
 */
export function Seccao({
  id,
  titulo,
  direita,
  children,
  className,
}: {
  id: SeccaoId
  titulo: string
  direita?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className={cn(
        "scroll-mt-20 rounded-xl border bg-card md:scroll-mt-8",
        className
      )}
    >
      <div
        className={cn(
          "flex min-h-14 items-center justify-between gap-4 px-5",
          children ? "border-b" : ""
        )}
      >
        <h2 id={`${id}-titulo`} className="text-sm font-semibold">
          {titulo}
        </h2>
        {direita && <div className="flex items-center gap-2">{direita}</div>}
      </div>
      {children && <div className="px-5 py-4">{children}</div>}
    </section>
  )
}

/** Desktop-only side nav with an anchor per section (hidden below `lg`). */
export function NavSeccoes({ ids }: { ids: ReadonlyArray<SeccaoId> }) {
  const itens = SECCOES_EMPRESA.filter((s) => ids.includes(s.id))
  return (
    <nav
      aria-label="Secções da empresa"
      className="sticky top-8 hidden self-start lg:block"
    >
      <ul className="flex flex-col gap-0.5">
        {itens.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="flex h-9 items-center rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Aligned label/value rows shared by Dados and A minha conta. */
export function Linhas({
  itens,
}: {
  itens: ReadonlyArray<{ label: string; valor: React.ReactNode }>
}) {
  return (
    <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
      {itens.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere]">{item.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

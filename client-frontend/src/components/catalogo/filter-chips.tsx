import { cn } from "@/lib/utils"

export type Opcao = {
  valor: string
  rotulo: string
  contagem: number
}

const numero = new Intl.NumberFormat("pt-PT")

/**
 * Single-choice chip row with a leading "all" chip and a label column. Wraps;
 * used from `sm` up (phones get one scrolling row plus the Filtros sheet).
 */
export function FilterChips({
  rotulo,
  rotuloTodos,
  opcoes,
  escolhida,
  onEscolher,
}: {
  rotulo: string
  rotuloTodos: string
  opcoes: Array<Opcao>
  escolhida: string | undefined
  onEscolher: (valor: string | undefined) => void
}) {
  const total = opcoes.reduce((n, o) => n + o.contagem, 0)

  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="w-14 shrink-0 pt-1.5 text-xs font-medium text-muted-foreground">
        {rotulo}
      </span>
      <div
        role="group"
        aria-label={rotulo}
        className="flex min-w-0 flex-1 flex-wrap gap-1.5"
      >
        <Chip
          ativo={escolhida === undefined}
          onClick={() => onEscolher(undefined)}
          contagem={total}
        >
          {rotuloTodos}
        </Chip>
        {opcoes.map((o) => (
          <Chip
            key={o.valor}
            ativo={o.valor === escolhida}
            contagem={o.contagem}
            onClick={() =>
              onEscolher(o.valor === escolhida ? undefined : o.valor)
            }
          >
            {o.rotulo}
          </Chip>
        ))}
      </div>
    </div>
  )
}

/** A toggle pill; tapping the lit one clears it. */
export function Chip({
  ativo,
  contagem,
  onClick,
  children,
}: {
  ativo: boolean
  contagem?: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25",
        ativo
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background text-foreground hover:border-foreground/25"
      )}
    >
      {children}
      {contagem !== undefined && (
        <span
          className={cn(
            "text-[11px] tabular-nums",
            ativo ? "text-primary-foreground/75" : "text-muted-foreground"
          )}
        >
          {numero.format(contagem)}
        </span>
      )}
    </button>
  )
}

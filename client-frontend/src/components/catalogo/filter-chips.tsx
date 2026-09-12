import { cn } from "@/lib/utils"

export type Opcao = {
  valor: string
  rotulo: string
  contagem: number
}

const numero = new Intl.NumberFormat("pt-PT")

/**
 * Single-choice chip row. Scrolls sideways on a phone (thumb-friendly, no
 * modal) and wraps on wider screens. The first chip is always "all".
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
      <span className="hidden w-16 shrink-0 pt-2 text-xs font-medium text-muted-foreground sm:block">
        {rotulo}
      </span>
      {/* `min-w-0` is what lets this row scroll instead of stretching the
          whole page sideways on a phone (a flex child defaults to
          min-width:auto = its content width). */}
      <div
        role="group"
        aria-label={rotulo}
        className="sem-scrollbar -mx-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:px-0"
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

function Chip({
  ativo,
  contagem,
  onClick,
  children,
}: {
  ativo: boolean
  contagem: number
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
          : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {children}
      <span
        className={cn(
          "text-[11px] tabular-nums",
          ativo ? "text-primary-foreground/75" : "text-muted-foreground"
        )}
      >
        {numero.format(contagem)}
      </span>
    </button>
  )
}

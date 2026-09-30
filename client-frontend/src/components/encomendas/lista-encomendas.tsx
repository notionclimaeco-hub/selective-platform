import { Link } from "@tanstack/react-router"
import type { FunctionReturnType } from "convex/server"
import { ChevronRight, LoaderCircle, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import type { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { eurExato } from "@/lib/catalogo"
import { formatarData, totaisEncomenda } from "@/lib/encomendas"
import { usePagarPorBanco } from "@/lib/pagar-por-banco"
import { cn } from "@/lib/utils"
import { EstadoBadge } from "./estado-badge"

export type EncomendaResumo = FunctionReturnType<
  typeof api.encomendas.minhas
>["page"][number]

/**
 * Orders list: one card per order on phones, one table from `md`. Each row
 * is a single stretched link to the order; the Pagar button (opens Revolut's
 * Pay by Bank window in place) sits above it (`relative z-10`) so the two
 * never nest.
 */
export function ListaEncomendas({
  encomendas,
}: {
  encomendas: Array<EncomendaResumo>
}) {
  return (
    <>
      <ul className="flex flex-col gap-2.5 md:hidden">
        {encomendas.map((e) => (
          <CartaoEncomenda key={e._id} encomenda={e} />
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <div
          aria-hidden
          className={cn(
            COLUNAS,
            "border-b bg-secondary/40 py-2.5 text-xs font-medium text-muted-foreground"
          )}
        >
          <span>Encomenda</span>
          <span>Data</span>
          <span>Estado</span>
          <span className="text-right">Referências</span>
          <span className="text-right">Total c/IVA</span>
          <span />
        </div>
        <ul className="divide-y">
          {encomendas.map((e) => (
            <LinhaEncomenda key={e._id} encomenda={e} />
          ))}
        </ul>
      </div>
    </>
  )
}

// Fixed columns so badges, counts and totals line up down the table.
const COLUNAS =
  "grid grid-cols-[7rem_8rem_minmax(0,1fr)_6rem_8rem_7.5rem] items-center gap-4 px-5"

function CartaoEncomenda({ encomenda: e }: { encomenda: EncomendaResumo }) {
  return (
    <li className="relative rounded-xl border bg-card transition-colors hover:border-foreground/20">
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div className="min-w-0">
          <Link
            to="/encomendas/$id"
            params={{ id: e._id }}
            className="font-semibold outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/25"
          >
            ENC-{e.numero}
          </Link>
          <p className="text-xs text-muted-foreground">
            {formatarData(e.placedAt)}
          </p>
        </div>
        <EstadoBadge estado={e.estado} />
      </div>
      <div className="flex items-baseline justify-between gap-3 px-4 pt-2 pb-3.5 text-sm">
        <span className="text-muted-foreground">{referencias(e.nLinhas)}</span>
        <span className="font-semibold tabular-nums">
          {eurExato.format(totaisEncomenda(e).total / 100)}
        </span>
      </div>
      {e.revolutToken && (
        <div className="px-4 pb-4">
          <BotaoPagar revolutToken={e.revolutToken} className="h-10 w-full" />
        </div>
      )}
    </li>
  )
}

function LinhaEncomenda({ encomenda: e }: { encomenda: EncomendaResumo }) {
  return (
    <li
      className={cn(
        COLUNAS,
        "group relative min-h-14 py-2.5 text-sm transition-colors hover:bg-secondary/40"
      )}
    >
      <Link
        to="/encomendas/$id"
        params={{ id: e._id }}
        className="font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/25 focus-visible:after:ring-inset"
      >
        ENC-{e.numero}
      </Link>
      <span className="text-muted-foreground">{formatarData(e.placedAt)}</span>
      <span>
        <EstadoBadge estado={e.estado} />
      </span>
      <span className="text-right text-muted-foreground tabular-nums">
        {e.nLinhas}
      </span>
      <span className="text-right font-medium tabular-nums">
        {eurExato.format(totaisEncomenda(e).total / 100)}
      </span>
      <span className="flex justify-end">
        {e.revolutToken ? (
          <BotaoPagar revolutToken={e.revolutToken} size="sm" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        )}
      </span>
    </li>
  )
}

/** Opens Revolut's Pay by Bank window right from the list. */
function BotaoPagar({
  revolutToken,
  size,
  className,
}: {
  revolutToken: string
  size?: "sm"
  className?: string
}) {
  const { fase, pagar } = usePagarPorBanco({
    aoErro: (mensagem) => toast.error(`Pagamento não iniciado: ${mensagem}`),
  })
  const ocupado = fase === "a_abrir" || fase === "a_confirmar"

  return (
    <Button
      size={size}
      disabled={ocupado}
      onClick={() => void pagar(revolutToken)}
      className={cn("relative z-10", className)}
    >
      {ocupado ? (
        <LoaderCircle data-icon="inline-start" className="animate-spin" />
      ) : (
        <ShieldCheck data-icon="inline-start" />
      )}
      {fase === "a_abrir"
        ? "A abrir…"
        : fase === "a_confirmar"
          ? "A confirmar…"
          : "Pagar"}
    </Button>
  )
}

function referencias(n: number): string {
  return `${n} ${n === 1 ? "referência" : "referências"}`
}

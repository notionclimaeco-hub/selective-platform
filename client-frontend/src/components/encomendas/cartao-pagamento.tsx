import { Link } from "@tanstack/react-router"
import { ArrowRight, CheckCircle2, Landmark, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { eurExato } from "@/lib/catalogo"
import { formatarDataEncomenda, prazoRelativo } from "@/lib/encomendas"

/**
 * The one thing the installer has to do while an order is
 * `aguardando_pagamento`. Lives at the top of the order page so it is never
 * missed; the actual bank flow happens on /pagamento/$token.
 */
export function CartaoPagarAgora({
  token,
  totalCents,
  expiraEm,
  agora,
}: {
  token: string
  totalCents: number
  expiraEm?: number
  agora: number
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-orange-200 bg-orange-50/60">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
            <Landmark className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Stock confirmado — falta o pagamento
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pague por transferência bancária a partir da app do seu banco. Sem
              cartão, sem taxas adicionais.
            </p>
            {expiraEm && (
              <p className="mt-2 text-sm font-medium text-orange-800">
                Link válido até {formatarDataEncomenda(expiraEm)} ·{" "}
                {prazoRelativo(expiraEm, agora)}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <p className="text-sm text-muted-foreground sm:text-right">
            Total c/IVA{" "}
            <span className="block text-2xl font-semibold text-foreground tabular-nums">
              {eurExato.format(totalCents / 100)}
            </span>
          </p>
          <Button
            render={<Link to="/pagamento/$token" params={{ token }} />}
            nativeButton={false}
            size="lg"
            className="h-12 px-6"
          >
            Pagar agora
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
      <p className="flex items-center gap-1.5 border-t border-orange-200/70 bg-white/60 px-5 py-2.5 text-xs text-muted-foreground sm:px-6">
        <ShieldCheck className="size-3.5 text-primary" />
        Pagamento seguro por Pay by Bank. A fatura-recibo é emitida assim que o
        banco confirmar.
      </p>
    </section>
  )
}

export function CartaoPagamentoRecebido({ paidAt }: { paidAt: number }) {
  return (
    <section className="flex gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
      <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" />
      <div>
        <h2 className="font-semibold tracking-tight">Pagamento recebido</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirmado em {formatarDataEncomenda(paidAt)}. Estamos a encomendar
          aos fornecedores; avisamos quando o equipamento estiver no armazém
          para levantamento.
        </p>
      </div>
    </section>
  )
}

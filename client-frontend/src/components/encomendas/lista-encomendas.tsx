import { Link } from "@tanstack/react-router"
import type { FunctionReturnType } from "convex/server"
import { ArrowRight, ChevronRight, Landmark } from "lucide-react"

import type { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { eurExato } from "@/lib/catalogo"
import {
  encomendaEmCurso,
  formatarData,
  passosEncomenda,
  prazoRelativo,
  totaisEncomenda,
} from "@/lib/encomendas"
import { EstadoBadge } from "./estado-badge"
import { PontosProgresso } from "./linha-do-tempo"

export type EncomendaResumo = FunctionReturnType<
  typeof api.encomendas.minhas
>["page"][number]

/**
 * Orders list: what needs the installer's action first, then everything in
 * progress, then history. Rows are one link each (no nested buttons); the
 * pay button lives in the "acção necessária" block above the list.
 */
export function ListaEncomendas({
  encomendas,
  agora,
}: {
  encomendas: Array<EncomendaResumo>
  agora: number
}) {
  const aPagar = encomendas.filter(
    (e) => e.estado === "aguardando_pagamento" && e.pagamentoToken
  )
  const emCurso = encomendas.filter((e) => encomendaEmCurso(e.estado))
  const historico = encomendas.filter((e) => !encomendaEmCurso(e.estado))

  return (
    <>
      {aPagar.length > 0 && (
        <section
          aria-labelledby="accao-necessaria"
          className="rounded-xl border border-orange-200 bg-orange-50/60 p-5"
        >
          <h2
            id="accao-necessaria"
            className="flex items-center gap-2 text-sm font-semibold text-orange-900"
          >
            <Landmark className="size-4" />
            {aPagar.length === 1
              ? "1 encomenda à espera do seu pagamento"
              : `${aPagar.length} encomendas à espera do seu pagamento`}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {aPagar.map((e) => (
              <li
                key={e._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200/70 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">ENC-{e.numero}</p>
                  <p className="text-sm text-muted-foreground">
                    {eurExato.format(totaisEncomenda(e).total / 100)} c/IVA
                    {e.paymentExpiresAt &&
                      ` · ${prazoRelativo(e.paymentExpiresAt, agora)}`}
                  </p>
                </div>
                <Button
                  render={
                    <Link
                      to="/pagamento/$token"
                      params={{ token: e.pagamentoToken! }}
                    />
                  }
                  nativeButton={false}
                  size="sm"
                >
                  Pagar agora
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {emCurso.length > 0 && <Grupo titulo="Em curso" encomendas={emCurso} />}
      {historico.length > 0 && (
        <Grupo titulo="Histórico" encomendas={historico} />
      )}
    </>
  )
}

function Grupo({
  titulo,
  encomendas,
}: {
  titulo: string
  encomendas: Array<EncomendaResumo>
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        {titulo}
        <span className="ml-2 font-normal tracking-normal normal-case">
          {encomendas.length}
        </span>
      </h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {encomendas.map((e) => (
          <li key={e._id}>
            <LinhaEncomenda encomenda={e} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function LinhaEncomenda({ encomenda: e }: { encomenda: EncomendaResumo }) {
  const passos = passosEncomenda(e)
  const { total } = totaisEncomenda(e)

  return (
    <Link
      to="/conta/encomendas/$id"
      params={{ id: e._id }}
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-secondary/40 sm:grid-cols-[6.5rem_minmax(0,1fr)_10.5rem_6.5rem_1rem] sm:px-5"
    >
      <div className="col-start-1 row-start-1 sm:col-auto sm:row-auto">
        <p className="font-semibold">ENC-{e.numero}</p>
        <p className="text-xs text-muted-foreground">
          {formatarData(e.placedAt)}
        </p>
      </div>

      <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
        <PontosProgresso passos={passos} />
        <span className="text-sm text-muted-foreground">
          {e.nLinhas} {e.nLinhas === 1 ? "referência" : "referências"}
        </span>
      </div>

      {/* Fixed-width columns so badges and totals line up down the list. */}
      <div className="col-start-2 row-start-1 flex justify-end sm:col-start-3 sm:row-auto sm:justify-start">
        <EstadoBadge estado={e.estado} />
      </div>
      <span className="hidden text-right text-sm font-medium tabular-nums sm:block">
        {eurExato.format(total / 100)}
      </span>

      <ChevronRight className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
    </Link>
  )
}

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { FunctionReturnType } from "convex/server"

import type { api } from "@convex/_generated/api"
import {
  EMAIL_GERAL,
  MAPS_ARMAZEM,
  MORADA_ARMAZEM,
} from "@/components/shell/nav"
import { CabecalhoPagina } from "@/components/shell/pagina"
import { Button } from "@/components/ui/button"
import {
  MOTIVO_CANCELAMENTO_LABELS,
  formatarData,
  formatarDataEncomenda,
  passosEncomenda,
  podeCancelarEncomenda,
  totaisEncomenda,
} from "@/lib/encomendas"
import { CancelarEncomenda } from "./cancelar-encomenda"
import { Cartao, Valores } from "./cartao"
import { CartaoPagamentoRecebido, CartaoPagarAgora } from "./cartao-pagamento"
import { EstadoBadge } from "./estado-badge"
import { LinhaDoTempo } from "./linha-do-tempo"
import { LinhasEncomenda } from "./linhas-encomenda"
import { PagarAgora } from "./pagar-agora"

export type EncomendaDetalheVista = NonNullable<
  FunctionReturnType<typeof api.encomendas.obter>
>

/**
 * Order page body: header with Cancelar while allowed, then the timeline,
 * payment and lines, with the order's details in a side column on wide
 * screens. A payable order gets the floating "Pagar agora" pill, which opens
 * Revolut's Pay by Bank window over this page.
 */
export function EncomendaDetalhe({
  encomenda,
  agora,
  onCancelar,
  aCancelar,
  erro,
}: {
  encomenda: EncomendaDetalheVista
  agora: number
  onCancelar: () => Promise<boolean>
  aCancelar: boolean
  erro: string | null
}) {
  const [confirmar, setConfirmar] = useState(false)
  const passos = passosEncomenda(encomenda)
  const { total } = totaisEncomenda(encomenda)
  const cancelada = encomenda.estado === "cancelada"
  const podeCancelar = podeCancelarEncomenda(encomenda.estado)
  const token = encomenda.pagamentoToken
  const pagavel = encomenda.revolutToken !== undefined
  const assunto = encodeURIComponent(`Encomenda ENC-${encomenda.numero}`)

  // The webhook moves the order to `paga` while the page is open (usually
  // right after the Revolut window closes), and the desk's last receção to
  // `pronta_a_levantar`: say so once.
  const estadoAnterior = useRef(encomenda.estado)
  useEffect(() => {
    if (
      estadoAnterior.current === "aguardando_pagamento" &&
      encomenda.estado === "paga"
    ) {
      toast.success("Pagamento recebido.")
    }
    if (
      estadoAnterior.current === "paga" &&
      encomenda.estado === "pronta_a_levantar"
    ) {
      toast.success("A encomenda está pronta a levantar.")
    }
    estadoAnterior.current = encomenda.estado
  }, [encomenda.estado])

  return (
    <>
      <CabecalhoPagina
        voltar={{ to: "/encomendas", label: "Encomendas" }}
        titulo={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            ENC-{encomenda.numero}
            <EstadoBadge estado={encomenda.estado} tamanho="md" />
          </span>
        }
        descricao={formatarDataEncomenda(encomenda.placedAt)}
        acoes={
          podeCancelar && (
            <Button variant="outline" onClick={() => setConfirmar(true)}>
              Cancelar
            </Button>
          )
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <section className="rounded-xl border bg-card px-5 py-4 sm:py-5">
            <LinhaDoTempo passos={passos} />
          </section>

          {token && (
            <CartaoPagarAgora
              token={token}
              totalCents={total}
              expiraEm={encomenda.paymentExpiresAt}
              agora={agora}
            />
          )}
          {encomenda.paidAt && !cancelada && (
            <CartaoPagamentoRecebido
              paidAt={encomenda.paidAt}
              totalCents={total}
            />
          )}

          <LinhasEncomenda
            linhas={encomenda.linhas}
            totais={encomenda}
            levantada={encomenda.levantadaAt !== undefined}
          />
        </div>

        <Cartao titulo="Detalhes" className="lg:sticky lg:top-8">
          <Valores
            itens={[
              { label: "Submetida", valor: formatarData(encomenda.placedAt) },
              cancelada &&
                encomenda.cancelReason !== undefined && {
                  label: "Motivo",
                  valor: MOTIVO_CANCELAMENTO_LABELS[encomenda.cancelReason],
                },
              {
                label: "Levantamento",
                valor: (
                  <a
                    href={MAPS_ARMAZEM}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {MORADA_ARMAZEM.rua}, {MORADA_ARMAZEM.localidade}
                  </a>
                ),
              },
              {
                label: "Contacto",
                valor: (
                  <a
                    href={`mailto:${EMAIL_GERAL}?subject=${assunto}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {EMAIL_GERAL}
                  </a>
                ),
              },
            ]}
          />
        </Cartao>
      </div>

      {/* Room for the floating pill so it never covers the last card. */}
      {pagavel && <div aria-hidden className="h-12" />}
      <PagarAgora
        aberto={pagavel}
        revolutToken={encomenda.revolutToken}
        totalCents={total}
      />

      {podeCancelar && (
        <CancelarEncomenda
          numero={encomenda.numero}
          aberto={confirmar}
          onAbertoChange={setConfirmar}
          onConfirmar={() =>
            void onCancelar().then((ok) => ok && setConfirmar(false))
          }
          aCancelar={aCancelar}
          erro={erro}
        />
      )}
    </>
  )
}

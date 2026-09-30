import { useState } from "react"
import { Link } from "@tanstack/react-router"
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

export type EncomendaDetalheVista = NonNullable<
  FunctionReturnType<typeof api.encomendas.obter>
>

/**
 * Order page body. The header carries the one thing to do (Pagar, and
 * Cancelar while allowed); below it the timeline, payment and lines, with the
 * order's details in a side column on wide screens.
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
  const assunto = encodeURIComponent(`Encomenda ENC-${encomenda.numero}`)

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
          (podeCancelar || token) && (
            <>
              {podeCancelar && (
                <Button variant="outline" onClick={() => setConfirmar(true)}>
                  Cancelar
                </Button>
              )}
              {token && (
                <Button
                  render={<Link to="/pagamento/$token" params={{ token }} />}
                  nativeButton={false}
                >
                  Pagar
                </Button>
              )}
            </>
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

          <LinhasEncomenda linhas={encomenda.linhas} totais={encomenda} />
        </div>

        <Cartao titulo="Detalhes" className="lg:sticky lg:top-8">
          <Valores
            itens={[
              { label: "Submetida", valor: formatarData(encomenda.placedAt) },
              cancelada &&
                encomenda.cancelReason !== undefined && {
                  label: "Cancelada",
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

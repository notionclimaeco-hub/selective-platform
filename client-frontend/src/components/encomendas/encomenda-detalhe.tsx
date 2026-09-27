import { useState } from "react"
import { Link } from "@tanstack/react-router"
import type { FunctionReturnType } from "convex/server"
import { Mail } from "lucide-react"

import type { api } from "@convex/_generated/api"
import { CabecalhoPagina } from "@/components/shell/pagina"
import { Button } from "@/components/ui/button"
import { eurExato } from "@/lib/catalogo"
import {
  ESTADO_ENCOMENDA_TEXTO,
  MOTIVO_CANCELAMENTO_LABELS,
  formatarDataEncomenda,
  passosEncomenda,
  podeCancelarEncomenda,
  totaisEncomenda,
} from "@/lib/encomendas"
import { CartaoPagamentoRecebido, CartaoPagarAgora } from "./cartao-pagamento"
import { EstadoBadge } from "./estado-badge"
import { LinhaDoTempo } from "./linha-do-tempo"
import { LinhasEncomenda } from "./linhas-encomenda"

export type EncomendaDetalheVista = NonNullable<
  FunctionReturnType<typeof api.encomendas.obter>
>

/**
 * Order page body. Reads top-down as "where is it, what do I have to do,
 * what is in it": timeline → action card → lines, with the summary and the
 * cancel action in a side column on wide screens.
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
  onCancelar: () => void
  aCancelar: boolean
  erro: string | null
}) {
  const passos = passosEncomenda(encomenda)
  const { total } = totaisEncomenda(encomenda)
  const cancelada = encomenda.estado === "cancelada"

  return (
    <>
      <CabecalhoPagina
        voltar={{ to: "/encomendas", label: "Encomendas" }}
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            ENC-{encomenda.numero}
            <EstadoBadge estado={encomenda.estado} tamanho="md" />
          </span>
        }
        descricao={`Submetida em ${formatarDataEncomenda(encomenda.placedAt)}`}
      />

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <LinhaDoTempo passos={passos} />
        <p className="mt-5 border-t pt-4 text-sm text-muted-foreground">
          {cancelada && encomenda.cancelReason
            ? MOTIVO_CANCELAMENTO_LABELS[encomenda.cancelReason]
            : ESTADO_ENCOMENDA_TEXTO[encomenda.estado]}
        </p>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {encomenda.estado === "aguardando_pagamento" &&
            encomenda.pagamentoToken && (
              <CartaoPagarAgora
                token={encomenda.pagamentoToken}
                totalCents={total}
                expiraEm={encomenda.paymentExpiresAt}
                agora={agora}
              />
            )}
          {encomenda.paidAt && !cancelada && (
            <CartaoPagamentoRecebido paidAt={encomenda.paidAt} />
          )}

          <LinhasEncomenda linhas={encomenda.linhas} totais={encomenda} />
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold">Resumo</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Item rotulo="Total c/IVA" valor={eurExato.format(total / 100)} />
              <Item
                rotulo="Referências"
                valor={String(
                  encomenda.linhas.filter((l) => l.estadoLinha !== "retirada")
                    .length
                )}
              />
              <Item rotulo="Preços" valor="Congelados ao submeter" />
              <Item rotulo="Levantamento" valor="Armazém Clima Eco" />
            </dl>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold">
              {cancelada
                ? "Dúvidas sobre esta encomenda?"
                : "Precisa de alterar algo?"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {cancelada
                ? "Fale com o escritório — podemos voltar a lançar a encomenda com preços actualizados."
                : "Alterações às quantidades ou às referências fazem-se com o escritório."}
            </p>
            <a
              href={`mailto:geral@climaeco.pt?subject=${encodeURIComponent(`Encomenda ENC-${encomenda.numero}`)}`}
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <Mail className="size-4" /> geral@climaeco.pt
            </a>
          </section>

          {podeCancelarEncomenda(encomenda.estado) && (
            <Cancelar
              onCancelar={onCancelar}
              aCancelar={aCancelar}
              erro={erro}
            />
          )}

          {cancelada && (
            <Button
              render={<Link to="/produtos" />}
              nativeButton={false}
              variant="outline"
            >
              Voltar ao catálogo
            </Button>
          )}
        </aside>
      </div>
    </>
  )
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right font-medium tabular-nums">{valor}</dd>
    </div>
  )
}

/** Two-step cancel: the destructive button turns into an inline confirmation. */
function Cancelar({
  onCancelar,
  aCancelar,
  erro,
}: {
  onCancelar: () => void
  aCancelar: boolean
  erro: string | null
}) {
  const [confirmar, setConfirmar] = useState(false)

  if (!confirmar) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setConfirmar(true)}
          className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-destructive hover:underline"
        >
          Cancelar encomenda
        </button>
        {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <h2 className="text-sm font-semibold">Cancelar esta encomenda?</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Os preços congelados perdem-se e terá de submeter uma nova encomenda a
        partir do catálogo. Esta acção não pode ser desfeita.
      </p>
      <div className="mt-4 flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={aCancelar}
          onClick={onCancelar}
        >
          {aCancelar ? "A cancelar…" : "Sim, cancelar"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={aCancelar}
          onClick={() => setConfirmar(false)}
        >
          Manter
        </Button>
      </div>
      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
    </section>
  )
}

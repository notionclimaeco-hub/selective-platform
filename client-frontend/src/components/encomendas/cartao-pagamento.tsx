import { Copy } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { eurExato } from "@/lib/catalogo"
import { formatarData, prazoRelativo } from "@/lib/encomendas"
import { Cartao, Valores } from "./cartao"

/**
 * Payment while `aguardando_pagamento`: amount, the link's expiry and a copy
 * button, so whoever pays at the company can get the link. The Pagar button
 * itself is the page header's primary action.
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
  async function copiar() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/pagamento/${token}`
      )
      toast.success("Link copiado.")
    } catch {
      toast.error("Não foi possível copiar o link.")
    }
  }

  return (
    <Cartao
      titulo="Pagamento"
      direita={
        <Button variant="outline" size="sm" onClick={() => void copiar()}>
          <Copy data-icon="inline-start" />
          Copiar link
        </Button>
      }
    >
      <Valores
        itens={[
          {
            label: "Total a pagar",
            valor: (
              <span className="font-semibold tabular-nums">
                {eurExato.format(totalCents / 100)}
              </span>
            ),
          },
          {
            label: "Método",
            valor: "Transferência bancária",
          },
          expiraEm !== undefined && {
            label: "Link válido até",
            valor: (
              <>
                {formatarData(expiraEm)}
                <span className="text-muted-foreground">
                  {" "}
                  · {prazoRelativo(expiraEm, agora)}
                </span>
              </>
            ),
          },
        ]}
      />
    </Cartao>
  )
}

export function CartaoPagamentoRecebido({
  paidAt,
  totalCents,
}: {
  paidAt: number
  totalCents: number
}) {
  return (
    <Cartao
      titulo="Pagamento"
      direita={<span className="font-medium text-primary">Recebido</span>}
    >
      <Valores
        itens={[
          {
            label: "Total pago",
            valor: (
              <span className="font-semibold tabular-nums">
                {eurExato.format(totalCents / 100)}
              </span>
            ),
          },
          { label: "Pago em", valor: formatarData(paidAt) },
        ]}
      />
    </Cartao>
  )
}

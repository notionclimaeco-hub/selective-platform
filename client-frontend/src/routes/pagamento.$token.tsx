import { useEffect, useRef, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import type { PaymentsModulePayByBankInstance } from "@revolut/checkout/types/types"

import { api } from "@convex/_generated/api"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { Button } from "@/components/ui/button"
import { eurExato, rotuloMarca } from "@/lib/catalogo"
import {
  MOTIVO_CANCELAMENTO_LABELS,
  formatarDataEncomenda,
} from "@/lib/encomendas"

/**
 * Merchant-hosted payment page (#8): no login, the token is the credential.
 * Pay by Bank only, via the Revolut payments module. The widget callbacks
 * update this page; the order becomes `paga` from the signed webhook, which
 * this reactive query then reflects.
 */
export const Route = createFileRoute("/pagamento/$token")({
  component: PagamentoPage,
})

type Fase = "pronto" | "a_abrir" | "aberto" | "erro" | "cancelado"

function PagamentoPage() {
  const { token } = Route.useParams()
  const pagamento = useQuery(api.pagamentos.porToken, { token })

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
        {pagamento === undefined ? (
          <p className="text-sm text-muted-foreground">A carregar…</p>
        ) : pagamento === null ? (
          <LinkInvalido />
        ) : (
          <Pagamento pagamento={pagamento} />
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

function LinkInvalido() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="text-lg font-semibold tracking-tight">
        Link de pagamento inválido
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Este link não corresponde a nenhuma encomenda. Confirme o link na sua
        área de cliente ou contacte-nos.
      </p>
      <Button
        render={<Link to="/conta/encomendas" />}
        nativeButton={false}
        variant="outline"
        className="mt-4"
      >
        Ir para as encomendas
      </Button>
    </section>
  )
}

type Vista = NonNullable<FunctionReturnType<typeof api.pagamentos.porToken>>

function Pagamento({ pagamento }: { pagamento: Vista }) {
  const totalIva = pagamento.totalPagamentoCents ?? 0
  const iva = totalIva - pagamento.totalRevendaCents

  return (
    <>
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          Pagamento
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {pagamento.titulo}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {pagamento.empresa}
        </p>
      </div>

      <Estado pagamento={pagamento} />

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <ul className="divide-y">
          {pagamento.linhas.map((linha) => (
            <li
              key={linha.ref}
              className="flex items-start justify-between gap-4 px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{linha.nome}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {rotuloMarca(linha.marca)} · {linha.ref} · {linha.qty} ×{" "}
                  {eurExato.format(linha.precoRevendaCents / 100)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {eurExato.format((linha.precoRevendaCents * linha.qty) / 100)}
              </p>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t px-4 py-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>Subtotal (s/IVA)</dt>
            <dd className="tabular-nums">
              {eurExato.format(pagamento.totalRevendaCents / 100)}
            </dd>
          </div>
          {pagamento.totalPagamentoCents !== undefined && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <dt>IVA ({pagamento.ivaPercent}%)</dt>
                <dd className="tabular-nums">{eurExato.format(iva / 100)}</dd>
              </div>
              <div className="flex justify-between pt-1 text-base font-semibold">
                <dt>Total a pagar</dt>
                <dd className="text-primary tabular-nums">
                  {eurExato.format(totalIva / 100)}
                </dd>
              </div>
            </>
          )}
        </dl>
      </section>

      <p className="text-sm text-muted-foreground">
        A fatura-recibo é emitida automaticamente após a confirmação do
        pagamento e fica disponível na área de cliente.
      </p>
    </>
  )
}

function Estado({ pagamento }: { pagamento: Vista }) {
  if (pagamento.estado === "aguardando_pagamento" && pagamento.revolutToken) {
    return (
      <PagarPorBanco
        revolutToken={pagamento.revolutToken}
        expiraEm={pagamento.paymentExpiresAt}
      />
    )
  }
  const { titulo, texto } = textoEstado(pagamento)
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{texto}</p>
    </section>
  )
}

function textoEstado(p: Vista): { titulo: string; texto: string } {
  switch (p.estado) {
    case "paga":
    case "concluida":
      return {
        titulo: "Pagamento recebido",
        texto: `Obrigado. Recebemos o pagamento${p.paidAt ? ` em ${formatarDataEncomenda(p.paidAt)}` : ""}. Vamos encomendar aos fornecedores e avisamos quando o equipamento estiver no armazém.`,
      }
    case "cancelada":
      return {
        titulo: "Encomenda cancelada",
        texto: p.cancelReason
          ? MOTIVO_CANCELAMENTO_LABELS[p.cancelReason]
          : "Esta encomenda foi cancelada e já não pode ser paga.",
      }
    default:
      return {
        titulo: "Pagamento ainda não disponível",
        texto:
          "O escritório está a rever esta encomenda. Quando o valor final estiver fechado, este link volta a ficar activo.",
      }
  }
}

function PagarPorBanco({
  revolutToken,
  expiraEm,
}: {
  revolutToken: string
  expiraEm?: number
}) {
  const [fase, setFase] = useState<Fase>("pronto")
  const [erro, setErro] = useState<string | null>(null)
  const instancia = useRef<PaymentsModulePayByBankInstance | null>(null)

  useEffect(() => () => instancia.current?.destroy(), [])

  async function pagar() {
    setErro(null)
    setFase("a_abrir")
    try {
      const publicToken = import.meta.env.VITE_REVOLUT_PUBLIC_KEY as
        string | undefined
      if (!publicToken) throw new Error("VITE_REVOLUT_PUBLIC_KEY em falta")
      const mode =
        import.meta.env.VITE_REVOLUT_MODE === "sandbox" ? "sandbox" : "prod"
      const { default: RevolutCheckout } = await import("@revolut/checkout")
      const { payByBank } = await RevolutCheckout.payments({
        publicToken,
        mode,
        locale: "pt",
      })
      instancia.current?.destroy()
      instancia.current = payByBank({
        // The Revolut order already exists (created when the office asked
        // for payment); the widget only needs its public token.
        createOrder: async () => ({ publicId: revolutToken }),
        location: "PT",
        onSuccess: () => setFase("aberto"),
        onError: ({ error }) => {
          setErro(error.message)
          setFase("erro")
        },
        onCancel: () => setFase("cancelado"),
      })
      instancia.current.show()
      setFase("aberto")
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível abrir o pagamento."
      )
      setFase("erro")
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">
        Pagar por transferência bancária
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Escolha o seu banco e autorize a transferência na app ou no homebanking.
        Sem cartão, sem taxas adicionais.
        {expiraEm && ` Link válido até ${formatarDataEncomenda(expiraEm)}.`}
      </p>
      <Button
        className="mt-4"
        size="lg"
        disabled={fase === "a_abrir"}
        onClick={() => void pagar()}
      >
        {fase === "a_abrir" ? "A abrir…" : "Pagar com o meu banco"}
      </Button>
      {fase === "aberto" && (
        <p className="mt-3 text-sm text-muted-foreground">
          Assim que o banco confirmar a transferência, esta página actualiza
          automaticamente. Pode demorar alguns segundos.
        </p>
      )}
      {fase === "cancelado" && (
        <p className="mt-3 text-sm text-muted-foreground">
          Pagamento cancelado. Pode tentar de novo.
        </p>
      )}
      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
    </section>
  )
}

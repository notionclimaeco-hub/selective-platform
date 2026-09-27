import { useEffect, useRef, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import type { PaymentsModulePayByBankInstance } from "@revolut/checkout/types/types"
import {
  CheckCircle2,
  Clock,
  Landmark,
  Receipt,
  ShieldCheck,
  XCircle,
} from "lucide-react"

import { api } from "@convex/_generated/api"
import { LinhasEncomenda } from "@/components/encomendas/linhas-encomenda"
import { Button } from "@/components/ui/button"
import { eurExato } from "@/lib/catalogo"
import {
  MOTIVO_CANCELAMENTO_LABELS,
  formatarDataEncomenda,
  prazoRelativo,
} from "@/lib/encomendas"
import { cn } from "@/lib/utils"

/**
 * Merchant-hosted payment page (#8): no login, the token is the credential.
 * Pay by Bank only, via the Revolut payments module. The widget callbacks
 * update this page; the order becomes `paga` from the signed webhook, which
 * this reactive query then reflects.
 */
export const Route = createFileRoute("/_minimal/pagamento/$token")({
  component: PagamentoPage,
})

type Fase = "pronto" | "a_abrir" | "aberto" | "erro" | "cancelado"

function PagamentoPage() {
  const { token } = Route.useParams()
  const pagamento = useQuery(api.pagamentos.porToken, { token })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      {pagamento === undefined ? (
        <Esqueleto />
      ) : pagamento === null ? (
        <LinkInvalido />
      ) : (
        <Pagamento pagamento={pagamento} />
      )}
    </div>
  )
}

function LinkInvalido() {
  return (
    <section className="mx-auto w-full max-w-xl rounded-xl border bg-card p-6">
      <h1 className="text-lg font-semibold tracking-tight">
        Link de pagamento inválido
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Este link não corresponde a nenhuma encomenda. Confirme o link na sua
        área de cliente ou contacte-nos.
      </p>
      <Button
        render={<Link to="/encomendas" />}
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
  const [agora] = useState(() => Date.now())
  const pagavel =
    pagamento.estado === "aguardando_pagamento" && !!pagamento.revolutToken

  return (
    <>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <ShieldCheck className="size-3.5" /> Pagamento seguro
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Encomenda ENC-{pagamento.numero}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {pagamento.empresa}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
          <LinhasEncomenda
            linhas={pagamento.linhas}
            totais={pagamento}
            mostrarEstado={false}
          />
          <p className="text-sm text-muted-foreground">
            Preços de revenda congelados ao submeter a encomenda. IVA a{" "}
            {pagamento.ivaPercent}%. Dúvidas?{" "}
            <a
              href={`mailto:geral@climaeco.pt?subject=${encodeURIComponent(`Encomenda ENC-${pagamento.numero}`)}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              geral@climaeco.pt
            </a>
          </p>
        </div>

        <aside className="order-1 flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:order-2">
          {pagavel ? (
            <PagarPorBanco
              revolutToken={pagamento.revolutToken!}
              totalCents={pagamento.totalPagamentoCents ?? 0}
              expiraEm={pagamento.paymentExpiresAt}
              agora={agora}
            />
          ) : (
            <EstadoNaoPagavel pagamento={pagamento} />
          )}
          <Link
            to="/encomendas"
            className="text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Ver todas as encomendas na área de cliente
          </Link>
        </aside>
      </div>
    </>
  )
}

function EstadoNaoPagavel({ pagamento: p }: { pagamento: Vista }) {
  const { icon: Icon, tom, titulo, texto } = textoEstado(p)
  return (
    <section className={cn("rounded-xl border p-6", tom)}>
      <Icon className="size-8" />
      <h2 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
        {titulo}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{texto}</p>
      {p.totalPagamentoCents !== undefined && (
        <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
          Total{p.estado === "paga" || p.estado === "concluida" ? " pago" : ""}{" "}
          <span className="float-right font-semibold text-foreground tabular-nums">
            {eurExato.format(p.totalPagamentoCents / 100)}
          </span>
        </p>
      )}
    </section>
  )
}

function textoEstado(p: Vista): {
  icon: typeof CheckCircle2
  tom: string
  titulo: string
  texto: string
} {
  switch (p.estado) {
    case "paga":
    case "concluida":
      return {
        icon: CheckCircle2,
        tom: "border-emerald-200 bg-emerald-50/60 text-emerald-600",
        titulo: "Pagamento recebido",
        texto: `Obrigado. Recebemos o pagamento${p.paidAt ? ` em ${formatarDataEncomenda(p.paidAt)}` : ""}. Vamos encomendar aos fornecedores e avisamos quando o equipamento estiver no armazém.`,
      }
    case "cancelada":
      return {
        icon: XCircle,
        tom: "bg-card text-muted-foreground",
        titulo: "Encomenda cancelada",
        texto: p.cancelReason
          ? `${MOTIVO_CANCELAMENTO_LABELS[p.cancelReason]} Esta encomenda já não pode ser paga.`
          : "Esta encomenda foi cancelada e já não pode ser paga.",
      }
    default:
      return {
        icon: Clock,
        tom: "bg-card text-amber-600",
        titulo: "Pagamento ainda não disponível",
        texto:
          "O escritório está a rever esta encomenda. Quando o valor final estiver fechado, este link volta a ficar activo.",
      }
  }
}

function PagarPorBanco({
  revolutToken,
  totalCents,
  expiraEm,
  agora,
}: {
  revolutToken: string
  totalCents: number
  expiraEm?: number
  agora: number
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
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Total a pagar (c/IVA)</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-primary tabular-nums">
          {eurExato.format(totalCents / 100)}
        </p>
        {expiraEm && (
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-xl bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800 ring-1 ring-orange-600/20 ring-inset">
            <Clock className="size-3.5 shrink-0" />
            <span>Válido até {formatarDataEncomenda(expiraEm)}</span>
            <span>· {prazoRelativo(expiraEm, agora)}</span>
          </p>
        )}

        <Button
          className="mt-5 h-12 w-full text-base"
          size="lg"
          disabled={fase === "a_abrir"}
          onClick={() => void pagar()}
        >
          <Landmark data-icon="inline-start" />
          {fase === "a_abrir" ? "A abrir…" : "Pagar com o meu banco"}
        </Button>

        {fase === "aberto" && (
          <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
            Assim que o banco confirmar a transferência, esta página actualiza
            automaticamente. Pode demorar alguns segundos.
          </p>
        )}
        {fase === "cancelado" && (
          <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
            Pagamento cancelado. Pode tentar de novo quando quiser.
          </p>
        )}
        {erro && (
          <p className="mt-3 text-sm text-destructive" aria-live="polite">
            {erro}
          </p>
        )}
      </div>

      <ol className="space-y-2.5 border-t bg-secondary/40 px-6 py-4 text-sm">
        <PassoAjuda n={1}>Escolha o seu banco na janela que abre.</PassoAjuda>
        <PassoAjuda n={2}>
          Autorize a transferência na app ou no homebanking — sem cartão.
        </PassoAjuda>
        <PassoAjuda n={3}>
          <span className="inline-flex items-center gap-1.5">
            <Receipt className="size-3.5 text-primary" /> A fatura-recibo é
            emitida automaticamente.
          </span>
        </PassoAjuda>
      </ol>
    </section>
  )
}

function PassoAjuda({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-muted-foreground">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="h-16 w-64 animate-pulse rounded-xl bg-secondary/60" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="h-72 animate-pulse rounded-xl border bg-secondary/60" />
        <div className="h-64 animate-pulse rounded-xl border bg-secondary/60" />
      </div>
    </div>
  )
}

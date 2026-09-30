import { useState } from "react"
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router"
import { useMutation } from "convex/react"
import { FileText, LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { api } from "@convex/_generated/api"
import { LinhaOrcamento } from "@/components/orcamento/linha-orcamento"
import { useOrcamento } from "@/components/orcamento/orcamento-store"
import { PedidoEntrada } from "@/components/orcamento/pedido-entrada"
import {
  SucessoEncomenda,
  transitarParaSucesso,
} from "@/components/orcamento/sucesso-encomenda"
import type { Submetida } from "@/components/orcamento/sucesso-encomenda"
import { MAILTO_GERAL } from "@/components/shell/nav"
import { CabecalhoPagina, Pagina } from "@/components/shell/pagina"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { eurExato } from "@/lib/catalogo"
import { useEmpresaActiva } from "@/lib/empresa-activa"
import { mensagemErroSubmeter } from "@/lib/encomendas"
import { estadoCompra, totaisOrcamento } from "@/lib/orcamento"
import type { EstadoCompra } from "@/lib/orcamento"
import { useMapaPrecosPorRef } from "@/lib/precos-revenda"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_shell/orcamento")({
  component: OrcamentoPage,
})

/**
 * The quote list. Public in both shells: anyone builds it at PVP; only an
 * approved member submits it, which places an installer order (prices are
 * snapshotted by `encomendas.submeter`). Signing in is asked for at submit.
 */
function OrcamentoPage() {
  const { itens, hidratado } = useOrcamento()
  const [submetida, setSubmetida] = useState<Submetida | null>(null)

  if (submetida) return <SucessoEncomenda {...submetida} />

  return (
    <Pagina className="orcamento-lista">
      {!hidratado ? (
        <>
          <CabecalhoPagina titulo="Orçamento" />
          <Skeleton className="h-64 rounded-xl" />
        </>
      ) : itens.length === 0 ? (
        <>
          <CabecalhoPagina titulo="Orçamento" />
          <Vazia />
        </>
      ) : (
        <ListaOrcamento onSubmetida={setSubmetida} />
      )}
    </Pagina>
  )
}

function ListaOrcamento({
  onSubmetida,
}: {
  onSubmetida: (s: Submetida) => void
}) {
  const { itens, definirQuantidade, remover, limpar, repor } = useOrcamento()
  const { userId } = useRouteContext({ from: "__root__" })
  const { vista, orgActiva } = useEmpresaActiva(Boolean(userId))
  const estado = estadoCompra(Boolean(userId), vista)
  const revenda = useMapaPrecosPorRef(itens.map((i) => i.ref))
  const totais = totaisOrcamento(itens, revenda)

  const submeter = useMutation(api.encomendas.submeter)
  const [pedidoAberto, setPedidoAberto] = useState(false)
  const [aSubmeter, setASubmeter] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function onSubmeter() {
    setErro(null)
    setASubmeter(true)
    try {
      const { encomendaId, numero } = await submeter({
        linhas: itens.map((i) => ({ ref: i.ref, qty: i.quantidade })),
      })
      transitarParaSucesso(() => {
        onSubmetida({ encomendaId, numero, totalCents: totais.totalCents })
        limpar()
      })
    } catch (error) {
      setErro(mensagemErroSubmeter(error))
      // Only on failure: on success the list unmounts, and resetting first
      // would flash the idle button into the transition's old snapshot.
      setASubmeter(false)
    }
  }

  function removerComReverter(ref: string) {
    const antes = itens
    remover(ref)
    toast(`${ref} removido.`, {
      action: { label: "Reverter", onClick: () => repor(antes) },
    })
  }

  function limparComReverter() {
    const antes = itens
    limpar()
    toast("Lista limpa.", {
      action: { label: "Reverter", onClick: () => repor(antes) },
    })
  }

  const botao = (className?: string) => (
    <BotaoPrincipal
      estado={estado}
      orgActiva={orgActiva}
      aSubmeter={aSubmeter}
      onEntrar={() => setPedidoAberto(true)}
      onSubmeter={() => void onSubmeter()}
      className={className}
    />
  )
  const eRevenda = revenda !== null
  const aviso = nota(estado, erro)

  return (
    <>
      <CabecalhoPagina
        titulo="Orçamento"
        acoes={
          <Button
            variant="ghost"
            size="sm"
            className="-mr-2 text-muted-foreground"
            onClick={limparComReverter}
          >
            Limpar lista
          </Button>
        }
      />

      {/* Room for the phone bar under the last line. */}
      <div className="grid items-start gap-4 pb-[calc(var(--altura-barra-orcamento)+var(--folga-fundo))] md:pb-0 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
        <section
          aria-label="Equipamentos"
          className="overflow-hidden rounded-xl border bg-card"
        >
          <ul className="divide-y">
            {itens.map((item) => (
              <LinhaOrcamento
                key={item.ref}
                item={item}
                unitCents={revenda?.get(item.ref) ?? item.pvpCents}
                onQuantidade={(q) => definirQuantidade(item.ref, q)}
                onRemover={() => removerComReverter(item.ref)}
              />
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="resumo-titulo"
          className="rounded-xl border bg-card lg:sticky lg:top-8"
        >
          <div className="flex min-h-14 items-center justify-between gap-4 border-b px-5">
            <h2 id="resumo-titulo" className="text-sm font-semibold">
              Resumo
            </h2>
            <span className="text-sm text-muted-foreground tabular-nums">
              {itens.length} {itens.length === 1 ? "ref." : "refs."} ·{" "}
              {totais.unidades} un.
            </span>
          </div>
          <dl className="flex flex-col gap-1 px-5 py-4">
            <dt className="text-sm text-muted-foreground">
              {eRevenda
                ? "Total revenda (s/IVA)"
                : "Total indicativo (PVP s/IVA)"}
            </dt>
            <dd className="flex flex-wrap items-baseline gap-x-2.5">
              <span className="text-2xl font-semibold tracking-tight text-primary tabular-nums">
                {eurExato.format(totais.totalCents / 100)}
              </span>
              {eRevenda && totais.pvpCents !== totais.totalCents && (
                <span className="text-sm text-muted-foreground tabular-nums line-through">
                  <span className="sr-only">PVP </span>
                  {eurExato.format(totais.pvpCents / 100)}
                </span>
              )}
            </dd>
          </dl>
          {/* Phones submit from the bottom bar; the card keeps only the note. */}
          <div
            className={cn(
              "flex-col gap-3 px-5 pb-5",
              aviso ? "flex" : "hidden md:flex"
            )}
          >
            {botao("hidden w-full md:inline-flex")}
            {aviso}
          </div>
        </section>
      </div>

      <div
        data-barra-orcamento
        className="orcamento-barra fixed inset-x-0 bottom-[var(--barra-fundo)] z-30 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+var(--folga-fundo))] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              {eRevenda ? "Total revenda s/IVA" : "Total PVP s/IVA"}
            </p>
            <p className="font-semibold tabular-nums">
              {eurExato.format(totais.totalCents / 100)}
            </p>
          </div>
          {botao("shrink-0")}
        </div>
      </div>

      <PedidoEntrada aberto={pedidoAberto} onAbertoChange={setPedidoAberto} />
    </>
  )
}

/** The primary action for the visitor's state (see `estadoCompra`). */
function BotaoPrincipal({
  estado,
  orgActiva,
  aSubmeter,
  onEntrar,
  onSubmeter,
  className,
}: {
  estado: EstadoCompra
  // `submeter` needs the company org in the Convex JWT; disabled until then.
  orgActiva: boolean
  aSubmeter: boolean
  onEntrar: () => void
  onSubmeter: () => void
  className?: string
}) {
  const props = { size: "lg" as const, className }
  switch (estado) {
    case "anonimo":
      return (
        <Button {...props} onClick={onEntrar}>
          Entrar para encomendar
        </Button>
      )
    case "a-carregar":
      return (
        <Button {...props} disabled>
          A carregar…
        </Button>
      )
    case "registo":
      return (
        <Button
          {...props}
          render={<Link to="/registo" search={{ return: "/orcamento" }} />}
          nativeButton={false}
        >
          Completar o registo da empresa
        </Button>
      )
    case "pendente":
      return (
        <Button {...props} disabled>
          Empresa em aprovação
        </Button>
      )
    case "rejeitada":
    case "suspensa":
      return (
        <Button
          {...props}
          variant="outline"
          render={<a href={MAILTO_GERAL} />}
          nativeButton={false}
        >
          Contactar a Climaeco
        </Button>
      )
    case "aprovada":
      return (
        <Button
          {...props}
          disabled={aSubmeter || !orgActiva}
          onClick={onSubmeter}
        >
          {aSubmeter && <LoaderCircle className="animate-spin" />}
          {aSubmeter
            ? "A submeter…"
            : orgActiva
              ? "Submeter encomenda"
              : "A activar a empresa…"}
        </Button>
      )
  }
}

/** One line under the action: why it is locked, or what submitting does. */
function nota(estado: EstadoCompra, erro: string | null) {
  if (erro) {
    return <p className="text-xs text-destructive">{erro}</p>
  }
  switch (estado) {
    case "pendente":
      return (
        <p className="text-xs text-muted-foreground">
          Pode submeter depois de a Climaeco aprovar a empresa.
        </p>
      )
    case "rejeitada":
      return <p className={cn(AVISO, ERRO)}>Pedido de aprovação rejeitado.</p>
    case "suspensa":
      return (
        <p className={cn(AVISO, ERRO)}>
          Empresa suspensa: novas encomendas bloqueadas.
        </p>
      )
    case "aprovada":
      return (
        <p className="text-xs text-muted-foreground">
          Os preços de revenda ficam congelados ao submeter.
        </p>
      )
    default:
      return null
  }
}

const AVISO = "rounded-lg border px-3 py-2 text-xs"
const ERRO = "border-destructive/30 bg-destructive/10 text-destructive"

function Vazia() {
  return (
    <section className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
        <FileText className="size-5" />
      </div>
      <p className="font-medium">A lista está vazia</p>
      <Button render={<Link to="/produtos" />} nativeButton={false}>
        Ver catálogo
      </Button>
    </section>
  )
}

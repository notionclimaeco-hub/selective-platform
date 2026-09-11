import { Show } from "@clerk/tanstack-react-start"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Authenticated, usePaginatedQuery } from "convex/react"
import { ChevronRight } from "lucide-react"

import { api } from "@convex/_generated/api"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { Button } from "@/components/ui/button"
import { eurExato } from "@/lib/catalogo"
import { useEmpresaActiva } from "@/lib/empresa-activa"
import {
  ESTADO_ENCOMENDA_CLASSES,
  ESTADO_ENCOMENDA_LABELS,
  formatarDataEncomenda,
} from "@/lib/encomendas"

// `conta_.` keeps this a sibling of /conta (flat route), not a child rendered
// inside the account page.
export const Route = createFileRoute("/conta_/encomendas")({
  component: EncomendasPage,
})

function EncomendasPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Área de Cliente
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Encomendas
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <Link
              to="/conta"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Conta
            </Link>
            <span aria-hidden> · </span>
            Encomendas
          </p>
        </div>
        <Show when="signed-out">
          <p className="text-sm text-muted-foreground">A redirecionar…</p>
        </Show>
        <Show when="signed-in">
          <Authenticated>
            <Lista />
          </Authenticated>
        </Show>
      </main>
      <SiteFooter />
    </div>
  )
}

function Lista() {
  const { vista, orgActiva, activacaoFalhou } = useEmpresaActiva()
  const aprovada =
    vista?.kind === "empresa" && vista.empresa.estadoAprovacao === "aprovada"
  // `minhas` needs the org in the JWT; wait for the active org to match.
  const { results, status, loadMore } = usePaginatedQuery(
    api.encomendas.minhas,
    aprovada && orgActiva ? {} : "skip",
    { initialNumItems: 20 },
  )

  if (vista === undefined) {
    return <p className="text-sm text-muted-foreground">A carregar…</p>
  }
  if (vista?.kind === "empresa" && aprovada && !orgActiva) {
    return activacaoFalhou ? (
      <Aviso>
        Não foi possível activar a organização da empresa nesta sessão. Use o
        seletor de organização em{" "}
        <Link to="/conta" className="font-medium text-primary underline-offset-4 hover:underline">
          Conta
        </Link>
        .
      </Aviso>
    ) : (
      <p className="text-sm text-muted-foreground">A activar a empresa…</p>
    )
  }
  if (vista?.kind !== "empresa") {
    return (
      <Aviso>
        Complete o registo da empresa para submeter encomendas.{" "}
        <Link to="/registo" className="font-medium text-primary underline-offset-4 hover:underline">
          Registar empresa
        </Link>
      </Aviso>
    )
  }
  if (!aprovada) {
    return (
      <Aviso>
        As encomendas ficam disponíveis depois da aprovação comercial. O
        estado do pedido está em{" "}
        <Link to="/conta" className="font-medium text-primary underline-offset-4 hover:underline">
          Conta
        </Link>
        .
      </Aviso>
    )
  }
  if (status === "LoadingFirstPage") {
    return <p className="text-sm text-muted-foreground">A carregar…</p>
  }
  if (results.length === 0) {
    return (
      <Aviso>
        Ainda não há encomendas. Adicione equipamentos à lista de orçamento e
        submeta a partir do{" "}
        <Link to="/produtos" className="font-medium text-primary underline-offset-4 hover:underline">
          catálogo
        </Link>
        .
      </Aviso>
    )
  }

  return (
    <>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {results.map((encomenda) => (
          <li key={encomenda._id}>
            <Link
              to="/conta/encomendas/$id"
              params={{ id: encomenda._id }}
              className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{encomenda.titulo}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {formatarDataEncomenda(encomenda.placedAt)} ·{" "}
                  {encomenda.nLinhas}{" "}
                  {encomenda.nLinhas === 1 ? "linha" : "linhas"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="hidden text-sm tabular-nums text-muted-foreground sm:inline">
                  {eurExato.format(encomenda.totalRevendaCents / 100)}
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_ENCOMENDA_CLASSES[encomenda.estado]}`}
                >
                  {ESTADO_ENCOMENDA_LABELS[encomenda.estado]}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" && (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => loadMore(20)}
        >
          Carregar mais
        </Button>
      )}
    </>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
      {children}
    </p>
  )
}

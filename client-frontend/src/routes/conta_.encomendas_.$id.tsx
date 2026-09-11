import { useState } from "react"
import { Show } from "@clerk/tanstack-react-start"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Authenticated, useMutation, useQuery } from "convex/react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { Button } from "@/components/ui/button"
import { eurExato, rotuloMarca } from "@/lib/catalogo"
import { useEmpresaActiva } from "@/lib/empresa-activa"
import {
  ESTADO_ENCOMENDA_CLASSES,
  ESTADO_ENCOMENDA_LABELS,
  ESTADO_ENCOMENDA_TEXTO,
  ESTADO_LINHA_LABELS,
  MOTIVO_CANCELAMENTO_LABELS,
  formatarDataEncomenda,
  podeCancelarEncomenda,
} from "@/lib/encomendas"

export const Route = createFileRoute("/conta_/encomendas_/$id")({
  component: EncomendaPage,
})

function EncomendaPage() {
  const { id } = Route.useParams()

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
        <Show when="signed-out">
          <p className="text-sm text-muted-foreground">A redirecionar…</p>
        </Show>
        <Show when="signed-in">
          <Authenticated>
            {/* Convex validates the id; a malformed one yields null → "não encontrada". */}
            <Detalhe id={id as Id<"installerOrders">} />
          </Authenticated>
        </Show>
      </main>
      <SiteFooter />
    </div>
  )
}

function Detalhe({ id }: { id: Id<"installerOrders"> }) {
  const { vista, orgActiva, activacaoFalhou } = useEmpresaActiva()
  // `obter` returns null without the org in the JWT — don't show "não
  // encontrada" while the active org is still being switched.
  const encomenda = useQuery(
    api.encomendas.obter,
    orgActiva ? { encomendaId: id } : "skip",
  )
  const cancelar = useMutation(api.encomendas.cancelar)
  const [aCancelar, setACancelar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (vista !== undefined && vista?.kind !== "empresa") {
    return (
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Complete o registo da empresa para ver encomendas.
        </p>
      </section>
    )
  }
  if (!orgActiva && activacaoFalhou) {
    return (
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Não foi possível activar a organização da empresa nesta sessão. Use o
          seletor de organização em{" "}
          <Link to="/conta" className="font-medium text-primary underline-offset-4 hover:underline">
            Conta
          </Link>
          .
        </p>
      </section>
    )
  }
  if (encomenda === undefined) {
    return <p className="text-sm text-muted-foreground">A carregar…</p>
  }
  if (encomenda === null) {
    return (
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight">
          Encomenda não encontrada
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta encomenda não existe ou não pertence à sua empresa.
        </p>
        <Button
          render={<Link to="/conta/encomendas" />}
          nativeButton={false}
          variant="outline"
          className="mt-4"
        >
          Voltar às encomendas
        </Button>
      </section>
    )
  }

  async function onCancelar() {
    if (
      !window.confirm(
        "Cancelar esta encomenda? Esta acção não pode ser desfeita.",
      )
    ) {
      return
    }
    setErro(null)
    setACancelar(true)
    try {
      await cancelar({ encomendaId: id })
    } catch {
      setErro("Não foi possível cancelar a encomenda. Tente novamente.")
    } finally {
      setACancelar(false)
    }
  }

  return (
    <>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Área de Cliente
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {encomenda.titulo}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <Link
            to="/conta/encomendas"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Encomendas
          </Link>
          <span aria-hidden> · </span>
          {formatarDataEncomenda(encomenda.placedAt)}
        </p>
      </div>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${ESTADO_ENCOMENDA_CLASSES[encomenda.estado]}`}
        >
          {ESTADO_ENCOMENDA_LABELS[encomenda.estado]}
        </span>
        <p className="mt-3 text-sm text-muted-foreground">
          {encomenda.cancelReason
            ? MOTIVO_CANCELAMENTO_LABELS[encomenda.cancelReason]
            : ESTADO_ENCOMENDA_TEXTO[encomenda.estado]}
        </p>
        {podeCancelarEncomenda(encomenda.estado) && (
          <Button
            variant="destructive"
            className="mt-4"
            disabled={aCancelar}
            onClick={() => void onCancelar()}
          >
            {aCancelar ? "A cancelar…" : "Cancelar encomenda"}
          </Button>
        )}
        {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <ul className="divide-y">
          {encomenda.linhas.map((linha) => {
            const retirada = linha.estadoLinha === "retirada"
            return (
              <li
                key={linha._id}
                className={`flex items-start justify-between gap-4 px-4 py-3.5 ${retirada ? "opacity-60" : ""}`}
              >
                <div className="min-w-0">
                  <p className={`truncate font-medium ${retirada ? "line-through" : ""}`}>
                    {linha.nome}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {rotuloMarca(linha.marca)} · {linha.ref} · {linha.qty} ×{" "}
                    {eurExato.format(linha.precoRevendaCents / 100)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {eurExato.format(
                      (linha.precoRevendaCents * linha.qty) / 100,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ESTADO_LINHA_LABELS[linha.estadoLinha]}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="flex items-baseline justify-between border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">
            Total revenda (s/IVA)
          </span>
          <span className="text-lg font-semibold tabular-nums text-primary">
            {eurExato.format(encomenda.totalRevendaCents / 100)}
          </span>
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        Os preços desta encomenda foram congelados ao submeter. Alterações às
        linhas fazem-se através do escritório. IVA a {encomenda.ivaPercent}%
        aplicado nos documentos.
      </p>
    </>
  )
}

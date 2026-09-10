import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  usePaginatedQuery,
} from "convex/react"
import { ChevronRight } from "lucide-react"

import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  ESTADO_APROVACAO_CLASSES,
  ESTADO_APROVACAO_LABELS,
  ESTADOS_APROVACAO,
  eurosDeCents,
  type EstadoAprovacao,
} from "@/lib/labels"

export const Route = createFileRoute("/empresas")({ component: EmpresasPage })

const filtroCls =
  "h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

function EmpresasPage() {
  const [estadoFiltro, setEstadoFiltro] = useState("")

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-foreground">
          Contas
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
        <p className="text-sm text-muted-foreground">
          Aprovar, rejeitar ou suspender empresas instaladoras e fixar o
          respectivo tier comercial.
        </p>
      </div>

      <AuthLoading>
        <p className="text-sm text-muted-foreground">A verificar sessão…</p>
      </AuthLoading>
      <Unauthenticated>
        <p className="text-sm text-destructive">
          Sessão não autenticada com o Convex.
        </p>
      </Unauthenticated>
      <Authenticated>
        <Lista
          estadoFiltro={estadoFiltro}
          setEstadoFiltro={setEstadoFiltro}
        />
      </Authenticated>
    </main>
  )
}

function Lista({
  estadoFiltro,
  setEstadoFiltro,
}: {
  estadoFiltro: string
  setEstadoFiltro: (v: string) => void
}) {
  const estado = estadoFiltro
    ? (estadoFiltro as EstadoAprovacao)
    : undefined

  const { results, status, loadMore } = usePaginatedQuery(
    api.empresas.listar,
    { estado },
    { initialNumItems: 20 },
  )

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Estado</span>
        <select
          className={filtroCls}
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
        >
          <option value="">Todos</option>
          {ESTADOS_APROVACAO.map((e) => (
            <option key={e} value={e}>
              {ESTADO_APROVACAO_LABELS[e]}
            </option>
          ))}
        </select>
      </label>

      {results.length === 0 && status !== "LoadingFirstPage" ? (
        <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          Ainda não há empresas{estado ? ` no estado “${ESTADO_APROVACAO_LABELS[estado]}”` : ""}.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {results.map((empresa) => (
            <li key={empresa._id}>
              <Link
                to="/empresas/$empresaId"
                params={{ empresaId: empresa._id }}
                className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{empresa.nomeLegal}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    NIF {empresa.nif}
                    {empresa.email ? ` · ${empresa.email}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {eurosDeCents(empresa.volumeCents)} vol.
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      ESTADO_APROVACAO_CLASSES[empresa.estadoAprovacao],
                    )}
                  >
                    {ESTADO_APROVACAO_LABELS[empresa.estadoAprovacao]}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => loadMore(20)}>
          Carregar mais
        </Button>
      )}
      {status === "LoadingMore" && (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      )}
    </div>
  )
}

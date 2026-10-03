import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  usePaginatedQuery,
} from "convex/react"
import { ChevronRight } from "lucide-react"

import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Cabecalho,
  Filtros,
  Marcador,
  Cartao,
  Tabela,
  Td,
  Th,
  Vazio,
  linhaCls,
} from "@/components/ui/tabela"
import { cn } from "@/lib/utils"
import {
  ESTADO_APROVACAO_LABELS,
  ESTADO_APROVACAO_TOM,
  ESTADOS_APROVACAO,
  dataHora,
  eurosDeCents,
} from "@/lib/labels"
import type { EstadoAprovacao } from "@/lib/labels"

export const Route = createFileRoute("/empresas")({ component: EmpresasPage })

function EmpresasPage() {
  const [estado, setEstado] = useState<EstadoAprovacao | undefined>(undefined)

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <Cabecalho titulo="Empresas" />

      <AuthLoading>
        <p className="text-sm text-muted-foreground">A verificar sessão…</p>
      </AuthLoading>
      <Unauthenticated>
        <p className="text-sm text-destructive">
          Sessão não autenticada com o Convex.
        </p>
      </Unauthenticated>
      <Authenticated>
        <Lista estado={estado} setEstado={setEstado} />
      </Authenticated>
    </main>
  )
}

function Lista({
  estado,
  setEstado,
}: {
  estado: EstadoAprovacao | undefined
  setEstado: (v: EstadoAprovacao | undefined) => void
}) {
  const navigate = useNavigate()
  const { results, status, loadMore } = usePaginatedQuery(
    api.empresas.listar,
    { estado },
    { initialNumItems: 30 }
  )

  return (
    <div className="flex flex-col gap-4">
      <Filtros
        valor={estado}
        onChange={setEstado}
        opcoes={[
          { valor: undefined, rotulo: "Todas" },
          ...ESTADOS_APROVACAO.map((e) => ({
            valor: e,
            rotulo: ESTADO_APROVACAO_LABELS[e],
          })),
        ]}
      />

      <Cartao>
        {results.length === 0 && status !== "LoadingFirstPage" ? (
          <Vazio>Sem empresas neste estado.</Vazio>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Empresa</Th>
                <Th className="hidden sm:table-cell">NIF</Th>
                <Th num className="hidden md:table-cell">
                  Volume pago
                </Th>
                <Th className="hidden lg:table-cell">Registada</Th>
                <Th>Estado</Th>
                <Th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {results.map((empresa) => (
                <tr
                  key={empresa._id}
                  onClick={() =>
                    void navigate({
                      to: "/empresas/$empresaId",
                      params: { empresaId: empresa._id },
                    })
                  }
                  className={cn(linhaCls, "cursor-pointer")}
                >
                  <Td className="max-w-0 min-w-48">
                    <Link
                      to="/empresas/$empresaId"
                      params={{ empresaId: empresa._id }}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate font-medium hover:underline"
                    >
                      {empresa.nomeLegal}
                    </Link>
                    {empresa.email && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {empresa.email}
                      </span>
                    )}
                  </Td>
                  <Td className="hidden sm:table-cell">{empresa.nif}</Td>
                  <Td num className="hidden md:table-cell">
                    {eurosDeCents(empresa.volumeCents)}
                  </Td>
                  <Td className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                    {dataHora(empresa.registadoEm)}
                  </Td>
                  <Td>
                    <Marcador
                      tom={ESTADO_APROVACAO_TOM[empresa.estadoAprovacao]}
                    >
                      {ESTADO_APROVACAO_LABELS[empresa.estadoAprovacao]}
                    </Marcador>
                  </Td>
                  <Td num className="text-muted-foreground">
                    <ChevronRight className="inline size-4" />
                  </Td>
                </tr>
              ))}
              {(status === "LoadingFirstPage" || status === "LoadingMore") &&
                [0, 1, 2, 3].map((i) => (
                  <LinhaEsqueleto key={i} primeira={i === 0} />
                ))}
            </tbody>
          </Tabela>
        )}
      </Cartao>

      {status === "CanLoadMore" && (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => loadMore(30)}
        >
          Carregar mais
        </Button>
      )}
    </div>
  )
}

/** A table row's shape while the first or next page loads. */
function LinhaEsqueleto({ primeira }: { primeira: boolean }) {
  return (
    <tr>
      <Td className="min-w-48">
        {primeira && <span className="sr-only">A carregar…</span>}
        <div aria-hidden className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-48 max-w-full rounded-md" />
          <Skeleton className="h-3 w-32 max-w-full rounded-md" />
        </div>
      </Td>
      <Td className="hidden sm:table-cell">
        <Skeleton aria-hidden className="h-4 w-20 rounded-md" />
      </Td>
      <Td num className="hidden md:table-cell">
        <Skeleton aria-hidden className="ml-auto h-4 w-16 rounded-md" />
      </Td>
      <Td className="hidden lg:table-cell">
        <Skeleton aria-hidden className="h-4 w-28 rounded-md" />
      </Td>
      <Td>
        <Skeleton aria-hidden className="h-5 w-20 rounded-full" />
      </Td>
      <Td />
    </tr>
  )
}

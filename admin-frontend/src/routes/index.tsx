import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  usePaginatedQuery,
  useQuery,
} from "convex/react"
import { convexQuery } from "@convex-dev/react-query"
import { useSuspenseQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"

import { api } from "@convex/_generated/api"
import { cn } from "@/lib/utils"
import { useContagemAccao } from "@/components/prototype-encomendas/fixtures"
import {
  Cabecalho,
  Destaque,
  Marcador,
  Seccao,
  Tabela,
  Td,
  Th,
  linhaCls,
} from "@/components/ui/tabela"

export const Route = createFileRoute("/")({ component: Painel })

const hoje = new Intl.DateTimeFormat("pt-PT", { dateStyle: "full" })

function Painel() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <Cabecalho titulo="Painel" meta={hoje.format(new Date())}>
        <AuthLoading>
          <Marcador tom="inativo">A verificar sessão…</Marcador>
        </AuthLoading>
        <Authenticated>
          <Saude />
        </Authenticated>
      </Cabecalho>

      <Authenticated>
        <PrecisaDeTi />
      </Authenticated>
    </main>
  )
}

function Saude() {
  // Staff-gated query returning { ok: true }; reaching here means healthy.
  useSuspenseQuery(convexQuery(api.admin.health.get, {}))
  return <Marcador tom="feito">Backend operacional</Marcador>
}

/** What needs the office right now, one row per queue, counts right. */
function PrecisaDeTi() {
  const pendentes = usePaginatedQuery(
    api.empresas.listar,
    { estado: "pendente" },
    { initialNumItems: 50 }
  )
  const importacoes = useQuery(api.importacoes.listar, {})
  const encomendas = useContagemAccao()

  const nPendentes =
    pendentes.status === "LoadingFirstPage" ? null : pendentes.results.length
  const emRevisao =
    importacoes === undefined
      ? null
      : importacoes.filter((i) => i.estado === "em-revisao").length

  const filas: Array<{
    titulo: string
    detalhe: ReactNode
    n: number | null
    mais?: boolean
    to: "/prototype/encomendas" | "/empresas" | "/importacoes"
  }> = [
    {
      titulo: "Encomendas",
      detalhe: "Pedir stock, confirmar linhas, pedir pagamento, exceções",
      n: encomendas,
      to: "/prototype/encomendas",
    },
    {
      titulo: "Empresas pendentes",
      detalhe: "Pedidos de registo por aprovar",
      n: nPendentes,
      mais: pendentes.status === "CanLoadMore",
      to: "/empresas",
    },
    {
      titulo: "Importações em revisão",
      detalhe: "Tabelas de preços por aprovar",
      n: emRevisao,
      to: "/importacoes",
    },
  ]
  const total = filas.reduce((a, f) => a + (f.n ?? 0), 0)

  return (
    <Seccao titulo="Precisa de ti" contagem={total}>
      <Tabela>
        <thead>
          <tr>
            <Th className="w-8" />
            <Th className="w-56">Fila</Th>
            <Th className="hidden sm:table-cell">Ação</Th>
            <Th num className="w-24">
              Qtd
            </Th>
            <Th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            // Whole row is one stretched link, as on the client's order rows.
            <tr key={f.titulo} className={cn(linhaCls, "group relative")}>
              <Td className="pr-0">{(f.n ?? 0) > 0 && <Destaque />}</Td>
              <Td className="font-medium">
                <Link
                  to={f.to}
                  className="outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/25 focus-visible:after:ring-inset"
                >
                  {f.titulo}
                </Link>
              </Td>
              <Td className="hidden text-muted-foreground sm:table-cell">
                {f.detalhe}
              </Td>
              <Td
                num
                className={
                  (f.n ?? 0) > 0
                    ? "text-base font-semibold"
                    : "text-muted-foreground"
                }
              >
                {f.n === null ? "…" : `${f.n}${f.mais ? "+" : ""}`}
              </Td>
              <Td num>
                <ChevronRight className="inline size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Td>
            </tr>
          ))}
        </tbody>
      </Tabela>
    </Seccao>
  )
}

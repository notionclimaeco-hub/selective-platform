import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ChevronRight } from "lucide-react"

import { api } from "@convex/_generated/api"
import {
  ESTADO_IMPORTACAO_CLASSES,
  ESTADO_IMPORTACAO_LABELS,
  dataHora,
  rotuloMarca,
} from "@/lib/labels"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/importacoes")({
  component: ImportacoesPage,
})

type Importacao = FunctionReturnType<typeof api.importacoes.listar>[number]

function ImportacoesPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-[0.2em] text-brand-foreground uppercase">
          Catálogo
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Importações</h1>
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
        <Lista />
      </Authenticated>
    </main>
  )
}

function EstadoBadge({ estado }: { estado: Importacao["estado"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        ESTADO_IMPORTACAO_CLASSES[estado]
      )}
    >
      {ESTADO_IMPORTACAO_LABELS[estado]}
    </span>
  )
}

function decisao(r: Importacao): string {
  if (r.estado === "aprovada" && r.decididoEm !== undefined) {
    return `Aprovada ${dataHora(r.decididoEm)}`
  }
  if (r.estado === "rejeitada") {
    const quando =
      r.decididoEm !== undefined ? ` ${dataHora(r.decididoEm)}` : ""
    return r.motivoRejeicao
      ? `Rejeitada${quando} · ${r.motivoRejeicao}`
      : `Rejeitada${quando}`
  }
  if (r.estado === "a-promover") {
    return `A promover · ${r.numPromovidos ?? 0}/${r.numSkus}`
  }
  return "—"
}

const COLUNAS: Array<{
  chave: string
  rotulo: string
  valor: (r: Importacao) => number | string
}> = [
  { chave: "skus", rotulo: "SKUs", valor: (r) => r.numSkus },
  { chave: "grupos", rotulo: "Grupos", valor: (r) => r.numGrupos },
  { chave: "avisos", rotulo: "Avisos", valor: (r) => r.numComAvisos },
  { chave: "novos", rotulo: "Novos", valor: (r) => r.numNovos },
  { chave: "alterados", rotulo: "Alterados", valor: (r) => r.numAlterados },
  { chave: "iguais", rotulo: "Iguais", valor: (r) => r.numIguais },
  {
    chave: "desc",
    rotulo: "Descontinuados",
    valor: (r) => r.numDescontinuados ?? "—",
  },
]

function Lista() {
  const runs = useQuery(api.importacoes.listar, {})

  if (runs === undefined) {
    return <p className="text-sm text-muted-foreground">A carregar…</p>
  }
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem importações.</p>
  }

  return (
    <>
      {/* Phones: one card per run. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {runs.map((r) => (
          <li key={r._id} className="rounded-xl border bg-card">
            <Link
              to="/importacoes/$importacaoId"
              params={{ importacaoId: r._id }}
              className="flex items-start gap-3 p-3"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {rotuloMarca(r.marca)} {r.ano}
                  </span>
                  <EstadoBadge estado={r.estado} />
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.tabelaOrigem} · {dataHora(r.criadoEm)}
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  {COLUNAS.map((c) => (
                    <span key={c.chave} className="text-muted-foreground">
                      {c.rotulo}{" "}
                      <span className="font-medium text-foreground">
                        {c.valor(r)}
                      </span>
                    </span>
                  ))}
                </span>
                {decisao(r) !== "—" && (
                  <span className="text-xs break-words text-muted-foreground">
                    {decisao(r)}
                  </span>
                )}
              </span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: one row per run. */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b bg-secondary/40 text-left">
              <th className="px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Marca
              </th>
              <th className="px-2.5 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Ano
              </th>
              <th className="px-2.5 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Estado
              </th>
              {COLUNAS.map((c) => (
                <th
                  key={c.chave}
                  className="px-2.5 py-2 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {c.rotulo}
                </th>
              ))}
              <th className="px-2.5 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Criada
              </th>
              <th className="px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Decisão
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr
                key={r._id}
                className="border-b last:border-b-0 hover:bg-secondary/30"
              >
                <td className="px-3 py-2 font-medium">
                  <Link
                    to="/importacoes/$importacaoId"
                    params={{ importacaoId: r._id }}
                    className="hover:underline"
                  >
                    {rotuloMarca(r.marca)}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {r.tabelaOrigem}
                  </span>
                </td>
                <td className="px-2.5 py-2">{r.ano}</td>
                <td className="px-2.5 py-2">
                  <EstadoBadge estado={r.estado} />
                </td>
                {COLUNAS.map((c) => (
                  <td
                    key={c.chave}
                    className="px-2.5 py-2 text-right tabular-nums"
                  >
                    {c.valor(r)}
                  </td>
                ))}
                <td className="px-2.5 py-2 whitespace-nowrap text-muted-foreground">
                  {dataHora(r.criadoEm)}
                </td>
                <td className="max-w-xs px-3 py-2 text-muted-foreground">
                  <span className="line-clamp-2 break-words">{decisao(r)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

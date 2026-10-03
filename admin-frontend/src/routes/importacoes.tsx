import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ChevronRight } from "lucide-react"

import { api } from "@convex/_generated/api"
import { LinhasEsqueleto, Skeleton } from "@/components/ui/skeleton"
import {
  Cabecalho,
  Marcador,
  Seccao,
  Tabela,
  Td,
  Th,
  Vazio,
  linhaCls,
} from "@/components/ui/tabela"
import {
  ESTADO_IMPORTACAO_LABELS,
  ESTADO_IMPORTACAO_TOM,
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <Cabecalho titulo="Importações" />

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

/** The decision detail under the state: when, why, or how far along. */
function detalheDecisao(r: Importacao): string | null {
  if (r.estado === "aprovada" && r.decididoEm !== undefined) {
    return dataHora(r.decididoEm)
  }
  if (r.estado === "rejeitada") {
    const partes = [
      r.decididoEm !== undefined ? dataHora(r.decididoEm) : null,
      r.motivoRejeicao ?? null,
    ].filter((p): p is string => p !== null && p !== "")
    return partes.length > 0 ? partes.join(" · ") : null
  }
  if (r.estado === "a-promover") {
    return `${r.numPromovidos ?? 0}/${r.numSkus} promovidos`
  }
  return null
}

// Counts, widest-first to drop on narrower desktops (phones get cards).
const COLUNAS: Array<{
  chave: string
  rotulo: string
  valor: (r: Importacao) => number | string
  cls: string
  aviso?: (r: Importacao) => boolean
}> = [
  { chave: "skus", rotulo: "SKUs", valor: (r) => r.numSkus, cls: "" },
  { chave: "grupos", rotulo: "Grupos", valor: (r) => r.numGrupos, cls: "" },
  {
    chave: "avisos",
    rotulo: "Avisos",
    valor: (r) => r.numComAvisos,
    cls: "",
    aviso: (r) => r.numComAvisos > 0,
  },
  {
    chave: "novos",
    rotulo: "Novos",
    valor: (r) => r.numNovos,
    cls: "hidden lg:table-cell",
  },
  {
    chave: "alterados",
    rotulo: "Alterados",
    valor: (r) => r.numAlterados,
    cls: "hidden lg:table-cell",
  },
  {
    chave: "iguais",
    rotulo: "Iguais",
    valor: (r) => r.numIguais,
    cls: "hidden xl:table-cell",
  },
  {
    chave: "desc",
    rotulo: "Descontinuados",
    valor: (r) => r.numDescontinuados ?? "—",
    cls: "hidden xl:table-cell",
  },
]

function Lista() {
  const runs = useQuery(api.importacoes.listar, {})

  if (runs === undefined) {
    return (
      <>
        <div role="status" className="flex flex-col gap-2.5 md:hidden">
          <span className="sr-only">A carregar…</span>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              aria-hidden
              className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3 w-40 rounded-md" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-36 rounded-md" />
            </div>
          ))}
        </div>
        <Seccao
          titulo="Tabelas de preços"
          contagem="…"
          className="hidden md:flex"
        >
          <LinhasEsqueleto
            linhas={3}
            colunas={[
              "w-28",
              "w-10",
              "h-5 w-20 rounded-full",
              "ml-auto w-10",
              "w-10",
              "w-10",
            ]}
          />
        </Seccao>
      </>
    )
  }

  return (
    <>
      {runs.length === 0 ? (
        <section className="rounded-xl border bg-card md:hidden">
          <Vazio>Sem importações.</Vazio>
        </section>
      ) : (
        <ul className="flex flex-col gap-2.5 md:hidden">
          {runs.map((r) => (
            <CartaoImportacao key={r._id} run={r} />
          ))}
        </ul>
      )}
      <TabelaImportacoes runs={runs} />
    </>
  )
}

/** Phones: one card per run, the whole card links to the review page. */
function CartaoImportacao({ run: r }: { run: Importacao }) {
  const detalhe = detalheDecisao(r)
  return (
    <li className="relative rounded-xl border bg-card transition-colors hover:border-foreground/20">
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div className="min-w-0">
          <Link
            to="/importacoes/$importacaoId"
            params={{ importacaoId: r._id }}
            className="font-semibold outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/25"
          >
            {rotuloMarca(r.marca)} {r.ano}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {r.tabelaOrigem} · {dataHora(r.criadoEm)}
          </p>
        </div>
        <Marcador tom={ESTADO_IMPORTACAO_TOM[r.estado]}>
          {ESTADO_IMPORTACAO_LABELS[r.estado]}
        </Marcador>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-2 pb-3.5 text-sm text-muted-foreground tabular-nums">
        <span>
          <span className="font-semibold text-foreground">{r.numSkus}</span>{" "}
          SKUs
        </span>
        <span>{r.numGrupos} grupos</span>
        {r.numComAvisos > 0 && (
          <span className="font-medium text-warning-foreground">
            {r.numComAvisos} {r.numComAvisos === 1 ? "aviso" : "avisos"}
          </span>
        )}
      </div>
      {detalhe && (
        <p className="-mt-2 line-clamp-2 px-4 pb-3.5 text-xs break-words text-muted-foreground">
          {detalhe}
        </p>
      )}
    </li>
  )
}

/** From `md`: one table in a card. */
function TabelaImportacoes({ runs }: { runs: Array<Importacao> }) {
  const navigate = useNavigate()
  return (
    <Seccao
      titulo="Tabelas de preços"
      contagem={runs.length}
      className="hidden md:flex"
    >
      {runs.length === 0 ? (
        <Vazio>Sem importações.</Vazio>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <Th>Marca</Th>
              <Th>Ano</Th>
              <Th>Estado</Th>
              {COLUNAS.map((c) => (
                <Th key={c.chave} num className={c.cls}>
                  {c.rotulo}
                </Th>
              ))}
              <Th className="hidden xl:table-cell">Criada</Th>
              <Th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const detalhe = detalheDecisao(r)
              return (
                <tr
                  key={r._id}
                  onClick={() =>
                    void navigate({
                      to: "/importacoes/$importacaoId",
                      params: { importacaoId: r._id },
                    })
                  }
                  className={cn(linhaCls, "group cursor-pointer")}
                >
                  <Td className="max-w-0 min-w-36">
                    <Link
                      to="/importacoes/$importacaoId"
                      params={{ importacaoId: r._id }}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate font-semibold"
                    >
                      {rotuloMarca(r.marca)}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.tabelaOrigem}
                      <span className="xl:hidden">
                        {" "}
                        · {dataHora(r.criadoEm)}
                      </span>
                    </span>
                  </Td>
                  <Td className="text-muted-foreground">{r.ano}</Td>
                  <Td className="max-w-56">
                    <Marcador tom={ESTADO_IMPORTACAO_TOM[r.estado]}>
                      {ESTADO_IMPORTACAO_LABELS[r.estado]}
                    </Marcador>
                    {detalhe && (
                      <span
                        title={detalhe}
                        className="mt-1 line-clamp-2 text-xs break-words text-muted-foreground"
                      >
                        {detalhe}
                      </span>
                    )}
                  </Td>
                  {COLUNAS.map((c) => (
                    <Td
                      key={c.chave}
                      num
                      className={cn(
                        c.cls,
                        c.aviso?.(r) && "font-medium text-warning-foreground"
                      )}
                    >
                      {c.valor(r)}
                    </Td>
                  ))}
                  <Td className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">
                    {dataHora(r.criadoEm)}
                  </Td>
                  <Td num className="text-muted-foreground">
                    <ChevronRight className="inline size-4 transition-transform group-hover:translate-x-0.5" />
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Tabela>
      )}
    </Seccao>
  )
}

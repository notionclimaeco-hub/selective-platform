import { useEffect, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  Check,
  ChevronLeft,
  ExternalLink,
  Loader2,
  RotateCw,
  Search,
} from "lucide-react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { ConfirmDialog } from "@/components/produtos/confirm-dialog"
import { GrupoCard } from "@/components/importacoes/grupo-card"
import { RejeitarDialog } from "@/components/importacoes/rejeitar-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Paginacao } from "@/components/ui/paginacao"
import {
  CabecalhoEsqueleto,
  LinhasEsqueleto,
  Skeleton,
} from "@/components/ui/skeleton"
import {
  Cabecalho,
  Destaque,
  Marcador,
  Seccao,
  Vazio,
  campoCls,
} from "@/components/ui/tabela"
import {
  ESTADO_IMPORTACAO_LABELS,
  ESTADO_IMPORTACAO_TOM,
  dataHora,
  rotuloFamilia,
  rotuloMarca,
} from "@/lib/labels"
import { textoAprovacao } from "@/lib/revisao"
import { useDebounced } from "@/lib/use-debounced"
import { cn } from "@/lib/utils"
import { Seletor } from "@/components/ui/seletor"

export const Route = createFileRoute("/importacoes_/$importacaoId")({
  component: ImportacaoPage,
})

// Groups per page.
const POR_PAGINA = 20

type Obter = NonNullable<FunctionReturnType<typeof api.importacoes.obter>>
type Importacao = Obter["importacao"]

const voltar = (
  <Link
    to="/importacoes"
    className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
  >
    <ChevronLeft className="size-4" /> Importações
  </Link>
)

/**
 * The review workspace. The decision bar is the last child of the content
 * column and sticks to the bottom of the viewport, so it always spans the
 * column whatever the sidebar's width (expanded or collapsed).
 */
function ImportacaoPage() {
  const { importacaoId } = Route.useParams()

  return (
    <div className="flex flex-1 flex-col">
      <AuthLoading>
        <Corpo>
          {voltar}
          <p className="text-sm text-muted-foreground">A verificar sessão…</p>
        </Corpo>
      </AuthLoading>
      <Unauthenticated>
        <Corpo>
          {voltar}
          <p className="text-sm text-destructive">
            Sessão não autenticada com o Convex.
          </p>
        </Corpo>
      </Unauthenticated>
      <Authenticated>
        <Revisao importacaoId={importacaoId as Id<"importacoes">} />
      </Authenticated>
    </div>
  )
}

/** Page container; wider than the other pages for the side-by-side group. */
function Corpo({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      {children}
    </main>
  )
}

/** A filter chip that adds to the others (several can be lit at once). */
function Alternar({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25",
        ativo
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background text-foreground hover:border-foreground/25"
      )}
    >
      {ativo && <Check className="size-3.5" strokeWidth={2.5} />}
      {children}
    </button>
  )
}

/** One of the run's totals: label left, value right. */
function Total({
  rotulo,
  valor,
  aviso,
}: {
  rotulo: string
  valor: number | string
  aviso?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="truncate text-muted-foreground">{rotulo}</dt>
      <dd
        className={cn(
          "font-semibold tabular-nums",
          aviso && "text-warning-foreground"
        )}
      >
        {valor}
      </dd>
    </div>
  )
}

function Revisao({ importacaoId }: { importacaoId: Id<"importacoes"> }) {
  const [pagina, setPagina] = useState(0)
  const [busca, setBusca] = useState("")
  const [familia, setFamilia] = useState("")
  const [soAvisos, setSoAvisos] = useState(false)
  const [soAlterados, setSoAlterados] = useState(false)
  const [soPorRever, setSoPorRever] = useState(false)
  const [soSemImagens, setSoSemImagens] = useState(false)
  const [soFotosARever, setSoFotosARever] = useState(false)
  const termo = useDebounced(busca, 300).trim()

  useEffect(() => {
    setPagina(0)
  }, [
    termo,
    familia,
    soAvisos,
    soAlterados,
    soPorRever,
    soSemImagens,
    soFotosARever,
  ])

  const resultado = useQuery(api.importacoes.obter, {
    importacaoId,
    pagina,
    porPagina: POR_PAGINA,
    busca: termo || undefined,
    familia: familia || undefined,
    soAvisos: soAvisos || undefined,
    soAlterados: soAlterados || undefined,
    soPorRever: soPorRever || undefined,
    soSemImagens: soSemImagens || undefined,
    soFotosARever: soFotosARever || undefined,
  })

  useEffect(() => {
    if (resultado && resultado.pagina !== pagina) setPagina(resultado.pagina)
  }, [resultado, pagina])

  if (resultado === undefined) {
    return (
      <Corpo>
        {voltar}
        <CabecalhoEsqueleto />
        <Seccao titulo="Totais">
          <div
            aria-hidden
            className="grid grid-cols-2 gap-x-8 gap-y-2.5 px-5 py-4 sm:grid-cols-3 lg:grid-cols-5"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="flex h-5 items-center justify-between gap-3"
              >
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-4 w-8 rounded-md" />
              </div>
            ))}
          </div>
        </Seccao>
        <Seccao titulo="Grupos" contagem="…">
          <LinhasEsqueleto
            linhas={6}
            colunas={[
              "w-48",
              "hidden w-24 sm:block",
              "ml-auto h-5 w-20 rounded-full",
            ]}
          />
        </Seccao>
      </Corpo>
    )
  }
  if (resultado === null) {
    return (
      <Corpo>
        {voltar}
        <p className="text-sm text-muted-foreground">
          Importação não encontrada.
        </p>
      </Corpo>
    )
  }

  const { importacao: run } = resultado
  const podeRever = run.estado === "em-revisao"
  const temFiltro =
    termo !== "" ||
    familia !== "" ||
    soAvisos ||
    soAlterados ||
    soPorRever ||
    soSemImagens ||
    soFotosARever

  return (
    <>
      <Corpo>
        <Cabecalho
          voltar={voltar}
          titulo={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {rotuloMarca(run.marca)} {run.ano}
              <Marcador tom={ESTADO_IMPORTACAO_TOM[run.estado]}>
                {ESTADO_IMPORTACAO_LABELS[run.estado]}
              </Marcador>
            </span>
          }
          meta={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{run.tabelaOrigem}</span>
              <span aria-hidden>·</span>
              <span className="min-w-0 break-all">{run.ficheiro}</span>
              <span aria-hidden>·</span>
              <span>{dataHora(run.criadoEm)}</span>
            </span>
          }
        >
          {run.pdfUrl && (
            <a
              href={run.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <ExternalLink data-icon="inline-start" />
              PDF
            </a>
          )}
        </Cabecalho>

        <Seccao titulo="Totais">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2.5 px-5 py-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <Total rotulo="SKUs" valor={run.numSkus} />
            <Total rotulo="Grupos" valor={run.numGrupos} />
            <Total
              rotulo="Com avisos"
              valor={run.numComAvisos}
              aviso={run.numComAvisos > 0}
            />
            <Total rotulo="Novos" valor={run.numNovos} />
            <Total rotulo="Alterados" valor={run.numAlterados} />
            <Total rotulo="Iguais" valor={run.numIguais} />
            <Total rotulo="Sem imagens" valor={resultado.gruposSemImagens} />
            <Total
              rotulo="Fotos a rever"
              valor={resultado.gruposFotosARever}
              aviso={resultado.gruposFotosARever > 0}
            />
            {run.numDescontinuados !== undefined && (
              <Total rotulo="Descontinuados" valor={run.numDescontinuados} />
            )}
            {run.numReativados !== undefined && run.numReativados > 0 && (
              <Total rotulo="Reativados" valor={run.numReativados} />
            )}
          </dl>
        </Seccao>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Procurar grupo…"
                className={cn(campoCls, "w-full pl-9")}
              />
            </div>
            <Seletor
              aria-label="Filtrar por família"
              value={familia}
              onChange={(e) => setFamilia(e.target.value)}
            >
              <option value="">Todas as famílias</option>
              {resultado.familias.map((f) => (
                <option key={f} value={f}>
                  {rotuloFamilia(f)}
                </option>
              ))}
            </Seletor>
          </div>
          <div
            role="group"
            aria-label="Filtros"
            className="sem-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            <Alternar ativo={soAvisos} onClick={() => setSoAvisos((v) => !v)}>
              Só com avisos
            </Alternar>
            <Alternar
              ativo={soAlterados}
              onClick={() => setSoAlterados((v) => !v)}
            >
              Só alterados
            </Alternar>
            <Alternar
              ativo={soPorRever}
              onClick={() => setSoPorRever((v) => !v)}
            >
              Só por rever
            </Alternar>
            <Alternar
              ativo={soSemImagens}
              onClick={() => setSoSemImagens((v) => !v)}
            >
              Só sem imagens
            </Alternar>
            <Alternar
              ativo={soFotosARever}
              onClick={() => setSoFotosARever((v) => !v)}
            >
              Só fotos a rever
            </Alternar>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Seccao
            titulo="Grupos"
            contagem={resultado.totalGrupos}
            accoes={
              resultado.numPaginas > 1 ? (
                <span className="tabular-nums">
                  Pág. {resultado.pagina + 1}/{resultado.numPaginas}
                </span>
              ) : undefined
            }
          >
            {resultado.totalGrupos === 0 ? (
              <Vazio>
                {temFiltro
                  ? "Nenhum grupo corresponde aos filtros."
                  : "Sem grupos."}
              </Vazio>
            ) : (
              <ul className="flex flex-col divide-y">
                {resultado.grupos.map((g) => (
                  <GrupoCard
                    key={g.grupoModelo}
                    importacaoId={importacaoId}
                    resumo={g}
                    podeRever={podeRever}
                  />
                ))}
              </ul>
            )}
          </Seccao>
          {resultado.totalGrupos > 0 && (
            <Paginacao
              pagina={resultado.pagina}
              numPaginas={resultado.numPaginas}
              onPagina={setPagina}
            />
          )}
        </div>
      </Corpo>

      <BarraDecisao run={run} gruposPorRever={resultado.gruposPorRever} />
    </>
  )
}

/** A figure in the decision bar: muted label, tabular-nums value. */
function Contagem({
  rotulo,
  valor,
}: {
  rotulo: string
  valor: number | string
}) {
  return (
    <span className="text-sm whitespace-nowrap text-muted-foreground">
      {rotulo}{" "}
      <span className="font-semibold text-foreground tabular-nums">
        {valor}
      </span>
    </span>
  )
}

/**
 * Sticky bottom bar: the approval gate and the approve / reject actions
 * while the run is in review, the promotion progress (with a resume button)
 * while promoting, and the decision once taken.
 */
function BarraDecisao({
  run,
  gruposPorRever,
}: {
  run: Importacao
  gruposPorRever: number
}) {
  const aprovar = useMutation(api.importacoes.aprovarImportacao)
  const rejeitar = useMutation(api.importacoes.rejeitarImportacao)
  const retomar = useMutation(api.importacoes.retomarPromocao)
  const [dialogo, setDialogo] = useState<"aprovar" | "rejeitar" | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function retomarPromocao() {
    setErro(null)
    try {
      await retomar({ importacaoId: run._id })
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao retomar.")
    }
  }

  const quando =
    run.decididoEm !== undefined ? ` ${dataHora(run.decididoEm)}` : ""

  let conteudo: React.ReactNode
  switch (run.estado) {
    case "em-revisao":
      conteudo = (
        <>
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            {gruposPorRever === 0 ? (
              <Marcador tom="feito">Pronta para aprovar</Marcador>
            ) : (
              <>
                <Destaque />
                <span>
                  <span className="font-semibold tabular-nums">
                    {gruposPorRever}
                  </span>{" "}
                  {gruposPorRever === 1
                    ? "grupo por rever"
                    : "grupos por rever"}
                </span>
              </>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="destructive"
              onClick={() => setDialogo("rejeitar")}
            >
              Rejeitar
            </Button>
            <Button onClick={() => setDialogo("aprovar")}>
              {gruposPorRever > 0 ? "Aprovar mesmo assim" : "Aprovar"}
            </Button>
          </div>
        </>
      )
      break
    case "a-promover":
      conteudo = (
        <>
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin text-primary" />
            <Marcador tom="progresso">A promover</Marcador>
            <span className="font-semibold tabular-nums">
              {run.numPromovidos ?? 0}/{run.numSkus}
            </span>
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void retomarPromocao()}
          >
            <RotateCw data-icon="inline-start" />
            Retomar
          </Button>
        </>
      )
      break
    case "aprovada":
      conteudo = (
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <Marcador tom="feito">Aprovada{quando}</Marcador>
          <Contagem rotulo="Promovidos" valor={run.numPromovidos ?? 0} />
          <Contagem rotulo="Reativados" valor={run.numReativados ?? 0} />
          <Contagem
            rotulo="Descontinuados"
            valor={run.numDescontinuados ?? 0}
          />
        </p>
      )
      break
    case "rejeitada":
      conteudo = (
        <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Marcador tom="perigo">Rejeitada{quando}</Marcador>
          {run.motivoRejeicao && (
            <span className="min-w-0 break-words text-muted-foreground">
              {run.motivoRejeicao}
            </span>
          )}
        </p>
      )
      break
    case "a-extrair":
      conteudo = (
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <Marcador tom="inativo">A extrair</Marcador>
        </p>
      )
      break
  }

  return (
    <>
      {/* Last child of the content column: sticks to the viewport bottom
          and spans the column, beside the sidebar at either width. */}
      <div className="sticky bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          {conteudo}
          {erro && <p className="w-full text-sm text-destructive">{erro}</p>}
        </div>
      </div>

      {dialogo === "aprovar" && (
        <ConfirmDialog
          titulo="Aprovar importação"
          {...textoAprovacao(
            run.numSkus,
            rotuloMarca(run.marca),
            gruposPorRever
          )}
          variante="default"
          onConfirmar={async () => {
            await aprovar({ importacaoId: run._id, forcar: gruposPorRever > 0 })
            setDialogo(null)
          }}
          onCancelar={() => setDialogo(null)}
        />
      )}
      {dialogo === "rejeitar" && (
        <RejeitarDialog
          titulo="Rejeitar importação"
          onConfirmar={async (motivo) => {
            await rejeitar({
              importacaoId: run._id,
              motivo: motivo === "" ? undefined : motivo,
            })
            setDialogo(null)
          }}
          onCancelar={() => setDialogo(null)}
        />
      )}
    </>
  )
}

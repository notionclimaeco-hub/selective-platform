import { useCallback, useEffect, useState } from "react"
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
import { PainelPagina } from "@/components/importacoes/painel-pagina"
import type { AlvoPainel } from "@/components/importacoes/painel-pagina"
import { RejeitarDialog } from "@/components/importacoes/rejeitar-dialog"
import { Button } from "@/components/ui/button"
import { Paginacao } from "@/components/ui/paginacao"
import {
  ESTADO_IMPORTACAO_CLASSES,
  ESTADO_IMPORTACAO_LABELS,
  dataHora,
  rotuloFamilia,
  rotuloMarca,
} from "@/lib/labels"
import { useDebounced } from "@/lib/use-debounced"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/importacoes_/$importacaoId")({
  component: ImportacaoPage,
})

// Groups per page.
const POR_PAGINA = 20

type Obter = NonNullable<FunctionReturnType<typeof api.importacoes.obter>>
type Importacao = Obter["importacao"]

function ImportacaoPage() {
  const { importacaoId } = Route.useParams()
  const [painel, setPainel] = useState<AlvoPainel | null>(null)
  const fecharPainel = useCallback(() => setPainel(null), [])

  return (
    <main
      className={cn(
        "mx-auto flex max-w-5xl flex-col gap-5 px-4 pt-8 pb-28 sm:px-6",
        painel && "md:mr-[min(40rem,50vw)]"
      )}
    >
      <Link
        to="/importacoes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Importações
      </Link>

      <AuthLoading>
        <p className="text-sm text-muted-foreground">A verificar sessão…</p>
      </AuthLoading>
      <Unauthenticated>
        <p className="text-sm text-destructive">
          Sessão não autenticada com o Convex.
        </p>
      </Unauthenticated>
      <Authenticated>
        <Revisao
          importacaoId={importacaoId as Id<"importacoes">}
          onVerPagina={setPainel}
        />
      </Authenticated>

      {painel && (
        <PainelPagina
          alvo={painel}
          onPagina={(pagina) => setPainel({ ...painel, pagina })}
          onClose={fecharPainel}
        />
      )}
    </main>
  )
}

const filtroCls =
  "h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

function Toggle({
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
        "h-8 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
        ativo
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function Contagem({
  rotulo,
  valor,
}: {
  rotulo: string
  valor: number | string
}) {
  return (
    <span className="text-xs text-muted-foreground">
      {rotulo} <span className="font-medium text-foreground">{valor}</span>
    </span>
  )
}

function Revisao({
  importacaoId,
  onVerPagina,
}: {
  importacaoId: Id<"importacoes">
  onVerPagina: (alvo: AlvoPainel) => void
}) {
  const [pagina, setPagina] = useState(0)
  const [busca, setBusca] = useState("")
  const [familia, setFamilia] = useState("")
  const [soAvisos, setSoAvisos] = useState(false)
  const [soAlterados, setSoAlterados] = useState(false)
  const [soPorRever, setSoPorRever] = useState(false)
  const termo = useDebounced(busca, 300).trim()

  useEffect(() => {
    setPagina(0)
  }, [termo, familia, soAvisos, soAlterados, soPorRever])

  const resultado = useQuery(api.importacoes.obter, {
    importacaoId,
    pagina,
    porPagina: POR_PAGINA,
    busca: termo || undefined,
    familia: familia || undefined,
    soAvisos: soAvisos || undefined,
    soAlterados: soAlterados || undefined,
    soPorRever: soPorRever || undefined,
  })

  useEffect(() => {
    if (resultado && resultado.pagina !== pagina) setPagina(resultado.pagina)
  }, [resultado, pagina])

  if (resultado === undefined) {
    return <p className="text-sm text-muted-foreground">A carregar…</p>
  }
  if (resultado === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Importação não encontrada.
      </p>
    )
  }

  const { importacao: run } = resultado
  const podeRever = run.estado === "em-revisao"
  const temFiltro =
    termo !== "" || familia !== "" || soAvisos || soAlterados || soPorRever

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {rotuloMarca(run.marca)} {run.ano}
          </h1>
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
              ESTADO_IMPORTACAO_CLASSES[run.estado]
            )}
          >
            {ESTADO_IMPORTACAO_LABELS[run.estado]}
          </span>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{run.tabelaOrigem}</span>
          <span>·</span>
          <span className="break-all">{run.ficheiro}</span>
          <span>·</span>
          <span>{dataHora(run.criadoEm)}</span>
          {run.pdfUrl && (
            <a
              href={run.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              <ExternalLink className="size-3" />
              PDF
            </a>
          )}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border bg-card px-4 py-2.5">
          <Contagem rotulo="SKUs" valor={run.numSkus} />
          <Contagem rotulo="Grupos" valor={run.numGrupos} />
          <Contagem rotulo="Com avisos" valor={run.numComAvisos} />
          <Contagem rotulo="Novos" valor={run.numNovos} />
          <Contagem rotulo="Alterados" valor={run.numAlterados} />
          <Contagem rotulo="Iguais" valor={run.numIguais} />
          {run.numDescontinuados !== undefined && (
            <Contagem rotulo="Descontinuados" valor={run.numDescontinuados} />
          )}
          {run.numReativados !== undefined && run.numReativados > 0 && (
            <Contagem rotulo="Reativados" valor={run.numReativados} />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Procurar grupo…"
              className={cn(filtroCls, "w-full pl-9")}
            />
          </div>
          <select
            aria-label="Filtrar por família"
            value={familia}
            onChange={(e) => setFamilia(e.target.value)}
            className={filtroCls}
          >
            <option value="">Todas as famílias</option>
            {resultado.familias.map((f) => (
              <option key={f} value={f}>
                {rotuloFamilia(f)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Toggle ativo={soAvisos} onClick={() => setSoAvisos((v) => !v)}>
            Só com avisos
          </Toggle>
          <Toggle ativo={soAlterados} onClick={() => setSoAlterados((v) => !v)}>
            Só alterados
          </Toggle>
          <Toggle ativo={soPorRever} onClick={() => setSoPorRever((v) => !v)}>
            Só por rever
          </Toggle>
        </div>
      </div>

      {resultado.totalGrupos === 0 ? (
        <p className="text-sm text-muted-foreground">
          {temFiltro ? "Nenhum grupo corresponde aos filtros." : "Sem grupos."}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {resultado.totalGrupos}{" "}
            {resultado.totalGrupos === 1 ? "grupo" : "grupos"}
          </p>
          <ul className="flex flex-col gap-2">
            {resultado.grupos.map((g) => (
              <GrupoCard
                key={g.grupoModelo}
                importacaoId={importacaoId}
                resumo={g}
                podeRever={podeRever}
                onVerPagina={onVerPagina}
              />
            ))}
          </ul>
          <Paginacao
            pagina={resultado.pagina}
            numPaginas={resultado.numPaginas}
            onPagina={setPagina}
          />
        </>
      )}

      <BarraDecisao run={run} gruposPorRever={resultado.gruposPorRever} />
    </>
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

  let conteudo: React.ReactNode
  switch (run.estado) {
    case "em-revisao":
      conteudo = (
        <>
          <p className="min-w-0 flex-1 text-sm">
            {gruposPorRever === 0 ? (
              <span className="font-medium text-green-800">
                Pronta para aprovar
              </span>
            ) : (
              <>
                <span className="font-medium">{gruposPorRever}</span>{" "}
                {gruposPorRever === 1 ? "grupo por rever" : "grupos por rever"}
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
            <Button
              disabled={gruposPorRever > 0}
              onClick={() => setDialogo("aprovar")}
            >
              Aprovar
            </Button>
          </div>
        </>
      )
      break
    case "a-promover":
      conteudo = (
        <>
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />A
            promover · {run.numPromovidos ?? 0}/{run.numSkus}
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
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium text-green-800">
            Aprovada
            {run.decididoEm !== undefined ? ` ${dataHora(run.decididoEm)}` : ""}
          </span>
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
        <p className="min-w-0 text-sm">
          <span className="font-medium text-destructive">
            Rejeitada
            {run.decididoEm !== undefined ? ` ${dataHora(run.decididoEm)}` : ""}
          </span>
          {run.motivoRejeicao && (
            <span className="break-words text-muted-foreground">
              {" "}
              · {run.motivoRejeicao}
            </span>
          )}
        </p>
      )
      break
    case "a-extrair":
      conteudo = (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />A extrair
        </p>
      )
      break
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          {conteudo}
          {erro && <p className="w-full text-sm text-destructive">{erro}</p>}
        </div>
      </div>

      {dialogo === "aprovar" && (
        <ConfirmDialog
          titulo="Aprovar importação"
          descricao={`Promove ${run.numSkus} SKUs para o catálogo e marca como descontinuadas as referências de ${rotuloMarca(run.marca)} ausentes desta tabela.`}
          confirmarLabel="Aprovar"
          variante="default"
          onConfirmar={async () => {
            await aprovar({ importacaoId: run._id })
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

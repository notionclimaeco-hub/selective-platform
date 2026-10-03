import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { Check, ChevronDown, ChevronRight, TriangleAlert } from "lucide-react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { Skeleton } from "@/components/ui/skeleton"
import { Destaque, Marcador } from "@/components/ui/tabela"
import {
  DIFF_TOM,
  rotuloComponente,
  rotuloFamilia,
  rotuloSegmento,
  rotuloSistema,
  rotuloTipoUnidade,
} from "@/lib/labels"
import {
  atributosComuns,
  avisosDoGrupo,
  grupoInalterado,
  rotuloChave,
  rotuloValor,
  valorDe,
} from "@/lib/revisao"
import { cn } from "@/lib/utils"
import { TabelaVariantes } from "./tabela-variantes"
import { VisorPagina } from "./painel-pagina"
import { PainelImagens } from "./painel-imagens"
import { Subtitulo } from "./subtitulo"

type Obter = NonNullable<FunctionReturnType<typeof api.importacoes.obter>>
export type ResumoGrupo = Obter["grupos"][number]

/**
 * One staged group of the review page, a row of the "Grupos" card. The header (always rendered) carries the taxonomy, the counts and
 * the revisto mark; the body subscribes to the group's SKUs only while open.
 * Groups nothing changed in start collapsed.
 */
export function GrupoCard({
  importacaoId,
  resumo,
  podeRever,
}: {
  importacaoId: Id<"importacoes">
  resumo: ResumoGrupo
  podeRever: boolean
}) {
  const [aberto, setAberto] = useState(!grupoInalterado(resumo))
  const precisa = resumo.precisaRevisao && !resumo.revisto

  const taxonomia = [
    rotuloFamilia(resumo.familia),
    resumo.sistema && rotuloSistema(resumo.sistema),
    resumo.tipoUnidade && rotuloTipoUnidade(resumo.tipoUnidade),
    resumo.componente !== "conjunto" && rotuloComponente(resumo.componente),
    resumo.segmento && rotuloSegmento(resumo.segmento),
  ].filter(Boolean)

  return (
    <li>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={cn(
          "flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors outline-none hover:bg-secondary/40 focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:ring-inset",
          aberto && "bg-secondary/40"
        )}
      >
        {aberto ? (
          <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {precisa && <Destaque />}
            <span className="font-semibold break-words">
              {resumo.nomeGrupo}
            </span>
            {resumo.gama && (
              <span className="text-sm text-muted-foreground">
                {resumo.gama}
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {taxonomia.join(" · ")}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-1">
            <span className="mr-1 text-sm font-medium tabular-nums">
              {resumo.numSkus} {resumo.numSkus === 1 ? "SKU" : "SKUs"}
            </span>
            {resumo.numAvisos > 0 && (
              <Marcador tom="aviso">
                <span className="tabular-nums">{resumo.numAvisos}</span>{" "}
                {resumo.numAvisos === 1 ? "aviso" : "avisos"}
              </Marcador>
            )}
            {resumo.numNovos > 0 && (
              <Marcador tom={DIFF_TOM.novo}>
                <span className="tabular-nums">{resumo.numNovos}</span> novos
              </Marcador>
            )}
            {resumo.numAlterados > 0 && (
              <Marcador tom={DIFF_TOM.alterado}>
                <span className="tabular-nums">{resumo.numAlterados}</span>{" "}
                alterados
              </Marcador>
            )}
            {resumo.numIguais > 0 && (
              <Marcador tom={DIFF_TOM.igual}>
                <span className="tabular-nums">{resumo.numIguais}</span> iguais
              </Marcador>
            )}
            {!resumo.temImagens && (
              <Marcador tom="inativo">Sem imagens</Marcador>
            )}
            {resumo.fotosARever && (
              <Marcador tom="aviso">Fotos a rever</Marcador>
            )}
            {resumo.escolhaAgente && (
              <Marcador tom="progresso">Escolha do agente</Marcador>
            )}
          </span>
        </span>
        {resumo.revisto && (
          <Marcador tom="feito" className="shrink-0">
            Revisto
          </Marcador>
        )}
      </button>

      {aberto && (
        <CorpoGrupo
          importacaoId={importacaoId}
          resumo={resumo}
          podeRever={podeRever}
        />
      )}
    </li>
  )
}

/**
 * Open group: images and the variant table on the left, the price-table
 * pages on the right (stacked on narrow screens). The page buttons in the
 * table move the viewer to that page.
 */
function CorpoGrupo({
  importacaoId,
  resumo,
  podeRever,
}: {
  importacaoId: Id<"importacoes">
  resumo: ResumoGrupo
  podeRever: boolean
}) {
  const grupo = useQuery(api.importacoes.obterGrupo, {
    importacaoId,
    grupoModelo: resumo.grupoModelo,
  })
  const marcar = useMutation(api.importacoes.marcarGrupoRevisto)
  const [erro, setErro] = useState<string | null>(null)
  const [aMarcar, setAMarcar] = useState(false)
  // The page shown on the right; null until the group loads (first cited page).
  const [pagina, setPagina] = useState<number | null>(null)

  async function alternarRevisto() {
    setErro(null)
    setAMarcar(true)
    try {
      await marcar({
        importacaoId,
        grupoModelo: resumo.grupoModelo,
        revisto: !resumo.revisto,
      })
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao marcar o grupo.")
    } finally {
      setAMarcar(false)
    }
  }

  if (grupo === undefined) {
    // Same frame as the loaded group: variants table left, page right.
    return (
      <div
        role="status"
        className="grid gap-6 border-t px-5 pt-5 pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start"
      >
        <span className="sr-only">A carregar…</span>
        <div aria-hidden className="flex min-w-0 flex-col gap-3">
          <Skeleton className="h-4 w-24 rounded-md" />
          <div className="divide-y overflow-hidden rounded-lg border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex h-12 items-center gap-4 px-4">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-4 w-1/3 rounded-md" />
                <Skeleton className="ml-auto h-4 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton
          aria-hidden
          className="aspect-[1/1.414] w-full rounded-lg lg:max-h-[calc(100svh-7.5rem)]"
        />
      </div>
    )
  }
  if (grupo === null) {
    return (
      <p className="border-t px-5 py-4 text-sm text-muted-foreground">
        Grupo sem SKUs.
      </p>
    )
  }

  const avisos = avisosDoGrupo(grupo.skus)
  const comuns = atributosComuns(grupo.skus, resumo.familia)
  const paginaAtual = pagina ?? grupo.paginas.at(0)?.pagina ?? 0

  return (
    <div className="grid gap-6 border-t px-5 pt-5 pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        {avisos.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-lg bg-warning px-3 py-2.5 text-xs text-warning-foreground ring-1 ring-warning-foreground/20 ring-inset">
            {avisos.map((a, i) => (
              <li key={i} className="flex gap-2 break-words">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0">
                  <span className="font-semibold break-all">{a.ref}</span> ·{" "}
                  {a.aviso}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex min-w-0 flex-col">
          <Subtitulo contagem={grupo.skus.length}>Variantes</Subtitulo>
          <TabelaVariantes
            skus={grupo.skus}
            familia={resumo.familia}
            onVerPagina={setPagina}
          />
        </div>

        {comuns.length > 0 && (
          <div className="flex min-w-0 flex-col">
            <Subtitulo>Comum às variantes</Subtitulo>
            <dl className="grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2 xl:grid-cols-3">
              {comuns.map((a) => (
                <div
                  key={a.chave}
                  className="flex items-baseline justify-between gap-3"
                >
                  <dt className="shrink-0 text-muted-foreground">
                    {rotuloChave(a.chave)}
                  </dt>
                  <dd className="min-w-0 text-right font-medium break-all tabular-nums">
                    {rotuloValor(a.valor)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <PainelImagens
          grupoModelo={resumo.grupoModelo}
          marca={resumo.marca}
          refs={grupo.skus.map((s) => s.ref)}
          cores={[
            ...new Set(grupo.skus.flatMap((s) => valorDe(s, "cor") ?? [])),
          ]}
          podeEditar={podeRever}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <span className="text-xs text-muted-foreground">
            {resumo.grupoModelo}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={resumo.revisto}
            disabled={!podeRever || aMarcar}
            onClick={() => void alternarRevisto()}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
              resumo.revisto
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-input bg-background shadow-xs hover:bg-muted"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-4 items-center justify-center rounded-md border transition-colors duration-150",
                resumo.revisto
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background"
              )}
            >
              {resumo.revisto && <Check className="size-3" strokeWidth={3} />}
            </span>
            Revisto
          </button>
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
      </div>

      {/* Sticks near the top of the viewport on wide screens. */}
      <div className="min-w-0 lg:sticky lg:top-8">
        <VisorPagina
          paginas={grupo.paginas}
          pagina={paginaAtual}
          onPagina={setPagina}
        />
      </div>
    </div>
  )
}

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Sparkles,
  TriangleAlert,
} from "lucide-react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
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

type Obter = NonNullable<FunctionReturnType<typeof api.importacoes.obter>>
export type ResumoGrupo = Obter["grupos"][number]

function Chip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className ?? "bg-secondary text-secondary-foreground"
      )}
    >
      {children}
    </span>
  )
}

/**
 * One staged group of the review page. The header (always rendered) carries
 * the taxonomy badges, the counts and the revisto mark; the body subscribes
 * to the group's SKUs only while open. Groups nothing changed in start
 * collapsed.
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

  return (
    <li
      className={cn(
        "rounded-xl border bg-card",
        precisa && "border-amber-300/70",
        resumo.revisto && "border-green-300/70"
      )}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-start gap-2 p-3 text-left"
      >
        {aberto ? (
          <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium break-words">{resumo.nomeGrupo}</span>
            {resumo.gama && (
              <span className="text-sm text-muted-foreground">
                {resumo.gama}
              </span>
            )}
            {resumo.revisto && (
              <Chip className="bg-green-100 text-green-800">
                <Check className="mr-1 size-3" />
                Revisto
              </Chip>
            )}
          </span>
          <span className="flex flex-wrap gap-1">
            <Chip>{rotuloFamilia(resumo.familia)}</Chip>
            {resumo.sistema && <Chip>{rotuloSistema(resumo.sistema)}</Chip>}
            {resumo.tipoUnidade && (
              <Chip>{rotuloTipoUnidade(resumo.tipoUnidade)}</Chip>
            )}
            {resumo.componente !== "conjunto" && (
              <Chip>{rotuloComponente(resumo.componente)}</Chip>
            )}
            {resumo.segmento && <Chip>{rotuloSegmento(resumo.segmento)}</Chip>}
          </span>
          <span className="flex flex-wrap gap-1 text-xs text-muted-foreground">
            <span className="py-0.5">
              {resumo.numSkus} {resumo.numSkus === 1 ? "SKU" : "SKUs"}
            </span>
            {resumo.numAvisos > 0 && (
              <Chip className="bg-amber-100 text-amber-800">
                <TriangleAlert className="mr-1 size-3" />
                {resumo.numAvisos} {resumo.numAvisos === 1 ? "aviso" : "avisos"}
              </Chip>
            )}
            {resumo.numNovos > 0 && (
              <Chip className="bg-green-100 text-green-800">
                {resumo.numNovos} novos
              </Chip>
            )}
            {resumo.numAlterados > 0 && (
              <Chip className="bg-amber-100 text-amber-800">
                {resumo.numAlterados} alterados
              </Chip>
            )}
            {resumo.numIguais > 0 && <Chip>{resumo.numIguais} iguais</Chip>}
            {!resumo.temImagens && (
              <Chip className="bg-muted text-muted-foreground">
                <ImageIcon className="mr-1 size-3" />
                Sem imagens
              </Chip>
            )}
            {resumo.fotosARever && (
              <Chip className="bg-amber-100 text-amber-800">
                <Camera className="mr-1 size-3" />
                Fotos a rever
              </Chip>
            )}
            {resumo.escolhaAgente && (
              <Chip className="bg-sky-100 text-sky-800">
                <Sparkles className="mr-1 size-3" />
                Escolha do agente
              </Chip>
            )}
          </span>
        </span>
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
 * pages on the right (stacked on narrow screens). The page badges in the
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
    return (
      <p className="border-t px-3 py-3 text-sm text-muted-foreground">
        A carregar…
      </p>
    )
  }
  if (grupo === null) {
    return (
      <p className="border-t px-3 py-3 text-sm text-muted-foreground">
        Grupo sem SKUs.
      </p>
    )
  }

  const avisos = avisosDoGrupo(grupo.skus)
  const comuns = atributosComuns(grupo.skus, resumo.familia)
  const paginaAtual = pagina ?? grupo.paginas.at(0)?.pagina ?? 0

  return (
    <div className="grid gap-3 border-t p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-3">
      {avisos.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {avisos.map((a, i) => (
            <li key={i} className="flex gap-2 break-words">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="font-medium break-all">{a.ref}</span> ·{" "}
                {a.aviso}
              </span>
            </li>
          ))}
        </ul>
      )}

      {comuns.length > 0 && (
        <dl className="flex flex-wrap gap-1.5">
          {comuns.map((a) => (
            <div
              key={a.chave}
              className="inline-flex max-w-full items-baseline gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs"
            >
              <dt className="text-muted-foreground">{rotuloChave(a.chave)}</dt>
              <dd className="font-medium break-all">{rotuloValor(a.valor)}</dd>
            </div>
          ))}
        </dl>
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

      <TabelaVariantes
        skus={grupo.skus}
        familia={resumo.familia}
        onVerPagina={setPagina}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
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
            "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors disabled:opacity-50",
            resumo.revisto
              ? "border-green-300 bg-green-100 text-green-800"
              : "bg-background hover:bg-muted"
          )}
        >
          <span
            className={cn(
              "flex size-4 items-center justify-center rounded-full border",
              resumo.revisto
                ? "border-green-700 bg-green-700 text-white"
                : "border-muted-foreground/40"
            )}
          >
            {resumo.revisto && <Check className="size-3" strokeWidth={3} />}
          </span>
          Revisto
        </button>
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      </div>

      {/* Sticks just below the app header (h-16). */}
      <div className="min-w-0 lg:sticky lg:top-20">
        <VisorPagina
          paginas={grupo.paginas}
          pagina={paginaAtual}
          onPagina={setPagina}
        />
      </div>
    </div>
  )
}

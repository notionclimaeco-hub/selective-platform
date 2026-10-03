import { useEffect, useReducer, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { BotaoRecorte } from "@/components/importacoes/botao-recorte"
import { FaixaOrdenavel } from "@/components/imagens/faixa-ordenavel"
import { useObjectUrls } from "@/components/imagens/use-object-urls"
import { ZonaUpload } from "@/components/imagens/zona-upload"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Marcador } from "@/components/ui/tabela"
import {
  ESTADO_INICIAL,
  apenasRefs,
  decisaoParaRefs,
  listaAtiva,
  origemCandidata,
  paraGuardar,
  reduzir,
} from "@/lib/imagens-estado"
import type { Acao, Candidata, Estado, Imagem } from "@/lib/imagens-estado"
import {
  dimensoes,
  enviarParaStorage,
  redimensionar,
  sha256,
} from "@/lib/imagens-ficheiro"
import { FONTES, rotuloFonte } from "@/lib/labels"
import { recortarFundo } from "@/lib/recorte"
import type { EtapaRecorte } from "@/lib/recorte"
import { rotuloValor } from "@/lib/revisao"
import { cn } from "@/lib/utils"
import { Seletor } from "@/components/ui/seletor"
import { Subtitulo } from "./subtitulo"

type Dados = FunctionReturnType<typeof api.imagens.obterGrupoImagens>
type ImagemServidor = { ficheiro: string; url: string | null }

const GRUPO = ""

// Files whose storage URL is gone (deleted) can't be shown or chosen.
function soComUrl(imagens: Array<ImagemServidor>): Array<Imagem> {
  return imagens.flatMap((i) =>
    i.url === null ? [] : [{ ficheiro: i.ficheiro, url: i.url }]
  )
}

function candidatasDe(dados: Dados): Array<Candidata> {
  return dados.candidatas.flatMap((c) =>
    c.url === null ? [] : [{ ...c, url: c.url }]
  )
}

function iniciarDeDados(dados: Dados, refs: Array<string>): Acao {
  return {
    tipo: "iniciar",
    escolhidas: dados.escolhidas
      ? {
          imagens: soComUrl(dados.escolhidas.imagens),
          porRef: apenasRefs(dados.escolhidas.porRef, refs).map((p) => ({
            ref: p.ref,
            imagens: soComUrl(p.imagens),
          })),
        }
      : null,
    atuais: apenasRefs(dados.atuais, refs).map((a) => ({
      ref: a.ref,
      imagens: soComUrl(a.imagens),
    })),
    candidatas: candidatasDe(dados),
  }
}

// Re-seeds the panel with a saved decision, keeping the candidates known now.
function iniciarDeEstado(anterior: Estado, candidatas: Array<Candidata>): Acao {
  return {
    tipo: "iniciar",
    escolhidas: {
      imagens: anterior.grupo,
      porRef: Object.entries(anterior.porRef).map(([ref, imagens]) => ({
        ref,
        imagens,
      })),
    },
    atuais: [],
    candidatas,
  }
}

function mensagem(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

// Checkerboard behind transparent images (cutouts). On the strip it sits on
// every <img>: object-cover fills the box, so it only shows through alpha.
const XADREZ =
  "bg-white bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] bg-[image:linear-gradient(45deg,#e5e5e5_25%,transparent_25%),linear-gradient(-45deg,#e5e5e5_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e5e5_75%),linear-gradient(-45deg,transparent_75%,#e5e5e5_75%)]"
const XADREZ_IMGS =
  "[&_img]:bg-white [&_img]:bg-[length:16px_16px] [&_img]:bg-[position:0_0,0_8px,8px_-8px,-8px_0] [&_img]:bg-[image:linear-gradient(45deg,#e5e5e5_25%,transparent_25%),linear-gradient(-45deg,#e5e5e5_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e5e5_75%),linear-gradient(-45deg,transparent_75%,#e5e5e5_75%)]"

// One background removal at a time: running (with progress), then a preview
// shown in place of the strip image until "Usar recorte" / "Manter original".
type Recorte =
  | {
      fase: "a-processar"
      ficheiro: string
      etapa: EtapaRecorte
      pct: number
    }
  | {
      fase: "pre-visualizar"
      ficheiro: string
      origem: Candidata
      blob: Blob
      url: string
      aEnviar: boolean
    }

/**
 * The group's photo decision on the review page: an ordered strip (the
 * group list, or one ref's override) above the candidates by source, with
 * uploads as new candidates. Clicking a candidate toggles it; with no saved
 * decision one cutout starts selected (the agent's picks, when it saved
 * some, load as the saved decision). Nothing is written until "Guardar";
 * the toast after a save offers "Reverter" to the previous decision.
 */
export function PainelImagens({
  grupoModelo,
  marca,
  refs,
  cores,
  podeEditar,
}: {
  grupoModelo: string
  marca: string
  refs: Array<string>
  cores: Array<string>
  podeEditar: boolean
}) {
  const dados = useQuery(api.imagens.obterGrupoImagens, { grupoModelo })
  const gerarUploadUrl = useMutation(api.imagens.gerarUploadUrl)
  const adicionar = useMutation(api.imagens.adicionarCandidata)
  const definir = useMutation(api.imagens.definirImagensGrupo)

  const [estado, despachar] = useReducer(reduzir, ESTADO_INICIAL)
  const [aGuardar, setAGuardar] = useState(false)
  const [aEnviar, setAEnviar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [recorte, setRecorte] = useState<Recorte | null>(null)
  const previews = useObjectUrls()

  const iniciado = useRef(false)
  // Guardar and Reverter share one in-flight guard so their writes can't race.
  const aGravar = useRef(false)
  // The decision as last saved (or loaded): what "Reverter" goes back to.
  const guardado = useRef<Estado>(ESTADO_INICIAL)
  // Latest values for async handlers (upload loop, toast action).
  const estadoAtual = useRef(estado)
  estadoAtual.current = estado
  const dadosAtuais = useRef(dados)
  dadosAtuais.current = dados
  // Set synchronously so a double click can't start a second cutout.
  const emRecorte = useRef(false)
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  // Seed once per group, when the server data first arrives.
  useEffect(() => {
    if (iniciado.current || dados === undefined) return
    const acao = iniciarDeDados(dados, refs)
    despachar(acao)
    guardado.current = reduzir(ESTADO_INICIAL, acao)
    iniciado.current = true
  }, [dados, refs])

  const lista = listaAtiva(estado)
  const escolhidos = new Set(lista.map((i) => i.ficheiro))
  const semOverrides = paraGuardar(estado).porRef === undefined
  const ocupado = aEnviar || aGuardar || recorte !== null
  // The strip shows the cutout preview in place of its original.
  const itens =
    recorte?.fase === "pre-visualizar"
      ? lista.map((i) =>
          i.ficheiro === recorte.ficheiro ? { ...i, url: recorte.url } : i
        )
      : lista

  // adicionarCandidata dedupes per (group, hash): an id may name a candidate
  // we already hold, whose file the server kept instead of the new upload.
  function candidataConhecida(id: string): Candidata | undefined {
    return (
      estadoAtual.current.candidatas.find((c) => c._id === id) ??
      (dadosAtuais.current
        ? candidatasDe(dadosAtuais.current).find((c) => c._id === id)
        : undefined)
    )
  }

  async function enviar(files: Array<File>) {
    setErro(null)
    setAEnviar(true)
    try {
      for (const file of files) {
        const blob = await redimensionar(file)
        const [hash, medidas] = await Promise.all([
          sha256(blob),
          dimensoes(blob),
        ])
        const ficheiro = await enviarParaStorage(blob, () => gerarUploadUrl({}))
        const { candidataId } = await adicionar({
          marca,
          grupoModelo,
          ficheiro: ficheiro as Id<"_storage">,
          fonte: "upload",
          largura: medidas.largura,
          altura: medidas.altura,
          hash,
        })
        // Same bytes already a candidate of this group: the server kept the
        // existing file and dropped this upload.
        const existente = candidataConhecida(candidataId)
        despachar({
          tipo: "candidata-nova",
          candidata: existente ?? {
            _id: candidataId,
            ficheiro,
            url: previews.criar(blob),
            fonte: "upload",
          },
          escolher: true,
        })
      }
    } catch (err) {
      setErro(mensagem(err, "Erro ao enviar as imagens."))
    } finally {
      setAEnviar(false)
    }
  }

  function aoReceberFicheiros(files: Array<File>) {
    if (files.length === 0) {
      setErro("Só são aceites ficheiros de imagem.")
      return
    }
    void enviar(files)
  }

  async function recortar(item: Imagem, candidata: Candidata) {
    if (emRecorte.current) return
    emRecorte.current = true
    setErro(null)
    const ficheiro = item.ficheiro
    setRecorte({ fase: "a-processar", ficheiro, etapa: "recorte", pct: 0 })
    try {
      const blob = await recortarFundo(item.url, (etapa, pct) =>
        setRecorte({ fase: "a-processar", ficheiro, etapa, pct })
      )
      if (!montado.current) return
      setRecorte({
        fase: "pre-visualizar",
        ficheiro,
        origem: candidata,
        blob,
        url: previews.criar(blob),
        aEnviar: false,
      })
    } catch (err) {
      setErro(mensagem(err, "Não foi possível recortar o fundo."))
      setRecorte(null)
      emRecorte.current = false
    }
  }

  function manterOriginal() {
    if (recorte?.fase !== "pre-visualizar" || recorte.aEnviar) return
    previews.revogar(recorte.url)
    setRecorte(null)
    emRecorte.current = false
  }

  async function usarRecorte() {
    if (recorte?.fase !== "pre-visualizar" || recorte.aEnviar) return
    const r = recorte
    setRecorte({ ...r, aEnviar: true })
    setErro(null)
    try {
      const [hash, medidas] = await Promise.all([
        sha256(r.blob),
        dimensoes(r.blob),
      ])
      const ficheiro = await enviarParaStorage(r.blob, () => gerarUploadUrl({}))
      const { candidataId } = await adicionar({
        marca,
        grupoModelo,
        ficheiro: ficheiro as Id<"_storage">,
        fonte: "recorte",
        origem: r.origem._id as Id<"imagensCandidatas">,
        largura: medidas.largura,
        altura: medidas.altura,
        hash,
      })
      const existente = candidataConhecida(candidataId)
      if (existente) previews.revogar(r.url)
      despachar({
        tipo: "trocar-recorte",
        ficheiro: r.ficheiro,
        recorte: existente ?? {
          _id: candidataId,
          ficheiro,
          url: r.url,
          fonte: "recorte",
          origem: r.origem._id,
        },
      })
      setRecorte(null)
      emRecorte.current = false
    } catch (err) {
      setErro(mensagem(err, "Erro ao enviar o recorte."))
      setRecorte({ ...r, aEnviar: false })
    }
  }

  async function gravar(e: Estado) {
    const { imagens, porRef } = decisaoParaRefs(paraGuardar(e), refs)
    await definir({
      grupoModelo,
      marca,
      imagens: imagens as Array<Id<"_storage">>,
      porRef: porRef?.map((p) => ({
        ref: p.ref,
        imagens: p.imagens as Array<Id<"_storage">>,
      })),
      refsDoGrupo: refs,
    })
  }

  async function reverter(anterior: Estado) {
    if (aGravar.current) return
    aGravar.current = true
    setAGuardar(true)
    try {
      await gravar(anterior)
      guardado.current = anterior
      despachar(iniciarDeEstado(anterior, estadoAtual.current.candidatas))
      toast("Imagens revertidas.")
    } catch (err) {
      toast.error(mensagem(err, "Não foi possível reverter."))
    } finally {
      aGravar.current = false
      setAGuardar(false)
    }
  }

  async function guardar() {
    if (aGravar.current) return
    aGravar.current = true
    const anterior = guardado.current
    const atual = estado
    setAGuardar(true)
    setErro(null)
    try {
      await gravar(atual)
      guardado.current = atual
      toast("Imagens guardadas.", {
        action: {
          label: "Reverter",
          onClick: () => void reverter(anterior),
        },
      })
    } catch (err) {
      setErro(mensagem(err, "Erro ao guardar."))
    } finally {
      aGravar.current = false
      setAGuardar(false)
    }
  }

  const porFonte = FONTES.map((fonte) => ({
    fonte,
    itens: estado.candidatas.filter((c) => c.fonte === fonte),
  })).filter((g) => g.itens.length > 0)

  return (
    <section aria-label="Imagens" className="flex min-w-0 flex-col gap-3">
      <Subtitulo
        className="mb-0"
        contagem={lista.length > 0 ? lista.length : undefined}
        accoes={
          <>
            {cores.length > 1 && semOverrides && (
              <Marcador tom="aviso">{cores.length} cores, 1 lista</Marcador>
            )}
            {refs.length > 1 && (
              <Seletor
                aria-label="Lista de imagens"
                value={estado.refAtiva ?? GRUPO}
                onChange={(e) =>
                  despachar({
                    tipo: "ativar-ref",
                    ref: e.target.value === GRUPO ? null : e.target.value,
                  })
                }
                tamanho="sm"
                className="max-w-full"
              >
                <option value={GRUPO}>Grupo (todas as variantes)</option>
                {refs.map((ref) => (
                  <option key={ref} value={ref}>
                    {ref}
                  </option>
                ))}
              </Seletor>
            )}
          </>
        }
      >
        Imagens
      </Subtitulo>

      {dados === undefined ? (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">A carregar…</span>
          <Skeleton aria-hidden className="h-3 w-64 max-w-full rounded-md" />
          <div aria-hidden className="flex gap-3 sm:grid sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                className="aspect-square w-32 shrink-0 rounded-xl sm:w-auto"
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {dados.escolhidas?.porAgente && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3 shrink-0" />
                Escolha do agente: já conta na aprovação. Guarde para a
                confirmar ou altere.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              A primeira imagem é a capa. Arraste para reordenar; clique numa
              candidata para a juntar ou tirar.
            </p>
            <div className={XADREZ_IMGS}>
              <FaixaOrdenavel
                itens={itens}
                onReordenar={(de, para) =>
                  despachar({ tipo: "reordenar", de, para })
                }
                onRemover={(ficheiro) =>
                  despachar({ tipo: "remover", ficheiro })
                }
                onCapa={(ficheiro) => despachar({ tipo: "capa", ficheiro })}
                acoesExtra={(item) => {
                  const candidata = estado.candidatas.find(
                    (c) => c.ficheiro === item.ficheiro
                  )
                  if (!candidata) return null
                  return (
                    <BotaoRecorte
                      candidata={candidata}
                      candidatas={estado.candidatas}
                      escolhidos={escolhidos}
                      aRecortar={
                        recorte?.fase === "a-processar" &&
                        recorte.ficheiro === item.ficheiro
                      }
                      podeRecortar={podeEditar}
                      desativado={ocupado}
                      onRecortar={() => void recortar(item, candidata)}
                      onTrocar={(para) =>
                        despachar({
                          tipo: "trocar-recorte",
                          ficheiro: item.ficheiro,
                          recorte: para,
                        })
                      }
                    />
                  )
                }}
                vazio={
                  <p className="rounded-lg border border-dashed border-input px-3 py-6 text-center text-sm text-muted-foreground">
                    Escolha candidatas abaixo ou adicione imagens.
                  </p>
                }
              />
            </div>
            {recorte && (
              <div
                role="status"
                className="flex flex-wrap items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-sm"
              >
                {recorte.fase === "a-processar" ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span className="tabular-nums">
                      {recorte.etapa === "modelo"
                        ? `A descarregar o modelo… ${recorte.pct} %`
                        : "A recortar…"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mr-auto text-muted-foreground">
                      Recorte pronto: pré-visualização na faixa.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={manterOriginal}
                      disabled={recorte.aEnviar}
                    >
                      Manter original
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void usarRecorte()}
                      disabled={recorte.aEnviar}
                    >
                      {recorte.aEnviar && <Loader2 className="animate-spin" />}
                      {recorte.aEnviar ? "A enviar…" : "Usar recorte"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Swallow drops that miss the upload zone so the browser doesn't
              navigate to the file. */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
          >
            <ZonaUpload
              ocupado={ocupado || !podeEditar}
              onFicheiros={aoReceberFicheiros}
              rotulo={aEnviar ? "A enviar…" : "Adicionar imagens"}
            >
              {porFonte.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sem candidatas para este grupo.
                </p>
              ) : (
                porFonte.map((g) => (
                  <div key={g.fonte} className="flex flex-col gap-1.5">
                    <h4 className="flex items-baseline gap-2 text-xs font-medium text-muted-foreground">
                      Candidatas · {rotuloFonte(g.fonte)}
                      <span className="tabular-nums">{g.itens.length}</span>
                    </h4>
                    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {g.itens.map((c) => (
                        <MiniaturaCandidata
                          key={c._id}
                          candidata={c}
                          escolhida={escolhidos.has(c.ficheiro)}
                          onEscolher={() =>
                            despachar({
                              tipo: "escolher",
                              ficheiro: c.ficheiro,
                            })
                          }
                        />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </ZonaUpload>
          </div>
        </>
      )}

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <footer className="flex flex-wrap items-center justify-end gap-2">
        {!podeEditar && (
          <span className="mr-auto text-xs text-muted-foreground">
            Só é possível guardar com a importação em revisão.
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void guardar()}
          disabled={!podeEditar || ocupado || dados === undefined}
        >
          {aGuardar && <Loader2 className="animate-spin" />}
          {aGuardar ? "A guardar…" : "Guardar"}
        </Button>
      </footer>
    </section>
  )
}

function MiniaturaCandidata({
  candidata,
  escolhida,
  onEscolher,
}: {
  candidata: Candidata
  escolhida: boolean
  onEscolher: () => void
}) {
  const origem = origemCandidata(candidata.origemUrl)
  return (
    <li className="relative">
      <button
        type="button"
        aria-pressed={escolhida}
        aria-label={escolhida ? "Tirar imagem" : "Escolher imagem"}
        title={candidata.aviso}
        onClick={onEscolher}
        className={cn(
          "block aspect-square w-full overflow-hidden rounded-lg border bg-muted transition-[border-color,box-shadow] duration-150 ease-out outline-none hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-primary/40",
          escolhida
            ? "border-primary ring-2 ring-primary"
            : candidata.aviso
              ? "border-warning-foreground/50"
              : "border-border"
        )}
      >
        <img
          src={candidata.url}
          alt=""
          loading="lazy"
          draggable={false}
          className={cn(
            "size-full object-contain",
            candidata.fonte === "recorte" && XADREZ,
            escolhida && "opacity-60"
          )}
        />
        {escolhida && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-4" strokeWidth={3} />
            </span>
          </span>
        )}
      </button>
      {candidata.cor && (
        <span className="pointer-events-none absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded-md bg-background/90 px-1 py-px text-[10px] font-medium">
          {rotuloValor(candidata.cor)}
        </span>
      )}
      {candidata.aviso && (
        <span
          className="pointer-events-none absolute top-1 left-1 flex size-5 items-center justify-center rounded-md bg-warning text-warning-foreground"
          aria-hidden="true"
        >
          <TriangleAlert className="size-3" />
        </span>
      )}
      {candidata.aviso && (
        <span className="mt-1 line-clamp-2 block text-[10px] leading-tight text-warning-foreground">
          {candidata.aviso}
        </span>
      )}
      {origem?.tipo === "link" && (
        <a
          href={origem.url}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir origem"
          className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-lg border border-input bg-background/90 text-foreground transition-colors duration-150 hover:bg-background"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
      {origem?.tipo === "texto" && (
        <span className="pointer-events-none absolute top-1 right-1 rounded-md bg-background/90 px-1 py-px text-[10px] font-medium">
          {origem.texto}
        </span>
      )}
    </li>
  )
}

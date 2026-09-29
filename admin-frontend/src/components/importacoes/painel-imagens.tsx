import { useEffect, useReducer, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { Check, ExternalLink, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { FaixaOrdenavel } from "@/components/imagens/faixa-ordenavel"
import { useObjectUrls } from "@/components/imagens/use-object-urls"
import { ZonaUpload } from "@/components/imagens/zona-upload"
import { Button } from "@/components/ui/button"
import {
  ESTADO_INICIAL,
  apenasRefs,
  decisaoParaRefs,
  listaAtiva,
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
import { rotuloValor } from "@/lib/revisao"
import { cn } from "@/lib/utils"

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

// Per-image actions in the strip; the background-removal button (or the
// before/after toggle when a cutout exists) plugs in here.
function acoesDaImagem(
  _item: Imagem,
  _candidata: Candidata | undefined
): ReactNode {
  return null
}

/**
 * The group's photo decision on the review page: an ordered strip (the
 * group list, or one ref's override) above the candidates by source, with
 * uploads as new candidates. Nothing is written until "Guardar"; the toast
 * after a save offers "Reverter" to the previous decision.
 */
export function PainelImagens({
  grupoModelo,
  marca,
  refs,
  cores,
  podeEditar,
  onFechar,
}: {
  grupoModelo: string
  marca: string
  refs: Array<string>
  cores: Array<string>
  podeEditar: boolean
  onFechar: () => void
}) {
  const dados = useQuery(api.imagens.obterGrupoImagens, { grupoModelo })
  const gerarUploadUrl = useMutation(api.imagens.gerarUploadUrl)
  const adicionar = useMutation(api.imagens.adicionarCandidata)
  const definir = useMutation(api.imagens.definirImagensGrupo)

  const [estado, despachar] = useReducer(reduzir, ESTADO_INICIAL)
  const [aGuardar, setAGuardar] = useState(false)
  const [aEnviar, setAEnviar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
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
  const ocupado = aEnviar || aGuardar

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
        const existente =
          estadoAtual.current.candidatas.find((c) => c._id === candidataId) ??
          (dadosAtuais.current
            ? candidatasDe(dadosAtuais.current).find(
                (c) => c._id === candidataId
              )
            : undefined)
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
    <section
      aria-label="Imagens"
      className="flex min-w-0 flex-col gap-3 rounded-lg border bg-background p-3"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">Imagens</h3>
        {refs.length > 1 && (
          <select
            aria-label="Lista de imagens"
            value={estado.refAtiva ?? GRUPO}
            onChange={(e) =>
              despachar({
                tipo: "ativar-ref",
                ref: e.target.value === GRUPO ? null : e.target.value,
              })
            }
            className="h-8 max-w-full min-w-0 rounded-lg border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value={GRUPO}>Grupo (todas as variantes)</option>
            {refs.map((ref) => (
              <option key={ref} value={ref}>
                {ref}
              </option>
            ))}
          </select>
        )}
        {cores.length > 1 && semOverrides && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-800">
            {cores.length} cores, 1 lista
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={onFechar}
          disabled={ocupado}
          aria-label="Fechar"
        >
          <X />
        </Button>
      </header>

      {dados === undefined ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">
              A primeira imagem é a capa. Arraste para reordenar.
            </span>
            <FaixaOrdenavel
              itens={lista}
              onReordenar={(de, para) =>
                despachar({ tipo: "reordenar", de, para })
              }
              onRemover={(ficheiro) => despachar({ tipo: "remover", ficheiro })}
              onCapa={(ficheiro) => despachar({ tipo: "capa", ficheiro })}
              acoesExtra={(item) =>
                acoesDaImagem(
                  item,
                  estado.candidatas.find((c) => c.ficheiro === item.ficheiro)
                )
              }
              vazio={
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  Escolha candidatas abaixo ou adicione imagens.
                </p>
              }
            />
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
                    <h4 className="text-xs font-medium text-muted-foreground">
                      {rotuloFonte(g.fonte)}{" "}
                      <span className="font-normal">({g.itens.length})</span>
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
          onClick={onFechar}
          disabled={ocupado}
        >
          Cancelar
        </Button>
        <Button
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
  return (
    <li className="relative">
      <button
        type="button"
        aria-pressed={escolhida}
        aria-label={escolhida ? "Já escolhida" : "Escolher imagem"}
        onClick={onEscolher}
        className={cn(
          "block aspect-square w-full overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          escolhida && "ring-2 ring-primary"
        )}
      >
        <img
          src={candidata.url}
          alt=""
          loading="lazy"
          draggable={false}
          className={cn("size-full object-contain", escolhida && "opacity-60")}
        />
        {escolhida && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-4" strokeWidth={3} />
            </span>
          </span>
        )}
      </button>
      {candidata.cor && (
        <span className="pointer-events-none absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
          {rotuloValor(candidata.cor)}
        </span>
      )}
      {candidata.origemUrl && (
        <a
          href={candidata.origemUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir origem"
          className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-md bg-background/85 text-foreground hover:bg-background"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </li>
  )
}

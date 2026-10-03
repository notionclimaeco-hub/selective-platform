import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { arrayMove } from "@dnd-kit/sortable"
import { ImagePlus, Loader2 } from "lucide-react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { Janela, JanelaMeta } from "@/components/produtos/janela"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FaixaOrdenavel } from "@/components/imagens/faixa-ordenavel"
import { ZonaUpload } from "@/components/imagens/zona-upload"
import { useObjectUrls } from "@/components/imagens/use-object-urls"
import { enviarParaStorage, redimensionar } from "@/lib/imagens-ficheiro"
import type { ImagemItem } from "./sortable-image"

export type ManagerAlvo = {
  ref: string
  nome: string
  temGrupo: boolean
  aplicarAoGrupo: boolean
}

// Modal image manager for a single product ref. Handles upload, drag-to-reorder
// (first = cover), remove, and an optional "aplicar ao grupo" fan-out, then
// commits the ordered list via api.imagens.definirImagens.
export function ImageManager({
  alvo,
  onClose,
}: {
  alvo: ManagerAlvo
  onClose: () => void
}) {
  const dados = useQuery(api.imagens.listarPorRef, { ref: alvo.ref })
  const gerarUploadUrl = useMutation(api.imagens.gerarUploadUrl)
  const definirImagens = useMutation(api.imagens.definirImagens)

  const [itens, setItens] = useState<Array<ImagemItem>>([])
  const [aplicarAoGrupo, setAplicarAoGrupo] = useState(alvo.aplicarAoGrupo)
  const [aEnviar, setAEnviar] = useState(false)
  const [aGuardar, setAGuardar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const inicializado = useRef(false)
  // Previews for fresh uploads; revoked on removal and on unmount.
  const previews = useObjectUrls()

  // Seed local state once, when the server list first arrives for this ref.
  useEffect(() => {
    if (inicializado.current || dados === undefined) return
    if (dados === null) {
      setItens([])
    } else {
      setItens(
        dados.imagens
          .filter((i) => i.url !== null)
          .map((i) => ({ ficheiro: i.ficheiro, url: i.url as string }))
      )
    }
    inicializado.current = true
  }, [dados])

  function reordenar(de: string, para: string) {
    setItens((prev) => {
      const from = prev.findIndex((i) => i.ficheiro === de)
      const to = prev.findIndex((i) => i.ficheiro === para)
      if (from === -1 || to === -1) return prev
      return arrayMove(prev, from, to)
    })
  }

  async function enviarFicheiros(files: Array<File>) {
    if (files.length === 0) return
    setErro(null)
    setAEnviar(true)
    try {
      for (const file of files) {
        const blob = await redimensionar(file)
        const storageId = await enviarParaStorage(blob, () =>
          gerarUploadUrl({})
        )
        const preview = previews.criar(blob)
        setItens((prev) =>
          prev.some((i) => i.ficheiro === storageId)
            ? prev
            : [...prev, { ficheiro: storageId, url: preview }]
        )
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar ficheiros.")
    } finally {
      setAEnviar(false)
    }
  }

  function aoReceberFicheiros(files: Array<File>) {
    if (files.length === 0) {
      setErro("Só são aceites ficheiros de imagem.")
      return
    }
    void enviarFicheiros(files)
  }

  function definirCapa(ficheiro: string) {
    setItens((prev) => {
      const idx = prev.findIndex((i) => i.ficheiro === ficheiro)
      if (idx <= 0) return prev
      return arrayMove(prev, idx, 0)
    })
  }

  function remover(ficheiro: string) {
    const item = itens.find((i) => i.ficheiro === ficheiro)
    if (item) previews.revogar(item.url)
    setItens((prev) => prev.filter((i) => i.ficheiro !== ficheiro))
  }

  async function guardar() {
    setErro(null)
    setAGuardar(true)
    try {
      await definirImagens({
        ref: alvo.ref,
        imagens: itens.map((i) => i.ficheiro as Id<"_storage">),
        aplicarAoGrupo: alvo.temGrupo ? aplicarAoGrupo : undefined,
      })
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao guardar.")
    } finally {
      setAGuardar(false)
    }
  }

  const ocupado = aEnviar || aGuardar

  return (
    <Janela
      titulo="Gerir imagens"
      onFechar={onClose}
      bloqueada={ocupado}
      rodape={
        // Stacks on phones: the checkbox label is too long to share a row
        // with two buttons at 320–390px.
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {alvo.temGrupo ? (
            <label className="flex min-w-0 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-primary"
                checked={aplicarAoGrupo}
                disabled={ocupado}
                onChange={(e) => setAplicarAoGrupo(e.target.checked)}
              />
              Aplicar a todas as variantes do grupo
            </label>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={ocupado}>
              Cancelar
            </Button>
            <Button onClick={() => void guardar()} disabled={ocupado}>
              {aGuardar && <Loader2 className="animate-spin" />}
              {aGuardar ? "A guardar…" : "Guardar"}
            </Button>
          </div>
        </div>
      }
    >
      <JanelaMeta>
        <span className="font-medium break-words">{alvo.nome}</span>
        <span className="break-all text-muted-foreground">Ref. {alvo.ref}</span>
        <span className="ml-auto text-muted-foreground tabular-nums">
          {itens.length} {itens.length === 1 ? "imagem" : "imagens"}
        </span>
      </JanelaMeta>

      {/* Swallow drops that miss the upload zone (padding) so the browser
          doesn't navigate to the file. */}
      <div
        className="flex-1 overflow-y-auto px-5 py-5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
      >
        {dados === undefined ? (
          <div role="status" className="flex flex-col gap-3">
            <span className="sr-only">A carregar…</span>
            <div aria-hidden className="flex items-center gap-3">
              <Skeleton className="h-9 w-44 rounded-lg" />
              <Skeleton className="h-3 w-48 rounded-md" />
            </div>
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
          <ZonaUpload
            ocupado={ocupado}
            onFicheiros={aoReceberFicheiros}
            rotulo={aEnviar ? "A enviar…" : "Adicionar imagens"}
            nota="A primeira é a capa. Arraste para reordenar."
          >
            <FaixaOrdenavel
              itens={itens}
              onReordenar={reordenar}
              onRemover={remover}
              onCapa={definirCapa}
              vazio={
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-input bg-secondary/30 px-6 py-12 text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-background ring-1 ring-border">
                    <ImagePlus className="size-5 text-muted-foreground" />
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Arraste imagens para aqui ou use “Adicionar imagens”.
                  </p>
                </div>
              }
            />

            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
          </ZonaUpload>
        )}
      </div>
    </Janela>
  )
}

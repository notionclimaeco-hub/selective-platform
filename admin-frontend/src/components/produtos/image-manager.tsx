import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors
  
} from "@dnd-kit/core"
import type {DragEndEvent} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { ImagePlus, Loader2, X } from "lucide-react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { SortableImage  } from "./sortable-image"
import type {ImagemItem} from "./sortable-image";

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
  const [aArrastar, setAArrastar] = useState(false)
  // Nested dragenter/dragleave events fire per child element; a counter keeps
  // the drop overlay stable until the pointer truly leaves the drop zone.
  const dragDepth = useRef(0)

  const inicializado = useRef(false)
  // Object URLs created for fresh uploads, revoked on unmount to avoid leaks.
  const objectUrls = useRef<Array<string>>([])

  // Seed local state once, when the server list first arrives for this ref.
  useEffect(() => {
    if (inicializado.current || dados === undefined) return
    if (dados === null) {
      setItens([])
    } else {
      setItens(
        dados.imagens
          .filter((i) => i.url !== null)
          .map((i) => ({ ficheiro: i.ficheiro, url: i.url as string })),
      )
    }
    inicializado.current = true
  }, [dados])

  useEffect(() => {
    return () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url)
    }
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItens((prev) => {
      const from = prev.findIndex((i) => i.ficheiro === active.id)
      const to = prev.findIndex((i) => i.ficheiro === over.id)
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
        const url = await gerarUploadUrl({})
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        })
        if (!res.ok) throw new Error(`Upload falhou (${res.status})`)
        const { storageId } = (await res.json()) as { storageId: string }
        const preview = URL.createObjectURL(file)
        objectUrls.current.push(preview)
        setItens((prev) =>
          prev.some((i) => i.ficheiro === storageId)
            ? prev
            : [...prev, { ficheiro: storageId, url: preview }],
        )
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar ficheiros.")
    } finally {
      setAEnviar(false)
    }
  }

  function apenasImagens(files: Array<File>) {
    return files.filter((f) => f.type.startsWith("image/"))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    dragDepth.current = 0
    setAArrastar(false)
    if (ocupado) return
    const files = apenasImagens(Array.from(e.dataTransfer.files))
    if (files.length === 0) {
      setErro("Só são aceites ficheiros de imagem.")
      return
    }
    void enviarFicheiros(files)
  }

  function handleDragEnter(e: React.DragEvent) {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return
    dragDepth.current += 1
    setAArrastar(true)
  }

  function handleDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setAArrastar(false)
  }

  function definirCapa(ficheiro: string) {
    setItens((prev) => {
      const idx = prev.findIndex((i) => i.ficheiro === ficheiro)
      if (idx <= 0) return prev
      return arrayMove(prev, idx, 0)
    })
  }

  function remover(ficheiro: string) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={ocupado ? undefined : onClose}
      />

      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-medium">Gerir imagens</h2>
            <p className="text-sm break-words text-muted-foreground">
              {alvo.nome}
            </p>
            <p className="text-xs break-all text-muted-foreground">
              Ref.: {alvo.ref}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            disabled={ocupado}
            aria-label="Fechar"
          >
            <X />
          </Button>
        </header>

        <div
          className="relative flex-1 overflow-y-auto px-5 py-4"
          onDragEnter={handleDragEnter}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {aArrastar && (
            <div className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary bg-primary/5 text-primary">
              <ImagePlus className="size-8" />
              <p className="text-sm font-medium">Largar para adicionar</p>
            </div>
          )}
          {dados === undefined ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-4xl border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
                  <ImagePlus className="size-4" />
                  {aEnviar ? "A enviar…" : "Adicionar imagens"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={ocupado}
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      e.target.value = ""
                      void enviarFicheiros(files)
                    }}
                  />
                </label>
                <span className="text-xs text-muted-foreground">
                  A primeira imagem é a capa. Arraste para reordenar.
                </span>
              </div>

              {itens.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
                  <ImagePlus className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Arraste imagens para aqui ou use “Adicionar imagens”.
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={itens.map((i) => i.ficheiro)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-2 gap-3 min-[400px]:grid-cols-3 sm:grid-cols-4">
                      {itens.map((item, i) => (
                        <SortableImage
                          key={item.ficheiro}
                          item={item}
                          isCapa={i === 0}
                          onRemover={() => remover(item.ficheiro)}
                          onDefinirCapa={() => definirCapa(item.ficheiro)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {erro && (
                <p className="mt-4 text-sm text-destructive">{erro}</p>
              )}
            </>
          )}
        </div>

        {/* Stacks on phones: the checkbox label is too long to share a row
            with two buttons at 320–390px. */}
        <footer className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {alvo.temGrupo ? (
            <label className="flex min-w-0 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 shrink-0"
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
        </footer>
      </div>
    </div>
  )
}

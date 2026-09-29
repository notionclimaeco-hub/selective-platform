import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import type { ReactNode } from "react"

import { SortableImage } from "@/components/produtos/sortable-image"
import type { ImagemItem } from "@/components/produtos/sortable-image"

// Sortable image list; the first item is the cover ("capa"). Horizontal
// scroll strip on phones, grid from `sm` up. Callbacks identify images by
// `ficheiro` (storage id); `onReordenar(de, para)` moves `de` to where `para` is.
export function FaixaOrdenavel({
  itens,
  onReordenar,
  onRemover,
  onCapa,
  acoesExtra,
  vazio,
}: {
  itens: Array<ImagemItem>
  onReordenar: (de: string, para: string) => void
  onRemover: (ficheiro: string) => void
  onCapa: (ficheiro: string) => void
  acoesExtra?: (item: ImagemItem) => ReactNode
  vazio?: ReactNode
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onReordenar(String(active.id), String(over.id))
  }

  if (itens.length === 0) return <>{vazio ?? null}</>

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={itens.map((i) => i.ficheiro)}
        strategy={rectSortingStrategy}
      >
        <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0">
          {itens.map((item, i) => (
            <div key={item.ficheiro} className="w-32 shrink-0 sm:w-auto">
              <SortableImage
                item={item}
                isCapa={i === 0}
                onRemover={() => onRemover(item.ficheiro)}
                onDefinirCapa={() => onCapa(item.ficheiro)}
                acoes={acoesExtra?.(item)}
              />
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

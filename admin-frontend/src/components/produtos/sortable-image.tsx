import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Star, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type ImagemItem = {
  // Storage id doubles as the stable dnd id.
  ficheiro: string
  // Resolved URL (from the server) or an object URL for a fresh upload.
  url: string
}

// One draggable thumbnail in the image manager grid. The first item in the
// list is the cover ("capa").
export function SortableImage({
  item,
  isCapa,
  onRemover,
  onDefinirCapa,
}: {
  item: ImagemItem
  isCapa: boolean
  onRemover: () => void
  onDefinirCapa: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.ficheiro })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border bg-muted",
        isDragging && "z-10 opacity-70 ring-2 ring-ring",
      )}
    >
      <img
        src={item.url}
        alt=""
        className="size-full object-cover"
        draggable={false}
      />

      {isCapa && (
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
          <Star className="size-3 fill-current" />
          Capa
        </span>
      )}

      {/* Drag handle */}
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        className="absolute right-1.5 top-1.5 flex size-7 cursor-grab items-center justify-center rounded-md bg-background/80 text-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 pointer-coarse:opacity-100 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      {/* Bottom actions — always visible on touch screens (no hover there). */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 pointer-coarse:opacity-100">
        {!isCapa ? (
          <button
            type="button"
            onClick={onDefinirCapa}
            className="min-w-0 truncate rounded-md bg-background/85 px-2 py-1 text-xs font-medium text-foreground backdrop-blur hover:bg-background"
          >
            Definir capa
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onRemover}
          aria-label="Remover imagem"
          className="flex size-7 items-center justify-center rounded-md bg-background/85 text-destructive backdrop-blur hover:bg-background"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}

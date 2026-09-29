import { useRef, useState } from "react"
import type { ReactNode } from "react"
import { ImagePlus } from "lucide-react"

// Drop target plus an "add files" button. `onFicheiros` receives only image
// files; an empty array means a drop held no images (callers show an error).
// Drops and the picker are ignored while `ocupado`.
export function ZonaUpload({
  ocupado,
  onFicheiros,
  rotulo,
  children,
}: {
  ocupado: boolean
  onFicheiros: (files: Array<File>) => void
  rotulo: string
  children?: ReactNode
}) {
  const [aArrastar, setAArrastar] = useState(false)
  // Nested dragenter/dragleave events fire per child element; a counter keeps
  // the drop overlay stable until the pointer truly leaves the drop zone.
  const dragDepth = useRef(0)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    dragDepth.current = 0
    setAArrastar(false)
    if (ocupado) return
    onFicheiros(
      Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      )
    )
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

  return (
    <div
      className="relative flex flex-col gap-3"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {aArrastar && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary bg-primary/5 text-primary">
          <ImagePlus className="size-8" />
          <p className="text-sm font-medium">Largar para adicionar</p>
        </div>
      )}
      <label className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-4xl border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
        <ImagePlus className="size-4" />
        {rotulo}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          disabled={ocupado}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ""
            if (files.length > 0) onFicheiros(files)
          }}
        />
      </label>
      {children}
    </div>
  )
}

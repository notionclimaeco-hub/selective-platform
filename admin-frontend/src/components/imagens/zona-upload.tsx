import { useRef, useState } from "react"
import type { ReactNode } from "react"
import { ImagePlus } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Drop target plus an "add files" button. `onFicheiros` receives only image
// files; an empty array means a drop held no images (callers show an error).
// Drops and the picker are ignored while `ocupado`. `nota` is a short hint
// set on the button's row.
export function ZonaUpload({
  ocupado,
  onFicheiros,
  rotulo,
  nota,
  children,
}: {
  ocupado: boolean
  onFicheiros: (files: Array<File>) => void
  rotulo: string
  nota?: ReactNode
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
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary bg-background/90 text-primary backdrop-blur-[2px]">
          <ImagePlus className="size-7" />
          <p className="text-sm font-medium">Largar para adicionar</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label
          aria-disabled={ocupado || undefined}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "cursor-pointer has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/25",
            ocupado && "cursor-default opacity-50"
          )}
        >
          <ImagePlus data-icon="inline-start" />
          {rotulo}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={ocupado}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              e.target.value = ""
              if (files.length > 0) onFicheiros(files)
            }}
          />
        </label>
        {nota && <span className="text-xs text-muted-foreground">{nota}</span>}
      </div>
      {children}
    </div>
  )
}

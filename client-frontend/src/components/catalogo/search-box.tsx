import { useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"

// The box owns the text while the user types and only commits to the URL (via
// `onBusca`) after a pause — one query per phrase, not one per keystroke.
const ATRASO_MS = 300

export function SearchBox({
  valor,
  onBusca,
  className,
}: {
  /** Committed term (from the URL). */
  valor: string
  onBusca: (termo: string | undefined) => void
  className?: string
}) {
  const [texto, setTexto] = useState(valor)
  const ultimoCommit = useRef(valor)
  const onBuscaRef = useRef(onBusca)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onBuscaRef.current = onBusca
  }, [onBusca])

  // Follow the URL when it changes from the outside (Limpar, back button) but
  // never clobber what the user is typing right now.
  useEffect(() => {
    if (valor !== ultimoCommit.current) {
      ultimoCommit.current = valor
      setTexto(valor)
    }
  }, [valor])

  useEffect(() => {
    const limpo = texto.trim()
    if (limpo === ultimoCommit.current) return
    const id = setTimeout(() => {
      ultimoCommit.current = limpo
      onBuscaRef.current(limpo === "" ? undefined : limpo)
    }, ATRASO_MS)
    return () => clearTimeout(id)
  }, [texto])

  function commit(limpo: string) {
    ultimoCommit.current = limpo
    onBusca(limpo === "" ? undefined : limpo)
  }

  // "/" jumps to the search box, like every search-first UI does.
  useEffect(() => {
    function atalho(e: KeyboardEvent) {
      const alvo = e.target
      const aEscrever =
        alvo instanceof HTMLElement &&
        (alvo.tagName === "INPUT" ||
          alvo.tagName === "TEXTAREA" ||
          alvo.tagName === "SELECT" ||
          alvo.isContentEditable)
      if (e.key === "/" && !aEscrever) {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener("keydown", atalho)
    return () => window.removeEventListener("keydown", atalho)
  }, [])

  function limpar() {
    setTexto("")
    commit("")
    input.current?.focus()
  }

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={input}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // Commit now instead of waiting out the debounce; blurring also
            // dismisses the phone keyboard so the results are visible.
            commit(texto.trim())
            input.current?.blur()
          } else if (e.key === "Escape") {
            if (texto !== "") limpar()
            else input.current?.blur()
          }
        }}
        placeholder="Pesquisar por nome, referência ou gama…"
        aria-label="Pesquisar no catálogo"
        className="h-11 w-full rounded-xl border border-input bg-background pr-10 pl-10 text-[15px] shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {texto === "" ? (
        <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border bg-secondary px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground sm:block">
          /
        </kbd>
      ) : (
        <button
          type="button"
          onClick={limpar}
          aria-label="Limpar pesquisa"
          className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

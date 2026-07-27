import { useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { CornerDownLeft, Search, X } from "lucide-react"

import { api } from "@convex/_generated/api"
import { eur, rotuloFamilia, rotuloMarca } from "@/lib/catalogo"
import { cn } from "@/lib/utils"

// Search box for the catalog. Owns the text while the user types and only
// commits (into the URL, via `onBusca`) after a short pause, so each keystroke
// does not trigger a query and a re-render of the whole grid.
const ATRASO_MS = 250
// Below this, a typeahead matches almost everything and helps nobody.
const MIN_SUGESTAO = 2

export function CatalogSearch({
  valor,
  onBusca,
}: {
  valor: string
  onBusca: (termo: string | undefined) => void
}) {
  const navigate = useNavigate()
  const [texto, setTexto] = useState(valor)
  const [termoAdiado, setTermoAdiado] = useState(valor)
  const [focado, setFocado] = useState(false)
  // Index of the keyboard-highlighted suggestion; -1 = "search for the text".
  const [ativo, setAtivo] = useState(-1)
  const input = useRef<HTMLInputElement>(null)

  // Follow the URL when it changes from the outside (chip removed, back button).
  useEffect(() => {
    setTexto(valor)
  }, [valor])

  useEffect(() => {
    const id = setTimeout(() => setTermoAdiado(texto.trim()), ATRASO_MS)
    return () => clearTimeout(id)
  }, [texto])

  useEffect(() => {
    if (termoAdiado === valor) return
    onBusca(termoAdiado === "" ? undefined : termoAdiado)
  }, [termoAdiado, valor, onBusca])

  const { data: sugestoes } = useQuery(
    convexQuery(
      api.produtos.sugerirCatalogo,
      focado && termoAdiado.length >= MIN_SUGESTAO
        ? { termo: termoAdiado }
        : "skip"
    )
  )

  const abertas = focado && (sugestoes?.length ?? 0) > 0
  useEffect(() => {
    setAtivo(-1)
  }, [termoAdiado])

  // "/" and ⌘K jump to the search box, like every search-first UI does.
  useEffect(() => {
    function atalho(e: KeyboardEvent) {
      const alvo = e.target
      const aEscrever =
        alvo instanceof HTMLElement &&
        (alvo.tagName === "INPUT" ||
          alvo.tagName === "TEXTAREA" ||
          alvo.isContentEditable)
      const combo = e.key === "k" && (e.metaKey || e.ctrlKey)
      if (combo || (e.key === "/" && !aEscrever)) {
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
    setTermoAdiado("")
    onBusca(undefined)
    input.current?.focus()
  }

  function abrirSugestao(indice: number) {
    const sugestao = sugestoes?.[indice]
    if (!sugestao) return
    setFocado(false)
    input.current?.blur()
    void navigate({ to: "/produto/$ref", params: { ref: sugestao.ref } })
  }

  function teclas(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (abertas) {
        setFocado(false)
      } else {
        limpar()
        input.current?.blur()
      }
      return
    }
    if (!abertas) return
    const total = sugestoes?.length ?? 0
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setAtivo((i) => (i + 1 >= total ? -1 : i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setAtivo((i) => (i <= -1 ? total - 1 : i - 1))
    } else if (e.key === "Enter" && ativo >= 0) {
      e.preventDefault()
      abrirSugestao(ativo)
    } else if (e.key === "Enter") {
      // Plain Enter = search the typed text; commit it now instead of waiting
      // out the debounce.
      setTermoAdiado(texto.trim())
      setFocado(false)
      input.current?.blur()
    }
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={input}
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={() => setFocado(true)}
        // A click on a suggestion must land before the list unmounts.
        onBlur={() => setTimeout(() => setFocado(false), 120)}
        onKeyDown={teclas}
        role="combobox"
        aria-expanded={abertas}
        aria-controls="sugestoes-catalogo"
        aria-autocomplete="list"
        placeholder="Pesquisar por nome, referência, gama…"
        aria-label="Pesquisar no catálogo"
        className="h-12 w-full rounded-xl border bg-card pr-24 pl-11 text-sm shadow-sm transition-shadow outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
      />
      {texto === "" ? (
        <kbd className="pointer-events-none absolute top-1/2 right-4 hidden -translate-y-1/2 rounded border bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:block">
          /
        </kbd>
      ) : (
        <button
          type="button"
          onClick={limpar}
          aria-label="Limpar pesquisa"
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}

      {abertas && (
        <ul
          id="sugestoes-catalogo"
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-popover shadow-lg"
        >
          {sugestoes?.map((sugestao, i) => (
            <li
              key={sugestao.grupoModelo}
              role="option"
              aria-selected={i === ativo}
            >
              <button
                type="button"
                onMouseEnter={() => setAtivo(i)}
                onClick={() => abrirSugestao(i)}
                className={cn(
                  "flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors",
                  i === ativo && "bg-secondary"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {sugestao.nome}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {rotuloMarca(sugestao.marca)} ·{" "}
                    {rotuloFamilia(sugestao.familia)} · {sugestao.ref}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-primary">
                  {eur.format(sugestao.precoDesdeCents / 100)}
                </span>
              </button>
            </li>
          ))}
          <li className="flex items-center gap-1.5 border-t bg-secondary/40 px-4 py-2 text-xs text-muted-foreground">
            <CornerDownLeft className="size-3.5" />
            Enter para ver todos os resultados de “{texto.trim()}”
          </li>
        </ul>
      )}
    </div>
  )
}

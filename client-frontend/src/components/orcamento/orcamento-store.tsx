import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

// A single line in the client's quote request. We store enough to render the
// quote list without re-fetching from Convex. Prices are PVP (public) cents —
// reseller pricing is never handled client-side.
export type ItemOrcamento = {
  ref: string
  nome: string
  marca: string
  familia: string
  variante?: string
  pvpCents: number
  quantidade: number
  // Cover snapshot at add-time so the Orçamento page renders without another
  // query. capaPdfUrl (the catalog page) is kept for older stored lists.
  capaUrl?: string | null
  capaPdfUrl?: string | null
}

type NovoItem = Omit<ItemOrcamento, "quantidade">

type OrcamentoContextValue = {
  itens: Array<ItemOrcamento>
  /** Distinct product lines. */
  totalLinhas: number
  /** Sum of all quantities. */
  totalItens: number
  /** Sum of pvpCents * quantidade across lines. */
  totalCents: number
  /** True once the list has been read from localStorage (client only). */
  hidratado: boolean
  adicionar: (item: NovoItem, quantidade?: number) => void
  definirQuantidade: (ref: string, quantidade: number) => void
  remover: (ref: string) => void
  limpar: () => void
  /**
   * Put back the lines of an earlier snapshot that are no longer in the list,
   * at their old positions: the "Reverter" of a removal or a clear.
   */
  repor: (antes: Array<ItemOrcamento>) => void
  obter: (ref: string) => ItemOrcamento | undefined
}

const STORAGE_KEY = "clima-eco:orcamento:v1"
const MAX_QTD = 999

const OrcamentoContext = createContext<OrcamentoContextValue | null>(null)

function lerStorage(): Array<ItemOrcamento> {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Defensive: keep only well-formed entries so a corrupted/older payload
    // can never crash the app.
    return parsed.filter(
      (i): i is ItemOrcamento =>
        i &&
        typeof i.ref === "string" &&
        typeof i.nome === "string" &&
        typeof i.pvpCents === "number" &&
        typeof i.quantidade === "number",
    )
  } catch {
    return []
  }
}

function clamp(qtd: number): number {
  if (!Number.isFinite(qtd)) return 1
  return Math.min(MAX_QTD, Math.max(1, Math.round(qtd)))
}

export function OrcamentoProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<Array<ItemOrcamento>>([])
  const [hidratado, setHidratado] = useState(false)
  const hidratadoRef = useRef(false)

  // Hydrate from localStorage after mount to avoid SSR mismatch.
  useEffect(() => {
    setItens(lerStorage())
    hidratadoRef.current = true
    setHidratado(true)
  }, [])

  // Persist after every change, but only once hydrated so we never clobber the
  // stored list with the initial empty state.
  useEffect(() => {
    if (!hidratadoRef.current) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(itens))
    } catch {
      // Ignore quota / private-mode write failures.
    }
  }, [itens])

  const adicionar = useCallback((item: NovoItem, quantidade = 1) => {
    const qtd = clamp(quantidade)
    setItens((prev) => {
      const existente = prev.find((i) => i.ref === item.ref)
      if (existente) {
        return prev.map((i) =>
          i.ref === item.ref
            ? { ...i, ...item, quantidade: clamp(i.quantidade + qtd) }
            : i,
        )
      }
      return [...prev, { ...item, quantidade: qtd }]
    })
  }, [])

  const definirQuantidade = useCallback((ref: string, quantidade: number) => {
    setItens((prev) =>
      prev.map((i) =>
        i.ref === ref ? { ...i, quantidade: clamp(quantidade) } : i,
      ),
    )
  }, [])

  const remover = useCallback((ref: string) => {
    setItens((prev) => prev.filter((i) => i.ref !== ref))
  }, [])

  const limpar = useCallback(() => setItens([]), [])
  const repor = useCallback((antes: Array<ItemOrcamento>) => {
    setItens((prev) => {
      const presentes = new Set(prev.map((i) => i.ref))
      const out = [...prev]
      antes.forEach((item, indice) => {
        if (!presentes.has(item.ref)) out.splice(indice, 0, item)
      })
      return out
    })
  }, [])
  const obter = useCallback(
    (ref: string) => itens.find((i) => i.ref === ref),
    [itens],
  )

  const value = useMemo<OrcamentoContextValue>(() => {
    const totalItens = itens.reduce((acc, i) => acc + i.quantidade, 0)
    const totalCents = itens.reduce(
      (acc, i) => acc + i.pvpCents * i.quantidade,
      0,
    )
    return {
      itens,
      totalLinhas: itens.length,
      totalItens,
      totalCents,
      hidratado,
      adicionar,
      definirQuantidade,
      remover,
      limpar,
      repor,
      obter,
    }
  }, [
    itens,
    hidratado,
    adicionar,
    definirQuantidade,
    remover,
    limpar,
    repor,
    obter,
  ])

  return (
    <OrcamentoContext.Provider value={value}>
      {children}
    </OrcamentoContext.Provider>
  )
}

export function useOrcamento(): OrcamentoContextValue {
  const ctx = useContext(OrcamentoContext)
  if (!ctx) {
    throw new Error("useOrcamento deve ser usado dentro de <OrcamentoProvider>")
  }
  return ctx
}

import { X } from "lucide-react"

import { DIMENSOES, eur } from "@/lib/catalogo"
import { alternarValor, selecionados } from "@/lib/catalogo-search"
import type { FiltrosCatalogo } from "@/lib/catalogo-search"

type Ativo = {
  id: string
  rotulo: string
  limpar: Partial<FiltrosCatalogo>
}

/** Flat list of what is currently narrowing the results, each removable. */
function listar(filtros: FiltrosCatalogo): Array<Ativo> {
  const ativos: Array<Ativo> = []

  if (filtros.q) {
    ativos.push({
      id: "q",
      rotulo: `"${filtros.q}"`,
      limpar: { q: undefined },
    })
  }

  for (const { chave, rotulo, rotuloValor } of DIMENSOES) {
    for (const valor of selecionados(filtros, chave)) {
      ativos.push({
        id: `${chave}:${valor}`,
        rotulo: `${rotulo}: ${rotuloValor(valor)}`,
        limpar: alternarValor(filtros, chave, valor),
      })
    }
  }

  if (filtros.precoMin !== undefined || filtros.precoMax !== undefined) {
    const de = filtros.precoMin
    const ate = filtros.precoMax
    ativos.push({
      id: "preco",
      rotulo:
        de !== undefined && ate !== undefined
          ? `${eur.format(de)} – ${eur.format(ate)}`
          : de !== undefined
            ? `desde ${eur.format(de)}`
            : `até ${eur.format(ate ?? 0)}`,
      limpar: { precoMin: undefined, precoMax: undefined },
    })
  }

  if (filtros.kwMin !== undefined || filtros.kwMax !== undefined) {
    const de = filtros.kwMin
    const ate = filtros.kwMax
    ativos.push({
      id: "kw",
      rotulo:
        de !== undefined && ate !== undefined
          ? `${de} – ${ate} kW`
          : de !== undefined
            ? `desde ${de} kW`
            : `até ${ate} kW`,
      limpar: { kwMin: undefined, kwMax: undefined },
    })
  }

  if (filtros.foto) {
    ativos.push({
      id: "foto",
      rotulo: "Com fotografia",
      limpar: { foto: undefined },
    })
  }

  return ativos
}

export function ActiveFilters({
  filtros,
  onFiltrar,
  onLimpar,
}: {
  filtros: FiltrosCatalogo
  onFiltrar: (patch: Partial<FiltrosCatalogo>) => void
  onLimpar: () => void
}) {
  const ativos = listar(filtros)
  if (ativos.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ativos.map((ativo) => (
        <button
          key={ativo.id}
          type="button"
          onClick={() => onFiltrar(ativo.limpar)}
          className="group inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 py-1 pr-2 pl-3 text-xs font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-primary/10"
        >
          {ativo.rotulo}
          <X className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
          <span className="sr-only">Remover filtro</span>
        </button>
      ))}
      {ativos.length > 1 && (
        <button
          type="button"
          onClick={onLimpar}
          className="rounded-full px-2 py-1 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Limpar tudo
        </button>
      )}
    </div>
  )
}

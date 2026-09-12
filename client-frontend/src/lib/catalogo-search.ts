// The catalog's state lives entirely in the URL — `/produtos?q=mural&familia=
// ar-condicionado&marca=daikin&ordenar=preco-asc&pagina=2` — so every result
// page is shareable and the back button steps through what the user did.

import { FAMILIAS, ORDENACOES } from "./catalogo"
import type { Ordenacao } from "./catalogo"

export type FiltrosCatalogo = {
  q?: string
  familia?: string
  marca?: string
  ordenar?: Ordenacao
  /** 1-based in the URL (people read "página 2"); 0-based on the wire. */
  pagina?: number
}

export const POR_PAGINA = 24

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() !== ""
    ? valor.trim()
    : undefined
}

function paginaValida(valor: unknown): number | undefined {
  const n =
    typeof valor === "number"
      ? valor
      : typeof valor === "string"
        ? Number.parseInt(valor, 10)
        : NaN
  return Number.isInteger(n) && n >= 2 ? n : undefined
}

/** Route-level `validateSearch`: unknown or malformed params are dropped. */
export function validarBusca(search: Record<string, unknown>): FiltrosCatalogo {
  const ordenar = texto(search.ordenar)
  const familia = texto(search.familia)
  return {
    q: texto(search.q),
    familia:
      familia && FAMILIAS.some((f) => f === familia) ? familia : undefined,
    marca: texto(search.marca)?.toLowerCase(),
    ordenar: ORDENACOES.some((o) => o.valor === ordenar)
      ? (ordenar as Ordenacao)
      : undefined,
    pagina: paginaValida(search.pagina),
  }
}

/** Arguments for `api.catalogo.listar`, normalised so equal searches share a cache entry. */
export function argsCatalogo(filtros: FiltrosCatalogo) {
  return {
    busca: filtros.q,
    familia: filtros.familia,
    marca: filtros.marca,
    ordenar: filtros.ordenar ?? "relevancia",
    pagina: Math.max(0, (filtros.pagina ?? 1) - 1),
    porPagina: POR_PAGINA,
  }
}

/** What narrows the results (search, family, brand) — not sorting or paging. */
export function contarFiltrosAtivos(filtros: FiltrosCatalogo): number {
  return [filtros.q, filtros.familia, filtros.marca].filter(
    (v) => v !== undefined
  ).length
}

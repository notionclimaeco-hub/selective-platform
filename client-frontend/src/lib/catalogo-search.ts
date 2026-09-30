// The catalog's state lives entirely in the URL — `/produtos?q=mural&familia=
// ar-condicionado&marca=daikin&frio-kw=2.5..5&ordenar=preco-asc&pagina=2` — so
// every result page is shareable and the back button steps through what the
// user did.
//
// Hero-spec filters take one param per filter of the chosen familia (a hero
// key, or one side of the energy class): a range `min..max` for numeric keys
// (either end may be left open, "2.5.."), a comma list of values for the
// others ("classe-energetica-frio=A+++,A++").

import {
  classeValida,
  definicoesFiltro,
  filtroAtivo,
} from "@convex/lib/catalogoFiltros"
import type {
  DefFiltro,
  FiltroDestaque,
  PedidoCatalogo,
} from "@convex/lib/catalogoFiltros"
import { FAMILIAS, ORDENACOES } from "./catalogo"
import type { Ordenacao } from "./catalogo"

export type FiltrosCatalogo = {
  q?: string
  familia?: string
  marca?: string
  ordenar?: Ordenacao
  /** 1-based in the URL (people read "página 2"); 0-based in `paginar`. */
  pagina?: number
  /** Hero-spec filters, keyed by filter key (see above). */
  [chave: string]: string | number | undefined
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

function numeroOpcional(parte: string | undefined): number | undefined | null {
  if (parte === undefined || parte === "") return undefined
  const n = Number(parte)
  return Number.isFinite(n) ? n : null
}

/**
 * A hero filter from its URL param. The router hands over numbers for params
 * that read as JSON ("2" → 2), so both types are accepted. Malformed → undefined;
 * a side filter keeps only energy classes.
 */
export function lerFiltro(
  def: DefFiltro,
  bruto: unknown
): FiltroDestaque | undefined {
  const valor = typeof bruto === "number" ? String(bruto) : texto(bruto)
  if (valor === undefined) return undefined
  if (def.hero.tipo !== "numero") {
    const valores = [
      ...new Set(
        valor
          .split(",")
          .map((v) => v.trim())
          .filter((v) =>
            def.lado === undefined ? v !== "" : classeValida(v)
          )
      ),
    ]
    return valores.length > 0 ? { valores } : undefined
  }
  const partes = valor.split("..")
  if (partes.length !== 2) return undefined
  const min = numeroOpcional(partes[0])
  const max = numeroOpcional(partes[1])
  if (min === null || max === null) return undefined
  if (min === undefined && max === undefined) return undefined
  if (min !== undefined && max !== undefined && min > max) return undefined
  return { min, max }
}

/**
 * The URL param for a hero filter; undefined clears it. A lone numeric value
 * ("2" tubos) goes as a number so the router does not quote it.
 */
export function escreverFiltro(
  filtro: FiltroDestaque | undefined
): string | number | undefined {
  if (filtro === undefined || !filtroAtivo(filtro)) return undefined
  if ("valores" in filtro) {
    const lista = filtro.valores.join(",")
    return /^\d+$/.test(lista) ? Number(lista) : lista
  }
  return `${filtro.min ?? ""}..${filtro.max ?? ""}`
}

/** Route-level `validateSearch`: unknown or malformed params are dropped. */
export function validarBusca(search: Record<string, unknown>): FiltrosCatalogo {
  const ordenar = texto(search.ordenar)
  const familia = texto(search.familia)
  const familiaValida =
    familia && FAMILIAS.some((f) => f === familia) ? familia : undefined
  const filtros: FiltrosCatalogo = {
    q: texto(search.q),
    familia: familiaValida,
    marca: texto(search.marca)?.toLowerCase(),
    ordenar: ORDENACOES.some((o) => o.valor === ordenar)
      ? (ordenar as Ordenacao)
      : undefined,
    pagina: paginaValida(search.pagina),
  }
  // Hero filters only exist within their familia.
  for (const def of familiaValida ? definicoesFiltro(familiaValida) : []) {
    const valor = escreverFiltro(lerFiltro(def, search[def.chave]))
    if (valor !== undefined) filtros[def.chave] = valor
  }
  return filtros
}

/** The chosen familia's hero filters, parsed. */
export function filtrosDestaque(
  filtros: FiltrosCatalogo
): Record<string, FiltroDestaque> {
  const familia = filtros.familia
  if (familia === undefined) return {}
  return Object.fromEntries(
    definicoesFiltro(familia).flatMap((def) => {
      const filtro = lerFiltro(def, filtros[def.chave])
      return filtro ? [[def.chave, filtro]] : []
    })
  )
}

/** The URL minus every hero filter (they belong to the familia being left). */
export function semFiltrosDestaque(filtros: FiltrosCatalogo): FiltrosCatalogo {
  const { q, familia, marca, ordenar, pagina } = filtros
  return { q, familia, marca, ordenar, pagina }
}

/** What `filtrarCatalogo` needs from the URL. */
export function pedidoCatalogo(filtros: FiltrosCatalogo): PedidoCatalogo {
  return {
    busca: filtros.q,
    familia: filtros.familia,
    marca: filtros.marca,
    filtros: filtrosDestaque(filtros),
    ordenar: filtros.ordenar ?? "relevancia",
  }
}

/** What narrows the results (search, family, brand, hero specs). */
export function contarFiltrosAtivos(filtros: FiltrosCatalogo): number {
  return (
    [filtros.q, filtros.familia, filtros.marca].filter((v) => v !== undefined)
      .length + Object.keys(filtrosDestaque(filtros)).length
  )
}

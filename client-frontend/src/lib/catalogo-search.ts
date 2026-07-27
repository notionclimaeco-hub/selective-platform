// The catalog search state lives entirely in the URL, so every result page is
// shareable and the browser's back button steps through the user's filtering.
//
// Multi-select facets are comma-separated lists ("?marca=daikin,midea") rather
// than repeated or JSON-encoded params: it keeps links short and readable, and
// a single-value link like "?marca=daikin" (used by the landing marquee) is a
// valid list of one.

import { DIMENSOES, ORDENACOES } from "./catalogo"
import type { DimensaoChave, Ordenacao } from "./catalogo"

export type Vista = "grelha" | "lista"

export type FiltrosCatalogo = {
  q?: string
  familia?: string
  marca?: string
  tipo?: string
  componente?: string
  sistema?: string
  segmento?: string
  classe?: string
  refrigerante?: string
  precoMin?: number
  precoMax?: number
  kwMin?: number
  kwMax?: number
  foto?: boolean
  ordenar?: Ordenacao
  vista?: Vista
  pagina?: number
}

/** URL param name for each facet dimension. */
export const PARAM_DIMENSAO: Record<DimensaoChave, keyof FiltrosCatalogo> = {
  familia: "familia",
  marca: "marca",
  tipoUnidade: "tipo",
  componente: "componente",
  sistema: "sistema",
  segmento: "segmento",
  classeEnergetica: "classe",
  refrigerante: "refrigerante",
}

export function lerLista(valor: unknown): Array<string> {
  if (typeof valor !== "string") return []
  return valor
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "")
}

/** Empty list → undefined so the param drops out of the URL entirely. */
export function escreverLista(valores: Array<string>): string | undefined {
  return valores.length > 0 ? valores.join(",") : undefined
}

export function selecionados(
  filtros: FiltrosCatalogo,
  dimensao: DimensaoChave
): Array<string> {
  return lerLista(filtros[PARAM_DIMENSAO[dimensao]])
}

/** Toggle one value of a multi-select facet, preserving the others. */
export function alternarValor(
  filtros: FiltrosCatalogo,
  dimensao: DimensaoChave,
  valor: string
): Partial<FiltrosCatalogo> {
  const atuais = selecionados(filtros, dimensao)
  const proximos = atuais.includes(valor)
    ? atuais.filter((v) => v !== valor)
    : [...atuais, valor]
  return { [PARAM_DIMENSAO[dimensao]]: escreverLista(proximos) }
}

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() !== ""
    ? valor.trim()
    : undefined
}

function numero(valor: unknown): number | undefined {
  const n =
    typeof valor === "number"
      ? valor
      : typeof valor === "string"
        ? Number.parseFloat(valor)
        : NaN
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function inteiroPositivo(valor: unknown): number | undefined {
  const n = numero(valor)
  return n !== undefined && n >= 1 ? Math.floor(n) : undefined
}

/** Route-level `validateSearch`: unknown params are dropped, not trusted. */
export function validarBusca(search: Record<string, unknown>): FiltrosCatalogo {
  const ordenarBruto = texto(search.ordenar)
  const ordenar = ORDENACOES.some((o) => o.valor === ordenarBruto)
    ? (ordenarBruto as Ordenacao)
    : undefined
  const vista = search.vista === "lista" ? "lista" : undefined

  const filtros: FiltrosCatalogo = {
    q: texto(search.q),
    precoMin: numero(search.precoMin),
    precoMax: numero(search.precoMax),
    kwMin: numero(search.kwMin),
    kwMax: numero(search.kwMax),
    foto: search.foto === true || search.foto === "1" ? true : undefined,
    ordenar,
    vista,
    pagina: inteiroPositivo(search.pagina),
  }
  const listas = filtros as Record<string, string | undefined>
  for (const { chave } of DIMENSOES) {
    const param = PARAM_DIMENSAO[chave]
    // Re-serialising the parsed list normalises stray spaces and empty items.
    listas[param] = escreverLista(lerLista(search[param]))
  }
  return filtros
}

/** Arguments for `api.produtos.listarCatalogo`. */
export function argsCatalogo(filtros: FiltrosCatalogo, porPagina: number) {
  return {
    busca: filtros.q,
    marcas: lerLista(filtros.marca),
    familias: lerLista(filtros.familia),
    tiposUnidade: lerLista(filtros.tipo),
    componentes: lerLista(filtros.componente),
    sistemas: lerLista(filtros.sistema),
    segmentos: lerLista(filtros.segmento),
    classesEnergeticas: lerLista(filtros.classe),
    refrigerantes: lerLista(filtros.refrigerante),
    precoMinCents:
      filtros.precoMin !== undefined
        ? Math.round(filtros.precoMin * 100)
        : undefined,
    precoMaxCents:
      filtros.precoMax !== undefined
        ? Math.round(filtros.precoMax * 100)
        : undefined,
    frioKwMin: filtros.kwMin,
    frioKwMax: filtros.kwMax,
    apenasComFoto: filtros.foto,
    ordenar: filtros.ordenar ?? "relevancia",
    pagina: Math.max(0, (filtros.pagina ?? 1) - 1),
    porPagina,
  }
}

/** Everything except pagination/sorting/view — i.e. what narrows the results. */
export function contarFiltrosAtivos(filtros: FiltrosCatalogo): number {
  let n = 0
  for (const { chave } of DIMENSOES) {
    n += selecionados(filtros, chave).length
  }
  if (filtros.q) n += 1
  if (filtros.precoMin !== undefined || filtros.precoMax !== undefined) n += 1
  if (filtros.kwMin !== undefined || filtros.kwMax !== undefined) n += 1
  if (filtros.foto) n += 1
  return n
}

/** Keeps sorting and view mode, clears everything that filters. */
export function semFiltros(filtros: FiltrosCatalogo): FiltrosCatalogo {
  return { ordenar: filtros.ordenar, vista: filtros.vista }
}

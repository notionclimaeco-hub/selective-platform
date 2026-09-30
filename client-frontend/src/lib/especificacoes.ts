// How spec keys and values read in the shop: labels and units from the spec
// registry, numbers in Portuguese notation, enum slugs as words. The catalog
// card, the product page and the Filtros controls all format through here.

import { ladoDeFiltro } from "@convex/lib/catalogoFiltros"
import type { Destaque } from "@convex/lib/catalogoFiltros"
import {
  PADRAO_CLASSE_ENERGETICA,
  PADRAO_DIMENSOES,
  definicaoChave,
  rotuloChave as rotuloChaveRegisto,
} from "@convex/lib/specRegistry"

// The live catalog still carries a few pre-registry keys until every brand is
// reloaded (#44–#47, cutover #53); label those here so nothing renders as a
// raw slug meanwhile.
const ROTULOS_LEGADO: Partial<Record<string, string>> = {
  capacidade: "Capacidade (kW)",
  deposito: "Depósito",
  comando: "Comando",
  modo: "Modo",
  caudal: "Caudal",
}

/** "Classe energética (frio)": a side filter names its side. */
function rotuloLado(chave: string): string | undefined {
  const lado = ladoDeFiltro(chave)
  return lado && `${lado.hero.rotulo} (${lado.lado})`
}

/** "Frio (kW)": the registry label with its unit. */
export function rotuloChave(chave: string): string {
  return (
    ROTULOS_LEGADO[chave] ?? rotuloLado(chave) ?? rotuloChaveRegisto(chave)
  )
}

/** "Frio": the registry label alone, for places that show the unit apart. */
export function rotuloCurto(chave: string): string {
  return definicaoChave(chave)?.rotulo ?? rotuloChave(chave)
}

export function unidadeDe(chave: string): string | undefined {
  return definicaoChave(chave)?.unidade
}

const numero = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 })

export function formatarNumero(n: number): string {
  return numero.format(n)
}

function numeroOuTexto(valor: string): string {
  const n = Number.parseFloat(valor.replace(",", "."))
  return Number.isFinite(n) ? formatarNumero(n) : valor
}

// Enum values are slugs; these need accents or more than a capital letter.
const ROTULOS_VALOR: Record<string, string> = {
  nao: "Não",
  monofasica: "Monofásica",
  trifasica: "Trifásica",
  media: "Média",
  "branco-perola": "Branco pérola",
}

function deslug(valor: string): string {
  const texto = valor.replace(/-/g, " ")
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function palavra(valor: string): string {
  return /^[a-z][a-z0-9-]*$/.test(valor)
    ? (ROTULOS_VALOR[valor] ?? deslug(valor))
    : valor
}

/**
 * A stored value as the shop shows it, without its unit (the label carries
 * it): "2.5" → "2,5", "monofasica" → "Monofásica", "600x570x300" →
 * "600 × 570 × 300". Refs, refrigerants and series codes stay as stored.
 */
export function formatarValor(chave: string, valor: string): string {
  const def = definicaoChave(chave)
  // Pre-registry keys: lower-case slugs ("nao", "castanho-escuro") read as
  // words, anything else as stored.
  if (def === undefined) return palavra(valor)
  switch (def.tipo) {
    case "numero":
      return numeroOuTexto(valor)
    case "enum":
    case "booleano":
      return ROTULOS_VALOR[valor] ?? deslug(valor)
    case "texto":
      if (def.padrao === PADRAO_DIMENSOES) {
        return valor.split("x").map(numeroOuTexto).join(" × ")
      }
      // Lower-case slugs ("comando") read as words; refs and codes as stored.
      return palavra(valor)
  }
}

/** "2,5–7,1 kW", "200 L", "3,5 kW": a numeric span with its unit. */
export function formatarIntervalo(
  chave: string,
  min: number,
  max: number
): string {
  const unidade = unidadeDe(chave)
  const valor =
    min === max
      ? formatarNumero(min)
      : `${formatarNumero(min)}–${formatarNumero(max)}`
  return unidade ? `${valor} ${unidade}` : valor
}

/**
 * One hero spec as the catalog card prints it. Energy classes show the best
 * pair only; unit-less numeric enums name themselves ("2/4 tubos"); longer
 * value lists show two and count the rest.
 */
function destaqueCurto(d: Destaque): string {
  if (d.tipo === "intervalo") return formatarIntervalo(d.chave, d.min, d.max)
  const def = definicaoChave(d.chave)
  if (def?.padrao === PADRAO_CLASSE_ENERGETICA) return d.valores[0] ?? ""
  const valores = d.valores.map((v) => formatarValor(d.chave, v))
  const texto =
    valores.length > 2
      ? `${valores.slice(0, 2).join("/")} +${valores.length - 2}`
      : valores.join("/")
  return def?.tipo === "enum" && d.valores.every((v) => /^\d+$/.test(v))
    ? `${texto} ${def.rotulo.toLowerCase()}`
    : texto
}

const MAX_DESTAQUES_CARTAO = 3

/**
 * The card's spec line: the page's hero specs in registry order, up to three,
 * e.g. ["2,5–7,1 kW", "A+++/A+"] or ["200 L", "3,5 kW"]. A spec whose unit an
 * earlier one already showed is left out ("Frio" and "Calor" would read as two
 * unlabelled kW spans).
 */
export function linhaDestaques(destaques: Array<Destaque>): Array<string> {
  const unidades = new Set<string>()
  const partes: Array<string> = []
  for (const d of destaques) {
    const unidade = d.tipo === "intervalo" ? unidadeDe(d.chave) : undefined
    if (unidade !== undefined) {
      if (unidades.has(unidade)) continue
      unidades.add(unidade)
    }
    const texto = destaqueCurto(d)
    if (texto !== "") partes.push(texto)
    if (partes.length === MAX_DESTAQUES_CARTAO) break
  }
  return partes
}

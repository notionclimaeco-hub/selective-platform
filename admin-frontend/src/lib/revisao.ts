// Pure logic of the import review page (#41): which attribute keys become
// columns of a staged group's variant table and which render as spec chips.
// Mirrors `client-frontend/src/components/produto/variant-table.tsx`, with
// the registry's hero specs pinned first instead of BTU.

import {
  heroSpecs,
  rotuloChave as rotuloChaveRegisto,
} from "@convex/lib/specRegistry"

export type Atributo = { chave: string; valor: string }

export type SkuTabela = {
  ref: string
  atributos: Array<Atributo>
  pvpCents: number
}

export function rotuloChave(chave: string): string {
  return rotuloChaveRegisto(chave)
}

// Slug values read better with spaces ("branco-perola" -> "branco perola").
export function rotuloValor(valor: string): string {
  return valor.replace(/-/g, " ")
}

// Distinct keys across the group, ordered by first appearance (= extraction
// order: variant axes first, specs after).
function chavesOrdenadas(skus: ReadonlyArray<SkuTabela>): Array<string> {
  const vistas = new Set<string>()
  const ordem: Array<string> = []
  for (const s of skus) {
    for (const a of s.atributos) {
      if (!vistas.has(a.chave)) {
        vistas.add(a.chave)
        ordem.push(a.chave)
      }
    }
  }
  return ordem
}

export function valorDe(s: SkuTabela, chave: string): string | undefined {
  return s.atributos.find((a) => a.chave === chave)?.valor
}

/**
 * Keys that distinguish SKUs within the group: present with ≥2 distinct
 * values, or missing on some SKUs. These become the table columns, with the
 * familia's hero specs first (registry order) and the rest in extraction order.
 */
export function chavesVariaveis(
  skus: ReadonlyArray<SkuTabela>,
  familia: string
): Array<string> {
  if (skus.length < 2) return []
  const variaveis = chavesOrdenadas(skus).filter((chave) => {
    const valores = new Set(skus.map((s) => valorDe(s, chave)))
    return valores.size > 1
  })
  const hero = heroSpecs(familia).filter((h) => variaveis.includes(h))
  return [...hero, ...variaveis.filter((c) => !hero.includes(c))]
}

/**
 * Attributes shared by every SKU of the group with the same value. These
 * render as spec chips instead of table columns. For a single SKU this is
 * simply all of its attributes.
 */
export function atributosComuns(
  skus: ReadonlyArray<SkuTabela>
): Array<Atributo> {
  if (skus.length === 0) return []
  const primeiro = skus[0]
  if (skus.length === 1) return primeiro.atributos
  return primeiro.atributos.filter((a) =>
    skus.every((s) => valorDe(s, a.chave) === a.valor)
  )
}

/** Every warning of the group, tagged with the SKU it belongs to. */
export function avisosDoGrupo(
  skus: ReadonlyArray<{ ref: string; avisos: ReadonlyArray<string> }>
): Array<{ ref: string; aviso: string }> {
  return skus.flatMap((s) => s.avisos.map((aviso) => ({ ref: s.ref, aviso })))
}

/** A group nothing changed in: collapsed by default on the review page. */
export function grupoInalterado(g: {
  numAvisos: number
  numNovos: number
  numAlterados: number
}): boolean {
  return g.numAvisos === 0 && g.numNovos === 0 && g.numAlterados === 0
}

/**
 * Approve dialog copy. With groups still unreviewed the staff member can
 * approve anyway (`forcar`), and the dialog says so.
 */
export function textoAprovacao(
  numSkus: number,
  marca: string,
  porRever: number
): { descricao: string; confirmarLabel: string } {
  const base = `Publica ${numSkus} SKUs no catálogo (substituem os atuais) e marca como descontinuadas as referências de ${marca} ausentes desta tabela.`
  if (porRever === 0) return { descricao: base, confirmarLabel: "Aprovar" }
  const grupos =
    porRever === 1
      ? "1 grupo ainda por rever"
      : `${porRever} grupos ainda por rever`
  return {
    descricao: `${grupos}: entram como estão, com as imagens escolhidas pelo agente. ${base}`,
    confirmarLabel: "Aprovar mesmo assim",
  }
}

// Pure logic of the import review page (#41). Which attribute keys become
// columns of a staged group's variant table and which render as spec chips is
// shared with the shop's product page (`convex/lib/especificacoes.ts`).

import { rotuloChave as rotuloChaveRegisto } from "@convex/lib/specRegistry"

export {
  atributosComuns,
  chavesVariaveis,
  valorDe,
} from "@convex/lib/especificacoes"
export type { Atributo } from "@convex/lib/especificacoes"

export function rotuloChave(chave: string): string {
  return rotuloChaveRegisto(chave)
}

// Slug values read better with spaces ("branco-perola" -> "branco perola").
export function rotuloValor(valor: string): string {
  return valor.replace(/-/g, " ")
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

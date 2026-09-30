import type { FunctionReturnType } from "convex/server"

import type { api } from "@convex/_generated/api"

type VistaEmpresa = FunctionReturnType<typeof api.empresas.minha>

/**
 * What the visitor can do with the quote list, from the session and
 * `api.empresas.minha`. Drives the Orçamento page's primary action.
 */
export type EstadoCompra =
  | "anonimo"
  | "a-carregar"
  | "registo"
  | "pendente"
  | "rejeitada"
  | "suspensa"
  | "aprovada"

export function estadoCompra(
  sessao: boolean,
  vista: VistaEmpresa | undefined
): EstadoCompra {
  if (!sessao) return "anonimo"
  // `minha` answers null until Convex has the session token.
  if (vista === undefined || vista === null) return "a-carregar"
  if (vista.kind !== "empresa") return "registo"
  return vista.empresa.estadoAprovacao
}

/**
 * Line and list totals in cents. `revenda` is the live reseller-price overlay
 * (null unless the visitor is an approved member); lines it does not cover
 * stay at PVP.
 */
export function totaisOrcamento(
  itens: ReadonlyArray<{ ref: string; pvpCents: number; quantidade: number }>,
  revenda: ReadonlyMap<string, number> | null
): { pvpCents: number; totalCents: number; unidades: number } {
  let pvpCents = 0
  let totalCents = 0
  let unidades = 0
  for (const i of itens) {
    pvpCents += i.pvpCents * i.quantidade
    totalCents += (revenda?.get(i.ref) ?? i.pvpCents) * i.quantidade
    unidades += i.quantidade
  }
  return { pvpCents, totalCents, unidades }
}

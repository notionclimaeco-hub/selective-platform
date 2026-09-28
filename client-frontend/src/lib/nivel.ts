import type { FunctionReturnType } from "convex/server"

import type { api } from "@convex/_generated/api"

/** Shape of `empresas.resumoTier` when the company has a tier. */
export type ResumoTier = NonNullable<
  FunctionReturnType<typeof api.empresas.resumoTier>
>

/**
 * Fill of the Nível progress bar, 0–100. The bar runs from zero to the next
 * threshold (not from the current threshold), which is what an installer
 * expects when they read "€3 200 de €10 000". A zero threshold is full.
 */
export function progressoNivel(
  volumeCents: number,
  limiarCents: number
): number {
  if (limiarCents <= 0) return 100
  const fraccao = volumeCents / limiarCents
  if (!Number.isFinite(fraccao) || fraccao <= 0) return 0
  return Math.min(100, Math.round(fraccao * 100))
}

/** Volume still missing to reach `limiarCents`, never negative. */
export function faltaParaProximo(
  volumeCents: number,
  limiarCents: number
): number {
  return Math.max(0, limiarCents - volumeCents)
}

/**
 * Reseller price: PVP minus the (marca × tier) discount, rounded to the cent.
 * Missing matrix cell is 0% — caller passes `descontoPercent = 0`.
 *
 * The discount matrix never leaves Convex; only final cents are returned.
 */
export function precoRevendaCents(
  pvpCents: number,
  descontoPercent: number,
): number {
  if (!Number.isFinite(pvpCents) || pvpCents < 0) {
    throw new Error("pvpCents must be a non-negative finite number");
  }
  if (!Number.isFinite(descontoPercent) || descontoPercent < 0) {
    throw new Error("descontoPercent must be a non-negative finite number");
  }
  if (descontoPercent === 0) {
    return Math.round(pvpCents);
  }
  return Math.round((pvpCents * (100 - descontoPercent)) / 100);
}

/**
 * Highest active tier whose limiarCents ≤ volumeCents.
 * Tiers must already be filtered to `ativa` and sorted by limiarCents ascending.
 * Never demotes — callers only use this when assigning or promoting, not when
 * a refund would drop the volume-derived tier below the current one.
 */
export function tierPorVolume<T extends { limiarCents: number }>(
  tiersAtivosOrdenados: readonly T[],
  volumeCents: number,
): T | null {
  let encontrado: T | null = null;
  for (const tier of tiersAtivosOrdenados) {
    if (tier.limiarCents <= volumeCents) {
      encontrado = tier;
    } else {
      break;
    }
  }
  return encontrado;
}

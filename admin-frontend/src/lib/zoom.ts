// Zoom maths for the review page's price-table viewer. 1 = page fits the
// viewer's width.

export const ZOOM_MIN = 1
export const ZOOM_MAX = 4
const PASSOS = [1, 1.25, 1.5, 2, 2.5, 3, 4]

const limitar = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

/** The next preset above (1) or below (-1) the current zoom. */
export function zoomSeguinte(zoom: number, direcao: 1 | -1): number {
  const passo =
    direcao === 1
      ? PASSOS.find((p) => p > zoom + 1e-6)
      : PASSOS.filter((p) => p < zoom - 1e-6).at(-1)
  return passo ?? limitar(zoom)
}

/** Continuous zoom from a ctrl/⌘ + wheel (or trackpad pinch) delta. */
export function zoomPorRoda(zoom: number, deltaY: number): number {
  return limitar(zoom * Math.exp(-deltaY * 0.002))
}

/**
 * New scroll offset (one axis) so the content point under `ancora` (px into
 * the viewport) stays under it when the content goes from `tamanho` to
 * `novoTamanho`.
 */
export function scrollAncorado(a: {
  scroll: number
  ancora: number
  tamanho: number
  novoTamanho: number
}): number {
  const fracao = (a.scroll + a.ancora) / a.tamanho
  return Math.max(0, fracao * a.novoTamanho - a.ancora)
}

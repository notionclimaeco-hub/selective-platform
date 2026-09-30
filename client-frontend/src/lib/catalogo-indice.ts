import { useConvex } from "convex/react"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"

import { api } from "@convex/_generated/api"
import { lerIndice } from "@convex/lib/catalogoFiltros"

// The catalog index is fetched once and kept for a few minutes rather than
// subscribed to: an import approval rewrites hundreds of rows, and a live
// subscription would push a fresh copy of the whole catalog to every open tab.
// A visitor sees the new catalog on their next visit or after the stale time.
const FRESCO_MS = 5 * 60_000

/** Every product page, decoded and ready for `filtrarCatalogo`. */
export function useIndiceCatalogo() {
  const convex = useConvex()
  return useQuery({
    queryKey: ["catalogo", "indice"],
    queryFn: () => convex.query(api.catalogo.indice, {}),
    select: lerIndice,
    staleTime: FRESCO_MS,
  })
}

/** Cover URLs of the product pages on screen, by grupoModelo. */
export function useCapas(
  grupos: Array<string>
): Map<string, string | null> | undefined {
  const { data } = useQuery(convexQuery(api.catalogo.capas, { grupos }))
  if (data === undefined) return undefined
  return new Map(data.map((c) => [c.grupoModelo, c.url]))
}

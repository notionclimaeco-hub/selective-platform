import { useAuth } from "@clerk/tanstack-react-start"
import { useQuery } from "convex/react"

import { api } from "@convex/_generated/api"

const MAX_REFS = 50
const MAX_GRUPOS = 40

/**
 * Live reseller-price overlay. `null` until Convex says this visitor is an
 * approved installer member — callers must keep rendering PVP in that case.
 * Never persist the returned cents.
 */
export function useMapaPrecosPorRef(
  refs: Array<string>,
): Map<string, number> | null {
  const { isSignedIn } = useAuth()
  const unique = [...new Set(refs.filter((r) => r.length > 0))].slice(
    0,
    MAX_REFS,
  )
  const data = useQuery(
    api.precos.porRefs,
    isSignedIn && unique.length > 0 ? { refs: unique } : "skip",
  )
  if (!data) return null
  return new Map(data.map((p) => [p.ref, p.precoRevendaCents]))
}

export function useMapaDesdePorGrupo(
  grupos: Array<string>,
): Map<string, number> | null {
  const { isSignedIn } = useAuth()
  const unique = [...new Set(grupos.filter((g) => g.length > 0))].slice(
    0,
    MAX_GRUPOS,
  )
  const data = useQuery(
    api.precos.desdePorGrupos,
    isSignedIn && unique.length > 0 ? { gruposModelo: unique } : "skip",
  )
  if (!data) return null
  return new Map(data.map((p) => [p.grupoModelo, p.precoDesdeCents]))
}

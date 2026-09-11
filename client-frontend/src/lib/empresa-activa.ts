import { useEffect, useRef, useState } from "react"
import { useClerk, useOrganization } from "@clerk/tanstack-react-start"
import { useQuery } from "convex/react"

import { api } from "@convex/_generated/api"

/**
 * The installer's company plus whether it is the *active* Clerk organization.
 *
 * `empresas.minha` finds the company by registrant even without an active org,
 * but every order function needs `org_id` in the Convex JWT (`requireInstaller`).
 * Callers must gate order queries on `orgActiva`, and we try `setActive` once
 * so the JWT picks the org up.
 */
export function useEmpresaActiva(activo = true) {
  const { setActive } = useClerk()
  const { organization, isLoaded } = useOrganization()
  const vista = useQuery(api.empresas.minha, activo ? {} : "skip")
  const tentouActivar = useRef(false)
  const [activacaoFalhou, setActivacaoFalhou] = useState(false)

  const clerkOrgId = vista?.kind === "empresa" ? vista.empresa.clerkOrgId : null
  const orgActiva = clerkOrgId !== null && organization?.id === clerkOrgId

  useEffect(() => {
    if (tentouActivar.current || !isLoaded || clerkOrgId === null || orgActiva) {
      return
    }
    tentouActivar.current = true
    setActive({ organization: clerkOrgId }).catch(() => {
      setActivacaoFalhou(true)
    })
  }, [isLoaded, clerkOrgId, orgActiva, setActive])

  return { vista, orgActiva, activacaoFalhou }
}

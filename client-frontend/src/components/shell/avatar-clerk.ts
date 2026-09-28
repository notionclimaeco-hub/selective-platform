import { useOrganization, useUser } from "@clerk/tanstack-react-start"

import { avatarComIniciais } from "@/lib/clerk-ui"
import { iniciais } from "@/lib/iniciais"

/** `elements` for `UserButton` / `openUserProfile`: initials while the user has no photo. */
export function useAvatarUtilizador() {
  const { user } = useUser()
  if (!user || user.hasImage) return {}
  const nome =
    user.fullName || user.username || user.primaryEmailAddress?.emailAddress
  return avatarComIniciais(iniciais(nome))
}

/** `elements` for `OrganizationSwitcher`: initials tile while the company has no logo. */
export function useAvatarOrganizacao() {
  const { organization } = useOrganization()
  if (!organization || organization.hasImage) return {}
  return avatarComIniciais(iniciais(organization.name), "quadrado")
}

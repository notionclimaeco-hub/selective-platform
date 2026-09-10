/** Only the account home may be used as a post-login return (open-redirect). */
export function caminhoSeguroDeRegresso(raw: unknown): string | undefined {
  if (raw === "/conta") return "/conta"
  return undefined
}

export function isContaPath(pathname: string): boolean {
  return pathname === "/conta" || pathname.startsWith("/conta/")
}

export function isEntrarPath(pathname: string): boolean {
  return pathname === "/entrar"
}

export function isRegistoPath(pathname: string): boolean {
  return pathname === "/registo"
}

export type ClientAuthRedirect =
  | { to: "/entrar"; search: { return: string } }
  | { to: "/conta" }
  | null

/**
 * Public catalog stays public. Only the client-area routes are gated:
 * signed-out `/conta*` → `/entrar`; signed-in `/entrar` → `/conta`;
 * signed-in with an org on `/registo` → `/conta` (#2 + #3).
 */
export function clientAuthRedirect(
  userId: string | null | undefined,
  orgId: string | null | undefined,
  pathname: string,
): ClientAuthRedirect {
  if (isContaPath(pathname) && !userId) {
    return { to: "/entrar", search: { return: pathname } }
  }
  if (isEntrarPath(pathname) && userId) {
    return { to: "/conta" }
  }
  if (isRegistoPath(pathname) && userId && orgId) {
    return { to: "/conta" }
  }
  return null
}

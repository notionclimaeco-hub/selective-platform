// Environment paths allowed as a post-login return (open-redirect guard).
const REGRESSO_SEGURO =
  /^\/(?:inicio|empresa|orcamento|encomendas(?:\/[a-z0-9]+)?)$/

export function caminhoSeguroDeRegresso(raw: unknown): string | undefined {
  if (typeof raw === "string" && REGRESSO_SEGURO.test(raw)) return raw
  return undefined
}

/** `/entrar` or `/registo` with the `?return=` carried along, when there is one. */
export function comRegresso(
  caminho: "/entrar" | "/registo",
  regresso: string | undefined
): string {
  return regresso === undefined
    ? caminho
    : `${caminho}?return=${encodeURIComponent(regresso)}`
}

/** Button label for going back to a safe return path after signing in or registering. */
export function rotuloDeRegresso(regresso: string): string {
  if (regresso === "/orcamento") return "Voltar ao orçamento"
  if (regresso === "/empresa") return "Ver a empresa"
  if (regresso.startsWith("/encomendas")) return "Voltar às encomendas"
  return "Ir para o início"
}

/**
 * Pages that need a session. `/orcamento` is deliberately absent: anyone builds
 * the quote list; only submitting it prompts for sign-in.
 */
export function isAreaPrivada(pathname: string): boolean {
  return (
    pathname === "/inicio" ||
    pathname === "/empresa" ||
    pathname === "/encomendas" ||
    pathname.startsWith("/encomendas/")
  )
}

export function isEntrarPath(pathname: string): boolean {
  return pathname === "/entrar"
}

export function isRegistoPath(pathname: string): boolean {
  return pathname === "/registo"
}

export type ClientAuthRedirect =
  | { to: "/entrar"; search: { return: string } }
  | { to: "/inicio" }
  | { to: "/empresa" }
  | null

/**
 * Public pages stay public. Only the environment is gated:
 * signed-out on `/inicio`, `/encomendas*`, `/empresa` → `/entrar?return=…`;
 * signed-in on `/entrar` → `/inicio`;
 * signed-in with an org on `/registo` → `/empresa` (nothing left to register).
 */
export function clientAuthRedirect(
  userId: string | null | undefined,
  orgId: string | null | undefined,
  pathname: string
): ClientAuthRedirect {
  if (isAreaPrivada(pathname) && !userId) {
    return { to: "/entrar", search: { return: pathname } }
  }
  if (isEntrarPath(pathname) && userId) {
    return { to: "/inicio" }
  }
  if (isRegistoPath(pathname) && userId && orgId) {
    return { to: "/empresa" }
  }
  return null
}

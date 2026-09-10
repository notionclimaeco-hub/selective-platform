// Root beforeLoad auth gate. Keep `/sign-in` as an exact prefix so we never
// match an unrelated path like `/sign-in-help`.
export function isSignInPath(pathname: string): boolean {
  return pathname === "/sign-in" || pathname.startsWith("/sign-in/")
}

export function authGatePath(
  userId: string | null | undefined,
  pathname: string,
): "/sign-in" | "/" | null {
  const onSignIn = isSignInPath(pathname)
  if (!userId) {
    return onSignIn ? null : "/sign-in"
  }
  return onSignIn ? "/" : null
}

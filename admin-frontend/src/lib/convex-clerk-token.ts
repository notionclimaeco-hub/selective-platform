type ClerkGetToken = (options?: {
  template?: string
}) => Promise<string | null>

type SessionClaims = { aud?: unknown } | null | undefined

/**
 * Convex rejects Clerk's default session JWT with NoAuthProvider — even on
 * public queries — because the audience is not `convex`. Request the JWT
 * template named `convex`, unless Clerk's native Convex integration already
 * issued a session token with that audience.
 */
export async function fetchConvexClerkToken(
  getToken: ClerkGetToken,
  sessionClaims: SessionClaims,
): Promise<string | null> {
  try {
    if (sessionClaims?.aud === "convex") {
      return await getToken()
    }
    return await getToken({ template: "convex" })
  } catch {
    return null
  }
}

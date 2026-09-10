import { describe, expect, it, vi } from "vitest"

import { fetchConvexClerkToken } from "./convex-clerk-token"

describe("fetchConvexClerkToken", () => {
  it("requests the convex JWT template for a normal Clerk session", async () => {
    const getToken = vi.fn().mockResolvedValue("convex-jwt")

    await expect(
      fetchConvexClerkToken(getToken, { aud: "https://clerk.example" }),
    ).resolves.toBe("convex-jwt")

    expect(getToken).toHaveBeenCalledWith({ template: "convex" })
  })

  it("uses the session token when Clerk already set audience to convex", async () => {
    const getToken = vi.fn().mockResolvedValue("session-jwt")

    await expect(
      fetchConvexClerkToken(getToken, { aud: "convex" }),
    ).resolves.toBe("session-jwt")

    expect(getToken).toHaveBeenCalledWith()
  })

  it("returns null when Clerk has no token or the template is missing", async () => {
    await expect(
      fetchConvexClerkToken(vi.fn().mockResolvedValue(null), null),
    ).resolves.toBeNull()

    await expect(
      fetchConvexClerkToken(
        vi.fn().mockRejectedValue(new Error("JWT template not found")),
        null,
      ),
    ).resolves.toBeNull()
  })
})

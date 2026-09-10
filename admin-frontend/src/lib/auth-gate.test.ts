import { describe, expect, it } from "vitest"

import { authGatePath, isSignInPath } from "./auth-gate"

describe("isSignInPath", () => {
  it("matches the sign-in page and its nested Clerk steps", () => {
    expect(isSignInPath("/sign-in")).toBe(true)
    expect(isSignInPath("/sign-in/factor-one")).toBe(true)
  })

  it("does not match unrelated paths", () => {
    expect(isSignInPath("/")).toBe(false)
    expect(isSignInPath("/empresas")).toBe(false)
    expect(isSignInPath("/sign-in-help")).toBe(false)
  })
})

describe("authGatePath", () => {
  it("sends anonymous visitors to sign-in", () => {
    expect(authGatePath(null, "/")).toBe("/sign-in")
    expect(authGatePath(undefined, "/empresas")).toBe("/sign-in")
  })

  it("lets anonymous visitors stay on sign-in", () => {
    expect(authGatePath(null, "/sign-in")).toBeNull()
    expect(authGatePath(null, "/sign-in/factor-one")).toBeNull()
  })

  it("sends signed-in visitors away from sign-in so <SignIn> never mounts", () => {
    expect(authGatePath("user_123", "/sign-in")).toBe("/")
    expect(authGatePath("user_123", "/sign-in/factor-one")).toBe("/")
  })

  it("lets signed-in visitors stay on the rest of the app", () => {
    expect(authGatePath("user_123", "/")).toBeNull()
    expect(authGatePath("user_123", "/empresas")).toBeNull()
  })
})

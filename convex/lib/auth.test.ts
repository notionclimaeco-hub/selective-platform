import { describe, expect, it } from "vitest";
import { claimOrgId, claimString } from "./auth";
import type { UserIdentity } from "convex/server";

function identity(extra: Record<string, unknown> = {}): UserIdentity {
  return {
    tokenIdentifier: "https://example.clerk.accounts.dev|user_1",
    subject: "user_1",
    issuer: "https://example.clerk.accounts.dev",
    ...extra,
  } as UserIdentity;
}

describe("claimString", () => {
  it("returns non-empty strings and null otherwise", () => {
    expect(claimString(identity({ org_id: "org_abc" }), "org_id")).toBe(
      "org_abc",
    );
    expect(claimString(identity({ org_id: "" }), "org_id")).toBeNull();
    expect(claimString(identity({ org_id: 1 }), "org_id")).toBeNull();
    expect(claimString(identity(), "org_id")).toBeNull();
    expect(claimString(identity({ role: "staff" }), "role")).toBe("staff");
  });
});

describe("claimOrgId", () => {
  it("prefers the top-level org_id claim", () => {
    expect(claimOrgId(identity({ org_id: "org_top" }))).toBe("org_top");
  });

  it("reads Clerk's nested o.id when org_id is missing", () => {
    expect(claimOrgId(identity({ o: { id: "org_nested", rol: "admin" } }))).toBe(
      "org_nested",
    );
  });

  it("returns null without an organization", () => {
    expect(claimOrgId(identity())).toBeNull();
    expect(claimOrgId(identity({ o: { rol: "admin" } }))).toBeNull();
  });
});

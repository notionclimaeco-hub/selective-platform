import { describe, expect, it } from "vitest";
import { claimString } from "./auth";
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

import type { UserIdentity } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

type AuthCtx = QueryCtx | MutationCtx | ActionCtx;
type DbCtx = QueryCtx | MutationCtx;

export type InstallerContext = {
  identity: UserIdentity;
  orgId: string;
  orgRole: string | null;
  company: Doc<"installerCompanies">;
};

/**
 * Read a custom Clerk session-token claim as a non-empty string.
 * Missing / nested / non-string values become null — Convex does not flatten
 * Clerk's nested `o` object (#9).
 */
export function claimString(
  identity: UserIdentity,
  key: string,
): string | null {
  const value = (identity as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Active Clerk organization id. Prefer the top-level `org_id` claim (Convex
 * JWT template); fall back to Clerk's nested session `o.id`.
 */
export function claimOrgId(identity: UserIdentity): string | null {
  const top = claimString(identity, "org_id");
  if (top !== null) {
    return top;
  }
  const nested = (identity as Record<string, unknown>).o;
  if (typeof nested !== "object" || nested === null || !("id" in nested)) {
    return null;
  }
  const id = (nested as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function claimOrgRole(identity: UserIdentity): string | null {
  const top = claimString(identity, "org_role");
  if (top !== null) {
    return top;
  }
  const nested = (identity as Record<string, unknown>).o;
  if (typeof nested !== "object" || nested === null || !("rol" in nested)) {
    return null;
  }
  const rol = (nested as { rol?: unknown }).rol;
  return typeof rol === "string" && rol.length > 0 ? rol : null;
}

export async function requireIdentity(ctx: AuthCtx): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Not authenticated");
  }
  return identity;
}

/**
 * Gate a Convex function to authenticated staff users.
 *
 * Throws if there is no authenticated identity, or if the Clerk session token's
 * `role` claim is not "staff". Returns the identity so callers can start with:
 *
 *   const identity = await requireStaff(ctx);
 */
export async function requireStaff(ctx: AuthCtx) {
  const identity = await requireIdentity(ctx);

  // `role` is a custom claim on the Clerk session token
  // ("role": "{{user.public_metadata.role}}"), surfaced on the identity.
  if (claimString(identity, "role") !== "staff") {
    throw new Error("Forbidden: staff access required");
  }

  return identity;
}

/**
 * Signed-in Clerk user with an Active org that has a Convex installer-company
 * record. Returns null when unsigned, when there is no `org_id` claim, or when
 * no matching company exists (e.g. staff in a test org). Does not gate on
 * `estadoAprovacao` — callers decide.
 */
export async function getInstallerContext(
  ctx: DbCtx,
): Promise<InstallerContext | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }

  const orgId = claimOrgId(identity);
  if (orgId === null) {
    return null;
  }

  const company = await ctx.db
    .query("installerCompanies")
    .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", orgId))
    .unique();

  if (company === null) {
    return null;
  }

  return {
    identity,
    orgId,
    orgRole: claimOrgRole(identity),
    company,
  };
}

/**
 * Gate to a member of an **approved** installer company. Sign-in is kept for
 * other states; this helper is what blocks reseller prices and orders.
 */
export async function requireInstaller(ctx: DbCtx): Promise<InstallerContext> {
  const context = await getInstallerContext(ctx);
  if (context === null) {
    throw new Error("Not authenticated as an installer company member");
  }
  if (context.company.estadoAprovacao !== "aprovada") {
    throw new Error("Forbidden: installer company is not approved");
  }
  return context;
}

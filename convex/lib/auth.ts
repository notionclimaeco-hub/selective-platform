import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

type AuthCtx = QueryCtx | MutationCtx | ActionCtx;

/**
 * Gate a Convex function to authenticated staff users.
 *
 * Throws if there is no authenticated identity, or if the Clerk session token's
 * `role` claim is not "staff". Returns the identity so callers can start with:
 *
 *   const identity = await requireStaff(ctx);
 */
export async function requireStaff(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Not authenticated");
  }

  // `role` is a custom claim on the Clerk session token
  // ("role": "{{user.public_metadata.role}}"), surfaced on the identity.
  const role = (identity as { role?: unknown }).role;
  if (role !== "staff") {
    throw new Error("Forbidden: staff access required");
  }

  return identity;
}

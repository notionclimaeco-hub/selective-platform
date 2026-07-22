import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireStaff } from "../lib/auth";

/**
 * Example staff-gated query for smoke-testing the full auth chain
 * (Clerk token -> Convex identity -> requireStaff). Returns { ok: true }.
 */
export const get = query({
  args: {},
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx) => {
    await requireStaff(ctx);
    return { ok: true as const };
  },
});

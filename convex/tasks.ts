import { query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("tasks"),
      _creationTime: v.number(),
      text: v.string(),
      isCompleted: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Public list of active brands. Deliberately excludes `descontoPercent` so the
 * per-brand reseller discount never leaks through a public query.
 */
export const listarAtivas = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("marcas"),
      _creationTime: v.number(),
      slug: v.string(),
      nome: v.string(),
      ativa: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const marcas = await ctx.db.query("marcas").collect();
    return marcas
      .filter((m) => m.ativa)
      .map((m) => ({
        _id: m._id,
        _creationTime: m._creationTime,
        slug: m.slug,
        nome: m.nome,
        ativa: m.ativa,
      }));
  },
});

/**
 * Set the flat per-brand discount %. Internal only — staff/backend use.
 */
export const definirDesconto = internalMutation({
  args: {
    slug: v.string(),
    descontoPercent: v.number(),
  },
  returns: v.object({
    marcaId: v.id("marcas"),
    descontoPercent: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.descontoPercent < 0 || args.descontoPercent > 100) {
      throw new Error("descontoPercent must be between 0 and 100");
    }

    const marca = await ctx.db
      .query("marcas")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!marca) {
      throw new Error(`Brand not found: ${args.slug}`);
    }

    await ctx.db.patch(marca._id, { descontoPercent: args.descontoPercent });
    return { marcaId: marca._id, descontoPercent: args.descontoPercent };
  },
});

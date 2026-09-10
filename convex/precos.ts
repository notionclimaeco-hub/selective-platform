import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getInstallerContext } from "./lib/auth";
import { precoRevendaCents } from "./lib/precoRevenda";

const MAX_REFS = 50;
const MAX_GRUPOS = 40;
const MAX_CELULAS = 200;
const MAX_VARIANTES_GRUPO = 40;

async function mapaDescontos(
  ctx: QueryCtx,
  tierId: Id<"tiers">,
): Promise<Map<string, number>> {
  const cells = await ctx.db
    .query("tierDescontos")
    .withIndex("by_tier", (q) => q.eq("tierId", tierId))
    .take(MAX_CELULAS);
  return new Map(cells.map((c) => [c.marca, c.descontoPercent]));
}

async function tierAprovado(
  ctx: QueryCtx,
): Promise<Id<"tiers"> | null> {
  const installer = await getInstallerContext(ctx);
  if (
    installer === null ||
    installer.company.estadoAprovacao !== "aprovada" ||
    installer.company.tierId === undefined
  ) {
    return null;
  }
  return installer.company.tierId;
}

/**
 * Authenticated overlay for PDP / quote-list rows. Returns null for anyone
 * who is not a member of an approved installer company — the public catalog
 * queries stay PVP-only. Final cents only; the matrix never leaves Convex.
 */
export const porRefs = query({
  args: { refs: v.array(v.string()) },
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        ref: v.string(),
        precoRevendaCents: v.number(),
      }),
    ),
  ),
  handler: async (ctx, args) => {
    const tierId = await tierAprovado(ctx);
    if (tierId === null) {
      return null;
    }

    const descontos = await mapaDescontos(ctx, tierId);
    const refs = args.refs.slice(0, MAX_REFS);
    const out: Array<{ ref: string; precoRevendaCents: number }> = [];

    for (const ref of refs) {
      const produto = await ctx.db
        .query("produtos")
        .withIndex("by_ref", (q) => q.eq("ref", ref))
        .unique();
      if (!produto || produto.estado !== "publicado") {
        continue;
      }
      const percent = descontos.get(produto.marca) ?? 0;
      out.push({
        ref: produto.ref,
        precoRevendaCents: precoRevendaCents(produto.pvpCents, percent),
      });
    }

    return out;
  },
});

/**
 * Authenticated overlay for catalog cards: lowest reseller price in each
 * published group. Null when the visitor is not an approved installer member.
 */
export const desdePorGrupos = query({
  args: { gruposModelo: v.array(v.string()) },
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        grupoModelo: v.string(),
        precoDesdeCents: v.number(),
      }),
    ),
  ),
  handler: async (ctx, args) => {
    const tierId = await tierAprovado(ctx);
    if (tierId === null) {
      return null;
    }

    const descontos = await mapaDescontos(ctx, tierId);
    const grupos = args.gruposModelo.slice(0, MAX_GRUPOS);
    const out: Array<{ grupoModelo: string; precoDesdeCents: number }> = [];

    for (const grupoModelo of grupos) {
      const variantes = await ctx.db
        .query("produtos")
        .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", grupoModelo))
        .take(MAX_VARIANTES_GRUPO);
      const publicadas = variantes.filter((p) => p.estado === "publicado");
      if (publicadas.length === 0) {
        continue;
      }

      let min = Number.POSITIVE_INFINITY;
      for (const p of publicadas) {
        const cents = precoRevendaCents(
          p.pvpCents,
          descontos.get(p.marca) ?? 0,
        );
        if (cents < min) min = cents;
      }
      out.push({ grupoModelo, precoDesdeCents: min });
    }

    return out;
  },
});

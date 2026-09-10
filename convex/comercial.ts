import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireStaff } from "./lib/auth";
import { slugifyNome } from "./lib/slug";

const MAX_TIERS = 50;
const MAX_MARCAS = 100;
const MAX_CELULAS = 500;

const tierValidator = v.object({
  _id: v.id("tiers"),
  _creationTime: v.number(),
  slug: v.string(),
  nome: v.string(),
  limiarCents: v.number(),
  ordem: v.number(),
  ativa: v.boolean(),
});

const celulaValidator = v.object({
  marca: v.string(),
  marcaNome: v.string(),
  tierId: v.id("tiers"),
  descontoPercent: v.number(),
});

function assertDesconto(descontoPercent: number): void {
  if (
    !Number.isFinite(descontoPercent) ||
    descontoPercent < 0 ||
    descontoPercent > 100
  ) {
    throw new Error("descontoPercent must be between 0 and 100");
  }
}

function assertLimiar(limiarCents: number): void {
  if (!Number.isFinite(limiarCents) || limiarCents < 0) {
    throw new Error("limiarCents must be a non-negative number");
  }
}

async function listarTiersDocs(
  ctx: QueryCtx | MutationCtx,
): Promise<Array<Doc<"tiers">>> {
  return await ctx.db.query("tiers").withIndex("by_ordem").take(MAX_TIERS);
}

async function slugLivre(
  ctx: QueryCtx | MutationCtx,
  slug: string,
  excepto?: Id<"tiers">,
): Promise<void> {
  const existente = await ctx.db
    .query("tiers")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (existente && existente._id !== excepto) {
    throw new Error(`Tier slug already exists: ${slug}`);
  }
}

export const listarTiers = query({
  args: {},
  returns: v.array(tierValidator),
  handler: async (ctx) => {
    await requireStaff(ctx);
    return await listarTiersDocs(ctx);
  },
});

export const criarTier = mutation({
  args: {
    nome: v.string(),
    limiarCents: v.number(),
    ordem: v.optional(v.number()),
    slug: v.optional(v.string()),
  },
  returns: v.id("tiers"),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const nome = args.nome.trim();
    if (nome.length === 0) {
      throw new Error("nome is required");
    }
    assertLimiar(args.limiarCents);

    const slug = (args.slug ?? slugifyNome(nome)).trim();
    if (slug.length === 0) {
      throw new Error("slug is required");
    }
    await slugLivre(ctx, slug);

    const existentes = await listarTiersDocs(ctx);
    const ordem =
      args.ordem ??
      existentes.reduce((max, t) => Math.max(max, t.ordem), -1) + 1;

    return await ctx.db.insert("tiers", {
      slug,
      nome,
      limiarCents: args.limiarCents,
      ordem,
      ativa: true,
    });
  },
});

export const atualizarTier = mutation({
  args: {
    tierId: v.id("tiers"),
    nome: v.optional(v.string()),
    limiarCents: v.optional(v.number()),
    ordem: v.optional(v.number()),
    ativa: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const tier = await ctx.db.get(args.tierId);
    if (!tier) {
      throw new Error("Tier not found");
    }

    if (args.limiarCents !== undefined) {
      assertLimiar(args.limiarCents);
      if (tier.slug === "base" && args.limiarCents !== 0) {
        throw new Error("Base tier must keep limiarCents = 0");
      }
    }

    const nome = args.nome?.trim();
    await ctx.db.patch(args.tierId, {
      ...(nome !== undefined && nome.length > 0 ? { nome } : {}),
      ...(args.limiarCents !== undefined
        ? { limiarCents: args.limiarCents }
        : {}),
      ...(args.ordem !== undefined ? { ordem: args.ordem } : {}),
      ...(args.ativa !== undefined ? { ativa: args.ativa } : {}),
    });
    return null;
  },
});

/**
 * Staff grid: every active marca × every tier. Missing cells are 0% (same
 * fallback the reseller-price query uses). The matrix never goes to the
 * client-frontend — this is the admin Comercial section.
 */
export const listarMatriz = query({
  args: {},
  returns: v.object({
    tiers: v.array(tierValidator),
    marcas: v.array(
      v.object({
        slug: v.string(),
        nome: v.string(),
      }),
    ),
    celulas: v.array(celulaValidator),
  }),
  handler: async (ctx) => {
    await requireStaff(ctx);

    const tiers = await listarTiersDocs(ctx);
    const marcasDocs = (await ctx.db.query("marcas").take(MAX_MARCAS)).filter(
      (m) => m.ativa,
    );
    const descontos = await ctx.db.query("tierDescontos").take(MAX_CELULAS);

    const porPar = new Map<string, number>();
    for (const d of descontos) {
      porPar.set(`${d.marca}:${d.tierId}`, d.descontoPercent);
    }

    const celulas: Array<{
      marca: string;
      marcaNome: string;
      tierId: Id<"tiers">;
      descontoPercent: number;
    }> = [];
    for (const marca of marcasDocs) {
      for (const tier of tiers) {
        celulas.push({
          marca: marca.slug,
          marcaNome: marca.nome,
          tierId: tier._id,
          descontoPercent: porPar.get(`${marca.slug}:${tier._id}`) ?? 0,
        });
      }
    }

    return {
      tiers,
      marcas: marcasDocs.map((m) => ({ slug: m.slug, nome: m.nome })),
      celulas,
    };
  },
});

export const definirDesconto = mutation({
  args: {
    marca: v.string(),
    tierId: v.id("tiers"),
    descontoPercent: v.number(),
  },
  returns: v.id("tierDescontos"),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    assertDesconto(args.descontoPercent);

    const marca = await ctx.db
      .query("marcas")
      .withIndex("by_slug", (q) => q.eq("slug", args.marca))
      .unique();
    if (!marca) {
      throw new Error(`Brand not found: ${args.marca}`);
    }

    const tier = await ctx.db.get(args.tierId);
    if (!tier) {
      throw new Error("Tier not found");
    }

    const existente = await ctx.db
      .query("tierDescontos")
      .withIndex("by_marca_and_tier", (q) =>
        q.eq("marca", args.marca).eq("tierId", args.tierId),
      )
      .unique();

    if (existente) {
      await ctx.db.patch(existente._id, {
        descontoPercent: args.descontoPercent,
      });
      return existente._id;
    }

    return await ctx.db.insert("tierDescontos", {
      marca: args.marca,
      tierId: args.tierId,
      descontoPercent: args.descontoPercent,
    });
  },
});

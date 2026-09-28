import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { estadoAprovacaoValidator } from "./schema";
import type { EstadoAprovacao } from "./lib/aprovacao";
import { assertTransicao } from "./lib/aprovacao";
import { requireStaff, getInstallerContext, claimOrgId } from "./lib/auth";
import { normalizarNif } from "./lib/nif";
import { tierPorVolume } from "./lib/precoRevenda";

const empresaStaffValidator = v.object({
  _id: v.id("installerCompanies"),
  _creationTime: v.number(),
  clerkOrgId: v.string(),
  nomeLegal: v.string(),
  nif: v.string(),
  morada: v.string(),
  email: v.string(),
  telefone: v.string(),
  certifNumero: v.optional(v.string()),
  notas: v.optional(v.string()),
  estadoAprovacao: estadoAprovacaoValidator,
  tierId: v.optional(v.id("tiers")),
  tierPin: v.optional(v.id("tiers")),
  volumeCents: v.number(),
  registadoPor: v.string(),
  registadoEm: v.number(),
  decididoEm: v.optional(v.number()),
  decididoPor: v.optional(v.string()),
});

const empresaClienteValidator = v.object({
  _id: v.id("installerCompanies"),
  clerkOrgId: v.string(),
  nomeLegal: v.string(),
  nif: v.string(),
  morada: v.string(),
  email: v.string(),
  telefone: v.string(),
  certifNumero: v.optional(v.string()),
  estadoAprovacao: estadoAprovacaoValidator,
  tierNome: v.union(v.string(), v.null()),
});

function paraStaff(doc: Doc<"installerCompanies">) {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    clerkOrgId: doc.clerkOrgId,
    nomeLegal: doc.nomeLegal,
    nif: doc.nif,
    morada: doc.morada,
    email: doc.email,
    telefone: doc.telefone,
    certifNumero: doc.certifNumero,
    notas: doc.notas,
    estadoAprovacao: doc.estadoAprovacao,
    tierId: doc.tierId,
    tierPin: doc.tierPin,
    volumeCents: doc.volumeCents,
    registadoPor: doc.registadoPor,
    registadoEm: doc.registadoEm,
    decididoEm: doc.decididoEm,
    decididoPor: doc.decididoPor,
  };
}

async function empresaOuErro(
  ctx: QueryCtx | MutationCtx,
  id: Id<"installerCompanies">,
): Promise<Doc<"installerCompanies">> {
  const empresa = await ctx.db.get(id);
  if (!empresa) {
    throw new Error("Installer company not found");
  }
  return empresa;
}

export async function obterTierBase(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"tiers">> {
  const base = await ctx.db
    .query("tiers")
    .withIndex("by_slug", (q) => q.eq("slug", "base"))
    .unique();
  if (base === null || !base.ativa) {
    throw new Error("Base tier is not configured");
  }
  return base;
}

async function obterTiersAtivosOrdenados(
  ctx: QueryCtx | MutationCtx,
): Promise<Array<Doc<"tiers">>> {
  const rows = await ctx.db.query("tiers").withIndex("by_ordem").take(50);
  return rows
    .filter((t) => t.ativa)
    .sort((a, b) => a.limiarCents - b.limiarCents);
}

export async function aplicarTransicao(
  ctx: MutationCtx,
  empresa: Doc<"installerCompanies">,
  para: EstadoAprovacao,
  staffSubject: string,
  agora: number,
): Promise<void> {
  assertTransicao(empresa.estadoAprovacao, para);

  const patch: {
    estadoAprovacao: EstadoAprovacao;
    decididoEm: number;
    decididoPor: string;
    tierId?: Id<"tiers">;
  } = {
    estadoAprovacao: para,
    decididoEm: agora,
    decididoPor: staffSubject,
  };

  if (para === "aprovada" && empresa.tierId === undefined) {
    const base = await obterTierBase(ctx);
    patch.tierId = base._id;
  }

  await ctx.db.patch(empresa._id, patch);
}

export async function aplicarPin(
  ctx: MutationCtx,
  empresa: Doc<"installerCompanies">,
  tierId: Id<"tiers">,
): Promise<void> {
  const tier = await ctx.db.get(tierId);
  if (!tier || !tier.ativa) {
    throw new Error("Tier not found or inactive");
  }
  await ctx.db.patch(empresa._id, { tierId, tierPin: tierId });
}

export async function aplicarLimpezaPin(
  ctx: MutationCtx,
  empresa: Doc<"installerCompanies">,
): Promise<void> {
  const tiers = await obterTiersAtivosOrdenados(ctx);
  const derivado = tierPorVolume(tiers, empresa.volumeCents);
  if (derivado === null) {
    throw new Error("No active tier configured");
  }
  await ctx.db.patch(empresa._id, {
    tierPin: undefined,
    tierId: derivado._id,
  });
}

async function vistaCliente(
  ctx: QueryCtx,
  company: Doc<"installerCompanies">,
) {
  const tier =
    company.tierId !== undefined ? await ctx.db.get(company.tierId) : null;
  return {
    kind: "empresa" as const,
    empresa: {
      _id: company._id,
      clerkOrgId: company.clerkOrgId,
      nomeLegal: company.nomeLegal,
      nif: company.nif,
      morada: company.morada,
      email: company.email,
      telefone: company.telefone,
      certifNumero: company.certifNumero,
      estadoAprovacao: company.estadoAprovacao,
      tierNome: tier?.nome ?? null,
    },
  };
}

/**
 * The caller's installer company, or null when unsigned / not registered.
 *
 * After self-serve registration the Clerk session may not yet carry `org_id`.
 * In that case we fall back to the company this user registered, so the
 * environment can show the pending state instead of an empty "register" CTA.
 * `sem-org` (no org claim, nothing registered) is distinct from
 * `sem-empresa` (org claim without a company record).
 */
async function empresaDoUtilizador(
  ctx: QueryCtx,
): Promise<
  | { kind: "anonimo" }
  | { kind: "sem-org" }
  | { kind: "sem-empresa"; orgId: string }
  | { kind: "empresa"; empresa: Doc<"installerCompanies"> }
> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return { kind: "anonimo" };
  }

  const orgId = claimOrgId(identity);
  if (orgId === null) {
    const proprio = await ctx.db
      .query("installerCompanies")
      .withIndex("by_registadoPor", (q) =>
        q.eq("registadoPor", identity.subject),
      )
      .take(1);
    const empresa = proprio[0];
    if (empresa) {
      return { kind: "empresa", empresa };
    }
    return { kind: "sem-org" };
  }

  const context = await getInstallerContext(ctx);
  if (context === null) {
    return { kind: "sem-empresa", orgId };
  }
  return { kind: "empresa", empresa: context.company };
}

/**
 * Signed-in installer-company view for `/empresa`. Null when unsigned.
 * `sem-org` / `sem-empresa` cover the registration vs. orphan-org cases
 * without leaking staff notes or the discount matrix.
 */
export const minha = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ kind: v.literal("sem-org") }),
    v.object({
      kind: v.literal("sem-empresa"),
      orgId: v.string(),
    }),
    v.object({
      kind: v.literal("empresa"),
      empresa: empresaClienteValidator,
    }),
  ),
  handler: async (ctx) => {
    const resultado = await empresaDoUtilizador(ctx);
    switch (resultado.kind) {
      case "anonimo":
        return null;
      case "sem-org":
        return { kind: "sem-org" as const };
      case "sem-empresa":
        return { kind: "sem-empresa" as const, orgId: resultado.orgId };
      case "empresa":
        return await vistaCliente(ctx, resultado.empresa);
    }
  },
});

/**
 * Tier summary for the caller's company (Empresa and Início). Null until the
 * company has a tier, i.e. before its first approval. `proximo` is the next
 * active tier above the *current* tier by threshold (not by volume), so a
 * company pinned above its volume never sees a lower tier as "next"; null at
 * the top. The discount matrix and every id stay on the server.
 */
export const resumoTier = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      nivel: v.string(),
      // A tier pin, worded for installers: staff holds this tier.
      definidoPelaClimaeco: v.boolean(),
      // Lifetime paid volume, VAT-excl cents.
      volumeCents: v.number(),
      proximo: v.union(
        v.null(),
        v.object({ nivel: v.string(), limiarCents: v.number() }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const resultado = await empresaDoUtilizador(ctx);
    if (resultado.kind !== "empresa") {
      return null;
    }
    const empresa = resultado.empresa;
    const actual =
      empresa.tierId === undefined ? null : await ctx.db.get(empresa.tierId);
    if (actual === null) {
      return null;
    }
    const tiers = await obterTiersAtivosOrdenados(ctx);
    const proximo =
      tiers.find((t) => t.limiarCents > actual.limiarCents) ?? null;
    return {
      nivel: actual.nome,
      definidoPelaClimaeco: empresa.tierPin !== undefined,
      volumeCents: empresa.volumeCents,
      proximo:
        proximo === null
          ? null
          : { nivel: proximo.nome, limiarCents: proximo.limiarCents },
    };
  },
});

export const conflitoRegisto = internalQuery({
  args: {
    nif: v.string(),
    registadoPor: v.string(),
  },
  returns: v.union(
    v.null(),
    v.literal("nif"),
    v.literal("utilizador"),
  ),
  handler: async (ctx, args) => {
    const porNif = await ctx.db
      .query("installerCompanies")
      .withIndex("by_nif", (q) => q.eq("nif", args.nif))
      .unique();
    if (porNif) {
      return "nif" as const;
    }

    const porUser = await ctx.db
      .query("installerCompanies")
      .withIndex("by_registadoPor", (q) =>
        q.eq("registadoPor", args.registadoPor),
      )
      .take(1);
    if (porUser[0]) {
      return "utilizador" as const;
    }

    return null;
  },
});

export const inserirPendente = internalMutation({
  args: {
    clerkOrgId: v.string(),
    nomeLegal: v.string(),
    nif: v.string(),
    morada: v.string(),
    email: v.string(),
    telefone: v.string(),
    certifNumero: v.optional(v.string()),
    registadoPor: v.string(),
    registadoEm: v.number(),
  },
  returns: v.id("installerCompanies"),
  handler: async (ctx, args) => {
    const nif = normalizarNif(args.nif);
    const conflito = await ctx.db
      .query("installerCompanies")
      .withIndex("by_nif", (q) => q.eq("nif", nif))
      .unique();
    if (conflito) {
      throw new Error("NIF already registered. Contact the office.");
    }

    const orgExistente = await ctx.db
      .query("installerCompanies")
      .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
    if (orgExistente) {
      throw new Error("Organization already registered");
    }

    return await ctx.db.insert("installerCompanies", {
      clerkOrgId: args.clerkOrgId,
      nomeLegal: args.nomeLegal,
      nif,
      morada: args.morada,
      email: args.email,
      telefone: args.telefone,
      certifNumero: args.certifNumero,
      estadoAprovacao: "pendente",
      volumeCents: 0,
      registadoPor: args.registadoPor,
      registadoEm: args.registadoEm,
    });
  },
});

export const listar = query({
  args: {
    estado: v.optional(estadoAprovacaoValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(empresaStaffValidator),
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const resultado =
      args.estado !== undefined
        ? await ctx.db
            .query("installerCompanies")
            .withIndex("by_estadoAprovacao", (q) =>
              q.eq("estadoAprovacao", args.estado!),
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("installerCompanies")
            .order("desc")
            .paginate(args.paginationOpts);

    return {
      ...resultado,
      page: resultado.page.map(paraStaff),
    };
  },
});

export const obter = query({
  args: { empresaId: v.id("installerCompanies") },
  returns: v.union(empresaStaffValidator, v.null()),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const empresa = await ctx.db.get(args.empresaId);
    return empresa ? paraStaff(empresa) : null;
  },
});

export const transitar = mutation({
  args: {
    empresaId: v.id("installerCompanies"),
    para: estadoAprovacaoValidator,
  },
  returns: empresaStaffValidator,
  handler: async (ctx, args) => {
    const identity = await requireStaff(ctx);
    const empresa = await empresaOuErro(ctx, args.empresaId);
    await aplicarTransicao(
      ctx,
      empresa,
      args.para,
      identity.subject,
      Date.now(),
    );
    return paraStaff(await empresaOuErro(ctx, args.empresaId));
  },
});

export const definirNotas = mutation({
  args: {
    empresaId: v.id("installerCompanies"),
    notas: v.optional(v.string()),
  },
  returns: empresaStaffValidator,
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const empresa = await empresaOuErro(ctx, args.empresaId);
    const notas = args.notas?.trim();
    await ctx.db.patch(empresa._id, {
      notas: notas === undefined || notas === "" ? undefined : notas,
    });
    return paraStaff(await empresaOuErro(ctx, args.empresaId));
  },
});

export const definirPin = mutation({
  args: {
    empresaId: v.id("installerCompanies"),
    tierId: v.id("tiers"),
  },
  returns: empresaStaffValidator,
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const empresa = await empresaOuErro(ctx, args.empresaId);
    await aplicarPin(ctx, empresa, args.tierId);
    return paraStaff(await empresaOuErro(ctx, args.empresaId));
  },
});

export const limparPin = mutation({
  args: { empresaId: v.id("installerCompanies") },
  returns: empresaStaffValidator,
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const empresa = await empresaOuErro(ctx, args.empresaId);
    await aplicarLimpezaPin(ctx, empresa);
    return paraStaff(await empresaOuErro(ctx, args.empresaId));
  },
});

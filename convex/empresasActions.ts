import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { claimOrgId, requireIdentity } from "./lib/auth";
import {
  apagarOrganizacaoClerk,
  criarOrganizacaoClerk,
} from "./lib/clerkOrganizations";
import { normalizarNif, validarNif } from "./lib/nif";

function textoObrigatorio(valor: string, campo: string): string {
  const t = valor.trim();
  if (t.length === 0) {
    throw new Error(`${campo} is required`);
  }
  return t;
}

/**
 * Signed-in user with no Active org: create the Clerk Organization (registrant
 * = org:admin) and insert the `pendente` Convex record. Self-serve org
 * creation stays disabled in Clerk, so every org has a matching row.
 */
export const registar = action({
  args: {
    nomeLegal: v.string(),
    nif: v.string(),
    morada: v.string(),
    email: v.string(),
    telefone: v.string(),
    certifNumero: v.optional(v.string()),
  },
  returns: v.object({
    empresaId: v.id("installerCompanies"),
    clerkOrgId: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    if (claimOrgId(identity) !== null) {
      throw new Error("Already a member of an organization");
    }

    const nomeLegal = textoObrigatorio(args.nomeLegal, "nomeLegal");
    const morada = textoObrigatorio(args.morada, "morada");
    const email = textoObrigatorio(args.email, "email");
    const telefone = textoObrigatorio(args.telefone, "telefone");
    if (!email.includes("@")) {
      throw new Error("Invalid email");
    }

    const nif = normalizarNif(args.nif);
    if (!validarNif(nif)) {
      throw new Error("Invalid NIF");
    }

    const certif = args.certifNumero?.trim();
    const certifNumero =
      certif === undefined || certif === "" ? undefined : certif;

    const conflito: "nif" | "utilizador" | null = await ctx.runQuery(
      internal.empresas.conflitoRegisto,
      { nif, registadoPor: identity.subject },
    );
    if (conflito === "nif") {
      throw new Error("NIF already registered. Contact the office.");
    }
    if (conflito === "utilizador") {
      throw new Error("You have already registered a company");
    }

    const org = await criarOrganizacaoClerk({
      name: nomeLegal.slice(0, 256),
      createdBy: identity.subject,
    });

    try {
      const empresaId: Id<"installerCompanies"> = await ctx.runMutation(
        internal.empresas.inserirPendente,
        {
          clerkOrgId: org.id,
          nomeLegal,
          nif,
          morada,
          email,
          telefone,
          certifNumero,
          registadoPor: identity.subject,
          registadoEm: Date.now(),
        },
      );
      return { empresaId, clerkOrgId: org.id };
    } catch (error) {
      await apagarOrganizacaoClerk(org.id);
      throw error;
    }
  },
});

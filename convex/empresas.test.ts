/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const STAFF = {
  subject: "user_staff",
  issuer: "https://example.clerk.accounts.dev",
  tokenIdentifier: "https://example.clerk.accounts.dev|user_staff",
  role: "staff",
};

function installerIdentity(orgId: string, subject = "user_installer") {
  return {
    subject,
    issuer: "https://example.clerk.accounts.dev",
    tokenIdentifier: `https://example.clerk.accounts.dev|${subject}`,
    org_id: orgId,
    org_role: "org:admin",
  };
}

function t() {
  return convexTest(schema, modules);
}

async function inserirEmpresa(test: ReturnType<typeof t>, clerkOrgId: string) {
  await test.mutation(internal.seed.seedTiers, {});
  return await test.mutation(internal.empresas.inserirPendente, {
    clerkOrgId,
    nomeLegal: "Clima Teste Lda",
    nif: "509442013",
    morada: "Rua A 1, 1000-001 Lisboa",
    email: "compras@teste.pt",
    telefone: "+351210000000",
    registadoPor: "user_installer",
    registadoEm: 1,
  });
}

async function aprovar(
  test: ReturnType<typeof t>,
  empresaId: Id<"installerCompanies">,
) {
  await test.withIdentity(STAFF).mutation(api.empresas.transitar, {
    empresaId,
    para: "aprovada",
  });
}

async function tierPorSlug(test: ReturnType<typeof t>, slug: string) {
  const tiers = await test.withIdentity(STAFF).query(api.comercial.listarTiers, {});
  const tier = tiers.find((t) => t.slug === slug);
  if (!tier) throw new Error(`tier ${slug} missing`);
  return tier;
}

describe("empresas.resumoTier", () => {
  it("is null for anonymous visitors and for a signed-in user without a company", async () => {
    const test = t();
    expect(await test.query(api.empresas.resumoTier, {})).toBeNull();
    expect(
      await test
        .withIdentity(installerIdentity("org_none"))
        .query(api.empresas.resumoTier, {}),
    ).toBeNull();
  });

  it("is null while the company is pending (no tier yet)", async () => {
    const test = t();
    await inserirEmpresa(test, "org_1");
    const resumo = await test
      .withIdentity(installerIdentity("org_1"))
      .query(api.empresas.resumoTier, {});
    expect(resumo).toBeNull();
  });

  it("returns base with prata as the next tier for a fresh approved company", async () => {
    const test = t();
    const empresaId = await inserirEmpresa(test, "org_1");
    await aprovar(test, empresaId);

    const resumo = await test
      .withIdentity(installerIdentity("org_1"))
      .query(api.empresas.resumoTier, {});
    expect(resumo).toEqual({
      nivel: "Base",
      definidoPelaClimaeco: false,
      volumeCents: 0,
      proximo: { nivel: "Prata", limiarCents: 1_000_000 },
    });
  });

  it("never carries discount, staff or supplier fields", async () => {
    const test = t();
    const empresaId = await inserirEmpresa(test, "org_1");
    await aprovar(test, empresaId);
    const prata = await tierPorSlug(test, "prata");
    await test.withIdentity(STAFF).mutation(api.comercial.definirDesconto, {
      marca: "daikin",
      tierId: prata._id,
      descontoPercent: 25,
    }).catch(() => {
      // No marcas seeded: the cell cannot be written, which is fine for this test.
    });

    const resumo = await test
      .withIdentity(installerIdentity("org_1"))
      .query(api.empresas.resumoTier, {});
    expect(resumo).not.toBeNull();
    expect(Object.keys(resumo!).sort()).toEqual(
      ["definidoPelaClimaeco", "nivel", "proximo", "volumeCents"].sort(),
    );
    expect(Object.keys(resumo!.proximo!).sort()).toEqual(["limiarCents", "nivel"]);
    expect(JSON.stringify(resumo)).not.toMatch(/desconto|notas|tierId|tierPin|_id/);
  });

  it("marks a pinned tier as set by Climaeco and takes the next tier above the pin", async () => {
    const test = t();
    const empresaId = await inserirEmpresa(test, "org_1");
    await aprovar(test, empresaId);
    const prata = await tierPorSlug(test, "prata");
    await test.withIdentity(STAFF).mutation(api.empresas.definirPin, {
      empresaId,
      tierId: prata._id,
    });

    const resumo = await test
      .withIdentity(installerIdentity("org_1"))
      .query(api.empresas.resumoTier, {});
    expect(resumo).toEqual({
      nivel: "Prata",
      definidoPelaClimaeco: true,
      volumeCents: 0,
      proximo: { nivel: "Ouro", limiarCents: 5_000_000 },
    });
  });

  it("has no next tier at the top", async () => {
    const test = t();
    const empresaId = await inserirEmpresa(test, "org_1");
    await aprovar(test, empresaId);
    const ouro = await tierPorSlug(test, "ouro");
    await test.withIdentity(STAFF).mutation(api.empresas.definirPin, {
      empresaId,
      tierId: ouro._id,
    });

    const resumo = await test
      .withIdentity(installerIdentity("org_1"))
      .query(api.empresas.resumoTier, {});
    expect(resumo?.nivel).toBe("Ouro");
    expect(resumo?.proximo).toBeNull();
  });

  it("finds the registrant's company even without an active org claim", async () => {
    const test = t();
    const empresaId = await inserirEmpresa(test, "org_1");
    await aprovar(test, empresaId);
    const resumo = await test
      .withIdentity({
        subject: "user_installer",
        issuer: "https://example.clerk.accounts.dev",
        tokenIdentifier: "https://example.clerk.accounts.dev|user_installer",
      })
      .query(api.empresas.resumoTier, {});
    expect(resumo?.nivel).toBe("Base");
  });
});

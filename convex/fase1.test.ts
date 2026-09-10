/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
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

async function seedTiers(test: ReturnType<typeof t>) {
  await test.mutation(internal.seed.seedTiers, {});
}

async function inserirEmpresa(
  test: ReturnType<typeof t>,
  args: {
    clerkOrgId: string;
    nif: string;
    registadoPor?: string;
  },
) {
  return await test.mutation(internal.empresas.inserirPendente, {
    clerkOrgId: args.clerkOrgId,
    nomeLegal: "Clima Teste Lda",
    nif: args.nif,
    morada: "Rua A 1, 1000-001 Lisboa",
    email: "compras@teste.pt",
    telefone: "+351210000000",
    registadoPor: args.registadoPor ?? "user_installer",
    registadoEm: 1,
  });
}

describe("empresas", () => {
  it("rejects a duplicate NIF", async () => {
    const test = t();
    await inserirEmpresa(test, {
      clerkOrgId: "org_1",
      nif: "509442013",
    });
    await expect(
      inserirEmpresa(test, { clerkOrgId: "org_2", nif: "509 442 013" }),
    ).rejects.toThrow(/NIF already registered/);
  });

  it("approves a pending company onto the base tier", async () => {
    const test = t();
    await seedTiers(test);
    const empresaId = await inserirEmpresa(test, {
      clerkOrgId: "org_1",
      nif: "509442013",
    });

    const asStaff = test.withIdentity(STAFF);
    const aprovada = await asStaff.mutation(api.empresas.transitar, {
      empresaId,
      para: "aprovada",
    });
    expect(aprovada.estadoAprovacao).toBe("aprovada");
    expect(aprovada.tierId).toBeDefined();

    const tiers = await asStaff.query(api.comercial.listarTiers, {});
    const base = tiers.find((tier) => tier.slug === "base");
    expect(aprovada.tierId).toBe(base?._id);
  });

  it("rejects an illegal transition", async () => {
    const test = t();
    await seedTiers(test);
    const empresaId = await inserirEmpresa(test, {
      clerkOrgId: "org_1",
      nif: "509442013",
    });
    const asStaff = test.withIdentity(STAFF);
    await expect(
      asStaff.mutation(api.empresas.transitar, {
        empresaId,
        para: "suspensa",
      }),
    ).rejects.toThrow(/pendente → suspensa/);
  });

  it("pins a tier and clearing the pin returns to volume-derived base", async () => {
    const test = t();
    await seedTiers(test);
    const empresaId = await inserirEmpresa(test, {
      clerkOrgId: "org_1",
      nif: "509442013",
    });
    const asStaff = test.withIdentity(STAFF);
    await asStaff.mutation(api.empresas.transitar, {
      empresaId,
      para: "aprovada",
    });
    const tiers = await asStaff.query(api.comercial.listarTiers, {});
    const ouro = tiers.find((tier) => tier.slug === "ouro");
    expect(ouro).toBeDefined();

    const pinned = await asStaff.mutation(api.empresas.definirPin, {
      empresaId,
      tierId: ouro!._id,
    });
    expect(pinned.tierPin).toBe(ouro!._id);
    expect(pinned.tierId).toBe(ouro!._id);

    const cleared = await asStaff.mutation(api.empresas.limparPin, {
      empresaId,
    });
    const base = tiers.find((tier) => tier.slug === "base");
    expect(cleared.tierPin).toBeUndefined();
    expect(cleared.tierId).toBe(base?._id);
  });

  it("minha returns empresa without staff notes", async () => {
    const test = t();
    await seedTiers(test);
    const empresaId = await inserirEmpresa(test, {
      clerkOrgId: "org_abc",
      nif: "509442013",
    });
    await test.withIdentity(STAFF).mutation(api.empresas.definirNotas, {
      empresaId,
      notas: "contactar amanhã",
    });

    const vista = await test
      .withIdentity(installerIdentity("org_abc"))
      .query(api.empresas.minha, {});
    expect(vista?.kind).toBe("empresa");
    if (vista?.kind !== "empresa") return;
    expect(vista.empresa.nomeLegal).toBe("Clima Teste Lda");
    expect(vista.empresa.clerkOrgId).toBe("org_abc");
    expect(vista.empresa).not.toHaveProperty("notas");
  });

  it("minha returns the registrant's company even without an active org", async () => {
    const test = t();
    await inserirEmpresa(test, {
      clerkOrgId: "org_abc",
      nif: "509442013",
      registadoPor: "user_installer",
    });

    const vista = await test
      .withIdentity({
        subject: "user_installer",
        issuer: "https://example.clerk.accounts.dev",
        tokenIdentifier:
          "https://example.clerk.accounts.dev|user_installer",
      })
      .query(api.empresas.minha, {});
    expect(vista?.kind).toBe("empresa");
    if (vista?.kind !== "empresa") return;
    expect(vista.empresa.estadoAprovacao).toBe("pendente");
    expect(vista.empresa.nif).toBe("509442013");
  });

  it("minha stays sem-org when the user has not registered a company", async () => {
    const test = t();
    const vista = await test
      .withIdentity({
        subject: "user_new",
        issuer: "https://example.clerk.accounts.dev",
        tokenIdentifier: "https://example.clerk.accounts.dev|user_new",
      })
      .query(api.empresas.minha, {});
    expect(vista).toEqual({ kind: "sem-org" });
  });
});

describe("precos", () => {
  async function setupCatalog(test: ReturnType<typeof t>) {
    await seedTiers(test);
    const empresaId = await inserirEmpresa(test, {
      clerkOrgId: "org_price",
      nif: "509442013",
    });
    const asStaff = test.withIdentity(STAFF);
    await asStaff.mutation(api.empresas.transitar, {
      empresaId,
      para: "aprovada",
    });

    await test.run(async (ctx) => {
      await ctx.db.insert("marcas", {
        slug: "hisense",
        nome: "Hisense",
        descontoPercent: 40,
        ativa: true,
      });
      await ctx.db.insert("produtos", {
        ref: "HS-001",
        marca: "hisense",
        nome: "Hisense 3.5",
        nomeGrupo: "Hisense 3.5",
        familia: "ar-condicionado",
        componente: "conjunto",
        grupoModelo: "hisense-35",
        atributos: [],
        pvpCents: 10000,
        ivaIncluido: false,
        tabelaOrigem: "hisense-2026",
        pdfPaginas: [],
        imagens: [],
        estado: "publicado",
      });
    });

    const tiers = await asStaff.query(api.comercial.listarTiers, {});
    const base = tiers.find((tier) => tier.slug === "base");
    if (!base) throw new Error("missing base");
    await asStaff.mutation(api.comercial.definirDesconto, {
      marca: "hisense",
      tierId: base._id,
      descontoPercent: 10,
    });

    return { empresaId, baseId: base._id };
  }

  it("returns null for anonymous and pending members", async () => {
    const test = t();
    await setupCatalog(test);

    const anon = await test.query(api.precos.porRefs, { refs: ["HS-001"] });
    expect(anon).toBeNull();

    await test.run(async (ctx) => {
      const empresas = await ctx.db.query("installerCompanies").take(1);
      const empresa = empresas[0];
      if (!empresa) throw new Error("missing company");
      await ctx.db.patch(empresa._id, { estadoAprovacao: "pendente" });
    });

    const pending = await test
      .withIdentity(installerIdentity("org_price"))
      .query(api.precos.porRefs, { refs: ["HS-001"] });
    expect(pending).toBeNull();
  });

  it("returns final cents for an approved member and treats a missing cell as PVP", async () => {
    const test = t();
    const { baseId } = await setupCatalog(test);

    const asInstaller = test.withIdentity(installerIdentity("org_price"));
    const comDesconto = await asInstaller.query(api.precos.porRefs, {
      refs: ["HS-001"],
    });
    expect(comDesconto).toEqual([
      { ref: "HS-001", precoRevendaCents: 9000 },
    ]);

    await test.withIdentity(STAFF).mutation(api.comercial.definirDesconto, {
      marca: "hisense",
      tierId: baseId,
      descontoPercent: 0,
    });

    const semDesconto = await asInstaller.query(api.precos.porRefs, {
      refs: ["HS-001"],
    });
    expect(semDesconto).toEqual([
      { ref: "HS-001", precoRevendaCents: 10000 },
    ]);

    const desde = await asInstaller.query(api.precos.desdePorGrupos, {
      gruposModelo: ["hisense-35"],
    });
    expect(desde).toEqual([
      { grupoModelo: "hisense-35", precoDesdeCents: 10000 },
    ]);
  });

  it("blocks reseller prices while the company is suspended", async () => {
    const test = t();
    const { empresaId } = await setupCatalog(test);
    await test.withIdentity(STAFF).mutation(api.empresas.transitar, {
      empresaId,
      para: "suspensa",
    });

    const prices = await test
      .withIdentity(installerIdentity("org_price"))
      .query(api.precos.porRefs, { refs: ["HS-001"] });
    expect(prices).toBeNull();
  });
});

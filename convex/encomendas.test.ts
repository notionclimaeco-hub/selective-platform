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

async function inserirEmpresa(
  test: ReturnType<typeof t>,
  clerkOrgId: string,
  nif: string,
) {
  return await test.mutation(internal.empresas.inserirPendente, {
    clerkOrgId,
    nomeLegal: "Clima Teste Lda",
    nif,
    morada: "Rua A 1, 1000-001 Lisboa",
    email: "compras@teste.pt",
    telefone: "+351210000000",
    registadoPor: "user_installer",
    registadoEm: 1,
  });
}

async function inserirProduto(
  test: ReturnType<typeof t>,
  ref: string,
  pvpCents: number,
  estado: "publicado" | "rascunho" = "publicado",
) {
  await test.run(async (ctx) => {
    await ctx.db.insert("produtos", {
      ref,
      marca: "hisense",
      nome: `Hisense ${ref}`,
      nomeGrupo: `Hisense ${ref}`,
      familia: "ar-condicionado",
      componente: "conjunto",
      grupoModelo: `hisense-${ref}`,
      atributos: [],
      pvpCents,
      ivaIncluido: false,
      tabelaOrigem: "hisense-2026",
      pdfPaginas: [],
      imagens: [],
      estado,
    });
  });
}

/** Approved company on base tier with 10% on hisense; two published SKUs. */
async function cenario(test: ReturnType<typeof t>) {
  await test.mutation(internal.seed.seedTiers, {});
  const empresaId = await inserirEmpresa(test, "org_enc", "509442013");
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
  });
  await inserirProduto(test, "HS-001", 10000);
  await inserirProduto(test, "HS-002", 20000);

  const tiers = await asStaff.query(api.comercial.listarTiers, {});
  const base = tiers.find((tier) => tier.slug === "base");
  if (!base) throw new Error("missing base tier");
  await asStaff.mutation(api.comercial.definirDesconto, {
    marca: "hisense",
    tierId: base._id,
    descontoPercent: 10,
  });

  return {
    empresaId,
    baseId: base._id,
    asStaff,
    asInstaller: test.withIdentity(installerIdentity("org_enc")),
  };
}

describe("encomendas.submeter", () => {
  it("requires an approved member and published refs", async () => {
    const test = t();
    const { empresaId, asInstaller } = await cenario(test);
    await inserirProduto(test, "HS-DRAFT", 1000, "rascunho");
    const linhas = [{ ref: "HS-001", qty: 1 }];

    await expect(
      test.mutation(api.encomendas.submeter, { linhas }),
    ).rejects.toThrow(/Not authenticated/);

    await test.run((ctx) =>
      ctx.db.patch(empresaId, { estadoAprovacao: "pendente" }),
    );
    await expect(
      asInstaller.mutation(api.encomendas.submeter, { linhas }),
    ).rejects.toThrow(/not approved/);

    await test.run((ctx) =>
      ctx.db.patch(empresaId, { estadoAprovacao: "aprovada" }),
    );
    await expect(
      asInstaller.mutation(api.encomendas.submeter, {
        linhas: [{ ref: "HS-DRAFT", qty: 1 }],
      }),
    ).rejects.toThrow(/unpublished/);
    await expect(
      asInstaller.mutation(api.encomendas.submeter, { linhas: [] }),
    ).rejects.toThrow(/empty/);
    await expect(
      asInstaller.mutation(api.encomendas.submeter, {
        linhas: [{ ref: "HS-001", qty: 0 }],
      }),
    ).rejects.toThrow(/qty/);
  });

  it("snapshots reseller cents, merges duplicate refs, numbers ENC-n", async () => {
    const test = t();
    const { asInstaller } = await cenario(test);

    const primeira = await asInstaller.mutation(api.encomendas.submeter, {
      linhas: [
        { ref: "HS-001", qty: 2 },
        { ref: "HS-001", qty: 1 },
        { ref: "HS-002", qty: 1 },
      ],
    });
    expect(primeira.numero).toBe(1);

    const detalhe = await asInstaller.query(api.encomendas.obter, {
      encomendaId: primeira.encomendaId,
    });
    expect(detalhe).not.toBeNull();
    if (!detalhe) return;
    expect(detalhe.titulo).toBe("ENC-1 — Clima Teste Lda");
    expect(detalhe.estado).toBe("recebida");
    expect(detalhe.ivaPercent).toBe(23);
    expect(detalhe.nLinhas).toBe(2);
    expect(detalhe.totalRevendaCents).toBe(3 * 9000 + 18000);
    const hs001 = detalhe.linhas.find((l) => l.ref === "HS-001");
    expect(hs001).toMatchObject({
      qty: 3,
      pvpCents: 10000,
      precoRevendaCents: 9000,
      estadoLinha: "por_confirmar",
    });
    expect(hs001).not.toHaveProperty("custoCents");

    // Catalog price change does not touch the snapshot.
    await test.run(async (ctx) => {
      const produto = await ctx.db
        .query("produtos")
        .withIndex("by_ref", (q) => q.eq("ref", "HS-001"))
        .unique();
      if (produto) await ctx.db.patch(produto._id, { pvpCents: 99999 });
    });
    const depois = await asInstaller.query(api.encomendas.obter, {
      encomendaId: primeira.encomendaId,
    });
    expect(
      depois?.linhas.find((l) => l.ref === "HS-001")?.precoRevendaCents,
    ).toBe(9000);

    const segunda = await asInstaller.mutation(api.encomendas.submeter, {
      linhas: [{ ref: "HS-002", qty: 1 }],
    });
    expect(segunda.numero).toBe(2);

    const lista = await asInstaller.query(api.encomendas.minhas, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(lista.page.map((e) => e.numero)).toEqual([2, 1]);
  });

  it("keeps orders private to the owning company", async () => {
    const test = t();
    const { asInstaller, asStaff } = await cenario(test);
    const { encomendaId } = await asInstaller.mutation(
      api.encomendas.submeter,
      { linhas: [{ ref: "HS-001", qty: 1 }] },
    );

    const outra = await inserirEmpresa(test, "org_outra", "500000000");
    await asStaff.mutation(api.empresas.transitar, {
      empresaId: outra,
      para: "aprovada",
    });
    const asOutra = test.withIdentity(
      installerIdentity("org_outra", "user_outra"),
    );

    expect(
      await asOutra.query(api.encomendas.obter, { encomendaId }),
    ).toBeNull();
    await expect(
      asOutra.mutation(api.encomendas.cancelar, { encomendaId }),
    ).rejects.toThrow(/not found/);
    const lista = await asOutra.query(api.encomendas.minhas, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(lista.page).toEqual([]);
  });
});

describe("encomendas.minhas", () => {
  it("filters by the installer's chips before paginating", async () => {
    const test = t();
    const { asInstaller } = await cenario(test);
    const estados = [
      "recebida",
      "aguardando_stock",
      "aguardando_pagamento",
      "paga",
      "concluida",
      "cancelada",
    ] as const;
    for (const estado of estados) {
      const { encomendaId } = await asInstaller.mutation(
        api.encomendas.submeter,
        { linhas: [{ ref: "HS-001", qty: 1 }] },
      );
      await test.run((ctx) => ctx.db.patch(encomendaId, { estado }));
    }

    async function numeros(
      filtro?: "a-pagar" | "em-curso" | "concluidas" | "canceladas",
    ) {
      const lista = await asInstaller.query(api.encomendas.minhas, {
        paginationOpts: { numItems: 10, cursor: null },
        ...(filtro ? { filtro } : {}),
      });
      return lista.page.map((e) => e.numero);
    }

    expect(await numeros()).toEqual([6, 5, 4, 3, 2, 1]);
    expect(await numeros("a-pagar")).toEqual([3]);
    expect(await numeros("em-curso")).toEqual([4, 2, 1]);
    expect(await numeros("concluidas")).toEqual([5]);
    expect(await numeros("canceladas")).toEqual([6]);
  });
});

describe("encomendas.cancelar", () => {
  it("installer may cancel before pay, never after paga", async () => {
    const test = t();
    const { asInstaller } = await cenario(test);
    const a = await asInstaller.mutation(api.encomendas.submeter, {
      linhas: [{ ref: "HS-001", qty: 1 }],
    });
    const cancelada = await asInstaller.mutation(api.encomendas.cancelar, {
      encomendaId: a.encomendaId,
    });
    expect(cancelada.estado).toBe("cancelada");
    expect(cancelada.cancelReason).toBe("installer");

    const b = await asInstaller.mutation(api.encomendas.submeter, {
      linhas: [{ ref: "HS-001", qty: 1 }],
    });
    await test.run((ctx) => ctx.db.patch(b.encomendaId, { estado: "paga" }));
    await expect(
      asInstaller.mutation(api.encomendas.cancelar, {
        encomendaId: b.encomendaId,
      }),
    ).rejects.toThrow(/paga/);
  });
});

describe("office line edits (internal)", () => {
  it("stock requested → confirm / qty / drop; last drop cancels the header", async () => {
    const test = t();
    const { asInstaller } = await cenario(test);
    const { encomendaId } = await asInstaller.mutation(
      api.encomendas.submeter,
      {
        linhas: [
          { ref: "HS-001", qty: 2 },
          { ref: "HS-002", qty: 1 },
        ],
      },
    );

    const aguardando = await test.mutation(internal.encomendas.pedirStock, {
      encomendaId,
    });
    expect(aguardando.estado).toBe("aguardando_stock");
    await expect(
      test.mutation(internal.encomendas.pedirStock, { encomendaId }),
    ).rejects.toThrow(/aguardando_stock/);

    const detalhe = await asInstaller.query(api.encomendas.obter, {
      encomendaId,
    });
    const l1 = detalhe?.linhas.find((l) => l.ref === "HS-001");
    const l2 = detalhe?.linhas.find((l) => l.ref === "HS-002");
    if (!l1 || !l2) throw new Error("missing lines");

    const confirmada = await test.mutation(internal.encomendas.confirmarLinha, {
      linhaId: l1._id,
      custoCents: 5000,
    });
    expect(confirmada.estadoLinha).toBe("confirmada");
    expect(confirmada).not.toHaveProperty("custoCents");

    const reduzida = await test.mutation(internal.encomendas.alterarQtyLinha, {
      linhaId: l1._id,
      qty: 1,
    });
    expect(reduzida).toMatchObject({ qty: 1, estadoLinha: "confirmada" });

    const aumentada = await test.mutation(internal.encomendas.alterarQtyLinha, {
      linhaId: l1._id,
      qty: 4,
    });
    expect(aumentada.estadoLinha).toBe("por_confirmar");

    const aposUma = await test.mutation(internal.encomendas.retirarLinha, {
      linhaId: l1._id,
    });
    expect(aposUma).toMatchObject({
      estado: "aguardando_stock",
      nLinhas: 1,
      totalRevendaCents: 18000,
    });

    const cancelada = await test.mutation(internal.encomendas.retirarLinha, {
      linhaId: l2._id,
    });
    expect(cancelada).toMatchObject({
      estado: "cancelada",
      cancelReason: "all_lines_dropped",
      nLinhas: 0,
      totalRevendaCents: 0,
    });

    await expect(
      test.mutation(internal.encomendas.confirmarLinha, { linhaId: l2._id }),
    ).rejects.toThrow(/cancelada/);
  });

  it("re-adding a dropped SKU uses the current reseller price", async () => {
    const test = t();
    const { asInstaller, asStaff, baseId } = await cenario(test);
    const { encomendaId } = await asInstaller.mutation(
      api.encomendas.submeter,
      {
        linhas: [
          { ref: "HS-001", qty: 1 },
          { ref: "HS-002", qty: 1 },
        ],
      },
    );
    const detalhe = await asInstaller.query(api.encomendas.obter, {
      encomendaId,
    });
    const l1 = detalhe?.linhas.find((l) => l.ref === "HS-001");
    if (!l1) throw new Error("missing line");

    await expect(
      test.mutation(internal.encomendas.adicionarLinha, {
        encomendaId,
        ref: "HS-001",
        qty: 1,
      }),
    ).rejects.toThrow(/already on this order/);

    await test.mutation(internal.encomendas.retirarLinha, { linhaId: l1._id });
    await asStaff.mutation(api.comercial.definirDesconto, {
      marca: "hisense",
      tierId: baseId,
      descontoPercent: 20,
    });

    const revivida = await test.mutation(internal.encomendas.adicionarLinha, {
      encomendaId,
      ref: "HS-001",
      qty: 2,
    });
    expect(revivida).toMatchObject({
      _id: l1._id,
      qty: 2,
      precoRevendaCents: 8000,
      estadoLinha: "por_confirmar",
    });

    const final = await asInstaller.query(api.encomendas.obter, {
      encomendaId,
    });
    expect(final?.totalRevendaCents).toBe(2 * 8000 + 18000);
    expect(final?.nLinhas).toBe(2);
  });
});

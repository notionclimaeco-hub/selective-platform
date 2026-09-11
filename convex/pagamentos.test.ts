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

const INSTALLER = {
  subject: "user_installer",
  issuer: "https://example.clerk.accounts.dev",
  tokenIdentifier: "https://example.clerk.accounts.dev|user_installer",
  org_id: "org_pag",
  org_role: "org:admin",
};

const TOKEN = "a".repeat(64);
const REVOLUT_ID = "rev-order-1";

/** Approved company, one published SKU, order in `aguardando_stock` with the line confirmed. */
async function encomendaProntaACobrar() {
  const test = convexTest(schema, modules);
  await test.mutation(internal.seed.seedTiers, {});
  const empresaId = await test.mutation(internal.empresas.inserirPendente, {
    clerkOrgId: "org_pag",
    nomeLegal: "Clima Teste Lda",
    nif: "509442013",
    morada: "Rua A 1, 1000-001 Lisboa",
    email: "compras@teste.pt",
    telefone: "+351210000000",
    registadoPor: "user_installer",
    registadoEm: 1,
  });
  const asStaff = test.withIdentity(STAFF);
  await asStaff.mutation(api.empresas.transitar, { empresaId, para: "aprovada" });
  await test.run(async (ctx) => {
    await ctx.db.insert("produtos", {
      ref: "HS-001",
      marca: "hisense",
      nome: "Hisense HS-001",
      nomeGrupo: "Hisense HS-001",
      familia: "ar-condicionado",
      componente: "conjunto",
      grupoModelo: "hisense-hs-001",
      atributos: [],
      pvpCents: 10000,
      ivaIncluido: false,
      tabelaOrigem: "hisense-2026",
      pdfPaginas: [],
      imagens: [],
      estado: "publicado",
    });
  });
  const asInstaller = test.withIdentity(INSTALLER);
  const { encomendaId } = await asInstaller.mutation(api.encomendas.submeter, {
    linhas: [{ ref: "HS-001", qty: 2 }],
  });
  await test.mutation(internal.encomendas.pedirStock, { encomendaId });
  const detalhe = await asInstaller.query(api.encomendas.obter, { encomendaId });
  const linha = detalhe?.linhas[0];
  if (!linha) throw new Error("missing line");
  await test.mutation(internal.encomendas.confirmarLinha, { linhaId: linha._id });
  return { test, asInstaller, encomendaId, linhaId: linha._id };
}

async function registarPedido(
  test: ReturnType<typeof convexTest>,
  encomendaId: Id<"installerOrders">,
) {
  await test.mutation(internal.pagamentos.registarPedido, {
    encomendaId,
    pagamentoToken: TOKEN,
    revolutOrderId: REVOLUT_ID,
    revolutToken: "public-token",
    totalPagamentoCents: 24600,
    agora: 1_000,
    expiraEm: 1_000 + 7 * 24 * 3600 * 1000,
  });
}

describe("pedir pagamento", () => {
  it("moves to aguardando_pagamento only when every remaining line is confirmed", async () => {
    const { test, asInstaller, encomendaId, linhaId } = await encomendaProntaACobrar();
    await test.mutation(internal.encomendas.alterarQtyLinha, { linhaId, qty: 3 }); // back to por_confirmar
    await expect(
      test.query(internal.pagamentos.paraPedido, { encomendaId }),
    ).rejects.toThrow(/confirmed/);
    await test.mutation(internal.encomendas.confirmarLinha, { linhaId });

    const pedido = await test.query(internal.pagamentos.paraPedido, { encomendaId });
    expect(pedido.empresa.email).toBe("compras@teste.pt");
    await registarPedido(test, encomendaId);

    const vista = await asInstaller.query(api.encomendas.obter, { encomendaId });
    expect(vista).toMatchObject({
      estado: "aguardando_pagamento",
      pagamentoToken: TOKEN,
      totalPagamentoCents: 24600,
    });
    await expect(
      test.mutation(internal.pagamentos.registarPedido, {
        encomendaId,
        pagamentoToken: "b".repeat(64),
        revolutOrderId: "other",
        revolutToken: "t",
        totalPagamentoCents: 1,
        agora: 2,
        expiraEm: 3,
      }),
    ).rejects.toThrow(/aguardando_pagamento/);
  });

  it("serves the public payment page by token, hiding the widget token once paid", async () => {
    const { test, encomendaId } = await encomendaProntaACobrar();
    expect(await test.query(api.pagamentos.porToken, { token: TOKEN })).toBeNull();
    await registarPedido(test, encomendaId);

    const pagina = await test.query(api.pagamentos.porToken, { token: TOKEN });
    expect(pagina).toMatchObject({
      estado: "aguardando_pagamento",
      empresa: "Clima Teste Lda",
      revolutToken: "public-token",
      totalPagamentoCents: 24600,
    });
    expect(pagina?.linhas).toHaveLength(1);
    expect(await test.query(api.pagamentos.porToken, { token: "short" })).toBeNull();

    await test.mutation(internal.pagamentos.aplicarEvento, {
      revolutOrderId: REVOLUT_ID,
      evento: "ORDER_COMPLETED",
      recebidoEm: 5_000,
    });
    const paga = await test.query(api.pagamentos.porToken, { token: TOKEN });
    expect(paga).toMatchObject({ estado: "paga", paidAt: 5_000 });
    expect(paga?.revolutToken).toBeUndefined();
  });

  it("void-to-edit returns to aguardando_stock and keeps the public token", async () => {
    const { test, encomendaId } = await encomendaProntaACobrar();
    await expect(
      test.mutation(internal.pagamentos.voltarAEditar, { encomendaId }),
    ).rejects.toThrow(/aguardando_stock/);
    await registarPedido(test, encomendaId);
    await test.mutation(internal.pagamentos.voltarAEditar, { encomendaId });
    const doc = await test.run((ctx) => ctx.db.get(encomendaId));
    expect(doc).toMatchObject({ estado: "aguardando_stock", pagamentoToken: TOKEN });
    expect(doc?.revolutOrderId).toBeUndefined();
    // Second request reuses the same public token.
    await registarPedido(test, encomendaId);
    expect((await test.run((ctx) => ctx.db.get(encomendaId)))?.pagamentoToken).toBe(TOKEN);
  });
});

describe("Revolut webhook effects", () => {
  it("ORDER_COMPLETED → paga with qty buckets, idempotent", async () => {
    const { test, encomendaId, linhaId } = await encomendaProntaACobrar();
    await registarPedido(test, encomendaId);
    const primeira = await test.mutation(internal.pagamentos.aplicarEvento, {
      revolutOrderId: REVOLUT_ID,
      evento: "ORDER_COMPLETED",
      recebidoEm: 9_000,
    });
    expect(primeira).toBe("paga");
    const linha = await test.run((ctx) => ctx.db.get(linhaId));
    expect(linha).toMatchObject({ qtyPorEnviar: 2, qtyEmTransito: 0, qtyAguardaRecolha: 0, qtyFalhada: 0 });
    const repetida = await test.mutation(internal.pagamentos.aplicarEvento, {
      revolutOrderId: REVOLUT_ID,
      evento: "ORDER_COMPLETED",
      recebidoEm: 9_500,
    });
    expect(repetida).toBe("repetido");
  });

  it("ORDER_FAILED → cancelada (payment_expired); declined attempts change nothing", async () => {
    const { test, encomendaId } = await encomendaProntaACobrar();
    await registarPedido(test, encomendaId);
    expect(
      await test.mutation(internal.pagamentos.aplicarEvento, {
        revolutOrderId: REVOLUT_ID,
        evento: "ORDER_PAYMENT_DECLINED",
        recebidoEm: 1,
      }),
    ).toBe("tentativa_falhada");
    expect((await test.run((ctx) => ctx.db.get(encomendaId)))?.estado).toBe("aguardando_pagamento");

    expect(
      await test.mutation(internal.pagamentos.aplicarEvento, {
        revolutOrderId: REVOLUT_ID,
        evento: "ORDER_FAILED",
        recebidoEm: 2,
      }),
    ).toBe("expirada");
    expect(await test.run((ctx) => ctx.db.get(encomendaId))).toMatchObject({
      estado: "cancelada",
      cancelReason: "payment_expired",
    });
  });

  it("flags a payment that lands after the installer cancelled", async () => {
    const { test, asInstaller, encomendaId } = await encomendaProntaACobrar();
    await registarPedido(test, encomendaId);
    await asInstaller.mutation(api.encomendas.cancelar, { encomendaId });
    expect(
      await test.mutation(internal.pagamentos.aplicarEvento, {
        revolutOrderId: REVOLUT_ID,
        evento: "ORDER_COMPLETED",
        recebidoEm: 3,
      }),
    ).toBe("pagamento_inesperado");
    expect(await test.run((ctx) => ctx.db.get(encomendaId))).toMatchObject({
      estado: "cancelada",
      paidAt: 3,
    });
  });

  it("ignores Revolut orders that are not ours", async () => {
    const { test } = await encomendaProntaACobrar();
    expect(
      await test.mutation(internal.pagamentos.aplicarEvento, {
        revolutOrderId: "someone-else",
        evento: "ORDER_COMPLETED",
        recebidoEm: 1,
      }),
    ).toBe("desconhecido");
  });
});

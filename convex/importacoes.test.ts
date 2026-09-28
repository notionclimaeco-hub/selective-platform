/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const SECRET = "segredo-teste";

const STAFF = {
  subject: "user_staff",
  issuer: "https://example.clerk.accounts.dev",
  tokenIdentifier: "https://example.clerk.accounts.dev|user_staff",
  role: "staff",
};

beforeEach(() => {
  vi.stubEnv("IMPORT_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function t() {
  return convexTest(schema, modules);
}
type T = ReturnType<typeof t>;

type Atributo = { chave: string; valor: string };

// A clean ar-condicionado conjunto: every required registry key present.
function staged(
  ref: string,
  extra: Partial<{
    marca: string;
    nome: string;
    nomeGrupo: string;
    familia: string;
    sistema: string;
    componente:
      | "conjunto"
      | "unidade-interior"
      | "unidade-exterior"
      | "acessorio"
      | "comando"
      | "deposito";
    gama: string;
    grupoModelo: string;
    atributos: Array<Atributo>;
    pvpCents: number;
    tabelaOrigem: string;
    pdfPaginas: Array<number>;
    compativelCom: Array<string>;
    avisos: Array<string>;
  }> = {},
) {
  return {
    ref,
    marca: "hisense",
    nome: `Mural Energy ${ref}`,
    nomeGrupo: "Mural Energy",
    familia: "ar-condicionado",
    componente: "conjunto" as const,
    grupoModelo: "hisense-energy",
    atributos: [
      { chave: "frio-kw", valor: "2.5" },
      { chave: "calor-kw", valor: "3.2" },
      { chave: "classe-energetica", valor: "A++/A+" },
    ],
    pvpCents: 50000,
    ivaIncluido: false,
    tabelaOrigem: "hisense-2026",
    pdfPaginas: [3],
    avisos: [],
    ...extra,
  };
}

// The 18 import fields of a staged SKU (what `upsertPorRef` accepts).
function live(ref: string, extra: Parameters<typeof staged>[1] = {}) {
  const { avisos: _a, compativelCom: _c, ...campos } = staged(ref, extra);
  return campos;
}

async function seedLive(
  test: T,
  produto: ReturnType<typeof live>,
  estado?: "rascunho" | "publicado" | "descontinuado",
  imagens: Array<Id<"_storage">> = [],
) {
  const { produtoId } = await test.mutation(internal.produtos.upsertPorRef, produto);
  if (imagens.length > 0) {
    await test.run((ctx) => ctx.db.patch(produtoId, { imagens }));
  }
  // Goes through the internal mutation so `catalogoGrupos` is synced too.
  if (estado) {
    await test.mutation(internal.produtos.definirEstadoPorRefs, {
      refs: [produto.ref],
      estado,
    });
  }
  return produtoId;
}

async function criarRun(
  test: T,
  extra: Partial<{ marca: string; ano: number; tabelaOrigem: string; pdf: Id<"_storage"> }> = {},
) {
  const { importacaoId } = await test.mutation(api.importacoes.criarImportacao, {
    secret: SECRET,
    marca: "hisense",
    ano: 2026,
    tabelaOrigem: "hisense-2026",
    ficheiro: "hisense-2026.pdf",
    ...extra,
  });
  return importacaoId;
}

async function carregar(
  test: T,
  importacaoId: Id<"importacoes">,
  skus: Array<ReturnType<typeof staged>>,
  concluir = true,
) {
  const r = await test.mutation(api.importacoes.carregarSkus, {
    secret: SECRET,
    importacaoId,
    skus,
  });
  if (concluir) {
    await test.mutation(api.importacoes.concluirCarregamento, {
      secret: SECRET,
      importacaoId,
    });
  }
  return r;
}

async function linhas(test: T, importacaoId: Id<"importacoes">) {
  return await test.run((ctx) =>
    ctx.db
      .query("skusEmRevisao")
      .withIndex("by_importacao", (q) => q.eq("importacaoId", importacaoId))
      .collect(),
  );
}

async function run(test: T, importacaoId: Id<"importacoes">) {
  const doc = await test.run((ctx) => ctx.db.get(importacaoId));
  if (!doc) throw new Error("run missing");
  return doc;
}

async function produtoPorRef(test: T, ref: string) {
  return await test.run((ctx) =>
    ctx.db
      .query("produtos")
      .withIndex("by_ref", (q) => q.eq("ref", ref))
      .unique(),
  );
}

async function storeBlob(test: T) {
  return await test.run((ctx) => ctx.storage.store(new Blob(["x"])));
}

describe("importacoes: carregamento", () => {
  it("rejects a wrong secret", async () => {
    const test = t();
    await expect(
      test.mutation(api.importacoes.criarImportacao, {
        secret: "errado",
        marca: "hisense",
        ano: 2026,
        tabelaOrigem: "hisense-2026",
        ficheiro: "x.pdf",
      }),
    ).rejects.toThrow(/inválido/);
  });

  it("creates a run in a-extrair with zero counts", async () => {
    const test = t();
    const id = await criarRun(test);
    expect(await run(test, id)).toMatchObject({
      estado: "a-extrair",
      numSkus: 0,
      numGrupos: 0,
      marca: "hisense",
      tabelaOrigem: "hisense-2026",
    });
  });

  it("classifies novo / alterado / igual against the live catalog", async () => {
    const test = t();
    await seedLive(test, live("A", { pvpCents: 50000 }));
    await seedLive(test, live("B", { pvpCents: 40000 }));
    const id = await criarRun(test);
    const r = await carregar(test, id, [staged("A"), staged("B"), staged("C")]);
    expect(r).toEqual({ carregados: 3, erros: [] });
    const rows = await linhas(test, id);
    const byRef = Object.fromEntries(rows.map((l) => [l.ref, l]));
    expect(byRef.A).toMatchObject({ diff: "igual", precoAnteriorCents: 50000 });
    expect(byRef.B).toMatchObject({ diff: "alterado", precoAnteriorCents: 40000 });
    expect(byRef.C).toMatchObject({ diff: "novo", grupoRevisto: false, promovido: false });
    expect(byRef.C?.precoAnteriorCents).toBeUndefined();
    expect(await run(test, id)).toMatchObject({
      estado: "em-revisao",
      numSkus: 3,
      numGrupos: 1,
      numNovos: 1,
      numAlterados: 1,
      numIguais: 1,
      numComAvisos: 0,
    });
  });

  it("merges registry warnings into avisos and folds compativelCom", async () => {
    const test = t();
    const id = await criarRun(test);
    await carregar(test, id, [
      staged("UE", {
        componente: "unidade-exterior",
        grupoModelo: "hisense-energy-unidade-exterior",
        atributos: [
          { chave: "frio-kw", valor: "5.0" },
          { chave: "misterio", valor: "1" },
        ],
        compativelCom: ["AMS-09", "AMS-12"],
        avisos: ["extractor: preço lido da página 4"],
      }),
    ]);
    const [row] = await linhas(test, id);
    expect(row?.avisos).toEqual([
      "extractor: preço lido da página 4",
      "misterio: chave desconhecida para ar-condicionado",
    ]);
    expect(row?.atributos).toContainEqual({
      chave: "compativel-com",
      valor: "AMS-09,AMS-12",
    });
    expect(await run(test, id)).toMatchObject({ numComAvisos: 1 });
  });

  it("rejects rows with registry errors, bad taxonomy, wrong table or duplicate refs", async () => {
    const test = t();
    const id = await criarRun(test);
    const r = await carregar(
      test,
      id,
      [
        staged("OK"),
        staged("TIPO", { atributos: [{ chave: "frio-kw", valor: "2,5 kW" }] }),
        staged("FAM", { familia: "inexistente" }),
        staged("SIS", { sistema: "quad-split" }),
        staged("TAB", { tabelaOrigem: "hisense-2025" }),
        staged("NEG", { pvpCents: -1 }),
        staged("OK"),
      ],
      false,
    );
    expect(r.carregados).toBe(1);
    expect(r.erros.map((e) => e.ref)).toEqual(["TIPO", "FAM", "SIS", "TAB", "NEG", "OK"]);
    expect(r.erros[0]?.erro).toMatch(/frio-kw/);
    expect(r.erros[5]?.erro).toMatch(/duplicada/);
    expect((await linhas(test, id)).map((l) => l.ref)).toEqual(["OK"]);
  });

  it("rejects a ref already loaded by a previous batch", async () => {
    const test = t();
    const id = await criarRun(test);
    await carregar(test, id, [staged("A")], false);
    const r = await carregar(test, id, [staged("A")], false);
    expect(r.carregados).toBe(0);
    expect(r.erros[0]?.erro).toMatch(/duplicada/);
  });

  it("refuses to conclude an empty run and to load after review started", async () => {
    const test = t();
    const id = await criarRun(test);
    await expect(
      test.mutation(api.importacoes.concluirCarregamento, { secret: SECRET, importacaoId: id }),
    ).rejects.toThrow(/não tem SKUs/);
    await carregar(test, id, [staged("A")]);
    await expect(carregar(test, id, [staged("B")], false)).rejects.toThrow(/em-revisao/);
  });

  it("supersedes an open run of the same table and deletes its rows", async () => {
    const test = t();
    const antiga = await criarRun(test);
    await carregar(test, antiga, [staged("A")]);
    const nova = await criarRun(test);
    expect(nova).not.toBe(antiga);
    expect(await run(test, antiga)).toMatchObject({
      estado: "rejeitada",
      motivoRejeicao: "substituída por nova extração",
    });
    expect(await linhas(test, antiga)).toEqual([]);
    // A different table is untouched.
    const outra = await criarRun(test, { marca: "midea", tabelaOrigem: "midea-2026" });
    expect(await run(test, nova)).toMatchObject({ estado: "a-extrair" });
    expect(await run(test, outra)).toMatchObject({ estado: "a-extrair" });
  });
});

describe("importacoes: registarPaginaImagem", () => {
  it("creates the slot when the PNG arrives before the PDF, then keeps both", async () => {
    const test = t();
    const png = await storeBlob(test);
    const r1 = await test.mutation(api.importacoes.registarPaginaImagem, {
      secret: SECRET,
      tabelaOrigem: "hisense-2026",
      pagina: 3,
      imagem: png,
    });
    expect(r1.substituido).toBe(false);

    const pdf = await storeBlob(test);
    const r2 = await test.mutation(api.importData.registarPagina, {
      secret: SECRET,
      tabelaOrigem: "hisense-2026",
      pagina: 3,
      ficheiro: pdf,
    });
    expect(r2.paginaId).toBe(r1.paginaId);
    expect(r2.substituido).toBe(false);

    const slot = await test.run((ctx) => ctx.db.get(r1.paginaId));
    expect(slot).toMatchObject({ ficheiro: pdf, imagem: png });
  });

  it("replaces the previous render and deletes its file", async () => {
    const test = t();
    const antigo = await storeBlob(test);
    const { paginaId } = await test.mutation(api.importacoes.registarPaginaImagem, {
      secret: SECRET,
      tabelaOrigem: "hisense-2026",
      pagina: 5,
      imagem: antigo,
    });
    const novo = await storeBlob(test);
    const r = await test.mutation(api.importacoes.registarPaginaImagem, {
      secret: SECRET,
      tabelaOrigem: "hisense-2026",
      pagina: 5,
      imagem: novo,
    });
    expect(r).toEqual({ paginaId, substituido: true });
    expect(await test.run((ctx) => ctx.db.get(paginaId))).toMatchObject({ imagem: novo });
    expect(await test.run((ctx) => ctx.db.system.get(antigo))).toBeNull();
  });
});

describe("importacoes: revisão", () => {
  async function runComGrupos(test: T) {
    await seedLive(test, live("P1", { pvpCents: 10000 }));
    const id = await criarRun(test);
    await carregar(test, id, [
      // group with a price change → must be reviewed
      staged("P1", { pvpCents: 12000 }),
      // clean, unchanged group → never blocks
      staged("L1", { grupoModelo: "hisense-limpo", nomeGrupo: "Limpo" }),
      // group with a warning → must be reviewed
      staged("A1", {
        grupoModelo: "hisense-aviso",
        nomeGrupo: "Aviso",
        avisos: ["extractor: capacidade ilegível"],
      }),
    ]);
    return id;
  }

  it("requires staff for review functions", async () => {
    const test = t();
    const id = await runComGrupos(test);
    await expect(
      test.mutation(api.importacoes.marcarGrupoRevisto, {
        importacaoId: id,
        grupoModelo: "hisense-energy",
        revisto: true,
      }),
    ).rejects.toThrow(/Not authenticated/);
    await expect(
      test.mutation(api.importacoes.aprovarImportacao, { importacaoId: id }),
    ).rejects.toThrow(/Not authenticated/);
    await expect(
      test.mutation(api.importacoes.rejeitarImportacao, { importacaoId: id }),
    ).rejects.toThrow(/Not authenticated/);
  });

  it("marks every row of a group and rejects unknown groups", async () => {
    const test = t();
    const id = await runComGrupos(test);
    const staff = test.withIdentity(STAFF);
    const r = await staff.mutation(api.importacoes.marcarGrupoRevisto, {
      importacaoId: id,
      grupoModelo: "hisense-energy",
      revisto: true,
    });
    expect(r).toEqual({ atualizados: 1 });
    const rows = await linhas(test, id);
    expect(rows.find((l) => l.ref === "P1")?.grupoRevisto).toBe(true);
    expect(rows.find((l) => l.ref === "L1")?.grupoRevisto).toBe(false);
    await expect(
      staff.mutation(api.importacoes.marcarGrupoRevisto, {
        importacaoId: id,
        grupoModelo: "nao-existe",
        revisto: true,
      }),
    ).rejects.toThrow(/não existe/);
  });

  it("refuses approval while a group with avisos or price changes is unreviewed", async () => {
    const test = t();
    const id = await runComGrupos(test);
    const staff = test.withIdentity(STAFF);
    await expect(
      staff.mutation(api.importacoes.aprovarImportacao, { importacaoId: id }),
    ).rejects.toThrow(/2 grupo\(s\).*hisense-aviso, hisense-energy/);
    await staff.mutation(api.importacoes.marcarGrupoRevisto, {
      importacaoId: id,
      grupoModelo: "hisense-energy",
      revisto: true,
    });
    await expect(
      staff.mutation(api.importacoes.aprovarImportacao, { importacaoId: id }),
    ).rejects.toThrow(/1 grupo\(s\).*hisense-aviso/);
    expect(await run(test, id)).toMatchObject({ estado: "em-revisao" });
  });

  it("passes the gate once every blocking group is reviewed", async () => {
    const test = t();
    const id = await runComGrupos(test);
    const staff = test.withIdentity(STAFF);
    for (const grupoModelo of ["hisense-energy", "hisense-aviso"]) {
      await staff.mutation(api.importacoes.marcarGrupoRevisto, {
        importacaoId: id,
        grupoModelo,
        revisto: true,
      });
    }
    const r = await staff.mutation(api.importacoes.aprovarImportacao, { importacaoId: id });
    expect(r).toEqual({ agendado: true });
    expect(await run(test, id)).toMatchObject({
      estado: "a-promover",
      decididoPor: "user_staff",
    });
  });

  it("rejects a run with a motivo and refuses to reject twice", async () => {
    const test = t();
    const id = await runComGrupos(test);
    const staff = test.withIdentity(STAFF);
    await staff.mutation(api.importacoes.rejeitarImportacao, {
      importacaoId: id,
      motivo: "  páginas em falta ",
    });
    expect(await run(test, id)).toMatchObject({
      estado: "rejeitada",
      motivoRejeicao: "páginas em falta",
      decididoPor: "user_staff",
    });
    expect((await linhas(test, id)).length).toBe(3);
    await expect(
      staff.mutation(api.importacoes.rejeitarImportacao, { importacaoId: id }),
    ).rejects.toThrow(/rejeitada/);
  });
});

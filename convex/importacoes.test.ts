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

async function aprovarEPromover(test: T, importacaoId: Id<"importacoes">) {
  vi.useFakeTimers();
  await test
    .withIdentity(STAFF)
    .mutation(api.importacoes.aprovarImportacao, { importacaoId });
  await test.finishAllScheduledFunctions(vi.runAllTimers);
  vi.useRealTimers();
}

describe("importacoes: promoção", () => {
  it("promotes every staged ref, preserving estado and imagens of live refs", async () => {
    const test = t();
    const foto = await storeBlob(test);
    await seedLive(test, live("PUB", { pvpCents: 50000 }), "publicado", [foto]);
    await seedLive(test, live("DESC", { pvpCents: 50000 }), "descontinuado");
    const id = await criarRun(test);
    await carregar(test, id, [
      staged("PUB", { nome: "Mural Energy PUB 2026" }),
      staged("DESC"),
      staged("NOVO"),
    ]);
    await aprovarEPromover(test, id);

    expect(await run(test, id)).toMatchObject({
      estado: "aprovada",
      numPromovidos: 3,
      numReativados: 1,
      numDescontinuados: 0,
    });
    expect(await produtoPorRef(test, "PUB")).toMatchObject({
      estado: "publicado",
      imagens: [foto],
      nome: "Mural Energy PUB 2026",
    });
    expect(await produtoPorRef(test, "DESC")).toMatchObject({ estado: "rascunho" });
    expect(await produtoPorRef(test, "NOVO")).toMatchObject({
      estado: "rascunho",
      imagens: [],
      tabelaOrigem: "hisense-2026",
    });
    const rows = await test.run((ctx) =>
      ctx.db
        .query("skusEmRevisao")
        .withIndex("by_importacao_promovido", (q) =>
          q.eq("importacaoId", id).eq("promovido", false),
        )
        .collect(),
    );
    expect(rows).toEqual([]);
  });

  it("marks absent refs of the brand descontinuado, across an older tabelaOrigem, never deleting", async () => {
    const test = t();
    await seedLive(test, live("FICA"), "publicado");
    await seedLive(
      test,
      live("SAI", { tabelaOrigem: "hisense-2025", grupoModelo: "hisense-antigo", nomeGrupo: "Antigo" }),
      "publicado",
    );
    await seedLive(
      test,
      live("SGT", { marca: "midea", tabelaOrigem: "midea-sgt", grupoModelo: "midea-sgt-x", nomeGrupo: "SGT" }),
      "publicado",
    );
    await seedLive(test, live("JA", { grupoModelo: "hisense-ja" }), "descontinuado");
    const id = await criarRun(test);
    await carregar(test, id, [staged("FICA")]);
    await aprovarEPromover(test, id);

    expect(await run(test, id)).toMatchObject({ estado: "aprovada", numDescontinuados: 1 });
    expect(await produtoPorRef(test, "FICA")).toMatchObject({ estado: "publicado" });
    expect(await produtoPorRef(test, "SAI")).toMatchObject({ estado: "descontinuado" });
    expect(await produtoPorRef(test, "SGT")).toMatchObject({ estado: "publicado" });
    expect(await produtoPorRef(test, "JA")).toMatchObject({ estado: "descontinuado" });
    // The listing drops a group whose only published SKU was discontinued.
    const grupo = await test.run((ctx) =>
      ctx.db
        .query("catalogoGrupos")
        .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", "hisense-antigo"))
        .unique(),
    );
    expect(grupo).toBeNull();
  });

  it("also discontinues by tabelaOrigem when the marca slug differs", async () => {
    const test = t();
    await seedLive(
      test,
      live("VELHO", { marca: "hisense-pt", grupoModelo: "hisense-pt-velho" }),
      "publicado",
    );
    const id = await criarRun(test);
    await carregar(test, id, [staged("NOVO")]);
    await aprovarEPromover(test, id);
    expect(await produtoPorRef(test, "VELHO")).toMatchObject({ estado: "descontinuado" });
  });

  it("promotes in batches of 100 and blocks a new run while promoting", async () => {
    const test = t();
    const id = await criarRun(test);
    const skus = Array.from({ length: 150 }, (_, i) =>
      staged(`R${String(i).padStart(3, "0")}`),
    );
    await carregar(test, id, skus.slice(0, 100), false);
    await carregar(test, id, skus.slice(100));

    vi.useFakeTimers();
    await test
      .withIdentity(STAFF)
      .mutation(api.importacoes.aprovarImportacao, { importacaoId: id });
    // Fire the runAfter(0) timer so the first batch starts, then wait for
    // it; the second batch it schedules stays pending.
    await vi.advanceTimersByTimeAsync(0);
    await test.finishInProgressScheduledFunctions();
    expect(await run(test, id)).toMatchObject({ estado: "a-promover", numPromovidos: 100 });
    await expect(criarRun(test)).rejects.toThrow(/a ser promovida/);
    await test.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();

    expect(await run(test, id)).toMatchObject({ estado: "aprovada", numPromovidos: 150 });
    expect(await produtoPorRef(test, "R149")).not.toBeNull();
  });

  it("retomarPromocao re-schedules a run left in a-promover and refuses other states", async () => {
    const test = t();
    const id = await criarRun(test);
    await carregar(test, id, [staged("A"), staged("B")]);
    const staff = test.withIdentity(STAFF);
    await expect(
      staff.mutation(api.importacoes.retomarPromocao, { importacaoId: id }),
    ).rejects.toThrow(/a-promover/);
    await expect(
      test.mutation(api.importacoes.retomarPromocao, { importacaoId: id }),
    ).rejects.toThrow(/Not authenticated/);

    // Approve but never run the scheduled batch: the run sits in a-promover
    // exactly as it would after a failed batch.
    vi.useFakeTimers();
    await staff.mutation(api.importacoes.aprovarImportacao, { importacaoId: id });
    expect(await run(test, id)).toMatchObject({ estado: "a-promover" });
    const r = await staff.mutation(api.importacoes.retomarPromocao, { importacaoId: id });
    expect(r).toEqual({ agendado: true });
    await test.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
    expect(await run(test, id)).toMatchObject({ estado: "aprovada", numPromovidos: 2 });
  });
});

describe("importacoes: consultas", () => {
  async function runParaConsulta(test: T) {
    await seedLive(test, live("P1", { pvpCents: 10000 }), "publicado");
    const pdf = await storeBlob(test);
    const png = await storeBlob(test);
    await test.mutation(api.importData.registarPagina, {
      secret: SECRET,
      tabelaOrigem: "hisense-2026",
      pagina: 3,
      ficheiro: pdf,
    });
    await test.mutation(api.importacoes.registarPaginaImagem, {
      secret: SECRET,
      tabelaOrigem: "hisense-2026",
      pagina: 4,
      imagem: png,
    });
    const id = await criarRun(test, { pdf });
    await carregar(test, id, [
      staged("P1", { pvpCents: 12000, pdfPaginas: [3, 4] }),
      staged("P2", { pvpCents: 9000, pdfPaginas: [3] }),
      staged("L1", { grupoModelo: "hisense-limpo", nomeGrupo: "Limpo" }),
      staged("A1", { grupoModelo: "hisense-aviso", nomeGrupo: "Aviso", avisos: ["x"] }),
    ]);
    return id;
  }

  it("requires staff", async () => {
    const test = t();
    const id = await runParaConsulta(test);
    await expect(test.query(api.importacoes.listar, {})).rejects.toThrow(/Not authenticated/);
    await expect(
      test.query(api.importacoes.obter, { importacaoId: id, pagina: 0, porPagina: 10 }),
    ).rejects.toThrow(/Not authenticated/);
    await expect(
      test.query(api.importacoes.obterGrupo, { importacaoId: id, grupoModelo: "hisense-energy" }),
    ).rejects.toThrow(/Not authenticated/);
  });

  it("lists runs newest first with counts", async () => {
    const test = t();
    const antiga = await criarRun(test, { marca: "midea", tabelaOrigem: "midea-2026" });
    const nova = await runParaConsulta(test);
    const lista = await test.withIdentity(STAFF).query(api.importacoes.listar, {});
    expect(lista.map((r) => r._id)).toEqual([nova, antiga]);
    expect(lista[0]).toMatchObject({ estado: "em-revisao", numSkus: 4, numGrupos: 3 });
  });

  it("returns the run header, paginated group summaries and the review gate count", async () => {
    const test = t();
    const id = await runParaConsulta(test);
    const staff = test.withIdentity(STAFF);
    const r = await staff.query(api.importacoes.obter, { importacaoId: id, pagina: 0, porPagina: 2 });
    expect(r?.importacao).toMatchObject({ _id: id, estado: "em-revisao", numSkus: 4 });
    expect(typeof r?.importacao.pdfUrl).toBe("string");
    expect(r?.totalGrupos).toBe(3);
    expect(r?.numPaginas).toBe(2);
    expect(r?.gruposPorRever).toBe(2);
    expect(r?.grupos.map((g) => g.grupoModelo)).toEqual(["hisense-aviso", "hisense-limpo"]);
    expect(r?.grupos[0]).toMatchObject({
      nomeGrupo: "Aviso",
      numSkus: 1,
      numAvisos: 1,
      revisto: false,
      precisaRevisao: true,
    });

    // Out-of-range page clamps to the last one.
    const ultima = await staff.query(api.importacoes.obter, { importacaoId: id, pagina: 9, porPagina: 2 });
    expect(ultima?.pagina).toBe(1);
    expect(ultima?.grupos.map((g) => g.grupoModelo)).toEqual(["hisense-energy"]);

    // Filters narrow the set and recount pages.
    const porRever = await staff.query(api.importacoes.obter, {
      importacaoId: id,
      pagina: 0,
      porPagina: 10,
      filtro: "por-rever",
    });
    expect(porRever?.grupos.map((g) => g.grupoModelo)).toEqual(["hisense-aviso", "hisense-energy"]);
    expect(porRever?.totalGrupos).toBe(2);
    expect(porRever?.gruposPorRever).toBe(2);
  });

  it("applies the page's text, familia and toggle filters and lists the run's familias", async () => {
    const test = t();
    const id = await runParaConsulta(test);
    const staff = test.withIdentity(STAFF);
    const base = { importacaoId: id, pagina: 0, porPagina: 10 };
    const ids = async (extra: Record<string, unknown>) =>
      (await staff.query(api.importacoes.obter, { ...base, ...extra }))?.grupos.map(
        (g) => g.grupoModelo,
      );
    expect(await ids({ busca: "energy" })).toEqual(["hisense-energy"]);
    expect(await ids({ busca: "LIMPO" })).toEqual(["hisense-limpo"]);
    expect(await ids({ soAvisos: true })).toEqual(["hisense-aviso"]);
    expect(await ids({ soAlterados: true })).toEqual(["hisense-energy"]);
    expect(await ids({ soPorRever: true })).toEqual(["hisense-aviso", "hisense-energy"]);
    expect(await ids({ soPorRever: true, soAvisos: true })).toEqual(["hisense-aviso"]);
    expect(await ids({ familia: "aqs" })).toEqual([]);
    const r = await staff.query(api.importacoes.obter, base);
    expect(r?.familias).toEqual(["ar-condicionado"]);
    expect(r?.grupos[0]?.componente).toBe("conjunto");
    expect(r?.grupos[0]?.gama).toBeUndefined();
  });

  it("returns null for an unknown run", async () => {
    const test = t();
    const id = await runParaConsulta(test);
    await test.run((ctx) => ctx.db.delete(id));
    const r = await test
      .withIdentity(STAFF)
      .query(api.importacoes.obter, { importacaoId: id, pagina: 0, porPagina: 10 });
    expect(r).toBeNull();
  });

  it("returns a group's SKUs by price with the live counterpart and page files", async () => {
    const test = t();
    const id = await runParaConsulta(test);
    const staff = test.withIdentity(STAFF);
    const g = await staff.query(api.importacoes.obterGrupo, {
      importacaoId: id,
      grupoModelo: "hisense-energy",
    });
    expect(g?.nomeGrupo).toBe("Mural Energy");
    expect(g?.revisto).toBe(false);
    expect(g?.skus.map((s) => s.ref)).toEqual(["P2", "P1"]);
    expect(g?.skus[1]).toMatchObject({ diff: "alterado", precoAnteriorCents: 10000 });
    expect(g?.skus[1]?.atual).toMatchObject({ pvpCents: 10000, estado: "publicado", numImagens: 0 });
    expect(g?.skus[0]?.atual).toBeNull();
    expect(g?.paginas.map((p) => p.pagina)).toEqual([3, 4]);
    expect(typeof g?.paginas[0]?.pdfUrl).toBe("string");
    expect(g?.paginas[0]?.imagemUrl).toBeNull();
    expect(g?.paginas[1]?.pdfUrl).toBeNull();
    expect(typeof g?.paginas[1]?.imagemUrl).toBe("string");

    expect(
      await staff.query(api.importacoes.obterGrupo, { importacaoId: id, grupoModelo: "nada" }),
    ).toBeNull();
  });
});

describe("importacoes: carregamento (revisão final)", () => {
  it("rejects a SKU whose marca is not the run's", async () => {
    const test = t();
    const id = await criarRun(test);
    const r = await carregar(test, id, [staged("X", { marca: "midea" })], false);
    expect(r.carregados).toBe(0);
    expect(r.erros[0]?.erro).toMatch(/marca "midea"/);
  });

  it("rejects a SKU whose grupoModelo already holds another brand in the catalog", async () => {
    const test = t();
    await seedLive(test, live("M1", { marca: "midea", tabelaOrigem: "midea-2026", grupoModelo: "partilhado" }));
    const id = await criarRun(test);
    const r = await carregar(test, id, [staged("H1", { grupoModelo: "partilhado" })], false);
    expect(r.carregados).toBe(0);
    expect(r.erros[0]?.erro).toMatch(/partilhado.*midea/);
  });
});

describe("obter: imagens", () => {
  it("counts groups without a decision or live images and filters them", async () => {
    const test = t();
    const staff = test.withIdentity(STAFF);
    const id = await criarRun(test);
    await carregar(test, id, [
      staged("A1", { grupoModelo: "g-a" }),
      staged("B1", { grupoModelo: "g-b", nomeGrupo: "B" }),
    ]);
    const f = await test.run(async (ctx) => ctx.storage.store(new Blob(["x"])));
    await test.run(async (ctx) => {
      await ctx.db.insert("imagensGrupo", {
        grupoModelo: "g-a",
        marca: "hisense",
        imagens: [f],
        atualizadoEm: 1,
        atualizadoPor: "s",
      });
    });
    const tudo = await staff.query(api.importacoes.obter, { importacaoId: id, pagina: 0, porPagina: 50 });
    expect(tudo?.gruposSemImagens).toBe(1);
    expect(tudo?.grupos.find((g) => g.grupoModelo === "g-a")?.temImagens).toBe(true);
    const so = await staff.query(api.importacoes.obter, {
      importacaoId: id,
      pagina: 0,
      porPagina: 50,
      soSemImagens: true,
    });
    expect(so?.grupos.map((g) => g.grupoModelo)).toEqual(["g-b"]);
  });
});

describe("promoção: imagens", () => {
  async function runAprovavel(tt: T) {
    const { importacaoId } = await tt.mutation(api.importacoes.criarImportacao, {
      secret: SECRET, marca: "hisense", ano: 2026, tabelaOrigem: "hisense-2026", ficheiro: "t.pdf",
    });
    await tt.mutation(api.importacoes.carregarSkus, {
      secret: SECRET, importacaoId,
      skus: [
        staged("A1", { grupoModelo: "g-a" }),
        staged("A2", { grupoModelo: "g-a" }),
        staged("B1", { grupoModelo: "g-b", nomeGrupo: "B" }),
      ],
    });
    await tt.mutation(api.importacoes.concluirCarregamento, { secret: SECRET, importacaoId });
    return importacaoId;
  }
  const f = (tt: T, s: string) => tt.run(async (ctx) => ctx.storage.store(new Blob([s])));

  it("applies the group list and the porRef override, keeps groups without decision, cleans candidates", async () => {
    vi.useFakeTimers();
    const tt = t();
    const staff = tt.withIdentity(STAFF);
    const importacaoId = await runAprovavel(tt);
    const capa = await f(tt, "capa");
    const preta = await f(tt, "preta");
    const lixo = await f(tt, "lixo");
    const viva = await f(tt, "viva");
    // B1 already exists with a photo and gets no decision.
    await tt.run(async (ctx) => {
      await ctx.db.insert("produtos", {
        ref: "B1", marca: "hisense", nome: "B1", nomeGrupo: "B", familia: "ar-condicionado", componente: "conjunto",
        grupoModelo: "g-b", atributos: [], pvpCents: 50000, ivaIncluido: false, tabelaOrigem: "hisense-2025",
        pdfPaginas: [1], imagens: [viva], estado: "publicado",
      });
    });
    await tt.mutation(api.imagens.registarCandidatas, {
      secret: SECRET,
      candidatas: [
        { marca: "hisense", grupoModelo: "g-a", ficheiro: capa, fonte: "site", hash: "h1", largura: 1, altura: 1 },
        { marca: "hisense", grupoModelo: "g-a", ficheiro: preta, fonte: "site", hash: "h2", largura: 1, altura: 1 },
        { marca: "hisense", grupoModelo: "g-a", ficheiro: lixo, fonte: "pdf", hash: "h3", largura: 1, altura: 1 },
        { marca: "hisense", grupoModelo: "g-b", ficheiro: viva, fonte: "site", hash: "h4", largura: 1, altura: 1 },
      ],
    });
    await staff.mutation(api.imagens.definirImagensGrupo, {
      grupoModelo: "g-a", marca: "hisense", imagens: [capa], porRef: [{ ref: "A2", imagens: [preta] }],
      refsDoGrupo: ["A1", "A2"],
    });
    await staff.mutation(api.importacoes.aprovarImportacao, { importacaoId });
    await tt.finishAllScheduledFunctions(vi.runAllTimers);

    const porRef = async (ref: string) =>
      tt.run(async (ctx) => (await ctx.db.query("produtos").withIndex("by_ref", (q) => q.eq("ref", ref)).unique())?.imagens);
    expect(await porRef("A1")).toEqual([capa]);
    expect(await porRef("A2")).toEqual([preta]);
    expect(await porRef("B1")).toEqual([viva]);
    const existe = (id: Id<"_storage">) => tt.run(async (ctx) => (await ctx.db.system.get(id)) !== null);
    expect(await existe(lixo)).toBe(false); // unchosen candidate removed
    expect(await existe(viva)).toBe(true); // nunca apaga ficheiro em uso (live product)
    expect(await existe(capa)).toBe(true);
    const run = await tt.run(async (ctx) => ctx.db.get(importacaoId));
    expect(run?.estado).toBe("aprovada");
    expect(run?.numImagensAplicadas).toBe(2);
    expect(run?.numCandidatasRemovidas).toBe(1);
    const restantes = await tt.run(async (ctx) => ctx.db.query("imagensCandidatas").collect());
    expect(restantes.map((c) => c.hash).sort()).toEqual(["h1", "h2", "h4"]);
  });

  async function produtoComFoto(tt: T, ref: string, grupoModelo: string, foto: Id<"_storage">) {
    await tt.run(async (ctx) => {
      await ctx.db.insert("produtos", {
        ref, marca: "hisense", nome: ref, nomeGrupo: "X", familia: "ar-condicionado", componente: "conjunto",
        grupoModelo, atributos: [], pvpCents: 50000, ivaIncluido: false, tabelaOrigem: "hisense-2025",
        pdfPaginas: [1], imagens: [foto], estado: "publicado",
      });
    });
  }
  const existe = (tt: T, id: Id<"_storage">) => tt.run(async (ctx) => (await ctx.db.system.get(id)) !== null);
  const imagensDe = (tt: T, ref: string) =>
    tt.run(async (ctx) => (await ctx.db.query("produtos").withIndex("by_ref", (q) => q.eq("ref", ref)).unique())?.imagens);

  it("deletes a pre-existing non-candidate image that a decision replaces", async () => {
    vi.useFakeTimers();
    const tt = t();
    const staff = tt.withIdentity(STAFF);
    const importacaoId = await runAprovavel(tt);
    const velha = await f(tt, "velha");
    const nova = await f(tt, "nova");
    await produtoComFoto(tt, "A1", "g-a", velha);
    await tt.mutation(api.imagens.registarCandidatas, {
      secret: SECRET,
      candidatas: [{ marca: "hisense", grupoModelo: "g-a", ficheiro: nova, fonte: "site", hash: "n1", largura: 1, altura: 1 }],
    });
    await staff.mutation(api.imagens.definirImagensGrupo, {
      grupoModelo: "g-a", marca: "hisense", imagens: [nova], porRef: [], refsDoGrupo: ["A1", "A2"],
    });
    await staff.mutation(api.importacoes.aprovarImportacao, { importacaoId });
    await tt.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await imagensDe(tt, "A1")).toEqual([nova]);
    expect(await existe(tt, velha)).toBe(false);
    expect(await existe(tt, nova)).toBe(true);
  });

  it("keeps a replaced image that another product or another group's decision still uses", async () => {
    vi.useFakeTimers();
    const tt = t();
    const staff = tt.withIdentity(STAFF);
    const importacaoId = await runAprovavel(tt);
    const partilhada = await f(tt, "partilhada");
    const daDecisao = await f(tt, "da-decisao");
    const nova = await f(tt, "nova");
    // A1 and a product outside the run share a photo; A2 had a photo that
    // another group's decision chose.
    await produtoComFoto(tt, "A1", "g-a", partilhada);
    await produtoComFoto(tt, "OUTRO", "g-z", partilhada);
    await produtoComFoto(tt, "A2", "g-a", daDecisao);
    await staff.mutation(api.imagens.definirImagensGrupo, {
      grupoModelo: "g-z", marca: "hisense", imagens: [daDecisao], porRef: [], refsDoGrupo: ["OUTRO"],
    });
    await staff.mutation(api.imagens.definirImagensGrupo, {
      grupoModelo: "g-a", marca: "hisense", imagens: [nova], porRef: [], refsDoGrupo: ["A1", "A2"],
    });
    await staff.mutation(api.importacoes.aprovarImportacao, { importacaoId });
    await tt.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await imagensDe(tt, "A1")).toEqual([nova]);
    expect(await imagensDe(tt, "A2")).toEqual([nova]);
    expect(await existe(tt, partilhada)).toBe(true);
    expect(await existe(tt, daDecisao)).toBe(true);
  });
});

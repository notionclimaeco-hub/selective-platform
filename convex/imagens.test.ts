/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
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

beforeEach(() => vi.stubEnv("IMPORT_SECRET", SECRET));
afterEach(() => vi.unstubAllEnvs());

function t() {
  return convexTest(schema, modules);
}
type T = ReturnType<typeof t>;

async function ficheiro(tt: T, conteudo = "png"): Promise<Id<"_storage">> {
  return await tt.run(async (ctx) => ctx.storage.store(new Blob([conteudo])));
}
async function existe(tt: T, id: Id<"_storage">): Promise<boolean> {
  return await tt.run(async (ctx) => (await ctx.db.system.get(id)) !== null);
}

function candidata(ficheiroId: Id<"_storage">, hash: string, extra: Record<string, unknown> = {}) {
  return {
    marca: "hisense",
    grupoModelo: "hisense-air-master",
    ficheiro: ficheiroId,
    fonte: "site" as const,
    origemUrl: "https://hisense.pt/air-master",
    hash,
    largura: 800,
    altura: 800,
    ...extra,
  };
}

describe("registarCandidatas", () => {
  it("creates rows and dedupes by hash, dropping the duplicate file", async () => {
    const tt = t();
    const a = await ficheiro(tt, "a");
    const b = await ficheiro(tt, "b");
    const r1 = await tt.mutation(api.imagens.registarCandidatas, {
      secret: SECRET,
      candidatas: [candidata(a, "h1"), candidata(b, "h2", { cor: "preto" })],
    });
    expect(r1).toEqual({ criadas: 2, repetidas: 0 });

    const a2 = await ficheiro(tt, "a-again");
    const r2 = await tt.mutation(api.imagens.registarCandidatas, {
      secret: SECRET,
      candidatas: [candidata(a2, "h1", { cor: "branco" })],
    });
    expect(r2).toEqual({ criadas: 0, repetidas: 1 });
    expect(await existe(tt, a2)).toBe(false);
    const rows = await tt.run(async (ctx) =>
      ctx.db.query("imagensCandidatas").withIndex("by_grupo", (q) => q.eq("grupoModelo", "hisense-air-master")).collect(),
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.hash === "h1")?.cor).toBe("branco");
    expect(rows.find((r) => r.hash === "h1")?.ficheiro).toBe(a);
  });

  it("hash repetido no mesmo lote: one row, one file", async () => {
    const tt = t();
    const a = await ficheiro(tt, "a");
    const b = await ficheiro(tt, "a");
    const r = await tt.mutation(api.imagens.registarCandidatas, {
      secret: SECRET,
      candidatas: [candidata(a, "same"), candidata(b, "same")],
    });
    expect(r).toEqual({ criadas: 1, repetidas: 1 });
    expect(await existe(tt, b)).toBe(false);
  });

  it("links a recorte to its source by origemHash and rejects a wrong secret", async () => {
    const tt = t();
    const src = await ficheiro(tt, "src");
    const cut = await ficheiro(tt, "cut");
    await tt.mutation(api.imagens.registarCandidatas, {
      secret: SECRET,
      candidatas: [candidata(src, "hs")],
    });
    await tt.mutation(api.imagens.registarCandidatas, {
      secret: SECRET,
      candidatas: [candidata(cut, "hc", { fonte: "recorte", origemHash: "hs" })],
    });
    const rows = await tt.run(async (ctx) =>
      ctx.db.query("imagensCandidatas").withIndex("by_hash", (q) => q.eq("hash", "hc")).collect(),
    );
    const fonte = await tt.run(async (ctx) =>
      ctx.db.query("imagensCandidatas").withIndex("by_hash", (q) => q.eq("hash", "hs")).unique(),
    );
    expect(rows[0]?.origem).toBe(fonte?._id);
    await expect(
      tt.mutation(api.imagens.registarCandidatas, { secret: "errado", candidatas: [] }),
    ).rejects.toThrow();
  });
});

describe("limparCandidatas", () => {
  it("deletes a brand's candidates and files except chosen or live ones", async () => {
    const tt = t();
    const livre = await ficheiro(tt, "livre");
    const escolhido = await ficheiro(tt, "escolhido");
    await tt.mutation(api.imagens.registarCandidatas, {
      secret: SECRET,
      candidatas: [candidata(livre, "h-livre"), candidata(escolhido, "h-esc", { fonte: "pdf" })],
    });
    await tt.run(async (ctx) => {
      await ctx.db.insert("imagensGrupo", {
        grupoModelo: "hisense-air-master", marca: "hisense", imagens: [escolhido],
        atualizadoEm: 1, atualizadoPor: "user_staff",
      });
    });
    const r = await tt.mutation(api.imagens.limparCandidatas, { secret: SECRET, marca: "hisense" });
    expect(r).toEqual({ removidas: 1 });
    expect(await existe(tt, livre)).toBe(false);
    expect(await existe(tt, escolhido)).toBe(true);
  });
});

async function seedProduto(tt: T, ref: string, grupoModelo: string, imagens: Array<Id<"_storage">>) {
  await tt.run(async (ctx) => {
    await ctx.db.insert("produtos", {
      ref, marca: "hisense", nome: ref, nomeGrupo: "Mural Air Master", familia: "ar-condicionado",
      componente: "conjunto", grupoModelo, atributos: [], pvpCents: 100, ivaIncluido: false,
      tabelaOrigem: "hisense-2025", pdfPaginas: [1], imagens, estado: "publicado",
    });
  });
}

describe("staff: obterGrupoImagens / definirImagensGrupo / candidatas", () => {
  it("returns candidates with URLs and recorteId, the decision and live images", async () => {
    const tt = t();
    const staff = tt.withIdentity(STAFF);
    const src = await ficheiro(tt, "src");
    const cut = await ficheiro(tt, "cut");
    const live = await ficheiro(tt, "live");
    await tt.mutation(api.imagens.registarCandidatas, {
      secret: SECRET,
      candidatas: [candidata(src, "hs"), candidata(cut, "hc", { fonte: "recorte", origemHash: "hs" })],
    });
    await seedProduto(tt, "QK25WM0A", "hisense-air-master", [live]);

    const antes = await staff.query(api.imagens.obterGrupoImagens, { grupoModelo: "hisense-air-master" });
    expect(antes.escolhidas).toBeNull();
    expect(antes.atuais).toEqual([{ ref: "QK25WM0A", imagens: [{ ficheiro: live, url: expect.any(String) }] }]);
    const fonte = antes.candidatas.find((c) => c.fonte === "site");
    const recorte = antes.candidatas.find((c) => c.fonte === "recorte");
    expect(fonte?.recorteId).toBe(recorte?._id);
    expect(recorte?.origem).toBe(fonte?._id);
    expect(fonte?.url).toEqual(expect.any(String));

    await staff.mutation(api.imagens.definirImagensGrupo, {
      grupoModelo: "hisense-air-master", marca: "hisense", imagens: [cut],
      porRef: [{ ref: "QK25WM0B", imagens: [src] }], refsDoGrupo: ["QK25WM0A", "QK25WM0B"],
    });
    const depois = await staff.query(api.imagens.obterGrupoImagens, { grupoModelo: "hisense-air-master" });
    expect(depois.escolhidas?.imagens.map((i) => i.ficheiro)).toEqual([cut]);
    expect(depois.escolhidas?.porRef[0]).toMatchObject({ ref: "QK25WM0B" });
  });

  it("porRef com ref repetida or outside the group is rejected; missing file is rejected", async () => {
    const tt = t();
    const staff = tt.withIdentity(STAFF);
    const f1 = await ficheiro(tt);
    await expect(staff.mutation(api.imagens.definirImagensGrupo, {
      grupoModelo: "g", marca: "hisense", imagens: [f1],
      porRef: [{ ref: "A", imagens: [f1] }, { ref: "A", imagens: [f1] }], refsDoGrupo: ["A"],
    })).rejects.toThrow(/repetida/);
    await expect(staff.mutation(api.imagens.definirImagensGrupo, {
      grupoModelo: "g", marca: "hisense", imagens: [f1],
      porRef: [{ ref: "Z", imagens: [f1] }], refsDoGrupo: ["A"],
    })).rejects.toThrow(/Z/);
    // A well-formed id whose file was deleted (a made-up id string fails argument validation instead).
    const apagado = await ficheiro(tt, "apagado");
    await tt.run(async (ctx) => ctx.storage.delete(apagado));
    await expect(staff.mutation(api.imagens.definirImagensGrupo, {
      grupoModelo: "g", marca: "hisense", imagens: [apagado], refsDoGrupo: [],
    })).rejects.toThrow(/não existe/);
  });

  it("adicionarCandidata dedupes by hash; removerCandidata refuses chosen files", async () => {
    const tt = t();
    const staff = tt.withIdentity(STAFF);
    const a = await ficheiro(tt, "a");
    const b = await ficheiro(tt, "a");
    const r1 = await staff.mutation(api.imagens.adicionarCandidata, {
      marca: "hisense", grupoModelo: "g", ficheiro: a, fonte: "upload", largura: 10, altura: 10, hash: "h",
    });
    const r2 = await staff.mutation(api.imagens.adicionarCandidata, {
      marca: "hisense", grupoModelo: "g", ficheiro: b, fonte: "upload", largura: 10, altura: 10, hash: "h",
    });
    expect(r2.candidataId).toBe(r1.candidataId);
    expect(await existe(tt, b)).toBe(false);

    await staff.mutation(api.imagens.definirImagensGrupo, {
      grupoModelo: "g", marca: "hisense", imagens: [a], refsDoGrupo: [],
    });
    await expect(staff.mutation(api.imagens.removerCandidata, { candidataId: r1.candidataId }))
      .rejects.toThrow(/em uso/);
    await staff.mutation(api.imagens.definirImagensGrupo, {
      grupoModelo: "g", marca: "hisense", imagens: [], refsDoGrupo: [],
    });
    await staff.mutation(api.imagens.removerCandidata, { candidataId: r1.candidataId });
    expect(await existe(tt, a)).toBe(false);
  });

  it("definirImagens with aplicarAoGrupo writes the group decision and keeps candidate files", async () => {
    const tt = t();
    const staff = tt.withIdentity(STAFF);
    const velha = await ficheiro(tt, "velha");
    const nova = await ficheiro(tt, "nova");
    await seedProduto(tt, "R1", "g", [velha]);
    await seedProduto(tt, "R2", "g", [velha]);
    await tt.mutation(api.imagens.registarCandidatas, { secret: SECRET, candidatas: [candidata(velha, "hv", { grupoModelo: "g" })] });
    await staff.mutation(api.imagens.definirImagens, { ref: "R1", imagens: [nova], aplicarAoGrupo: true });
    const decisao = await tt.run(async (ctx) =>
      ctx.db.query("imagensGrupo").withIndex("by_grupo", (q) => q.eq("grupoModelo", "g")).unique(),
    );
    expect(decisao?.imagens).toEqual([nova]);
    expect(decisao?.porRef).toBeUndefined();
    // "velha" is no longer on any product but is still a candidate: kept.
    expect(await existe(tt, velha)).toBe(true);
  });

  it("definirImagens keeps a file that is a candidate or decision in a sibling group of the same brand", async () => {
    const tt = t();
    const staff = tt.withIdentity(STAFF);
    const partilhada = await ficheiro(tt, "partilhada");
    const decidida = await ficheiro(tt, "decidida");
    const nova = await ficheiro(tt, "nova");
    await seedProduto(tt, "R1", "g1", [partilhada, decidida]);
    await tt.mutation(api.imagens.registarCandidatas, {
      secret: SECRET, candidatas: [candidata(partilhada, "hp", { grupoModelo: "g2" })],
    });
    await tt.run(async (ctx) => {
      await ctx.db.insert("imagensGrupo", {
        grupoModelo: "g2", marca: "hisense", imagens: [decidida], atualizadoEm: 1, atualizadoPor: "user_staff",
      });
    });
    const r = await staff.mutation(api.imagens.definirImagens, { ref: "R1", imagens: [nova] });
    expect(r.ficheirosRemovidos).toBe(0);
    expect(await existe(tt, partilhada)).toBe(true);
    expect(await existe(tt, decidida)).toBe(true);
  });

  it("candidate dedupe is per group: same hash in two groups keeps both files; same group dedupes", async () => {
    const tt = t();
    const staff = tt.withIdentity(STAFF);
    const a = await ficheiro(tt, "a");
    const b = await ficheiro(tt, "a");
    const c = await ficheiro(tt, "a");
    const args = { fonte: "upload" as const, largura: 10, altura: 10, hash: "h" };
    const r1 = await staff.mutation(api.imagens.adicionarCandidata, { marca: "hisense", grupoModelo: "g1", ficheiro: a, ...args });
    const r2 = await staff.mutation(api.imagens.adicionarCandidata, { marca: "hisense", grupoModelo: "g2", ficheiro: b, ...args });
    expect(r2.candidataId).not.toBe(r1.candidataId);
    expect(await existe(tt, a)).toBe(true);
    expect(await existe(tt, b)).toBe(true);
    const r3 = await staff.mutation(api.imagens.adicionarCandidata, { marca: "hisense", grupoModelo: "g2", ficheiro: c, ...args });
    expect(r3.candidataId).toBe(r2.candidataId);
    expect(await existe(tt, c)).toBe(false);
    const g2 = await staff.query(api.imagens.obterGrupoImagens, { grupoModelo: "g2" });
    expect(g2.candidatas).toHaveLength(1);
  });

  it("staff functions reject non-staff", async () => {
    const tt = t();
    await expect(tt.query(api.imagens.obterGrupoImagens, { grupoModelo: "g" })).rejects.toThrow();
  });
});

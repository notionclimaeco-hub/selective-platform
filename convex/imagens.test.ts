/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "segredo-teste";

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

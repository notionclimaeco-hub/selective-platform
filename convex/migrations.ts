/**
 * One-shot data migrations. Run via `npx convex run migrations:…` (or MCP).
 *
 * These write `produtos` directly without refreshing the denormalised
 * `catalogoGrupos` listing. After running any of them, rebuild it with
 * `npx convex run catalogo:reconstruir`.
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { ficheirosReferenciados } from "./imagens";

// Canonical attribute keys for the legacy fixed spec columns, in display
// order. Axis attributes (from atributosVariante) come first; these specs are
// appended after, skipping keys the doc already carries.
const LEGACY_SPECS = [
  ["capacidadeFrioKw", "frio-kw"],
  ["capacidadeCalorKw", "calor-kw"],
  ["capacidadeBtu", "btu"],
  ["classeEnergeticaFrio", "classe-frio"],
  ["classeEnergeticaCalor", "classe-calor"],
  ["seer", "seer"],
  ["scop", "scop"],
  ["refrigerante", "refrigerante"],
  ["wifi", "wifi"],
  ["maxUnidadesInteriores", "unidades-max"],
] as const;

// Shape of a pre-migration doc (the legacy fields no longer exist in the
// schema, so reads are done through this cast).
type CamposLegados = {
  atributos?: Array<{ chave: string; valor: string }>;
  atributosVariante?: Array<{ chave: string; valor: string }>;
  capacidadeFrioKw?: number;
  capacidadeCalorKw?: number;
  capacidadeBtu?: number;
  classeEnergeticaFrio?: string;
  classeEnergeticaCalor?: string;
  seer?: number;
  scop?: number;
  refrigerante?: string;
  wifi?: string;
  maxUnidadesInteriores?: number;
};

/**
 * Fold the legacy fixed spec columns + `atributosVariante` into the unified
 * ordered `atributos` list, then drop the legacy keys via replace.
 * Idempotent and batched — call repeatedly until `remaining` is 0.
 *
 * Already ran on dev (2026-07-24). NOTE: running this on a deployment whose
 * docs still carry legacy fields requires the transitional (widened) schema;
 * with the narrow schema those docs fail validation at push time.
 */
export const migrarParaAtributos = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  returns: v.object({
    scanned: v.number(),
    updated: v.number(),
    remaining: v.number(),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? 200, 1), 500);
    const todos = await ctx.db.query("produtos").collect();

    const pendentes = todos.filter((doc) => {
      const legado = doc as CamposLegados;
      if (legado.atributos === undefined) return true;
      if (legado.atributosVariante !== undefined) return true;
      return LEGACY_SPECS.some(([campo]) => legado[campo] !== undefined);
    });

    let updated = 0;
    for (const doc of pendentes.slice(0, batchSize)) {
      const legado = doc as typeof doc & CamposLegados;
      const atributos = [
        ...(legado.atributosVariante ?? legado.atributos ?? []),
      ];
      const presentes = new Set(atributos.map((a) => a.chave));
      for (const [campo, chave] of LEGACY_SPECS) {
        const valor = legado[campo];
        if (valor === undefined || presentes.has(chave)) continue;
        atributos.push({ chave, valor: String(valor) });
        presentes.add(chave);
      }

      const {
        _id,
        _creationTime,
        atributosVariante: _av,
        capacidadeFrioKw: _cf,
        capacidadeCalorKw: _cc,
        capacidadeBtu: _cb,
        classeEnergeticaFrio: _ef,
        classeEnergeticaCalor: _ec,
        seer: _seer,
        scop: _scop,
        refrigerante: _ref,
        wifi: _wifi,
        maxUnidadesInteriores: _max,
        ...rest
      } = legado;

      await ctx.db.replace(_id, { ...rest, atributos });
      updated++;
    }

    return {
      scanned: todos.length,
      updated,
      remaining: pendentes.length - updated,
    };
  },
});

/**
 * Replace em dashes in product names/descriptions with " | " (naming
 * convention: component separator is a pipe, not an mdash). Idempotent.
 */
export const substituirTravessaoPorPipe = internalMutation({
  args: {},
  returns: v.object({
    scanned: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx) => {
    const substituir = (s: string) =>
      s
        .replaceAll(" — ", " | ")
        .replaceAll("—", " | ")
        .replaceAll(" |  | ", " | "); // collapse if both forms were present

    const todos = await ctx.db.query("produtos").collect();
    let updated = 0;
    for (const doc of todos) {
      const nome = substituir(doc.nome);
      const nomeGrupo = substituir(doc.nomeGrupo);
      const descricao =
        doc.descricao !== undefined ? substituir(doc.descricao) : undefined;
      if (
        nome === doc.nome &&
        nomeGrupo === doc.nomeGrupo &&
        descricao === doc.descricao
      ) {
        continue;
      }
      await ctx.db.patch(doc._id, {
        nome,
        nomeGrupo,
        ...(descricao !== undefined ? { descricao } : {}),
      });
      updated++;
    }
    return { scanned: todos.length, updated };
  },
});

/**
 * Merge legacy `classe-frio` / `classe-calor` into a single
 * `classe-energetica=frio/calor` attribute (e.g. `A+++/A++`).
 * Missing side becomes `-`. Idempotent.
 */
export const unificarClasseEnergetica = internalMutation({
  args: {},
  returns: v.object({
    scanned: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx) => {
    const norm = (s: string) =>
      s
        .replaceAll("⁺", "+")
        .replaceAll("＋", "+")
        .trim();

    const todos = await ctx.db.query("produtos").collect();
    let updated = 0;
    for (const doc of todos) {
      const attrs = doc.atributos ?? [];
      const frio = attrs.find((a) => a.chave === "classe-frio")?.valor;
      const calor = attrs.find((a) => a.chave === "classe-calor")?.valor;
      const existing = attrs.find((a) => a.chave === "classe-energetica")?.valor;

      let valor: string | undefined = existing;
      if (!valor && (frio || calor)) {
        valor = `${norm(frio ?? "-")}/${norm(calor ?? "-")}`;
      } else if (valor && !valor.includes("/")) {
        // Legacy single class was cooling-only
        valor = `${norm(valor)}/-`;
      } else if (valor) {
        valor = valor
          .split("/")
          .map((p) => norm(p))
          .join("/");
      }

      if (!valor) continue;

      const next = attrs.filter(
        (a) =>
          a.chave !== "classe-frio" &&
          a.chave !== "classe-calor" &&
          a.chave !== "classe-energetica",
      );
      // Keep relative position: insert where the first legacy/class key was
      const idx = attrs.findIndex((a) =>
        ["classe-frio", "classe-calor", "classe-energetica"].includes(a.chave),
      );
      const insertAt = idx >= 0 ? Math.min(idx, next.length) : next.length;
      next.splice(insertAt, 0, { chave: "classe-energetica", valor });

      const same =
        next.length === attrs.length &&
        next.every(
          (a, i) => a.chave === attrs[i]?.chave && a.valor === attrs[i]?.valor,
        );
      if (same) continue;

      await ctx.db.patch(doc._id, { atributos: next });
      updated++;
    }
    return { scanned: todos.length, updated };
  },
});

/**
 * Set `classe-energetica` by ref (e.g. after enriching a brand CSV).
 * Replaces any existing classe-* keys. Idempotent per ref/valor.
 */
export const aplicarClasseEnergetica = internalMutation({
  args: {
    patches: v.array(
      v.object({
        ref: v.string(),
        valor: v.string(),
      }),
    ),
  },
  returns: v.object({
    updated: v.number(),
    missing: v.number(),
  }),
  handler: async (ctx, args) => {
    let updated = 0;
    let missing = 0;
    for (const { ref, valor } of args.patches) {
      const doc = await ctx.db
        .query("produtos")
        .withIndex("by_ref", (q) => q.eq("ref", ref))
        .unique();
      if (!doc) {
        missing++;
        continue;
      }
      const attrs = (doc.atributos ?? []).filter(
        (a) =>
          a.chave !== "classe-frio" &&
          a.chave !== "classe-calor" &&
          a.chave !== "classe-energetica",
      );
      const idx = (doc.atributos ?? []).findIndex((a) =>
        ["classe-frio", "classe-calor", "classe-energetica"].includes(a.chave),
      );
      const insertAt = idx >= 0 ? Math.min(idx, attrs.length) : attrs.length;
      attrs.splice(insertAt, 0, { chave: "classe-energetica", valor });
      const same =
        attrs.length === (doc.atributos ?? []).length &&
        attrs.every(
          (a, i) =>
            a.chave === doc.atributos?.[i]?.chave &&
            a.valor === doc.atributos?.[i]?.valor,
        );
      if (same) continue;
      await ctx.db.patch(doc._id, { atributos: attrs });
      updated++;
    }
    return { updated, missing };
  },
});

/** Publish every product (including those without images). Idempotent. */
export const publicarTodos = internalMutation({
  args: {},
  returns: v.object({
    alterados: v.number(),
    jaPublicados: v.number(),
    total: v.number(),
  }),
  handler: async (ctx) => {
    const todos = await ctx.db.query("produtos").collect();
    let alterados = 0;
    let jaPublicados = 0;
    for (const produto of todos) {
      if (produto.estado === "publicado") {
        jaPublicados++;
        continue;
      }
      await ctx.db.patch(produto._id, { estado: "publicado" });
      alterados++;
    }
    return { alterados, jaPublicados, total: todos.length };
  },
});

/**
 * Delete Convex Storage files nothing references (`ficheirosReferenciados`:
 * products, image candidates and group decisions of every brand, catalog
 * pages, run PDFs). Batched — call until `remaining` is 0.
 */
export const limparImagensOrfas = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  returns: v.object({
    scanned: v.number(),
    deleted: v.number(),
    remaining: v.number(),
    referenced: v.number(),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? 100, 1), 250);

    const referenciados = await ficheirosReferenciados(ctx);

    const todos = await ctx.db.system.query("_storage").collect();
    const orfaos = todos.filter((f) => !referenciados.has(f._id));
    let deleted = 0;
    for (const ficheiro of orfaos.slice(0, batchSize)) {
      await ctx.storage.delete(ficheiro._id);
      deleted++;
    }

    return {
      scanned: todos.length,
      deleted,
      remaining: orfaos.length - deleted,
      referenced: referenciados.size,
    };
  },
});

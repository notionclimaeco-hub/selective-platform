# Product images in the import review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff see candidate photos per staged group in `/importacoes/{id}`, choose and order them, upload their own and cut backgrounds, with the choice applied on approval and unchosen candidates deleted; candidates come from an agent-driven crawl run after every extraction.

**Architecture:** Two brand-wide Convex tables keyed by `grupoModelo` (`imagensCandidatas` = photos gathered, `imagensGrupo` = the ordered decision, optional per-ref override). A secret-guarded upload script (`scripts/imagens/candidatas.mjs`) fills candidates from a manifest the agent writes while browsing brand sites in Playwright (new skill `catalog-brand-images`). The review page gets an "Imagens" panel built from the products-page image manager, refactored into shared components; background removal runs in the browser with `@imgly/background-removal`. `promoverLote` applies decisions and a scheduled cleanup deletes unchosen candidates.

**Tech Stack:** Convex 1.42 (`convex-test` + vitest), TanStack Start admin app with React, `@dnd-kit`, `@imgly/background-removal`, Node scripts with `sharp` and `ConvexHttpClient`, Playwright for the agent crawl.

**Spec:** `docs/superpowers/specs/2026-09-28-imagens-na-revisao-design.md`

## Global Constraints

- Convex code follows `convex/_generated/ai/guidelines.md` (validators with `returns`, indexes named `by_<field>`, no `.filter` on queries; read the file before touching `convex/`).
- All user-visible strings in Portuguese, matching the existing admin pages (`Guardar`, `Cancelar`, `Capa`, `Revisto`).
- `produtos.imagens` stays the only list the client reads; staged SKUs gain no image field.
- Candidate images are stored resized to max 1600 px on the long side; dedupe key is the sha256 of the uploaded bytes (`hash`).
- Secret-guarded functions use `conferirSegredo(args.secret)` from `convex/lib/importSecret.ts`; staff functions use `requireStaff(ctx)` from `convex/lib/auth.ts`.
- Root vitest: `npx vitest run`; admin app tests: `pnpm --dir admin-frontend test`; Python toolkit untouched by this plan.
- Verification baseline (memory `verification-baseline`): pre-existing tsc errors are only `import.meta.glob` / `process` / `vite/client`; lint via each front end's eslint.
- Commit after every task with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

Inputs the spec implies but that would otherwise go untested; each has its test in the owning task:

1. A candidate file that the same product already uses (re-crawl of a brand already in the catalog): cleanup must never delete a file referenced by `produtos.imagens` (Task 6 test "nunca apaga ficheiro em uso").
2. Two candidates uploaded with the same bytes in one batch: only one row and one file survive (Task 3 test "hash repetido no mesmo lote").
3. A `porRef` entry for a ref that is not in the group, or a duplicate ref: `definirImagensGrupo` rejects it (Task 4 test "porRef com ref repetida").
4. The panel opened for a group already in the catalog with per-variant photos: the strip seeds from the live images of the selected ref, not the group (Task 4 `atuais` test; Task 10 reducer test "iniciar com atuais").
5. A cutout confirmed when the original is already the cover: the cutout takes the cover slot and the original goes back to candidates (Task 10 reducer test "trocar-recorte mantém a posição").

---

## File structure

```
convex/
├── schema.ts                       # + imagensCandidatas, imagensGrupo, fonteCandidataValidator, run counters
├── lib/imagensGrupo.ts             # pure: listaParaRef, ficheirosEscolhidos, candidatasARemover
├── lib/imagensGrupo.test.ts
├── lib/importacoes.ts              # + temImagens on ResumoGrupo, soSemImagens criterion
├── imagens.ts                      # + registarCandidatas, limparCandidatas, obterGrupoImagens,
│                                   #   definirImagensGrupo, adicionarCandidata, removerCandidata
├── imagens.test.ts                 # new
└── importacoes.ts                  # promotion applies decisions, limparCandidatasDaRun, obter counts
scripts/imagens/
├── lib/candidatas.mjs              # pure: lerManifesto, cobertura, chaveCandidata
├── lib/candidatas.test.ts          # vitest (root include extended)
├── alvos.mjs                       # staged.json → alvos.json
└── candidatas.mjs                  # manifest → resize/hash/upload → registarCandidatas (+ --recortar, --dry-run)
.claude/skills/catalog-brand-images/SKILL.md   (+ mirror in .agents/skills/)
admin-frontend/src/
├── lib/imagens-estado.ts           # reducer + tipos (pure)
├── lib/imagens-estado.test.ts
├── lib/imagens-ficheiro.ts         # redimensionar (canvas), sha256, upload
├── lib/recorte.ts                  # removeBackground wrapper (dynamic import)
├── components/imagens/faixa-ordenavel.tsx   # sortable strip (from image-manager)
├── components/imagens/zona-upload.tsx       # drop zone + file input
├── components/produtos/image-manager.tsx    # thin wrapper over the shared pieces
├── components/importacoes/painel-imagens.tsx
├── components/importacoes/grupo-card.tsx    # "Imagens" button + panel mount
└── routes/importacoes_.$importacaoId.tsx    # "Sem imagens" count + toggle
```

---

### Task 1: Schema — candidate and decision tables, run counters

**Files:**
- Modify: `convex/schema.ts` (after the `skusEmRevisao` table; `importacoes` table fields)
- Modify: `convex/importacoes.ts:52-69` (`importacaoValidator`)

**Interfaces:**
- Produces: tables `imagensCandidatas` (indexes `by_grupo`, `by_hash`, `by_marca`) and `imagensGrupo` (indexes `by_grupo`, `by_marca`); `fonteCandidataValidator`; `porRefValidator`; optional run fields `numImagensAplicadas`, `numCandidatasRemovidas`.

- [ ] **Step 1: Add the validators and tables**

In `convex/schema.ts`, next to `diffValidator`:

```ts
// Where a candidate photo came from (#images-in-review spec).
export const fonteCandidataValidator = v.union(
  v.literal("site"),
  v.literal("megaclima"),
  v.literal("pdf"),
  v.literal("upload"),
  v.literal("recorte"),
);

// Per-variant override inside a group's image decision.
export const porRefValidator = v.array(
  v.object({ ref: v.string(), imagens: v.array(v.id("_storage")) }),
);
```

After the `skusEmRevisao` table:

```ts
  // Candidate photos gathered for a product page (brand-wide, keyed by the
  // deterministic grupoModelo). Filled by scripts/imagens/candidatas.mjs and
  // by uploads/cutouts from the review page. Unchosen rows are deleted when
  // the brand's run is approved.
  imagensCandidatas: defineTable({
    marca: v.string(),
    grupoModelo: v.string(),
    ficheiro: v.id("_storage"),
    fonte: fonteCandidataValidator,
    origemUrl: v.optional(v.string()), // page URL, or "pdf:<pagina>"
    hash: v.string(), // sha256 of the stored bytes; dedupe key
    largura: v.number(),
    altura: v.number(),
    cor: v.optional(v.string()), // registry colour value when known
    origem: v.optional(v.id("imagensCandidatas")), // recorte: source candidate
    criadoEm: v.number(),
  })
    .index("by_grupo", ["grupoModelo"])
    .index("by_hash", ["hash"])
    .index("by_marca", ["marca"]),

  // The ordered image decision for a product page; applied to every SKU of
  // the group on approval (porRef wins for its ref).
  imagensGrupo: defineTable({
    grupoModelo: v.string(),
    marca: v.string(),
    imagens: v.array(v.id("_storage")),
    porRef: v.optional(porRefValidator),
    atualizadoEm: v.number(),
    atualizadoPor: v.string(),
  })
    .index("by_grupo", ["grupoModelo"])
    .index("by_marca", ["marca"]),
```

In the `importacoes` table, after `numDescontinuados`:

```ts
    numImagensAplicadas: v.optional(v.number()),
    numCandidatasRemovidas: v.optional(v.number()),
```

- [ ] **Step 2: Mirror the two fields in `importacaoValidator`**

In `convex/importacoes.ts`, after `numDescontinuados: v.optional(v.number()),` add:

```ts
  numImagensAplicadas: v.optional(v.number()),
  numCandidatasRemovidas: v.optional(v.number()),
```

- [ ] **Step 3: Typecheck and run the existing suite**

Run: `client-frontend/node_modules/.bin/tsc --noEmit -p convex/tsconfig.json 2>&1 | grep -vE "import.meta|process|vite/client"` → no lines.
Run: `npx vitest run` → all existing tests pass (165 at the time of writing).

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/importacoes.ts
git commit -m "Schema: imagensCandidatas and imagensGrupo tables, image counters on import runs"
```

---

### Task 2: Pure helpers for image decisions

**Files:**
- Create: `convex/lib/imagensGrupo.ts`
- Test: `convex/lib/imagensGrupo.test.ts`

**Interfaces:**
- Produces:
  - `type DecisaoImagens = { imagens: Array<Id<"_storage">>; porRef?: Array<{ ref: string; imagens: Array<Id<"_storage">> }> }`
  - `listaParaRef(d: DecisaoImagens, ref: string): Array<Id<"_storage">>`
  - `ficheirosEscolhidos(d: DecisaoImagens | null): Set<Id<"_storage">>`
  - `candidatasARemover<T extends { _id: X; ficheiro: Id<"_storage"> }>(candidatas: ReadonlyArray<T>, mantidos: ReadonlySet<Id<"_storage">>): Array<T>`
  - `validarPorRef(porRef: ReadonlyArray<{ ref: string }>, refsDoGrupo: ReadonlySet<string>): string | null` (error message or null)

- [ ] **Step 1: Write the failing tests**

```ts
// convex/lib/imagensGrupo.test.ts
import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import {
  candidatasARemover,
  ficheirosEscolhidos,
  listaParaRef,
  validarPorRef,
} from "./imagensGrupo";

const f = (s: string) => s as Id<"_storage">;

describe("listaParaRef", () => {
  it("uses the ref override when present, else the group list", () => {
    const d = {
      imagens: [f("g1"), f("g2")],
      porRef: [{ ref: "A-PRETO", imagens: [f("p1")] }],
    };
    expect(listaParaRef(d, "A-PRETO")).toEqual([f("p1")]);
    expect(listaParaRef(d, "A-BRANCO")).toEqual([f("g1"), f("g2")]);
  });
});

describe("ficheirosEscolhidos", () => {
  it("unions the group list and every override; null decision is empty", () => {
    const d = { imagens: [f("g1")], porRef: [{ ref: "X", imagens: [f("p1"), f("g1")] }] };
    expect([...ficheirosEscolhidos(d)].sort()).toEqual(["g1", "p1"]);
    expect(ficheirosEscolhidos(null).size).toBe(0);
  });
});

describe("candidatasARemover", () => {
  it("keeps candidates whose file is in the kept set", () => {
    const c = [
      { _id: "c1", ficheiro: f("g1") },
      { _id: "c2", ficheiro: f("x") },
    ];
    expect(candidatasARemover(c, new Set([f("g1")])).map((x) => x._id)).toEqual(["c2"]);
  });
});

describe("validarPorRef", () => {
  it("rejects refs outside the group and duplicates", () => {
    const refs = new Set(["A", "B"]);
    expect(validarPorRef([{ ref: "A" }], refs)).toBeNull();
    expect(validarPorRef([{ ref: "Z" }], refs)).toMatch(/Z/);
    expect(validarPorRef([{ ref: "A" }, { ref: "A" }], refs)).toMatch(/repetida/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run convex/lib/imagensGrupo.test.ts`
Expected: FAIL, "Cannot find module './imagensGrupo'".

- [ ] **Step 3: Implement**

```ts
// convex/lib/imagensGrupo.ts
// Pure helpers over a group's image decision (no Convex imports).
import type { Id } from "../_generated/dataModel";

export type DecisaoImagens = {
  imagens: Array<Id<"_storage">>;
  porRef?: Array<{ ref: string; imagens: Array<Id<"_storage">> }>;
};

/** The list a given SKU receives: its override, else the group list. */
export function listaParaRef(
  d: DecisaoImagens,
  ref: string,
): Array<Id<"_storage">> {
  return d.porRef?.find((p) => p.ref === ref)?.imagens ?? d.imagens;
}

/** Every file the decision keeps (group list plus all overrides). */
export function ficheirosEscolhidos(
  d: DecisaoImagens | null,
): Set<Id<"_storage">> {
  const out = new Set<Id<"_storage">>();
  if (!d) return out;
  for (const f of d.imagens) out.add(f);
  for (const p of d.porRef ?? []) for (const f of p.imagens) out.add(f);
  return out;
}

/** Candidates whose file is not in the kept set. */
export function candidatasARemover<T extends { ficheiro: Id<"_storage"> }>(
  candidatas: ReadonlyArray<T>,
  mantidos: ReadonlySet<Id<"_storage">>,
): Array<T> {
  return candidatas.filter((c) => !mantidos.has(c.ficheiro));
}

/** Error message when a porRef entry names a ref outside the group or twice. */
export function validarPorRef(
  porRef: ReadonlyArray<{ ref: string }>,
  refsDoGrupo: ReadonlySet<string>,
): string | null {
  const vistas = new Set<string>();
  for (const { ref } of porRef) {
    if (!refsDoGrupo.has(ref)) return `porRef: ref "${ref}" não pertence ao grupo.`;
    if (vistas.has(ref)) return `porRef: ref "${ref}" repetida.`;
    vistas.add(ref);
  }
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run convex/lib/imagensGrupo.test.ts` → 4 passed.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/imagensGrupo.ts convex/lib/imagensGrupo.test.ts
git commit -m "imagensGrupo helpers: list per ref, chosen files, candidates to remove"
```

---

### Task 3: Secret-guarded candidate registration and brand cleanup

**Files:**
- Modify: `convex/imagens.ts` (append)
- Test: `convex/imagens.test.ts` (create)

**Interfaces:**
- Consumes: `conferirSegredo` (`convex/lib/importSecret.ts`), `fonteCandidataValidator` (Task 1), `ficheirosEscolhidos` (Task 2).
- Produces:
  - `imagens.registarCandidatas({ secret, candidatas: Array<{ marca, grupoModelo, ficheiro, fonte, origemUrl?, hash, largura, altura, cor?, origemHash? }> }) → { criadas: number, repetidas: number }`
  - `imagens.limparCandidatas({ secret, marca, fonte? }) → { removidas: number }`
  - internal helper `candidataPorHash(ctx, hash)`.

- [ ] **Step 1: Write the failing tests**

```ts
// convex/imagens.test.ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run convex/imagens.test.ts`
Expected: FAIL, `api.imagens.registarCandidatas` undefined.

- [ ] **Step 3: Implement**

Append to `convex/imagens.ts` (add the imports at the top: `import { conferirSegredo } from "./lib/importSecret";`, `import { fonteCandidataValidator, porRefValidator } from "./schema";`, `import { ficheirosEscolhidos } from "./lib/imagensGrupo";`):

```ts
// --- Candidatas (secret-guarded, filled by scripts/imagens/candidatas.mjs) --

const candidataEntradaValidator = v.object({
  marca: v.string(),
  grupoModelo: v.string(),
  ficheiro: v.id("_storage"),
  fonte: fonteCandidataValidator,
  origemUrl: v.optional(v.string()),
  hash: v.string(),
  largura: v.number(),
  altura: v.number(),
  cor: v.optional(v.string()),
  // For "recorte" rows uploaded by the script: hash of the source candidate.
  origemHash: v.optional(v.string()),
});

async function candidataPorHash(ctx: MutationCtx, hash: string) {
  return await ctx.db
    .query("imagensCandidatas")
    .withIndex("by_hash", (q) => q.eq("hash", hash))
    .first();
}

/**
 * Upsert candidate photos by hash. A hash already known keeps its original
 * file (the new upload is deleted) and only refreshes origemUrl/cor. Batches
 * of ≤ 50 from the upload script.
 */
export const registarCandidatas = mutation({
  args: { secret: v.string(), candidatas: v.array(candidataEntradaValidator) },
  returns: v.object({ criadas: v.number(), repetidas: v.number() }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    let criadas = 0;
    let repetidas = 0;
    const agora = Date.now();
    for (const c of args.candidatas) {
      if (c.largura <= 0 || c.altura <= 0) {
        throw new Error(`candidata ${c.hash}: dimensões inválidas.`);
      }
      if ((await ctx.db.system.get(c.ficheiro)) === null) {
        throw new Error(`candidata ${c.hash}: ficheiro ${c.ficheiro} não existe.`);
      }
      const existente = await candidataPorHash(ctx, c.hash);
      if (existente) {
        repetidas++;
        const patch: { origemUrl?: string; cor?: string } = {};
        if (c.origemUrl !== undefined) patch.origemUrl = c.origemUrl;
        if (c.cor !== undefined) patch.cor = c.cor;
        if (Object.keys(patch).length > 0) await ctx.db.patch(existente._id, patch);
        if (existente.ficheiro !== c.ficheiro) await ctx.storage.delete(c.ficheiro);
        continue;
      }
      const origem =
        c.origemHash !== undefined
          ? ((await candidataPorHash(ctx, c.origemHash))?._id ?? undefined)
          : undefined;
      await ctx.db.insert("imagensCandidatas", {
        marca: c.marca,
        grupoModelo: c.grupoModelo,
        ficheiro: c.ficheiro,
        fonte: c.fonte,
        origemUrl: c.origemUrl,
        hash: c.hash,
        largura: c.largura,
        altura: c.altura,
        cor: c.cor,
        origem,
        criadoEm: agora,
      });
      criadas++;
    }
    return { criadas, repetidas };
  },
});

/** Files any decision or any live product still references. */
async function ficheirosEmUso(ctx: MutationCtx, marca: string): Promise<Set<Id<"_storage">>> {
  const emUso = new Set<Id<"_storage">>();
  const decisoes = await ctx.db
    .query("imagensGrupo")
    .withIndex("by_marca", (q) => q.eq("marca", marca))
    .collect();
  for (const d of decisoes) for (const f of ficheirosEscolhidos(d)) emUso.add(f);
  const produtos = await ctx.db
    .query("produtos")
    .withIndex("by_marca", (q) => q.eq("marca", marca))
    .collect();
  for (const p of produtos) for (const f of p.imagens) emUso.add(f);
  return emUso;
}

/** Delete a brand's candidates (rows + files) except chosen or live ones. */
export const limparCandidatas = mutation({
  args: { secret: v.string(), marca: v.string(), fonte: v.optional(fonteCandidataValidator) },
  returns: v.object({ removidas: v.number() }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    const emUso = await ficheirosEmUso(ctx, args.marca);
    const candidatas = await ctx.db
      .query("imagensCandidatas")
      .withIndex("by_marca", (q) => q.eq("marca", args.marca))
      .collect();
    let removidas = 0;
    for (const c of candidatas) {
      if (args.fonte !== undefined && c.fonte !== args.fonte) continue;
      if (emUso.has(c.ficheiro)) continue;
      await ctx.storage.delete(c.ficheiro);
      await ctx.db.delete(c._id);
      removidas++;
    }
    return { removidas };
  },
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run convex/imagens.test.ts` → 4 passed. Run `npx vitest run` → all pass.

- [ ] **Step 5: Commit**

```bash
git add convex/imagens.ts convex/imagens.test.ts
git commit -m "imagens: registarCandidatas (upsert by hash) and limparCandidatas"
```

---

### Task 4: Staff functions for the review panel

**Files:**
- Modify: `convex/imagens.ts` (append; also `definirImagensProduto` orphan rule and `definirImagens`)
- Test: `convex/imagens.test.ts` (append)

**Interfaces:**
- Consumes: Task 2 helpers; `requireStaff`.
- Produces:
  - `imagens.obterGrupoImagens({ grupoModelo }) → { candidatas: Array<{ _id, ficheiro, url: string | null, fonte, origemUrl?, cor?, origem?, recorteId?, largura, altura }>, escolhidas: { imagens: Array<{ ficheiro, url }>, porRef: Array<{ ref, imagens: Array<{ ficheiro, url }> }> } | null, atuais: Array<{ ref, imagens: Array<{ ficheiro, url }> }> }`
  - `imagens.definirImagensGrupo({ grupoModelo, marca, imagens, porRef?, refsDoGrupo }) → null`
  - `imagens.adicionarCandidata({ marca, grupoModelo, ficheiro, fonte: "upload" | "recorte", origem?, largura, altura, hash }) → { candidataId }`
  - `imagens.removerCandidata({ candidataId }) → null`
  - `definirImagensProduto` never deletes a file referenced by `imagensCandidatas` or `imagensGrupo`.

`refsDoGrupo` is passed by the panel (it already has the staged SKUs) so the mutation can validate `porRef` without knowing which run it belongs to.

- [ ] **Step 1: Write the failing tests**

Append to `convex/imagens.test.ts`:

```ts
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
    await expect(staff.mutation(api.imagens.definirImagensGrupo, {
      grupoModelo: "g", marca: "hisense", imagens: ["kg000000000000000000000000000000" as Id<"_storage">], refsDoGrupo: [],
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

  it("staff functions reject non-staff", async () => {
    const tt = t();
    await expect(tt.query(api.imagens.obterGrupoImagens, { grupoModelo: "g" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run convex/imagens.test.ts` → the new tests fail on missing functions.

- [ ] **Step 3: Implement**

In `definirImagensProduto`, replace the orphan block's "referenciados" construction so candidate and decision files are protected:

```ts
  if (candidatos.size > 0) {
    const referenciados = new Set<Id<"_storage">>();
    const todos = await ctx.db.query("produtos").collect();
    for (const p of todos) for (const ficheiro of p.imagens) referenciados.add(ficheiro);
    // Files still held as candidates or by a group decision are not orphans.
    for (const ficheiro of candidatos) {
      if (referenciados.has(ficheiro)) continue;
      const candidata = await ctx.db
        .query("imagensCandidatas")
        .withIndex("by_grupo", (q) => q.eq("grupoModelo", produto.grupoModelo))
        .collect();
      if (candidata.some((c) => c.ficheiro === ficheiro)) referenciados.add(ficheiro);
    }
    const decisao = await ctx.db
      .query("imagensGrupo")
      .withIndex("by_grupo", (q) => q.eq("grupoModelo", produto.grupoModelo))
      .unique();
    for (const f of ficheirosEscolhidos(decisao)) referenciados.add(f);
    for (const ficheiro of candidatos) {
      if (referenciados.has(ficheiro)) continue;
      await ctx.storage.delete(ficheiro);
      ficheirosRemovidos++;
    }
  }
```

(Move the `by_grupo` candidate query out of the loop: collect once before the `for`.)

In `definirImagens` (staff mutation) after `const r = await definirImagensProduto(ctx, args)`, write the decision when fanning out:

```ts
    if (args.aplicarAoGrupo === true) {
      const produto = await ctx.db
        .query("produtos")
        .withIndex("by_ref", (q) => q.eq("ref", args.ref))
        .unique();
      if (produto) {
        await gravarDecisao(ctx, {
          grupoModelo: produto.grupoModelo, marca: produto.marca,
          imagens: args.imagens, porRef: undefined, por: identity.subject,
        });
      }
    }
    return r;
```

(`const identity = await requireStaff(ctx);` at the top of the handler.)

Append the shared writer and the staff functions:

```ts
// --- Decisão por grupo (staff, página de revisão) ---------------------------

async function gravarDecisao(
  ctx: MutationCtx,
  d: {
    grupoModelo: string;
    marca: string;
    imagens: Array<Id<"_storage">>;
    porRef: Array<{ ref: string; imagens: Array<Id<"_storage">> }> | undefined;
    por: string;
  },
): Promise<void> {
  const imagens = [...new Set(d.imagens)];
  const porRef = d.porRef?.map((p) => ({ ref: p.ref, imagens: [...new Set(p.imagens)] }));
  for (const f of [...imagens, ...(porRef ?? []).flatMap((p) => p.imagens)]) {
    if ((await ctx.db.system.get(f)) === null) {
      throw new Error(`Ficheiro ${f} não existe no storage.`);
    }
  }
  const atual = await ctx.db
    .query("imagensGrupo")
    .withIndex("by_grupo", (q) => q.eq("grupoModelo", d.grupoModelo))
    .unique();
  const doc = {
    grupoModelo: d.grupoModelo, marca: d.marca, imagens,
    porRef: porRef && porRef.length > 0 ? porRef : undefined,
    atualizadoEm: Date.now(), atualizadoPor: d.por,
  };
  if (atual) await ctx.db.replace(atual._id, doc);
  else await ctx.db.insert("imagensGrupo", doc);
}

const imagemUrlValidator = v.object({ ficheiro: v.id("_storage"), url: v.union(v.string(), v.null()) });

async function comUrls(ctx: QueryCtx, ficheiros: ReadonlyArray<Id<"_storage">>) {
  return await Promise.all(
    ficheiros.map(async (ficheiro) => ({ ficheiro, url: await ctx.storage.getUrl(ficheiro) })),
  );
}

export const obterGrupoImagens = query({
  args: { grupoModelo: v.string() },
  returns: v.object({
    candidatas: v.array(
      v.object({
        _id: v.id("imagensCandidatas"),
        ficheiro: v.id("_storage"),
        url: v.union(v.string(), v.null()),
        fonte: fonteCandidataValidator,
        origemUrl: v.optional(v.string()),
        cor: v.optional(v.string()),
        origem: v.optional(v.id("imagensCandidatas")),
        recorteId: v.optional(v.id("imagensCandidatas")),
        largura: v.number(),
        altura: v.number(),
      }),
    ),
    escolhidas: v.union(
      v.null(),
      v.object({
        imagens: v.array(imagemUrlValidator),
        porRef: v.array(v.object({ ref: v.string(), imagens: v.array(imagemUrlValidator) })),
      }),
    ),
    atuais: v.array(v.object({ ref: v.string(), imagens: v.array(imagemUrlValidator) })),
  }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const rows = await ctx.db
      .query("imagensCandidatas")
      .withIndex("by_grupo", (q) => q.eq("grupoModelo", args.grupoModelo))
      .collect();
    const recortePor = new Map<Id<"imagensCandidatas">, Id<"imagensCandidatas">>();
    for (const r of rows) if (r.origem !== undefined) recortePor.set(r.origem, r._id);
    const candidatas = [];
    for (const r of rows) {
      candidatas.push({
        _id: r._id, ficheiro: r.ficheiro, url: await ctx.storage.getUrl(r.ficheiro),
        fonte: r.fonte, origemUrl: r.origemUrl, cor: r.cor, origem: r.origem,
        recorteId: recortePor.get(r._id), largura: r.largura, altura: r.altura,
      });
    }
    const decisao = await ctx.db
      .query("imagensGrupo")
      .withIndex("by_grupo", (q) => q.eq("grupoModelo", args.grupoModelo))
      .unique();
    const escolhidas = decisao
      ? {
          imagens: await comUrls(ctx, decisao.imagens),
          porRef: await Promise.all(
            (decisao.porRef ?? []).map(async (p) => ({ ref: p.ref, imagens: await comUrls(ctx, p.imagens) })),
          ),
        }
      : null;
    const produtos = await ctx.db
      .query("produtos")
      .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", args.grupoModelo))
      .collect();
    const atuais = [];
    for (const p of produtos) {
      if (p.imagens.length === 0) continue;
      atuais.push({ ref: p.ref, imagens: await comUrls(ctx, p.imagens) });
    }
    atuais.sort((a, b) => a.ref.localeCompare(b.ref));
    return { candidatas, escolhidas, atuais };
  },
});

export const definirImagensGrupo = mutation({
  args: {
    grupoModelo: v.string(),
    marca: v.string(),
    imagens: v.array(v.id("_storage")),
    porRef: v.optional(porRefValidator),
    refsDoGrupo: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireStaff(ctx);
    if (args.porRef) {
      const erro = validarPorRef(args.porRef, new Set(args.refsDoGrupo));
      if (erro) throw new Error(erro);
    }
    await gravarDecisao(ctx, { ...args, por: identity.subject, porRef: args.porRef });
    return null;
  },
});

export const adicionarCandidata = mutation({
  args: {
    marca: v.string(),
    grupoModelo: v.string(),
    ficheiro: v.id("_storage"),
    fonte: v.union(v.literal("upload"), v.literal("recorte")),
    origem: v.optional(v.id("imagensCandidatas")),
    largura: v.number(),
    altura: v.number(),
    hash: v.string(),
  },
  returns: v.object({ candidataId: v.id("imagensCandidatas") }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    if ((await ctx.db.system.get(args.ficheiro)) === null) {
      throw new Error(`Ficheiro ${args.ficheiro} não existe no storage.`);
    }
    const existente = await candidataPorHash(ctx, args.hash);
    if (existente) {
      if (existente.ficheiro !== args.ficheiro) await ctx.storage.delete(args.ficheiro);
      return { candidataId: existente._id };
    }
    const candidataId = await ctx.db.insert("imagensCandidatas", {
      marca: args.marca, grupoModelo: args.grupoModelo, ficheiro: args.ficheiro, fonte: args.fonte,
      hash: args.hash, largura: args.largura, altura: args.altura, origem: args.origem, criadoEm: Date.now(),
    });
    return { candidataId };
  },
});

export const removerCandidata = mutation({
  args: { candidataId: v.id("imagensCandidatas") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const c = await ctx.db.get(args.candidataId);
    if (!c) return null;
    const emUso = await ficheirosEmUso(ctx, c.marca);
    if (emUso.has(c.ficheiro)) {
      throw new Error("Imagem em uso: está escolhida num grupo ou num produto.");
    }
    // A recorte of this candidate loses its link, nothing else.
    const filhos = await ctx.db
      .query("imagensCandidatas")
      .withIndex("by_grupo", (q) => q.eq("grupoModelo", c.grupoModelo))
      .collect();
    for (const f of filhos) if (f.origem === c._id) await ctx.db.patch(f._id, { origem: undefined });
    await ctx.storage.delete(c.ficheiro);
    await ctx.db.delete(c._id);
    return null;
  },
});
```

Add `import { validarPorRef } from "./lib/imagensGrupo";` and `import type { QueryCtx } from "./_generated/server";` at the top.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run convex/imagens.test.ts` → 9 passed. `npx vitest run` → all pass.

- [ ] **Step 5: Commit**

```bash
git add convex/imagens.ts convex/imagens.test.ts
git commit -m "imagens: staff functions for the review panel (obterGrupoImagens, definirImagensGrupo, candidatas)"
```

---

### Task 5: Review-page query — "sem imagens" count and filter

**Files:**
- Modify: `convex/lib/importacoes.ts` (`ResumoGrupo`, `CriteriosGrupos`, `filtrarPorCriterios`)
- Modify: `convex/importacoes.ts` (`resumoGrupoValidator`, `obter`)
- Test: `convex/lib/importacoes.test.ts` (append), `convex/importacoes.test.ts` (append)

**Interfaces:**
- Produces: `ResumoGrupo.temImagens: boolean`; `CriteriosGrupos.soSemImagens?: boolean`; `obter` returns `gruposSemImagens: number` and accepts `soSemImagens?: boolean`.

- [ ] **Step 1: Write the failing tests**

Append to `convex/lib/importacoes.test.ts`:

```ts
describe("soSemImagens", () => {
  it("keeps only groups without images", () => {
    const base = resumirGrupos([]);
    void base;
    const r = (g: string, temImagens: boolean) => ({
      grupoModelo: g, nomeGrupo: g, marca: "m", familia: "f", componente: "conjunto" as const,
      numSkus: 1, numAvisos: 0, numNovos: 1, numAlterados: 0, numIguais: 0,
      revisto: false, precisaRevisao: false, temImagens,
    });
    expect(filtrarPorCriterios([r("a", true), r("b", false)], { soSemImagens: true }).map((x) => x.grupoModelo))
      .toEqual(["b"]);
  });
});
```

Append to `convex/importacoes.test.ts` (uses the file's `t()`, `STAFF`, `staged`, `SECRET` and the existing helper that creates a run and loads rows — `criarRunEmRevisao` or equivalent; if none exists, write one inline calling `criarImportacao`, `carregarSkus`, `concluirCarregamento`):

```ts
describe("obter: imagens", () => {
  it("counts groups without a decision or live images and filters them", async () => {
    const tt = t();
    const staff = tt.withIdentity(STAFF);
    const { importacaoId } = await tt.mutation(api.importacoes.criarImportacao, {
      secret: SECRET, marca: "hisense", ano: 2026, tabelaOrigem: "hisense-2026", ficheiro: "t.pdf",
    });
    await tt.mutation(api.importacoes.carregarSkus, {
      secret: SECRET, importacaoId,
      skus: [staged("A1", { grupoModelo: "g-a" }), staged("B1", { grupoModelo: "g-b", nomeGrupo: "B" })],
    });
    await tt.mutation(api.importacoes.concluirCarregamento, { secret: SECRET, importacaoId });
    const f = await tt.run(async (ctx) => ctx.storage.store(new Blob(["x"])));
    await tt.run(async (ctx) => {
      await ctx.db.insert("imagensGrupo", { grupoModelo: "g-a", marca: "hisense", imagens: [f], atualizadoEm: 1, atualizadoPor: "s" });
    });
    const tudo = await staff.query(api.importacoes.obter, { importacaoId, pagina: 0, porPagina: 50 });
    expect(tudo?.gruposSemImagens).toBe(1);
    expect(tudo?.grupos.find((g) => g.grupoModelo === "g-a")?.temImagens).toBe(true);
    const so = await staff.query(api.importacoes.obter, { importacaoId, pagina: 0, porPagina: 50, soSemImagens: true });
    expect(so?.grupos.map((g) => g.grupoModelo)).toEqual(["g-b"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run convex/lib/importacoes.test.ts convex/importacoes.test.ts` → type/assert failures on `temImagens` / `gruposSemImagens`.

- [ ] **Step 3: Implement**

`convex/lib/importacoes.ts`: add `temImagens: boolean;` to `ResumoGrupo`, initialise `temImagens: false` in `resumirGrupos`, add `soSemImagens?: boolean;` to `CriteriosGrupos` and in `filtrarPorCriterios`:

```ts
    if (c.soSemImagens && r.temImagens) return false;
```

`convex/importacoes.ts`: add `temImagens: v.boolean(),` to `resumoGrupoValidator`; in `obter` args add `soSemImagens: v.optional(v.boolean()),`; in `returns` add `gruposSemImagens: v.number(),`; in the handler after `const resumos = resumirGrupos(...)`:

```ts
    for (const r of resumos) {
      const decisao = await ctx.db
        .query("imagensGrupo")
        .withIndex("by_grupo", (q) => q.eq("grupoModelo", r.grupoModelo))
        .unique();
      if (decisao && ficheirosEscolhidos(decisao).size > 0) {
        r.temImagens = true;
        continue;
      }
      const vivos = await ctx.db
        .query("produtos")
        .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", r.grupoModelo))
        .collect();
      r.temImagens = vivos.some((p) => p.imagens.length > 0);
    }
    const semImagens = resumos.filter((r) => !r.temImagens).length;
```

Pass `soSemImagens: args.soSemImagens` into the `filtrarPorCriterios` call and return `gruposSemImagens: semImagens`. Import `ficheirosEscolhidos` from `./lib/imagensGrupo`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run` → all pass.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/importacoes.ts convex/lib/importacoes.test.ts convex/importacoes.ts convex/importacoes.test.ts
git commit -m "importacoes.obter: temImagens per group, gruposSemImagens count, soSemImagens filter"
```

---

### Task 6: Promotion applies decisions; scheduled cleanup of unchosen candidates

**Files:**
- Modify: `convex/importacoes.ts` (`promoverLote` loop and final pass; new `limparCandidatasDaRun`)
- Test: `convex/importacoes.test.ts` (append)

**Interfaces:**
- Consumes: `listaParaRef`, `ficheirosEscolhidos`, `candidatasARemover` (Task 2).
- Produces: `internal.importacoes.limparCandidatasDaRun({ importacaoId })`; run fields `numImagensAplicadas`, `numCandidatasRemovidas`.

- [ ] **Step 1: Write the failing tests**

Append to `convex/importacoes.test.ts` (the file already uses `vi.useFakeTimers()` + `await tt.finishAllScheduledFunctions(vi.runAllTimers)` for promotion; reuse that pattern):

```ts
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
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run convex/importacoes.test.ts` → fails on `numImagensAplicadas` / images not applied.

- [ ] **Step 3: Implement**

In `promoverLote`'s batch loop, after `const r = await upsertProdutoPorRef(...)` and the `descontinuado` check, apply the decision (patch directly; orphan handling is the cleanup step's job):

```ts
        const decisao = await ctx.db
          .query("imagensGrupo")
          .withIndex("by_grupo", (q) => q.eq("grupoModelo", linha.grupoModelo))
          .unique();
        if (decisao) {
          const lista = listaParaRef(decisao, linha.ref);
          const produto = await ctx.db.get(r.produtoId);
          const igual =
            produto !== null &&
            produto.imagens.length === lista.length &&
            produto.imagens.every((f, i) => f === lista[i]);
          if (!igual) {
            await ctx.db.patch(r.produtoId, { imagens: lista });
            aplicadas++;
          }
        }
```

Declare `let aplicadas = 0;` next to `let reativados = 0;` and add `numImagensAplicadas: (run.numImagensAplicadas ?? 0) + aplicadas,` to the batch patch. In the final pass, replace the closing patch with:

```ts
    await ctx.db.patch(run._id, {
      estado: "aprovada",
      numDescontinuados: descontinuados,
    });
    await ctx.scheduler.runAfter(0, internal.importacoes.limparCandidatasDaRun, {
      importacaoId: run._id,
    });
    return null;
```

New internal mutation after `promoverLote`:

```ts
/**
 * After approval: delete every candidate of the run's groups whose file is
 * not chosen (group list or porRef) and not on any live product of the brand.
 * Runs in its own transaction so a Daikin-sized run stays under limits.
 */
export const limparCandidatasDaRun = internalMutation({
  args: { importacaoId: v.id("importacoes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await obterRun(ctx, args.importacaoId);
    const grupos = new Set((await linhasDaRun(ctx, run._id)).map((l) => l.grupoModelo));
    const emUso = new Set<Id<"_storage">>();
    const produtos = await ctx.db
      .query("produtos")
      .withIndex("by_marca", (q) => q.eq("marca", run.marca))
      .collect();
    for (const p of produtos) for (const f of p.imagens) emUso.add(f);
    let removidas = 0;
    for (const grupoModelo of grupos) {
      const decisao = await ctx.db
        .query("imagensGrupo")
        .withIndex("by_grupo", (q) => q.eq("grupoModelo", grupoModelo))
        .unique();
      const mantidos = new Set<Id<"_storage">>([...emUso, ...ficheirosEscolhidos(decisao)]);
      const candidatas = await ctx.db
        .query("imagensCandidatas")
        .withIndex("by_grupo", (q) => q.eq("grupoModelo", grupoModelo))
        .collect();
      for (const c of candidatasARemover(candidatas, mantidos)) {
        if ((await ctx.db.system.get(c.ficheiro)) !== null) await ctx.storage.delete(c.ficheiro);
        await ctx.db.delete(c._id);
        removidas++;
      }
    }
    await ctx.db.patch(run._id, { numCandidatasRemovidas: removidas });
    return null;
  },
});
```

Imports: `import { candidatasARemover, ficheirosEscolhidos, listaParaRef } from "./lib/imagensGrupo";`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run` → all pass, including the existing promotion tests (their `finishAllScheduledFunctions` now also runs the cleanup).

- [ ] **Step 5: Commit**

```bash
git add convex/importacoes.ts convex/importacoes.test.ts
git commit -m "Promotion applies group image decisions; scheduled cleanup of unchosen candidates"
```

---

### Task 7: Script helpers — manifest, coverage report

**Files:**
- Create: `scripts/imagens/lib/candidatas.mjs`
- Test: `scripts/imagens/lib/candidatas.test.ts`
- Modify: `vitest.config.ts` (`include`)

**Interfaces:**
- Produces:
  - `lerManifesto(json: unknown, alvos: Alvos): Array<Entrada>` where `Entrada = { grupoModelo, marca, ficheiro, fonte, origemUrl?, cor? }`; throws on unknown group or fonte.
  - `cobertura(alvos: Alvos, entradas: ReadonlyArray<Entrada>): Cobertura` with `{ porGrupo: Array<{ grupoModelo, site, megaclima, pdf, upload, recorte, coresEmFalta: Array<string>, soInterior: boolean }>, semCandidatas: Array<string>, equipamentoSemSiteNemMegaclima: Array<string> }`.
  - `coberturaMarkdown(c: Cobertura): string`.
  - `type Alvos = { marca: string; grupos: Array<{ grupoModelo, nomeGrupo, refs: string[], componente, cores: string[], acessorio: boolean }> }`.

- [ ] **Step 1: Extend vitest include**

`vitest.config.ts`: `include: ["convex/**/*.test.ts", "scripts/**/*.test.ts"]`.

- [ ] **Step 2: Write the failing tests**

```ts
// scripts/imagens/lib/candidatas.test.ts
import { describe, expect, it } from "vitest";
import { cobertura, coberturaMarkdown, lerManifesto } from "./candidatas.mjs";

const alvos = {
  marca: "hisense",
  grupos: [
    { grupoModelo: "hisense-air-master", nomeGrupo: "Mural Air Master", refs: ["QK25WM0A", "QK25WM0B"],
      componente: "conjunto", cores: ["branco", "preto"], acessorio: false },
    { grupoModelo: "hisense-air-master-unidade-exterior", nomeGrupo: "Mural Air Master | UE", refs: ["AS25WM00W"],
      componente: "unidade-exterior", cores: [], acessorio: false },
    { grupoModelo: "hisense-yxe-c01u1-comando", nomeGrupo: "Comando", refs: ["YXE-C01U1"],
      componente: "comando", cores: [], acessorio: true },
  ],
};

describe("lerManifesto", () => {
  it("flattens the manifest and validates group and fonte", () => {
    const entradas = lerManifesto({
      "hisense-air-master": [{ ficheiro: "a.jpg", fonte: "site", origemUrl: "https://x", cor: "branco" }],
    }, alvos);
    expect(entradas).toEqual([{ grupoModelo: "hisense-air-master", marca: "hisense", ficheiro: "a.jpg",
      fonte: "site", origemUrl: "https://x", cor: "branco" }]);
    expect(() => lerManifesto({ "nao-existe": [] }, alvos)).toThrow(/nao-existe/);
    expect(() => lerManifesto({ "hisense-air-master": [{ ficheiro: "a", fonte: "bing" }] }, alvos)).toThrow(/fonte/);
  });
});

describe("cobertura", () => {
  it("counts by source, flags missing colours, indoor-only UE and equipment without site/megaclima", () => {
    const c = cobertura(alvos, [
      { grupoModelo: "hisense-air-master", marca: "hisense", ficheiro: "a.jpg", fonte: "site", cor: "branco" },
      { grupoModelo: "hisense-air-master-unidade-exterior", marca: "hisense", ficheiro: "ui-front.jpg", fonte: "pdf" },
    ]);
    const am = c.porGrupo.find((g) => g.grupoModelo === "hisense-air-master");
    expect(am).toMatchObject({ site: 1, pdf: 0, coresEmFalta: ["preto"] });
    const ue = c.porGrupo.find((g) => g.grupoModelo === "hisense-air-master-unidade-exterior");
    expect(ue).toMatchObject({ pdf: 1, soInterior: true });
    expect(c.semCandidatas).toEqual([]); // accessories without candidates are not listed
    expect(c.equipamentoSemSiteNemMegaclima).toEqual(["hisense-air-master-unidade-exterior"]);
    expect(coberturaMarkdown(c)).toContain("hisense-air-master-unidade-exterior");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run scripts/imagens/lib/candidatas.test.ts` → module not found.

- [ ] **Step 4: Implement**

```js
// scripts/imagens/lib/candidatas.mjs
// Pure helpers for candidatas.mjs: manifest parsing and the coverage report.
export const FONTES = ["site", "megaclima", "pdf", "upload", "recorte"]

/** manifest {grupoModelo: [{ficheiro, fonte, origemUrl?, cor?}]} → flat entries. */
export function lerManifesto(json, alvos) {
  if (!json || typeof json !== "object") throw new Error("manifesto inválido")
  const grupos = new Map(alvos.grupos.map((g) => [g.grupoModelo, g]))
  const out = []
  for (const [grupoModelo, lista] of Object.entries(json)) {
    if (!grupos.has(grupoModelo)) throw new Error(`grupo desconhecido no manifesto: ${grupoModelo}`)
    for (const e of lista) {
      if (!FONTES.includes(e.fonte)) throw new Error(`fonte inválida em ${grupoModelo}: ${e.fonte}`)
      if (!e.ficheiro) throw new Error(`entrada sem ficheiro em ${grupoModelo}`)
      const entrada = { grupoModelo, marca: alvos.marca, ficheiro: e.ficheiro, fonte: e.fonte }
      if (e.origemUrl) entrada.origemUrl = e.origemUrl
      if (e.cor) entrada.cor = e.cor
      out.push(entrada)
    }
  }
  return out
}

const INTERIOR_RX = /(?:interior|indoor|-ui|_ui|mural|wall)/i
const EXTERIOR_RX = /(?:exterior|outdoor|-ue|_ue|multisplit|condens)/i

export function cobertura(alvos, entradas) {
  const porGrupo = []
  const semCandidatas = []
  const equipamentoSemSiteNemMegaclima = []
  for (const g of alvos.grupos) {
    const minhas = entradas.filter((e) => e.grupoModelo === g.grupoModelo)
    const n = (fonte) => minhas.filter((e) => e.fonte === fonte).length
    const cores = new Set(minhas.map((e) => e.cor).filter(Boolean))
    const coresEmFalta = g.cores.filter((c) => !cores.has(c))
    const soInterior =
      g.componente === "unidade-exterior" && minhas.length > 0 &&
      minhas.every((e) => INTERIOR_RX.test(e.ficheiro) && !EXTERIOR_RX.test(e.ficheiro))
    porGrupo.push({ grupoModelo: g.grupoModelo, site: n("site"), megaclima: n("megaclima"), pdf: n("pdf"),
      upload: n("upload"), recorte: n("recorte"), coresEmFalta, soInterior })
    if (g.acessorio) continue
    if (minhas.length === 0) semCandidatas.push(g.grupoModelo)
    if (n("site") + n("megaclima") === 0) equipamentoSemSiteNemMegaclima.push(g.grupoModelo)
  }
  return { porGrupo, semCandidatas, equipamentoSemSiteNemMegaclima }
}

export function coberturaMarkdown(c) {
  const linhas = ["# Cobertura de imagens", "", "| grupo | site | megaclima | pdf | upload | recorte | cores em falta | só interior |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |"]
  for (const g of c.porGrupo) {
    linhas.push(`| ${g.grupoModelo} | ${g.site} | ${g.megaclima} | ${g.pdf} | ${g.upload} | ${g.recorte} | ${g.coresEmFalta.join(", ") || "—"} | ${g.soInterior ? "⚠" : ""} |`)
  }
  linhas.push("", `## Sem candidatas (${c.semCandidatas.length})`, ...c.semCandidatas.map((g) => `- ${g}`))
  linhas.push("", `## Equipamento sem foto do site nem Megaclima (${c.equipamentoSemSiteNemMegaclima.length})`,
    ...c.equipamentoSemSiteNemMegaclima.map((g) => `- ${g}`))
  return linhas.join("\n") + "\n"
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run scripts/imagens/lib/candidatas.test.ts` → 2 passed.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts scripts/imagens/lib/candidatas.mjs scripts/imagens/lib/candidatas.test.ts
git commit -m "scripts/imagens: manifest parsing and coverage report helpers"
```

---

### Task 8: `alvos.mjs` and `candidatas.mjs` (upload with resize, hash, batches, --dry-run, --recortar)

**Files:**
- Create: `scripts/imagens/alvos.mjs`, `scripts/imagens/candidatas.mjs`
- Modify: `package.json` scripts (`imagens:alvos`, `imagens:candidatas`)
- Test: `scripts/imagens/lib/candidatas.test.ts` (append a test for `prepararFicheiro` moved into the lib)

**Interfaces:**
- Consumes: `lerManifesto`, `cobertura`, `coberturaMarkdown` (Task 7); `importData.gerarUploadUrl`, `imagens.registarCandidatas` (Task 3); `ensureCutouts` (`lib/rembg.mjs`).
- Produces: `alvos.json` (shape `Alvos` from Task 7), `cobertura.md`; `prepararFicheiro(buffer): Promise<{ bytes: Buffer, hash: string, largura: number, altura: number, contentType: string }>` in `lib/candidatas.mjs`.

- [ ] **Step 1: Write the failing test for `prepararFicheiro`**

Append to `scripts/imagens/lib/candidatas.test.ts`:

```ts
import sharp from "sharp";
import { prepararFicheiro } from "./candidatas.mjs";

describe("prepararFicheiro", () => {
  it("resizes to 1600 px max, keeps alpha as PNG, hashes the output", async () => {
    const grande = await sharp({ create: { width: 3200, height: 1600, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    const r = await prepararFicheiro(grande);
    expect([r.largura, r.altura]).toEqual([1600, 800]);
    expect(r.contentType).toBe("image/jpeg");
    expect(r.hash).toMatch(/^[a-f0-9]{64}$/);
    const alfa = await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    expect((await prepararFicheiro(alfa)).contentType).toBe("image/png");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/imagens/lib/candidatas.test.ts` → `prepararFicheiro` is not exported.

- [ ] **Step 3: Implement the helper, then the two scripts**

Append to `scripts/imagens/lib/candidatas.mjs`:

```js
import { createHash } from "node:crypto"
import sharp from "sharp"

export const MAX_PX = 1600

/** Resize (max 1600 px), JPEG q85 or PNG when there is alpha; sha256 of the result. */
export async function prepararFicheiro(buffer) {
  const img = sharp(buffer).rotate()
  const meta = await img.metadata()
  const comAlfa = meta.hasAlpha === true
  const pipeline = img.resize({ width: MAX_PX, height: MAX_PX, fit: "inside", withoutEnlargement: true })
  const bytes = comAlfa ? await pipeline.png().toBuffer() : await pipeline.jpeg({ quality: 85 }).toBuffer()
  const out = await sharp(bytes).metadata()
  return {
    bytes, hash: createHash("sha256").update(bytes).digest("hex"),
    largura: out.width, altura: out.height, contentType: comAlfa ? "image/png" : "image/jpeg",
  }
}
```

`scripts/imagens/alvos.mjs`:

```js
// staged run JSON → product-scaffold/imagens/<marca>/alvos.json (groups to photograph).
//   node scripts/imagens/alvos.mjs product-scaffold/pdf-extract/hisense/hisense-2026-staged.json
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const staged = process.argv[2]
if (!staged) { console.error("uso: alvos.mjs <staged.json>"); process.exit(1) }
const run = JSON.parse(await readFile(staged, "utf8"))
const grupos = new Map()
for (const s of run.skus) {
  let g = grupos.get(s.grupoModelo)
  if (!g) {
    g = { grupoModelo: s.grupoModelo, nomeGrupo: s.nomeGrupo, gama: s.gama ?? null, familia: s.familia,
      tipoUnidade: s.tipoUnidade ?? null, componente: s.componente, refs: [], cores: [],
      acessorio: s.familia === "acessorios-e-controlo" || ["acessorio", "comando"].includes(s.componente) }
    grupos.set(s.grupoModelo, g)
  }
  g.refs.push(s.ref)
  const cor = s.atributos.find((a) => a.chave === "cor")?.valor
  if (cor && !g.cores.includes(cor)) g.cores.push(cor)
}
const alvos = { marca: run.marca, tabelaOrigem: run.tabelaOrigem, grupos: [...grupos.values()] }
const out = path.join(ROOT, "product-scaffold/imagens", run.marca, "alvos.json")
await mkdir(path.dirname(out), { recursive: true })
await writeFile(out, JSON.stringify(alvos, null, 2) + "\n")
console.log(`${alvos.grupos.length} grupos (${alvos.grupos.filter((g) => !g.acessorio).length} equipamento) → ${path.relative(ROOT, out)}`)
```

`scripts/imagens/candidatas.mjs`:

```js
// Upload candidate photos from a manifest to Convex (imagens.registarCandidatas).
//   node scripts/imagens/candidatas.mjs --brand hisense [--dry-run] [--recortar]
// Reads product-scaffold/imagens/<marca>/{alvos.json,candidatas.json}; writes cobertura.md.
import { ConvexHttpClient } from "convex/browser"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { api } from "../../convex/_generated/api.js"
import { cobertura, coberturaMarkdown, lerManifesto, prepararFicheiro } from "./lib/candidatas.mjs"
import { ensureCutouts, resolveRepoPath } from "./lib/rembg.mjs"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 ? process.argv[i + 1] : null }
const flag = (n) => process.argv.includes(`--${n}`)
const marca = arg("brand")
if (!marca) { console.error("uso: candidatas.mjs --brand <marca> [--dry-run] [--recortar]"); process.exit(1) }
const pasta = path.join(ROOT, "product-scaffold/imagens", marca)

async function loadEnv() {
  const txt = await readFile(path.join(ROOT, ".env"), "utf8")
  const env = {}
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

const alvos = JSON.parse(await readFile(path.join(pasta, "alvos.json"), "utf8"))
const manifesto = JSON.parse(await readFile(path.join(pasta, "candidatas.json"), "utf8"))
let entradas = lerManifesto(manifesto, alvos)

// Optional local cutouts (uvx rembg), uploaded as "recorte" linked by origemHash.
if (flag("recortar")) {
  const fontes = entradas.filter((e) => e.fonte !== "recorte").map((e) => resolveRepoPath(path.join(pasta, e.ficheiro)))
  const cortes = await ensureCutouts(fontes)
  for (const e of [...entradas]) {
    if (e.fonte === "recorte") continue
    const corte = cortes.get(resolveRepoPath(path.join(pasta, e.ficheiro)))
    if (corte) entradas.push({ ...e, ficheiro: corte, fonte: "recorte", origemDe: e.ficheiro })
  }
}

const preparadas = []
for (const e of entradas) {
  const abs = path.isAbsolute(e.ficheiro) ? e.ficheiro : path.join(pasta, e.ficheiro)
  const p = await prepararFicheiro(await readFile(abs))
  preparadas.push({ ...e, ...p })
}
const hashDe = new Map(preparadas.filter((p) => p.fonte !== "recorte").map((p) => [p.ficheiro, p.hash]))

const relatorio = cobertura(alvos, entradas)
await writeFile(path.join(pasta, "cobertura.md"), coberturaMarkdown(relatorio))
console.log(`${preparadas.length} candidatas, ${relatorio.semCandidatas.length} grupos de equipamento sem nenhuma, ` +
  `${relatorio.equipamentoSemSiteNemMegaclima.length} sem site/megaclima → cobertura.md`)
if (flag("dry-run")) process.exit(0)

const env = await loadEnv()
const url = env.VITE_CONVEX_URL || env.CONVEX_URL
const secret = env.IMPORT_SECRET
if (!url || !secret) throw new Error("VITE_CONVEX_URL/CONVEX_URL e IMPORT_SECRET em falta no .env")
const client = new ConvexHttpClient(url)

let criadas = 0, repetidas = 0
for (let i = 0; i < preparadas.length; i += 50) {
  const lote = []
  for (const p of preparadas.slice(i, i + 50)) {
    const uploadUrl = await client.mutation(api.importData.gerarUploadUrl, { secret })
    const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": p.contentType }, body: p.bytes })
    if (!res.ok) throw new Error(`upload falhou (${res.status}) para ${p.ficheiro}`)
    const { storageId } = await res.json()
    const c = { marca: p.marca, grupoModelo: p.grupoModelo, ficheiro: storageId, fonte: p.fonte, hash: p.hash,
      largura: p.largura, altura: p.altura }
    if (p.origemUrl) c.origemUrl = p.origemUrl
    if (p.cor) c.cor = p.cor
    if (p.fonte === "recorte" && p.origemDe) c.origemHash = hashDe.get(p.origemDe)
    lote.push(c)
  }
  const r = await client.mutation(api.imagens.registarCandidatas, { secret, candidatas: lote })
  criadas += r.criadas; repetidas += r.repetidas
  console.log(`  lote ${Math.floor(i / 50) + 1}: ${r.criadas} novas, ${r.repetidas} repetidas`)
}
console.log(`${criadas} candidatas novas, ${repetidas} já existiam (${marca})`)
```

`package.json` scripts: `"imagens:alvos": "node scripts/imagens/alvos.mjs"`, `"imagens:candidatas": "node scripts/imagens/candidatas.mjs"`.

Note: uploading a duplicate hash costs one upload that the server then deletes; acceptable for re-runs (the script prints "repetidas"). If the first brand run shows it matters, add a local `.candidatas-state.json` like `upload.mjs`.

- [ ] **Step 4: Run tests and a dry run**

Run: `npx vitest run scripts` → passes.
Run: `node scripts/imagens/alvos.mjs product-scaffold/pdf-extract/hisense/hisense-2026-staged.json` (if the Hisense staged JSON exists locally) → prints "208 grupos".
Create a two-entry `product-scaffold/imagens/hisense/candidatas.json` pointing at two local JPEGs and run `node scripts/imagens/candidatas.mjs --brand hisense --dry-run` → prints counts and writes `cobertura.md`.

- [ ] **Step 5: Commit**

```bash
git add scripts/imagens/alvos.mjs scripts/imagens/candidatas.mjs scripts/imagens/lib/candidatas.mjs scripts/imagens/lib/candidatas.test.ts package.json
git commit -m "scripts/imagens: alvos.mjs and candidatas.mjs (resize, hash, batched registarCandidatas, --recortar, --dry-run)"
```

---

### Task 9: Skill `catalog-brand-images` and links from the other skills

**Files:**
- Create: `.claude/skills/catalog-brand-images/SKILL.md`, `.claude/skills/catalog-brand-images/references/brands.md`
- Modify: `.claude/skills/catalog-pdf-extract/SKILL.md` (step 7), `.claude/skills/catalog-brand-import/SKILL.md` (photo section note)
- Mirror: copy the three skill trees into `.agents/skills/` (same paths)

- [ ] **Step 1: Write `SKILL.md`**

```markdown
---
name: catalog-brand-images
description: >
  Gathers candidate product photos for a staged import run: the agent browses
  the brand's official site in Playwright group by group, saves the packshots
  (per colour, indoor/outdoor apart), falls back to Megaclima and the PDF
  thumbnails, uploads everything as candidates to Convex and reports coverage.
  Use right after catalog-pdf-extract's enviar.py, or when a brand's review
  page shows groups without images.
---

# Catalog brand images (candidatas)

Cada extração acaba com este passo. O objetivo é que cada grupo em revisão
tenha candidatas de foto para o staff escolher em `/importacoes/{id}`; a
escolha e o recorte são feitos lá, não aqui.

## 1. Alvos

```bash
node scripts/imagens/alvos.mjs product-scaffold/pdf-extract/{marca}/{marca}-{ano}-staged.json
# → product-scaffold/imagens/{marca}/alvos.json
```

Lê a lista: para cada grupo tens refs, gama, tipoUnidade, componente e as
cores (`cores`). Acessórios (`acessorio: true`) só se o site tiver página
óbvia — não gastar tempo neles.

## 2. Site oficial, grupo a grupo (com juízo)

Abre o site em Playwright (`node -e` com `chromium.launch()`, ou um script
descartável em `.context/`). Usa os `scripts/imagens/crawl-*.mjs` como
ajudantes para listar páginas e extrair URLs de galerias/DAM (têm os truques
de TLS e de URL de cada marca), mas a decisão do que é um packshot é tua:

- Encontra a página da série pelo nome da gama e confirma pela ref.
- Guarda: vista de frente por cor; unidade interior e exterior em ficheiros
  separados; nada de cenas de ambiente, banners, ícones ou imagens com menos
  de 400 px no lado maior. Grupos `unidade-exterior` só levam fotos de UE.
- Ficheiros em `product-scaffold/imagens/{marca}/{grupoModelo}/NN.jpg` e
  regista o URL da página de onde veio.

## 3. Fallbacks, por esta ordem

1. Megaclima: `node scripts/imagens/crawl-megaclima-curl.mjs --brand {marca}`
   e escolher à mão o que serve.
2. Miniaturas do PDF: `python3 .claude/skills/catalog-pdf-extract/scripts/pdf_images.py <csv> --only <grupo>`
   (o CSV vem de `validar.py --csv`).

Cada uso de fallback fica listado no PR.

## 4. Manifesto e upload

`product-scaffold/imagens/{marca}/candidatas.json`:

```json
{ "hisense-air-master": [
    { "ficheiro": "hisense-air-master/01.jpg", "fonte": "site", "origemUrl": "https://hisense.pt/…", "cor": "branco" } ] }
```

```bash
node scripts/imagens/candidatas.mjs --brand {marca} --dry-run   # cobertura.md, sem rede
node scripts/imagens/candidatas.mjs --brand {marca}             # upload + registarCandidatas
node scripts/imagens/candidatas.mjs --brand {marca} --recortar  # + recortes locais (uvx rembg) como "recorte"
```

Idempotente por hash: correr outra vez só acrescenta fotos novas.

## 5. Cobertura (vai para o PR)

`cobertura.md`: contagens por fonte por grupo, grupos sem candidatas, grupos
com cores em falta, UE só com fotos de interior. Barra mínima: todos os grupos
de equipamento com pelo menos uma candidata de `site` ou `megaclima`, ou uma
razão escrita.

## Notas por marca

Ver [references/brands.md](references/brands.md).
```

`references/brands.md`: move the per-brand crawl notes from `catalog-brand-import/references/brands.md` (sites, TLS quirks, UI/UE aliases) into this file, rewritten as "where the series pages are" notes.

- [ ] **Step 2: Link from the other skills**

`catalog-pdf-extract/SKILL.md`: add a step "## 7. Imagens" after "## 6. Revisão e aprovação": "Correr a skill `catalog-brand-images` antes de entregar o link da revisão: a página mostra as candidatas por grupo e o staff escolhe lá." Update the QA list with "cobertura.md no PR".

`catalog-brand-import/SKILL.md`: at the top of "### 2) Product images" add: "**Novo fluxo (v4):** as fotos entram como candidatas com a skill `catalog-brand-images` e são escolhidas na página de revisão. O pipeline abaixo fica só para marcas já carregadas até ao #53."

- [ ] **Step 3: Mirror and commit**

```bash
rsync -a --delete .claude/skills/catalog-brand-images/ .agents/skills/catalog-brand-images/
cp .claude/skills/catalog-pdf-extract/SKILL.md .agents/skills/catalog-pdf-extract/SKILL.md
cp .claude/skills/catalog-brand-import/SKILL.md .agents/skills/catalog-brand-import/SKILL.md
git add .claude/skills .agents/skills
git commit -m "Skill catalog-brand-images: agent-driven candidate photos per staged group"
```

---

### Task 10: Admin state — image panel reducer

**Files:**
- Create: `admin-frontend/src/lib/imagens-estado.ts`
- Test: `admin-frontend/src/lib/imagens-estado.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Fonte = "site" | "megaclima" | "pdf" | "upload" | "recorte"
  export type Imagem = { ficheiro: string; url: string }
  export type Candidata = Imagem & { _id: string; fonte: Fonte; origemUrl?: string; cor?: string; origem?: string; recorteId?: string }
  export type Estado = { grupo: Array<Imagem>; porRef: Record<string, Array<Imagem>>; refAtiva: string | null; candidatas: Array<Candidata> }
  export type Acao =
    | { tipo: "iniciar"; escolhidas: { imagens: Array<Imagem>; porRef: Array<{ ref: string; imagens: Array<Imagem> }> } | null; atuais: Array<{ ref: string; imagens: Array<Imagem> }>; candidatas: Array<Candidata> }
    | { tipo: "ativar-ref"; ref: string | null }
    | { tipo: "escolher"; ficheiro: string }
    | { tipo: "remover"; ficheiro: string }
    | { tipo: "reordenar"; de: string; para: string }
    | { tipo: "capa"; ficheiro: string }
    | { tipo: "candidata-nova"; candidata: Candidata; escolher: boolean }
    | { tipo: "trocar-recorte"; ficheiro: string; recorte: Candidata }
  export function reduzir(e: Estado, a: Acao): Estado
  export function listaAtiva(e: Estado): Array<Imagem>
  export function paraGuardar(e: Estado): { imagens: Array<string>; porRef?: Array<{ ref: string; imagens: Array<string> }> }
  export const ESTADO_INICIAL: Estado
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// admin-frontend/src/lib/imagens-estado.test.ts
import { describe, expect, it } from "vitest"
import { ESTADO_INICIAL, listaAtiva, paraGuardar, reduzir } from "./imagens-estado"
import type { Candidata } from "./imagens-estado"

const c = (id: string, extra: Partial<Candidata> = {}): Candidata => ({
  _id: `id-${id}`, ficheiro: id, url: `u/${id}`, fonte: "site", ...extra,
})

function iniciado(escolhidas: Parameters<typeof reduzir>[1] extends infer A ? never : never) { void escolhidas }

describe("iniciar", () => {
  it("seeds from the decision when present", () => {
    const e = reduzir(ESTADO_INICIAL, { tipo: "iniciar", candidatas: [c("a")],
      escolhidas: { imagens: [{ ficheiro: "a", url: "u/a" }], porRef: [{ ref: "R2", imagens: [{ ficheiro: "b", url: "u/b" }] }] },
      atuais: [] })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["a"])
    expect(listaAtiva(reduzir(e, { tipo: "ativar-ref", ref: "R2" })).map((i) => i.ficheiro)).toEqual(["b"])
  })
  it("iniciar com atuais: seeds the group from the first live ref and per-ref lists that differ", () => {
    const e = reduzir(ESTADO_INICIAL, { tipo: "iniciar", candidatas: [], escolhidas: null,
      atuais: [{ ref: "R1", imagens: [{ ficheiro: "x", url: "u/x" }] }, { ref: "R2", imagens: [{ ficheiro: "y", url: "u/y" }] }] })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["x"])
    expect(e.porRef.R2?.map((i) => i.ficheiro)).toEqual(["y"])
    expect(e.porRef.R1).toBeUndefined()
  })
})

describe("escolher / remover / reordenar / capa", () => {
  const base = reduzir(ESTADO_INICIAL, { tipo: "iniciar", candidatas: [c("a"), c("b"), c("d")], escolhidas: null, atuais: [] })
  it("moves a candidate into the active list and back", () => {
    let e = reduzir(base, { tipo: "escolher", ficheiro: "a" })
    e = reduzir(e, { tipo: "escolher", ficheiro: "b" })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["a", "b"])
    expect(reduzir(e, { tipo: "escolher", ficheiro: "a" })).toBe(e) // no duplicates
    e = reduzir(e, { tipo: "remover", ficheiro: "a" })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["b"])
  })
  it("reorders and sets the cover", () => {
    let e = base
    for (const f of ["a", "b", "d"]) e = reduzir(e, { tipo: "escolher", ficheiro: f })
    e = reduzir(e, { tipo: "reordenar", de: "d", para: "a" })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["d", "a", "b"])
    e = reduzir(e, { tipo: "capa", ficheiro: "b" })
    expect(listaAtiva(e)[0]?.ficheiro).toBe("b")
  })
  it("per-ref edits start from the group list and do not touch it", () => {
    let e = reduzir(base, { tipo: "escolher", ficheiro: "a" })
    e = reduzir(e, { tipo: "ativar-ref", ref: "R2" })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["a"])
    e = reduzir(e, { tipo: "escolher", ficheiro: "b" })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["a", "b"])
    expect(e.grupo.map((i) => i.ficheiro)).toEqual(["a"])
    expect(paraGuardar(e)).toEqual({ imagens: ["a"], porRef: [{ ref: "R2", imagens: ["a", "b"] }] })
  })
})

describe("candidata-nova / trocar-recorte", () => {
  it("adds an upload and optionally chooses it; trocar-recorte mantém a posição", () => {
    let e = reduzir(ESTADO_INICIAL, { tipo: "iniciar", candidatas: [c("a"), c("b")], escolhidas: null, atuais: [] })
    e = reduzir(e, { tipo: "candidata-nova", candidata: c("up", { fonte: "upload" }), escolher: true })
    expect(e.candidatas.map((x) => x.ficheiro)).toContain("up")
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["up"])
    e = reduzir(e, { tipo: "escolher", ficheiro: "a" })
    e = reduzir(e, { tipo: "capa", ficheiro: "a" })
    const recorte = c("a-cut", { fonte: "recorte", origem: "id-a" })
    e = reduzir(e, { tipo: "trocar-recorte", ficheiro: "a", recorte })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["a-cut", "up"])
    expect(e.candidatas.find((x) => x._id === "id-a")?.recorteId).toBe("id-a-cut")
    // toggling back swaps the original into the same slot
    e = reduzir(e, { tipo: "trocar-recorte", ficheiro: "a-cut", recorte: c("a") })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["a", "up"])
  })
})
```

(Delete the unused `iniciado` helper line before running; it is there only to make the intent explicit and would fail lint.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --dir admin-frontend test -- imagens-estado` → module not found.

- [ ] **Step 3: Implement**

```ts
// admin-frontend/src/lib/imagens-estado.ts
// Pure state for the review page's image panel. The active list is the group
// list or, when a ref is selected, that ref's override (seeded from the group).
export type Fonte = "site" | "megaclima" | "pdf" | "upload" | "recorte"
export type Imagem = { ficheiro: string; url: string }
export type Candidata = Imagem & {
  _id: string
  fonte: Fonte
  origemUrl?: string
  cor?: string
  origem?: string
  recorteId?: string
}
export type Estado = {
  grupo: Array<Imagem>
  porRef: Record<string, Array<Imagem>>
  refAtiva: string | null
  candidatas: Array<Candidata>
}
export type Acao =
  | {
      tipo: "iniciar"
      escolhidas: { imagens: Array<Imagem>; porRef: Array<{ ref: string; imagens: Array<Imagem> }> } | null
      atuais: Array<{ ref: string; imagens: Array<Imagem> }>
      candidatas: Array<Candidata>
    }
  | { tipo: "ativar-ref"; ref: string | null }
  | { tipo: "escolher"; ficheiro: string }
  | { tipo: "remover"; ficheiro: string }
  | { tipo: "reordenar"; de: string; para: string }
  | { tipo: "capa"; ficheiro: string }
  | { tipo: "candidata-nova"; candidata: Candidata; escolher: boolean }
  | { tipo: "trocar-recorte"; ficheiro: string; recorte: Candidata }

export const ESTADO_INICIAL: Estado = { grupo: [], porRef: {}, refAtiva: null, candidatas: [] }

export function listaAtiva(e: Estado): Array<Imagem> {
  if (e.refAtiva !== null && e.porRef[e.refAtiva]) return e.porRef[e.refAtiva]
  return e.grupo
}

function comLista(e: Estado, lista: Array<Imagem>): Estado {
  if (e.refAtiva !== null) return { ...e, porRef: { ...e.porRef, [e.refAtiva]: lista } }
  return { ...e, grupo: lista }
}

function mover<T>(arr: Array<T>, de: number, para: number): Array<T> {
  const out = arr.slice()
  const [item] = out.splice(de, 1)
  out.splice(para, 0, item as T)
  return out
}

const iguais = (a: Array<Imagem>, b: Array<Imagem>) =>
  a.length === b.length && a.every((x, i) => x.ficheiro === b[i]?.ficheiro)

export function reduzir(e: Estado, a: Acao): Estado {
  switch (a.tipo) {
    case "iniciar": {
      if (a.escolhidas) {
        const porRef: Record<string, Array<Imagem>> = {}
        for (const p of a.escolhidas.porRef) porRef[p.ref] = p.imagens
        return { grupo: a.escolhidas.imagens, porRef, refAtiva: null, candidatas: a.candidatas }
      }
      const grupo = a.atuais[0]?.imagens ?? []
      const porRef: Record<string, Array<Imagem>> = {}
      for (const p of a.atuais) if (!iguais(p.imagens, grupo)) porRef[p.ref] = p.imagens
      return { grupo, porRef, refAtiva: null, candidatas: a.candidatas }
    }
    case "ativar-ref": {
      if (a.ref === null) return { ...e, refAtiva: null }
      const porRef = e.porRef[a.ref] ? e.porRef : { ...e.porRef, [a.ref]: e.grupo.slice() }
      return { ...e, refAtiva: a.ref, porRef }
    }
    case "escolher": {
      const lista = listaAtiva(e)
      if (lista.some((i) => i.ficheiro === a.ficheiro)) return e
      const c = e.candidatas.find((x) => x.ficheiro === a.ficheiro)
      if (!c) return e
      return comLista(e, [...lista, { ficheiro: c.ficheiro, url: c.url }])
    }
    case "remover":
      return comLista(e, listaAtiva(e).filter((i) => i.ficheiro !== a.ficheiro))
    case "reordenar": {
      const lista = listaAtiva(e)
      const de = lista.findIndex((i) => i.ficheiro === a.de)
      const para = lista.findIndex((i) => i.ficheiro === a.para)
      if (de === -1 || para === -1 || de === para) return e
      return comLista(e, mover(lista, de, para))
    }
    case "capa": {
      const lista = listaAtiva(e)
      const idx = lista.findIndex((i) => i.ficheiro === a.ficheiro)
      if (idx <= 0) return e
      return comLista(e, mover(lista, idx, 0))
    }
    case "candidata-nova": {
      const candidatas = e.candidatas.some((x) => x._id === a.candidata._id)
        ? e.candidatas
        : [...e.candidatas, a.candidata]
      const comCand = { ...e, candidatas }
      return a.escolher ? reduzir(comCand, { tipo: "escolher", ficheiro: a.candidata.ficheiro }) : comCand
    }
    case "trocar-recorte": {
      const lista = listaAtiva(e)
      const idx = lista.findIndex((i) => i.ficheiro === a.ficheiro)
      const candidatas = e.candidatas.some((x) => x._id === a.recorte._id)
        ? e.candidatas
        : [...e.candidatas, a.recorte]
      const ligadas = candidatas.map((x) =>
        a.recorte.origem !== undefined && x._id === a.recorte.origem ? { ...x, recorteId: a.recorte._id } : x,
      )
      const comCand = { ...e, candidatas: ligadas }
      if (idx === -1) return comCand
      const nova = lista.slice()
      nova[idx] = { ficheiro: a.recorte.ficheiro, url: a.recorte.url }
      return comLista(comCand, nova)
    }
  }
}

export function paraGuardar(e: Estado): { imagens: Array<string>; porRef?: Array<{ ref: string; imagens: Array<string> }> } {
  const porRef = Object.entries(e.porRef)
    .filter(([, lista]) => !iguais(lista, e.grupo))
    .map(([ref, lista]) => ({ ref, imagens: lista.map((i) => i.ficheiro) }))
  return porRef.length > 0
    ? { imagens: e.grupo.map((i) => i.ficheiro), porRef }
    : { imagens: e.grupo.map((i) => i.ficheiro) }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --dir admin-frontend test -- imagens-estado` → all pass.

- [ ] **Step 5: Commit**

```bash
git add admin-frontend/src/lib/imagens-estado.ts admin-frontend/src/lib/imagens-estado.test.ts
git commit -m "admin: image panel state reducer"
```

---

### Task 11: Shared image components; products-page manager refactored onto them

**Files:**
- Create: `admin-frontend/src/components/imagens/faixa-ordenavel.tsx`, `admin-frontend/src/components/imagens/zona-upload.tsx`, `admin-frontend/src/lib/imagens-ficheiro.ts`
- Modify: `admin-frontend/src/components/produtos/image-manager.tsx` (use the shared pieces; behaviour unchanged)
- Delete: nothing (`sortable-image.tsx` stays and is reused by the strip)

**Interfaces:**
- Produces:
  - `<FaixaOrdenavel itens={Array<Imagem>} onReordenar={(de, para) => void} onRemover={(ficheiro) => void} onCapa={(ficheiro) => void} acoesExtra?={(item) => ReactNode} vazio?={ReactNode} />` (DnD context inside; grid on desktop, horizontal scroll on phones).
  - `<ZonaUpload ocupado onFicheiros={(files: File[]) => void} rotulo="Adicionar imagens">{children}</ZonaUpload>` (drop overlay with the depth counter + file input).
  - `lib/imagens-ficheiro.ts`: `redimensionar(file: File, maxPx = 1600): Promise<Blob>` (canvas, keeps PNG when the type is png, else JPEG 0.85), `sha256(blob: Blob): Promise<string>`, `dimensoes(blob: Blob): Promise<{ largura, altura }>`, `enviarParaStorage(blob: Blob, gerarUploadUrl: () => Promise<string>): Promise<string>` (returns storageId).

- [ ] **Step 1: Extract the strip and the drop zone from `image-manager.tsx`**

`faixa-ordenavel.tsx` wraps the existing `DndContext`/`SortableContext`/`SortableImage` block (sensors: `PointerSensor` distance 5 plus `TouchSensor` with `activationConstraint: { delay: 250, tolerance: 5 }`, `KeyboardSensor`); `SortableImage` gains an optional `acoes?: React.ReactNode` slot rendered next to "Definir capa". `zona-upload.tsx` holds `handleDrop/handleDragEnter/handleDragLeave`, the overlay and the "Adicionar imagens" label with the hidden input.

`lib/imagens-ficheiro.ts`:

```ts
export async function redimensionar(file: File, maxPx = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height))
  if (escala === 1 && (file.type === "image/jpeg" || file.type === "image/png")) return file
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const png = file.type === "image/png"
  return await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas vazio"))), png ? "image/png" : "image/jpeg", 0.85),
  )
}

export async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function dimensoes(blob: Blob): Promise<{ largura: number; altura: number }> {
  const bitmap = await createImageBitmap(blob)
  return { largura: bitmap.width, altura: bitmap.height }
}

export async function enviarParaStorage(blob: Blob, gerarUploadUrl: () => Promise<string>): Promise<string> {
  const url = await gerarUploadUrl()
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": blob.type || "application/octet-stream" }, body: blob })
  if (!res.ok) throw new Error(`Upload falhou (${res.status})`)
  const { storageId } = (await res.json()) as { storageId: string }
  return storageId
}
```

- [ ] **Step 2: Rebuild `image-manager.tsx` on the shared pieces**

Keep its props and behaviour (modal, "aplicar ao grupo", `definirImagens`). Replace the inline grid with `<FaixaOrdenavel>` and the drop handling with `<ZonaUpload>`; uploads go through `redimensionar` + `enviarParaStorage(blob, () => gerarUploadUrl({}))`.

- [ ] **Step 3: Verify manually and by typecheck/lint**

Run: `pnpm --dir admin-frontend typecheck` and `pnpm --dir admin-frontend lint` → no new errors (baseline: 7 pre-existing lint errors in admin).
Open `/produtos`, open "Gerir imagens" on any product: add, reorder, set cover, remove, save; behaviour identical.

- [ ] **Step 4: Commit**

```bash
git add admin-frontend/src/components/imagens admin-frontend/src/lib/imagens-ficheiro.ts admin-frontend/src/components/produtos
git commit -m "admin: shared image strip and upload zone; products image manager uses them"
```

---

### Task 12: Review page — the Imagens panel

**Files:**
- Create: `admin-frontend/src/components/importacoes/painel-imagens.tsx`
- Modify: `admin-frontend/src/components/importacoes/grupo-card.tsx` (button + mount), `admin-frontend/src/routes/importacoes_.$importacaoId.tsx` (count + toggle)
- Modify: `admin-frontend/src/lib/labels.ts` (add `rotuloFonte`)

**Interfaces:**
- Consumes: `api.imagens.obterGrupoImagens`, `api.imagens.definirImagensGrupo`, `api.imagens.adicionarCandidata`, `api.imagens.gerarUploadUrl` (Task 4); reducer (Task 10); shared components (Task 11); `api.importacoes.obter` `gruposSemImagens`/`soSemImagens`/`temImagens` (Task 5).
- Produces: `<PainelImagens grupoModelo marca refs={Array<string>} cores={Array<string>} podeEditar onFechar />`.

- [ ] **Step 1: Labels**

`labels.ts`: `export const FONTE_LABELS: Record<Fonte, string> = { site: "Site", megaclima: "Megaclima", pdf: "PDF", upload: "Upload", recorte: "Recortes" }` and `rotuloFonte(f)`.

- [ ] **Step 2: Build the panel**

`painel-imagens.tsx` (structure; styling follows `grupo-card.tsx`):

```tsx
export function PainelImagens({ grupoModelo, marca, refs, cores, podeEditar, onFechar }: {...}) {
  const dados = useQuery(api.imagens.obterGrupoImagens, { grupoModelo })
  const gerarUploadUrl = useMutation(api.imagens.gerarUploadUrl)
  const adicionar = useMutation(api.imagens.adicionarCandidata)
  const definir = useMutation(api.imagens.definirImagensGrupo)
  const [estado, despachar] = useReducer(reduzir, ESTADO_INICIAL)
  const [aGuardar, setAGuardar] = useState(false)
  const [aEnviar, setAEnviar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [guardado, setGuardado] = useState<Estado | null>(null) // for "Anular"
  const iniciado = useRef(false)

  useEffect(() => {
    if (iniciado.current || dados === undefined) return
    despachar({ tipo: "iniciar",
      escolhidas: dados.escolhidas ? { imagens: soComUrl(dados.escolhidas.imagens), porRef: dados.escolhidas.porRef.map(...) } : null,
      atuais: dados.atuais.map((a) => ({ ref: a.ref, imagens: soComUrl(a.imagens) })),
      candidatas: dados.candidatas.filter((c) => c.url !== null).map((c) => ({ ...c, url: c.url as string })) })
    iniciado.current = true
  }, [dados])

  async function enviar(files: Array<File>) { /* redimensionar → sha256 → dimensoes → enviarParaStorage → adicionar({fonte:"upload"}) → despachar candidata-nova (escolher: true) with an object URL */ }
  async function guardar() {
    const anterior = guardado ?? estado
    setAGuardar(true); setErro(null)
    try {
      await definir({ grupoModelo, marca, ...paraGuardar(estado), refsDoGrupo: refs })
      setGuardado(anterior)
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao guardar.") } finally { setAGuardar(false) }
  }
  ...
}
```

Layout inside the group card body (below the variant table):

1. Header row: "Imagens" title, the per-variant `<select>` ("Grupo (todas as variantes)" + one option per ref), the hint chip `"{cores.length} cores, 1 lista"` when `cores.length > 1 && Object.keys(estado.porRef).length === 0`, and `onFechar`.
2. `<FaixaOrdenavel itens={listaAtiva(estado)} ...>` with `acoesExtra` rendering the "Recortar fundo" / before-after button (Task 13) and `vazio` = "Escolha candidatas abaixo ou adicione imagens."
3. Candidates by source: for each `Fonte` in `["site","megaclima","pdf","upload","recorte"]` with items, a heading `rotuloFonte` and a grid of thumbnails (3 columns on phones, 6 on desktop); each thumb shows the `cor` chip, an external-link icon to `origemUrl`, a check overlay when already in the active list, and dispatches `escolher` on click. Wrapped in `<ZonaUpload onFicheiros={enviar}>` with the "Adicionar imagens" label.
4. Footer: `guardado && <button onClick={() => { despachar({tipo:"iniciar", ...from guardado}) }}>Anular</button>` shown for 8 s after a save (a simple inline status, as the admin app has no toast component), `Cancelar` (onFechar), `Guardar` (disabled when `!podeEditar || aGuardar || aEnviar`).

`grupo-card.tsx`: in `CorpoGrupo` add `const [imagensAbertas, setImagensAbertas] = useState(false)` and a `Button variant="outline" size="sm"` labelled `Imagens` (with an `ImageIcon`) next to "Ver página"; when open, render `<PainelImagens grupoModelo={resumo.grupoModelo} marca={resumo.marca} refs={grupo.skus.map((s) => s.ref)} cores={[...new Set(grupo.skus.map((s) => valorDe(s, "cor")).filter(Boolean))]} podeEditar={podeRever} onFechar={() => setImagensAbertas(false)} />`. Show a small "Sem imagens" chip in the card header when `resumo.temImagens === false`.

Route: add `<Contagem rotulo="Sem imagens" valor={resultado.gruposSemImagens} />` to the counts row and a `<Toggle>` "Só sem imagens" bound to a new `soSemImagens` state passed to `useQuery(api.importacoes.obter, {..., soSemImagens: soSemImagens || undefined})`.

- [ ] **Step 3: Typecheck, lint, and check in the browser**

`pnpm --dir admin-frontend typecheck && pnpm --dir admin-frontend lint` → no new errors. Start the admin (`npx vite dev --port 55057 --host 127.0.0.1` inside `admin-frontend`, per the port etiquette memory) with the Convex functions pushed (`npx convex dev --once` with `CONVEX_DEPLOYMENT` exported), open the Hisense run, open a group, click "Imagens": empty strip, no candidates, upload two files, reorder, save, reload → strip persists.

- [ ] **Step 4: Commit**

```bash
git add admin-frontend/src
git commit -m "admin review page: Imagens panel per group (candidates, strip, per-variant override), sem-imagens count and filter"
```

---

### Task 13: In-browser background removal

**Files:**
- Create: `admin-frontend/src/lib/recorte.ts`
- Modify: `admin-frontend/src/components/importacoes/painel-imagens.tsx` (button + preview flow)
- Modify: `admin-frontend/package.json` (`@imgly/background-removal`)

**Interfaces:**
- Produces: `recortarFundo(url: string, onProgresso: (etapa: "modelo" | "recorte", pct: number) => void): Promise<Blob>`.

- [ ] **Step 1: Install and wrap**

`pnpm --dir admin-frontend add @imgly/background-removal`.

```ts
// admin-frontend/src/lib/recorte.ts
// Background removal in the browser. The library and its model (~40 MB,
// cached by the browser) load on first use only.
export async function recortarFundo(
  url: string,
  onProgresso: (etapa: "modelo" | "recorte", pct: number) => void,
): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal")
  const resposta = await fetch(url)
  if (!resposta.ok) throw new Error(`Não foi possível ler a imagem (${resposta.status})`)
  const origem = await resposta.blob()
  return await removeBackground(origem, {
    output: { format: "image/png", quality: 1 },
    progress: (chave, atual, total) => {
      const pct = total > 0 ? Math.round((atual / total) * 100) : 0
      onProgresso(chave.startsWith("fetch:") ? "modelo" : "recorte", pct)
    },
  })
}
```

- [ ] **Step 2: Wire the button in the panel**

In `PainelImagens`, `acoesExtra={(item) => <BotaoRecorte item={item} />}` where `BotaoRecorte`:

- Finds the candidate for `item.ficheiro`. If it has `recorteId` (or is itself a `recorte` with `origem`), renders a toggle "Ver original" / "Ver recorte" that dispatches `trocar-recorte` with the counterpart candidate.
- Otherwise renders "Recortar fundo"; on click: `setEstado("a recortar")`, call `recortarFundo(item.url, ...)`, show the resulting PNG in place (object URL) with two buttons "Usar recorte" and "Manter original". "Usar recorte": `sha256` + `dimensoes` + `enviarParaStorage(blob, () => gerarUploadUrl({}))` + `adicionar({ marca, grupoModelo, ficheiro, fonte: "recorte", origem: candidata._id, largura, altura, hash })` → dispatch `trocar-recorte` with `{ _id: candidataId, ficheiro, url: objectUrl, fonte: "recorte", origem: candidata._id }`.
- Progress text: "A descarregar o modelo… 37 %" during `modelo`, "A recortar…" during `recorte`. Errors go to the panel's `erro`.

- [ ] **Step 3: Verify in the browser**

On a group with a site candidate: click "Recortar fundo" → first run shows the model download, result appears with transparent background (checkerboard CSS behind the thumb: `bg-[linear-gradient(45deg,#eee_25%,transparent_25%),…]`), "Usar recorte" swaps it into the strip, "Ver original" toggles back. Reload: the recorte is listed under "Recortes" and linked.

- [ ] **Step 4: Commit**

```bash
git add admin-frontend/package.json admin-frontend/pnpm-lock.yaml admin-frontend/src/lib/recorte.ts admin-frontend/src/components/importacoes/painel-imagens.tsx
git commit -m "admin: in-browser background removal (@imgly/background-removal) in the Imagens panel"
```

---

### Task 14: End-to-end check on a real run, screenshots, docs

**Files:**
- Modify: `docs/superpowers/specs/2026-09-28-imagens-na-revisao-design.md` (only if the implementation deviated; note the deviation)
- Create: `docs/screenshots/imagens-revisao/` (390 and 1440 px)

- [ ] **Step 1: Seed candidates for one Hisense group and exercise the panel**

With the Hisense run in the dev deployment: write a manifest with three real packshots for `hisense-air-master` (fetched by hand from hisense.pt) and run `node scripts/imagens/candidatas.mjs --brand hisense`. In the panel: choose two, set the cover, cut one, add a per-ref override for the black variant, save.

- [ ] **Step 2: Screenshots**

Sign in as the staff test user (memory `clerk-e2e-test-user-screenshots`: admin needs the ad-hoc `/sign-in` ticket script) and capture the open panel at 390 px and 1440 px into `docs/screenshots/imagens-revisao/`. Check no horizontal overflow at 390 px.

- [ ] **Step 3: Full verification**

`npx vitest run` (root), `pnpm --dir admin-frontend test`, `pnpm --dir admin-frontend typecheck`, `pnpm --dir admin-frontend lint`, `pnpm test:pdf` → all green or only baseline errors.

- [ ] **Step 4: Commit and PR**

```bash
git add docs
git commit -m "Docs: screenshots of the Imagens panel; spec notes"
gh pr create --base main --title "Product images in the import review: candidates, selection, per-variant lists, in-browser cutouts, agent crawl skill" --body-file -
```

PR body: link the spec, paste the Hisense `cobertura.md` excerpt, the screenshots, the test counts and the baseline note.

---

## Self-review notes

- Spec coverage: data model (T1–T2), secret functions (T3), staff functions and `definirImagens` sync (T4), "sem imagens" count/filter (T5), promotion + cleanup + counters (T6), scripts and coverage (T7–T8), skill + links (T9), reducer (T10), shared components (T11), panel + route (T12), cutouts (T13), screenshots/verification (T14). Rejected runs keeping candidates needs no code: cleanup only runs from promotion.
- Deviation from the spec worth knowing: promotion patches `produtos.imagens` directly instead of calling `definirImagensProduto`, so the per-SKU orphan scan does not run 700 times in one run; the scheduled cleanup covers orphans for the brand. Task 14 records this in the spec.
- Types: `Fonte` union is spelled identically in `schema.ts` (`fonteCandidataValidator`), `lib/candidatas.mjs` (`FONTES`) and `imagens-estado.ts`; `obterGrupoImagens` field names (`candidatas`, `escolhidas`, `atuais`, `recorteId`) match the reducer's `iniciar` action.

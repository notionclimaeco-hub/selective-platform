# Import runs and staged SKUs in Convex (#40) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Convex tables, secret-guarded load mutations, staff review mutations, batched promotion and review queries that turn an extracted price table into catalog rows on approval.

**Architecture:** Two new tables (`importacoes`, `skusEmRevisao`) plus an optional PNG render on `paginasCatalogo`. Pure helpers in `convex/lib/importacoes.ts` (diff, group summaries, gate) are unit-tested; `convex/importacoes.ts` holds the functions and is integration-tested with convex-test. Promotion reuses `upsertProdutoPorRef` in scheduled batches of 100 and ends by marking absent refs of the brand `descontinuado`.

**Tech Stack:** Convex ^1.42 (TypeScript, `convex/values` validators), convex-test 0.0.54, vitest 4 with `edge-runtime`, `vi.stubEnv` / `vi.useFakeTimers`.

**Spec:** `docs/superpowers/specs/2026-09-28-import-runs-design.md`

## Global Constraints

- Every Convex function declares `args` and `returns` validators (`convex/_generated/ai/guidelines.md`).
- Field names, estado literals and error messages are Portuguese, matching the existing backend (`rascunho`, `descontinuado`, "não encontrado").
- `produtos` rows are never deleted by this feature. Only `estado` changes.
- `estado` and `imagens` on `produtos` are app-managed: promotion preserves them through `upsertProdutoPorRef`.
- Secret-guarded functions check `IMPORT_SECRET` exactly like `importData.ts` (`conferirSegredo`). Staff functions call `requireStaff(ctx)` from `convex/lib/auth.ts`.
- Run all commands from the repo root `/Users/diogoazevedo/conductor/workspaces/selective-platform/san-diego`. Tests: `pnpm vitest run <file>`. Typecheck: `client-frontend/node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` (pre-existing `process` / `vite/client` errors are not ours). Lint of `convex/` is not configured at the root; front-end lint is unaffected by this ticket.
- Commit after each task with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. Same `ref` twice inside one `carregarSkus` batch: the second copy must be rejected, not silently inserted twice. Test in Task 3.
2. `compativelCom` made only of blank strings: no `compativel-com` attribute may be added. Test in Task 2.
3. `concluirCarregamento` on a run with zero staged rows must throw, so an empty extraction can never reach review. Test in Task 3.
4. `criarImportacao` while a run of the same table is `a-promover` must throw rather than supersede a half-promoted run. Test in Task 6.
5. `obter` with `pagina` past the last page must clamp to the last page, as `produtos.listarAdmin` does. Test in Task 7.

---

### Task 1: Schema, shared validators and null-safe page readers

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/produtos.ts` (move `produtoImportFields` out; null-check `fichasCatalogoDe`)
- Modify: `convex/paginasCatalogo.ts` (`upsertPagina`, `listarPorTabela`)
- Modify: `convex/importData.ts` (`limparCatalogo`)

**Interfaces:**
- Produces from `convex/schema.ts`: `estadoImportacaoValidator`, `diffValidator`, `produtoImportFields`, `stagedSkuFields`, tables `importacoes`, `skusEmRevisao`; `paginasCatalogo.ficheiro` optional, `paginasCatalogo.imagem` optional.
- `convex/produtos.ts` keeps exporting `produtoImportFields` (re-export) and `ProdutoImport`, `upsertProdutoPorRef(ctx, args: ProdutoImport, gruposTocados?: Set<string>)`.

- [ ] **Step 1: Add validators and move `produtoImportFields` into `schema.ts`**

In `convex/schema.ts`, after the `SISTEMAS` constant and before `export default defineSchema({`, add:

```ts
// Import-run lifecycle (#40). `a-promover` is the window while promotion runs
// in scheduled batches.
export const estadoImportacaoValidator = v.union(
  v.literal("a-extrair"),
  v.literal("em-revisao"),
  v.literal("a-promover"),
  v.literal("aprovada"),
  v.literal("rejeitada"),
);

// Staged SKU against the live catalog: no live ref / live price differs /
// same price. Other field changes are visible when a group is opened.
export const diffValidator = v.union(
  v.literal("novo"),
  v.literal("alterado"),
  v.literal("igual"),
);

// Shared field validators for an imported product row (v4 JSON / v3 CSV).
// Reused by the internal upsert, the bulk importer and the staged-SKU table
// so all accept exactly the same shape. `imagens`/`estado` are app-managed
// and never imported.
export const produtoImportFields = {
  ref: v.string(),
  ean: v.optional(v.string()),
  marca: v.string(),
  nome: v.string(),
  nomeGrupo: v.string(),
  familia: v.string(),
  segmento: v.optional(segmentoValidator),
  sistema: v.optional(v.string()),
  tipoUnidade: v.optional(v.string()),
  componente: componenteValidator,
  gama: v.optional(v.string()),
  grupoModelo: v.string(),
  atributos: v.array(atributoValidator),
  descricao: v.optional(v.string()),
  pvpCents: v.number(),
  ivaIncluido: v.boolean(),
  tabelaOrigem: v.string(),
  pdfPaginas: v.array(v.number()),
};

// One staged SKU as the extractor sends it (`lib/stagedSku.ts` JSON contract).
export const stagedSkuFields = {
  ...produtoImportFields,
  compativelCom: v.optional(v.array(v.string())),
  avisos: v.array(v.string()),
};
```

In `convex/produtos.ts`, delete the `export const produtoImportFields = { ... };` block (the one starting with the comment "Shared field validators for an imported product row (v3 CSV)") and change the schema import at the top to:

```ts
import {
  estadoValidator,
  componenteValidator,
  segmentoValidator,
  atributoValidator,
  produtoImportFields,
  FAMILIAS,
  SISTEMAS,
} from "./schema";

export { produtoImportFields };
```

Keep `upsertResultValidator`, `ProdutoImport` and everything else as they are.

- [ ] **Step 2: Add the two tables and the `paginasCatalogo` fields**

In `convex/schema.ts`, replace the `paginasCatalogo` table with:

```ts
  // One-page catalog PDFs and 110 dpi PNG renders, stored once per
  // (tabelaOrigem, pagina) and shared across every product that references
  // that page. Either file may arrive first, so both are optional.
  // Uniqueness on (tabelaOrigem, pagina) is enforced in the mutation.
  paginasCatalogo: defineTable({
    tabelaOrigem: v.string(),
    pagina: v.number(),
    ficheiro: v.optional(v.id("_storage")),
    imagem: v.optional(v.id("_storage")),
  }).index("by_tabela_pagina", ["tabelaOrigem", "pagina"]),
```

Right after it, add:

```ts
  // One import run = one pass of a brand price table through extraction,
  // staging and review (#40). Counts are computed by `concluirCarregamento`;
  // the promotion counters by `promoverLote`.
  importacoes: defineTable({
    marca: v.string(),
    ano: v.number(),
    tabelaOrigem: v.string(), // "{marca}-{ano}", matches produtos.tabelaOrigem
    ficheiro: v.string(), // price-table PDF file name
    pdf: v.optional(v.id("_storage")),
    estado: estadoImportacaoValidator,
    numSkus: v.number(),
    numGrupos: v.number(),
    numNovos: v.number(),
    numAlterados: v.number(),
    numIguais: v.number(),
    numComAvisos: v.number(),
    numPromovidos: v.optional(v.number()),
    numReativados: v.optional(v.number()),
    numDescontinuados: v.optional(v.number()),
    criadoEm: v.number(),
    decididoEm: v.optional(v.number()),
    decididoPor: v.optional(v.string()),
    motivoRejeicao: v.optional(v.string()),
  })
    .index("by_tabelaOrigem", ["tabelaOrigem"])
    .index("by_estado", ["estado"]),

  // Staged SKUs of an import run. Never promoted directly: approval copies
  // them into `produtos` through the existing upsert path.
  skusEmRevisao: defineTable({
    importacaoId: v.id("importacoes"),
    ...stagedSkuFields,
    diff: diffValidator,
    // Live pvpCents whenever the ref already exists in `produtos`.
    precoAnteriorCents: v.optional(v.number()),
    // Same value on every row of a group; set by `marcarGrupoRevisto`.
    grupoRevisto: v.boolean(),
    // Set by `promoverLote`; lets promotion resume after a failed batch.
    promovido: v.boolean(),
  })
    .index("by_importacao", ["importacaoId"])
    .index("by_importacao_grupo", ["importacaoId", "grupoModelo"])
    .index("by_importacao_promovido", ["importacaoId", "promovido"]),
```

- [ ] **Step 3: Make the three `ficheiro` readers null-safe**

`convex/produtos.ts`, inside `fichasCatalogoDe`, change `if (!linha) continue;` to:

```ts
    if (!linha || linha.ficheiro === undefined) continue;
```

`convex/paginasCatalogo.ts`, in `upsertPagina`, change the `if (existente)` branch to:

```ts
  if (existente) {
    if (existente.ficheiro !== undefined && existente.ficheiro !== args.ficheiro) {
      await ctx.storage.delete(existente.ficheiro);
    }
    await ctx.db.patch(existente._id, { ficheiro: args.ficheiro });
    return { paginaId: existente._id, substituido: existente.ficheiro !== undefined };
  }
```

Same file, in `listarPorTabela`, change the mapped `url` to:

```ts
        url:
          linha.ficheiro === undefined
            ? null
            : await ctx.storage.getUrl(linha.ficheiro),
```

`convex/importData.ts`, in `limparCatalogo`, replace the `for (const pagina of paginas)` body with:

```ts
      for (const pagina of paginas) {
        if (pagina.ficheiro !== undefined) {
          await ctx.storage.delete(pagina.ficheiro);
          ficheirosPaginaApagados++;
        }
        if (pagina.imagem !== undefined) {
          await ctx.storage.delete(pagina.imagem);
          ficheirosPaginaApagados++;
        }
        await ctx.db.delete(pagina._id);
        paginasApagadas++;
      }
```

- [ ] **Step 4: Typecheck and run the existing suite**

Run: `client-frontend/node_modules/.bin/tsc --noEmit -p convex/tsconfig.json 2>&1 | grep -v "vite/client\|Cannot find name 'process'" ; pnpm vitest run`
Expected: no errors other than the pre-existing `process` / `vite/client` ones; all existing tests PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/produtos.ts convex/paginasCatalogo.ts convex/importData.ts
git commit -m "Schema: importacoes and skusEmRevisao tables, optional page render (#40)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Pure review helpers with unit tests

**Files:**
- Create: `convex/lib/importacoes.ts`
- Create: `convex/lib/importacoes.test.ts`
- Create: `convex/lib/importSecret.ts`
- Modify: `convex/importData.ts` (import `conferirSegredo` from the new module, delete the local copy)

**Interfaces:**
- Produces:
  - `classificarDiff(atual: { pvpCents: number } | null, pvpCents: number): { diff: Diff; precoAnteriorCents?: number }`
  - `dobrarCompatibilidade(atributos: ReadonlyArray<Atributo>, compativelCom: ReadonlyArray<string> | undefined): Array<Atributo>`
  - `resumirGrupos(linhas: ReadonlyArray<LinhaRevisao>): Array<ResumoGrupo>` (sorted by `nomeGrupo`, then `grupoModelo`)
  - `gruposPorRever(resumos: ReadonlyArray<ResumoGrupo>): Array<string>`
  - `filtrarGrupos(resumos, filtro: FiltroGrupos): Array<ResumoGrupo>`
  - `contarRun(linhas: ReadonlyArray<LinhaRevisao>): ContagensRun`
  - `conferirSegredo(secret: string): void` from `convex/lib/importSecret.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `convex/lib/importacoes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  classificarDiff,
  contarRun,
  dobrarCompatibilidade,
  filtrarGrupos,
  gruposPorRever,
  resumirGrupos,
  type LinhaRevisao,
} from "./importacoes";

function linha(extra: Partial<LinhaRevisao> = {}): LinhaRevisao {
  return {
    grupoModelo: "hisense-energy",
    nomeGrupo: "Mural Energy",
    marca: "hisense",
    familia: "ar-condicionado",
    componente: "conjunto",
    avisos: [],
    diff: "igual",
    grupoRevisto: false,
    ...extra,
  };
}

describe("classificarDiff", () => {
  it("is novo without a live row", () => {
    expect(classificarDiff(null, 100)).toEqual({ diff: "novo" });
  });
  it("is alterado when the live price differs and keeps the old price", () => {
    expect(classificarDiff({ pvpCents: 90 }, 100)).toEqual({
      diff: "alterado",
      precoAnteriorCents: 90,
    });
  });
  it("is igual with the same price and still records the old price", () => {
    expect(classificarDiff({ pvpCents: 100 }, 100)).toEqual({
      diff: "igual",
      precoAnteriorCents: 100,
    });
  });
});

describe("dobrarCompatibilidade", () => {
  const base = [{ chave: "frio-kw", valor: "2.5" }];
  it("appends compativel-com as a comma list", () => {
    expect(dobrarCompatibilidade(base, ["A", " B "])).toEqual([
      ...base,
      { chave: "compativel-com", valor: "A,B" },
    ]);
  });
  it("leaves atributos alone when the list is missing or empty", () => {
    expect(dobrarCompatibilidade(base, undefined)).toEqual(base);
    expect(dobrarCompatibilidade(base, [])).toEqual(base);
  });
  it("does not add the key when every entry is blank", () => {
    expect(dobrarCompatibilidade(base, ["", "  "])).toEqual(base);
  });
  it("keeps an existing compativel-com attribute", () => {
    const com = [...base, { chave: "compativel-com", valor: "X" }];
    expect(dobrarCompatibilidade(com, ["A"])).toEqual(com);
  });
});

describe("resumirGrupos", () => {
  it("summarises each group and sorts by nomeGrupo then grupoModelo", () => {
    const resumos = resumirGrupos([
      linha({ grupoModelo: "z", nomeGrupo: "Zeta", diff: "novo" }),
      linha({ diff: "alterado", avisos: ["frio-kw: em falta"] }),
      linha({ diff: "igual", grupoRevisto: true }),
      linha({ grupoModelo: "a", nomeGrupo: "Alfa", grupoRevisto: true }),
    ]);
    expect(resumos.map((r) => r.grupoModelo)).toEqual([
      "a",
      "hisense-energy",
      "z",
    ]);
    expect(resumos[1]).toEqual({
      grupoModelo: "hisense-energy",
      nomeGrupo: "Mural Energy",
      marca: "hisense",
      familia: "ar-condicionado",
      componente: "conjunto",
      numSkus: 2,
      numAvisos: 1,
      numNovos: 0,
      numAlterados: 1,
      numIguais: 1,
      revisto: false,
      precisaRevisao: true,
    });
    expect(resumos[0]?.precisaRevisao).toBe(false);
    expect(resumos[2]?.precisaRevisao).toBe(false);
  });

  it("is revisto only when every row is revisto", () => {
    const [r] = resumirGrupos([
      linha({ grupoRevisto: true }),
      linha({ grupoRevisto: false }),
    ]);
    expect(r?.revisto).toBe(false);
  });
});

describe("gruposPorRever and filtrarGrupos", () => {
  const resumos = resumirGrupos([
    linha({ grupoModelo: "limpo", nomeGrupo: "Limpo" }),
    linha({ grupoModelo: "aviso", nomeGrupo: "Aviso", avisos: ["x"] }),
    linha({ grupoModelo: "preco", nomeGrupo: "Preco", diff: "alterado" }),
    linha({ grupoModelo: "novo", nomeGrupo: "Novo", diff: "novo" }),
    linha({
      grupoModelo: "visto",
      nomeGrupo: "Visto",
      diff: "alterado",
      grupoRevisto: true,
    }),
  ]);

  it("lists only groups that need review and are not revisto", () => {
    expect(gruposPorRever(resumos)).toEqual(["aviso", "preco"]);
  });

  it("filters by the review page's tabs", () => {
    const ids = (f: Parameters<typeof filtrarGrupos>[1]) =>
      filtrarGrupos(resumos, f).map((r) => r.grupoModelo);
    expect(ids("todos")).toEqual(["aviso", "limpo", "novo", "preco", "visto"]);
    expect(ids("por-rever")).toEqual(["aviso", "preco"]);
    expect(ids("com-avisos")).toEqual(["aviso"]);
    expect(ids("alterados")).toEqual(["preco", "visto"]);
    expect(ids("novos")).toEqual(["novo"]);
  });
});

describe("contarRun", () => {
  it("counts skus, groups, diffs and rows with avisos", () => {
    expect(
      contarRun([
        linha({ diff: "novo", avisos: ["a", "b"] }),
        linha({ diff: "alterado" }),
        linha({ grupoModelo: "outro", diff: "igual", avisos: ["c"] }),
      ]),
    ).toEqual({
      numSkus: 3,
      numGrupos: 2,
      numNovos: 1,
      numAlterados: 1,
      numIguais: 1,
      numComAvisos: 2,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run convex/lib/importacoes.test.ts`
Expected: FAIL, cannot resolve `./importacoes`.

- [ ] **Step 3: Write the helpers**

Create `convex/lib/importacoes.ts`:

```ts
// Pure review logic for import runs (#40). No Convex imports so it can be
// unit-tested and reused by the admin review page for client-side grouping.

import type { Atributo } from "./specRegistry";

export type Diff = "novo" | "alterado" | "igual";

/** Staged SKU against the live catalog: price change or not. */
export function classificarDiff(
  atual: { pvpCents: number } | null,
  pvpCents: number,
): { diff: Diff; precoAnteriorCents?: number } {
  if (atual === null) return { diff: "novo" };
  return {
    diff: atual.pvpCents === pvpCents ? "igual" : "alterado",
    precoAnteriorCents: atual.pvpCents,
  };
}

export const CHAVE_COMPATIVEL = "compativel-com";

/**
 * The extractor sends `compativelCom` as an array; the catalog stores it as
 * the registry's `compativel-com` comma list. An existing attribute wins.
 */
export function dobrarCompatibilidade(
  atributos: ReadonlyArray<Atributo>,
  compativelCom: ReadonlyArray<string> | undefined,
): Array<Atributo> {
  const base = [...atributos];
  if (!compativelCom || base.some((a) => a.chave === CHAVE_COMPATIVEL)) {
    return base;
  }
  const valor = compativelCom
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .join(",");
  if (valor === "") return base;
  return [...base, { chave: CHAVE_COMPATIVEL, valor }];
}

// The fields a group summary needs; `Doc<"skusEmRevisao">` satisfies it.
export type LinhaRevisao = {
  grupoModelo: string;
  nomeGrupo: string;
  marca: string;
  familia: string;
  componente: string;
  avisos: ReadonlyArray<string>;
  diff: Diff;
  grupoRevisto: boolean;
};

export type ResumoGrupo = {
  grupoModelo: string;
  nomeGrupo: string;
  marca: string;
  familia: string;
  componente: string;
  numSkus: number;
  numAvisos: number;
  numNovos: number;
  numAlterados: number;
  numIguais: number;
  revisto: boolean;
  // A warning or a price change: the reviewer must open this group.
  precisaRevisao: boolean;
};

/** One summary per grupoModelo, sorted by nomeGrupo then grupoModelo. */
export function resumirGrupos(
  linhas: ReadonlyArray<LinhaRevisao>,
): Array<ResumoGrupo> {
  const grupos = new Map<string, ResumoGrupo>();
  for (const l of linhas) {
    let r = grupos.get(l.grupoModelo);
    if (!r) {
      r = {
        grupoModelo: l.grupoModelo,
        nomeGrupo: l.nomeGrupo,
        marca: l.marca,
        familia: l.familia,
        componente: l.componente,
        numSkus: 0,
        numAvisos: 0,
        numNovos: 0,
        numAlterados: 0,
        numIguais: 0,
        revisto: true,
        precisaRevisao: false,
      };
      grupos.set(l.grupoModelo, r);
    }
    r.numSkus++;
    r.numAvisos += l.avisos.length;
    if (l.diff === "novo") r.numNovos++;
    else if (l.diff === "alterado") r.numAlterados++;
    else r.numIguais++;
    if (!l.grupoRevisto) r.revisto = false;
    r.precisaRevisao = r.numAvisos > 0 || r.numAlterados > 0;
  }
  return [...grupos.values()].sort(
    (a, b) =>
      a.nomeGrupo.localeCompare(b.nomeGrupo) ||
      a.grupoModelo.localeCompare(b.grupoModelo),
  );
}

/** Groups that block approval. */
export function gruposPorRever(
  resumos: ReadonlyArray<ResumoGrupo>,
): Array<string> {
  return resumos
    .filter((r) => r.precisaRevisao && !r.revisto)
    .map((r) => r.grupoModelo);
}

export type FiltroGrupos =
  | "todos"
  | "por-rever"
  | "com-avisos"
  | "alterados"
  | "novos";

export function filtrarGrupos(
  resumos: ReadonlyArray<ResumoGrupo>,
  filtro: FiltroGrupos,
): Array<ResumoGrupo> {
  switch (filtro) {
    case "por-rever":
      return resumos.filter((r) => r.precisaRevisao && !r.revisto);
    case "com-avisos":
      return resumos.filter((r) => r.numAvisos > 0);
    case "alterados":
      return resumos.filter((r) => r.numAlterados > 0);
    case "novos":
      return resumos.filter((r) => r.numNovos > 0);
    case "todos":
      return [...resumos];
  }
}

export type ContagensRun = {
  numSkus: number;
  numGrupos: number;
  numNovos: number;
  numAlterados: number;
  numIguais: number;
  numComAvisos: number;
};

export function contarRun(linhas: ReadonlyArray<LinhaRevisao>): ContagensRun {
  const grupos = new Set<string>();
  const c: ContagensRun = {
    numSkus: 0,
    numGrupos: 0,
    numNovos: 0,
    numAlterados: 0,
    numIguais: 0,
    numComAvisos: 0,
  };
  for (const l of linhas) {
    grupos.add(l.grupoModelo);
    c.numSkus++;
    if (l.diff === "novo") c.numNovos++;
    else if (l.diff === "alterado") c.numAlterados++;
    else c.numIguais++;
    if (l.avisos.length > 0) c.numComAvisos++;
  }
  c.numGrupos = grupos.size;
  return c;
}
```

- [ ] **Step 4: Run the unit tests**

Run: `pnpm vitest run convex/lib/importacoes.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Move `conferirSegredo` to a shared module**

Create `convex/lib/importSecret.ts`:

```ts
// Shared secret for the trusted local import scripts (no browser, no Clerk).
// Every secret-guarded function in `importData.ts` and `importacoes.ts` calls
// this first. Set with `npx convex env set IMPORT_SECRET ...`.
export function conferirSegredo(secret: string): void {
  const esperado = process.env.IMPORT_SECRET;
  if (!esperado) {
    throw new Error(
      "IMPORT_SECRET não está configurado no deployment (npx convex env set IMPORT_SECRET ...).",
    );
  }
  if (secret !== esperado) {
    throw new Error("Segredo de importação inválido.");
  }
}
```

In `convex/importData.ts`, delete the local `function conferirSegredo(...)` and add `import { conferirSegredo } from "./lib/importSecret";` next to the other imports. Also add this comment above `export const removerAusentes`:

```ts
/**
 * @deprecated v3 full-rebuild rule. Replaced by import-run promotion (#40),
 * which marks absent refs `descontinuado` instead of deleting. Kept only for
 * the v3 `catalog-brand-import` skill until the cutover (#53) removes both.
 */
```

- [ ] **Step 6: Typecheck and run the whole suite**

Run: `client-frontend/node_modules/.bin/tsc --noEmit -p convex/tsconfig.json 2>&1 | grep -v "vite/client\|Cannot find name 'process'" ; pnpm vitest run`
Expected: no new type errors; all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add convex/lib/importacoes.ts convex/lib/importacoes.test.ts convex/lib/importSecret.ts convex/importData.ts
git commit -m "Import runs: pure review helpers and shared import secret (#40)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Load path: criarImportacao, carregarSkus, concluirCarregamento

**Files:**
- Create: `convex/importacoes.ts`
- Create: `convex/importacoes.test.ts`

**Interfaces:**
- Consumes: `stagedSkuFields`, `FAMILIAS`, `SISTEMAS` from `./schema`; `conferirSegredo`; `validarAtributos(familia, componente, atributos)` from `./lib/specRegistry`; `classificarDiff`, `dobrarCompatibilidade`, `contarRun` from `./lib/importacoes`.
- Produces public functions `api.importacoes.criarImportacao`, `api.importacoes.carregarSkus`, `api.importacoes.concluirCarregamento`, and module-private helpers `obterRun`, `exigirEstado`, `linhasDaRun` used by every later task in this file.
- Produces the test scaffolding (`t`, `SECRET`, `STAFF`, `staged`, `criarRun`, `carregar`) that Tasks 4 to 7 append their tests to.

- [ ] **Step 1: Write the failing tests with the shared scaffolding**

Create `convex/importacoes.test.ts`:

```ts
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
    componente: "conjunto" | "unidade-interior" | "unidade-exterior" | "acessorio" | "comando" | "deposito";
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
    const r = await carregar(test, id, [
      staged("A"),
      staged("B"),
      staged("C"),
    ]);
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
        atributos: [{ chave: "frio-kw", valor: "5.0" }, { chave: "misterio", valor: "1" }],
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run convex/importacoes.test.ts`
Expected: FAIL, `api.importacoes` does not exist.

- [ ] **Step 3: Write the load path**

Create `convex/importacoes.ts`:

```ts
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  FAMILIAS,
  SISTEMAS,
  atributoValidator,
  diffValidator,
  estadoImportacaoValidator,
  estadoValidator,
  stagedSkuFields,
} from "./schema";
import { requireStaff } from "./lib/auth";
import { conferirSegredo } from "./lib/importSecret";
import { validarAtributos } from "./lib/specRegistry";
import { upsertProdutoPorRef, type ProdutoImport } from "./produtos";
import { upsertPaginaImagem } from "./paginasCatalogo";
import { sincronizarGrupos } from "./lib/catalogoGrupos";
import {
  classificarDiff,
  contarRun,
  dobrarCompatibilidade,
  filtrarGrupos,
  gruposPorRever,
  resumirGrupos,
} from "./lib/importacoes";

// Import runs and staged SKUs (#40). Secret-guarded functions are what the
// extraction toolkit calls; staff functions back the admin review page.
// Promotion on approval runs in scheduled batches (`promoverLote`).

const LOTE_PROMOCAO = 100;

const FAMILIAS_SET = new Set<string>(FAMILIAS);
const SISTEMAS_SET = new Set<string>(SISTEMAS);

const stagedSkuValidator = v.object(stagedSkuFields);
type StagedSkuArgs = Infer<typeof stagedSkuValidator>;

const contagensValidator = v.object({
  numSkus: v.number(),
  numGrupos: v.number(),
  numNovos: v.number(),
  numAlterados: v.number(),
  numIguais: v.number(),
  numComAvisos: v.number(),
});

export const importacaoValidator = v.object({
  _id: v.id("importacoes"),
  _creationTime: v.number(),
  marca: v.string(),
  ano: v.number(),
  tabelaOrigem: v.string(),
  ficheiro: v.string(),
  pdf: v.optional(v.id("_storage")),
  estado: estadoImportacaoValidator,
  ...contagensValidator.fields,
  numPromovidos: v.optional(v.number()),
  numReativados: v.optional(v.number()),
  numDescontinuados: v.optional(v.number()),
  criadoEm: v.number(),
  decididoEm: v.optional(v.number()),
  decididoPor: v.optional(v.string()),
  motivoRejeicao: v.optional(v.string()),
});

export const skuEmRevisaoValidator = v.object({
  _id: v.id("skusEmRevisao"),
  _creationTime: v.number(),
  importacaoId: v.id("importacoes"),
  ...stagedSkuFields,
  diff: diffValidator,
  precoAnteriorCents: v.optional(v.number()),
  grupoRevisto: v.boolean(),
  promovido: v.boolean(),
});

// --- Shared helpers ----------------------------------------------------------

async function obterRun(
  ctx: QueryCtx | MutationCtx,
  importacaoId: Id<"importacoes">,
): Promise<Doc<"importacoes">> {
  const run = await ctx.db.get(importacaoId);
  if (!run) throw new Error("Importação não encontrada.");
  return run;
}

type EstadoImportacao = Doc<"importacoes">["estado"];

function exigirEstado(
  run: Doc<"importacoes">,
  ...estados: Array<EstadoImportacao>
): void {
  if (!estados.includes(run.estado)) {
    throw new Error(
      `Importação em estado "${run.estado}"; esperado ${estados.join(" ou ")}.`,
    );
  }
}

async function linhasDaRun(
  ctx: QueryCtx | MutationCtx,
  importacaoId: Id<"importacoes">,
): Promise<Array<Doc<"skusEmRevisao">>> {
  return await ctx.db
    .query("skusEmRevisao")
    .withIndex("by_importacao", (q) => q.eq("importacaoId", importacaoId))
    .collect();
}

/**
 * Per-SKU checks before staging. Throws on anything that would be rejected
 * by the catalog upsert or by the registry; returns the final attributes and
 * the merged warnings otherwise.
 */
function prepararSku(
  sku: StagedSkuArgs,
  run: Doc<"importacoes">,
  refsNaRun: Set<string>,
): { atributos: Array<{ chave: string; valor: string }>; avisos: Array<string> } {
  if (sku.tabelaOrigem !== run.tabelaOrigem) {
    throw new Error(
      `tabelaOrigem "${sku.tabelaOrigem}" não é a da importação (${run.tabelaOrigem}).`,
    );
  }
  if (refsNaRun.has(sku.ref)) {
    throw new Error(`ref "${sku.ref}" duplicada na importação.`);
  }
  if (!FAMILIAS_SET.has(sku.familia)) {
    throw new Error(`familia "${sku.familia}" inválida.`);
  }
  if (sku.sistema !== undefined && !SISTEMAS_SET.has(sku.sistema)) {
    throw new Error(`sistema "${sku.sistema}" inválido.`);
  }
  if (!Number.isInteger(sku.pvpCents) || sku.pvpCents < 0) {
    throw new Error("pvpCents deve ser um inteiro não negativo.");
  }
  if (sku.pdfPaginas.some((p) => !Number.isInteger(p) || p <= 0)) {
    throw new Error("pdfPaginas deve conter apenas inteiros positivos.");
  }
  const atributos = dobrarCompatibilidade(sku.atributos, sku.compativelCom);
  const { erros, avisos } = validarAtributos(
    sku.familia,
    sku.componente,
    atributos,
  );
  if (erros.length > 0) throw new Error(erros.join("; "));
  return { atributos, avisos: [...new Set([...sku.avisos, ...avisos])] };
}

// --- Load path (secret-guarded) ---------------------------------------------

/**
 * Open a run for a brand price table. An open run (`a-extrair` or
 * `em-revisao`) of the same table is superseded: its rows are deleted and it
 * is marked `rejeitada`, so a re-run of the extractor needs no cleanup. A run
 * still promoting blocks creation.
 */
export const criarImportacao = mutation({
  args: {
    secret: v.string(),
    marca: v.string(),
    ano: v.number(),
    tabelaOrigem: v.string(),
    ficheiro: v.string(),
    pdf: v.optional(v.id("_storage")),
  },
  returns: v.object({ importacaoId: v.id("importacoes") }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    const agora = Date.now();

    const anteriores = await ctx.db
      .query("importacoes")
      .withIndex("by_tabelaOrigem", (q) => q.eq("tabelaOrigem", args.tabelaOrigem))
      .collect();
    for (const anterior of anteriores) {
      if (anterior.estado === "a-promover") {
        throw new Error(
          `A importação ${anterior._id} de ${args.tabelaOrigem} ainda está a ser promovida.`,
        );
      }
      if (anterior.estado !== "a-extrair" && anterior.estado !== "em-revisao") {
        continue;
      }
      for (const linha of await linhasDaRun(ctx, anterior._id)) {
        await ctx.db.delete(linha._id);
      }
      await ctx.db.patch(anterior._id, {
        estado: "rejeitada",
        decididoEm: agora,
        motivoRejeicao: "substituída por nova extração",
      });
    }

    const importacaoId = await ctx.db.insert("importacoes", {
      marca: args.marca,
      ano: args.ano,
      tabelaOrigem: args.tabelaOrigem,
      ficheiro: args.ficheiro,
      pdf: args.pdf,
      estado: "a-extrair",
      numSkus: 0,
      numGrupos: 0,
      numNovos: 0,
      numAlterados: 0,
      numIguais: 0,
      numComAvisos: 0,
      criadoEm: agora,
    });
    return { importacaoId };
  },
});

/**
 * Append a batch of staged SKUs (the caller splits at ~100). Each SKU is
 * re-validated against the taxonomy and the spec registry and diffed against
 * the live catalog by ref. Bad rows are reported, good rows still commit.
 */
export const carregarSkus = mutation({
  args: {
    secret: v.string(),
    importacaoId: v.id("importacoes"),
    skus: v.array(stagedSkuValidator),
  },
  returns: v.object({
    carregados: v.number(),
    erros: v.array(v.object({ ref: v.string(), erro: v.string() })),
  }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    const run = await obterRun(ctx, args.importacaoId);
    exigirEstado(run, "a-extrair");

    const refsNaRun = new Set(
      (await linhasDaRun(ctx, run._id)).map((l) => l.ref),
    );
    let carregados = 0;
    const erros: Array<{ ref: string; erro: string }> = [];

    for (const sku of args.skus) {
      try {
        const { atributos, avisos } = prepararSku(sku, run, refsNaRun);
        const atual = await ctx.db
          .query("produtos")
          .withIndex("by_ref", (q) => q.eq("ref", sku.ref))
          .unique();
        const { diff, precoAnteriorCents } = classificarDiff(atual, sku.pvpCents);
        await ctx.db.insert("skusEmRevisao", {
          importacaoId: run._id,
          ...sku,
          atributos,
          avisos,
          diff,
          precoAnteriorCents,
          grupoRevisto: false,
          promovido: false,
        });
        refsNaRun.add(sku.ref);
        carregados++;
      } catch (e) {
        erros.push({
          ref: sku.ref,
          erro: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return { carregados, erros };
  },
});

/** Close the load: compute the run's counts and open it for review. */
export const concluirCarregamento = mutation({
  args: { secret: v.string(), importacaoId: v.id("importacoes") },
  returns: contagensValidator,
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    const run = await obterRun(ctx, args.importacaoId);
    exigirEstado(run, "a-extrair");
    const linhas = await linhasDaRun(ctx, run._id);
    if (linhas.length === 0) {
      throw new Error("A importação não tem SKUs carregados.");
    }
    const contagens = contarRun(linhas);
    await ctx.db.patch(run._id, { estado: "em-revisao", ...contagens });
    return contagens;
  },
});
```

The unused imports (`internalMutation`, `query`, `atributoValidator`, `estadoValidator`, `requireStaff`, `upsertProdutoPorRef`, `ProdutoImport`, `upsertPaginaImagem`, `sincronizarGrupos`, `filtrarGrupos`, `gruposPorRever`, `resumirGrupos`, `internal`, `LOTE_PROMOCAO`, `skuEmRevisaoValidator`) are consumed by Tasks 4 to 7. TypeScript does not error on unused imports in this tsconfig; leave them in place.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run convex/importacoes.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/importacoes.ts convex/importacoes.test.ts
git commit -m "Import runs: criarImportacao, carregarSkus, concluirCarregamento (#40)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Page renders: registarPaginaImagem

**Files:**
- Modify: `convex/paginasCatalogo.ts` (add `upsertPaginaImagem`)
- Modify: `convex/importacoes.ts` (add `registarPaginaImagem`)
- Modify: `convex/importacoes.test.ts` (append a describe block)

**Interfaces:**
- Produces `upsertPaginaImagem(ctx: MutationCtx, args: { tabelaOrigem: string; pagina: number; imagem: Id<"_storage"> }): Promise<{ paginaId: Id<"paginasCatalogo">; substituido: boolean }>` and `api.importacoes.registarPaginaImagem`.
- Consumes the test helpers `t`, `SECRET`, `storeBlob` from Task 3.

- [ ] **Step 1: Write the failing tests**

Append to `convex/importacoes.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run convex/importacoes.test.ts -t registarPaginaImagem`
Expected: FAIL, `registarPaginaImagem` is not a function of `api.importacoes`.

- [ ] **Step 3: Implement**

In `convex/paginasCatalogo.ts`, after `upsertPagina`, add:

```ts
/**
 * Idempotent upsert of a page's PNG render (110 dpi, for the review page).
 * Same (tabelaOrigem, pagina) slot as the one-page PDF; the previous render
 * file is deleted so re-uploads don't accumulate orphans.
 */
export async function upsertPaginaImagem(
  ctx: MutationCtx,
  args: { tabelaOrigem: string; pagina: number; imagem: Id<"_storage"> },
): Promise<{ paginaId: Id<"paginasCatalogo">; substituido: boolean }> {
  const existente = await ctx.db
    .query("paginasCatalogo")
    .withIndex("by_tabela_pagina", (q) =>
      q.eq("tabelaOrigem", args.tabelaOrigem).eq("pagina", args.pagina),
    )
    .unique();

  if (existente) {
    if (existente.imagem !== undefined && existente.imagem !== args.imagem) {
      await ctx.storage.delete(existente.imagem);
    }
    await ctx.db.patch(existente._id, { imagem: args.imagem });
    return { paginaId: existente._id, substituido: existente.imagem !== undefined };
  }

  const paginaId = await ctx.db.insert("paginasCatalogo", {
    tabelaOrigem: args.tabelaOrigem,
    pagina: args.pagina,
    imagem: args.imagem,
  });
  return { paginaId, substituido: false };
}
```

In `convex/importacoes.ts`, after `concluirCarregamento`, add:

```ts
/** Secret-guarded record of an uploaded page render (idempotent per slot). */
export const registarPaginaImagem = mutation({
  args: {
    secret: v.string(),
    tabelaOrigem: v.string(),
    pagina: v.number(),
    imagem: v.id("_storage"),
  },
  returns: v.object({
    paginaId: v.id("paginasCatalogo"),
    substituido: v.boolean(),
  }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    return await upsertPaginaImagem(ctx, {
      tabelaOrigem: args.tabelaOrigem,
      pagina: args.pagina,
      imagem: args.imagem,
    });
  },
});
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run convex/importacoes.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/paginasCatalogo.ts convex/importacoes.ts convex/importacoes.test.ts
git commit -m "Import runs: page PNG renders on paginasCatalogo (#40)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Staff review: marcarGrupoRevisto, rejeitarImportacao, approval gate

**Files:**
- Modify: `convex/importacoes.ts`
- Modify: `convex/importacoes.test.ts`

**Interfaces:**
- Produces `api.importacoes.marcarGrupoRevisto({ importacaoId, grupoModelo, revisto })`, `api.importacoes.rejeitarImportacao({ importacaoId, motivo? })`, `api.importacoes.aprovarImportacao({ importacaoId })` → `{ agendado: true }`. `aprovarImportacao` schedules `internal.importacoes.promoverLote`, which Task 6 implements; until then this task registers a stub so the reference resolves.
- Consumes `resumirGrupos`, `gruposPorRever` from `./lib/importacoes`; `requireStaff`; test helpers `t`, `STAFF`, `staged`, `seedLive`, `live`, `criarRun`, `carregar`, `linhas`, `run` from Task 3.

- [ ] **Step 1: Write the failing tests**

Append to `convex/importacoes.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run convex/importacoes.test.ts -t revisão`
Expected: FAIL, `marcarGrupoRevisto` is not a function of `api.importacoes`.

- [ ] **Step 3: Implement the staff mutations and a promotion stub**

In `convex/importacoes.ts`, after `registarPaginaImagem`, add:

```ts
// --- Review (staff) ----------------------------------------------------------

/** Flag every staged row of a group as reviewed (or not). */
export const marcarGrupoRevisto = mutation({
  args: {
    importacaoId: v.id("importacoes"),
    grupoModelo: v.string(),
    revisto: v.boolean(),
  },
  returns: v.object({ atualizados: v.number() }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const run = await obterRun(ctx, args.importacaoId);
    exigirEstado(run, "em-revisao");
    const linhas = await ctx.db
      .query("skusEmRevisao")
      .withIndex("by_importacao_grupo", (q) =>
        q.eq("importacaoId", run._id).eq("grupoModelo", args.grupoModelo),
      )
      .collect();
    if (linhas.length === 0) {
      throw new Error(`Grupo "${args.grupoModelo}" não existe nesta importação.`);
    }
    let atualizados = 0;
    for (const linha of linhas) {
      if (linha.grupoRevisto === args.revisto) continue;
      await ctx.db.patch(linha._id, { grupoRevisto: args.revisto });
      atualizados++;
    }
    return { atualizados };
  },
});

/** Close a run without promoting. Staged rows are kept for audit. */
export const rejeitarImportacao = mutation({
  args: { importacaoId: v.id("importacoes"), motivo: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireStaff(ctx);
    const run = await obterRun(ctx, args.importacaoId);
    exigirEstado(run, "a-extrair", "em-revisao");
    const motivo = args.motivo?.trim();
    await ctx.db.patch(run._id, {
      estado: "rejeitada",
      decididoEm: Date.now(),
      decididoPor: identity.subject,
      motivoRejeicao: motivo === "" ? undefined : motivo,
    });
    return null;
  },
});

/**
 * Approve a run. Gate: every group with a warning or a price change must be
 * reviewed. Promotion itself runs in scheduled batches (`promoverLote`) so a
 * Daikin-sized table stays under transaction limits; `a-promover` is the
 * visible in-between state.
 */
export const aprovarImportacao = mutation({
  args: { importacaoId: v.id("importacoes") },
  returns: v.object({ agendado: v.boolean() }),
  handler: async (ctx, args) => {
    const identity = await requireStaff(ctx);
    const run = await obterRun(ctx, args.importacaoId);
    exigirEstado(run, "em-revisao");

    const porRever = gruposPorRever(resumirGrupos(await linhasDaRun(ctx, run._id)));
    if (porRever.length > 0) {
      const lista = porRever.slice(0, 10).join(", ");
      const resto = porRever.length > 10 ? ", …" : "";
      throw new Error(
        `${porRever.length} grupo(s) com avisos ou preços alterados ainda por rever: ${lista}${resto}.`,
      );
    }

    await ctx.db.patch(run._id, {
      estado: "a-promover",
      decididoEm: Date.now(),
      decididoPor: identity.subject,
      numPromovidos: 0,
      numReativados: 0,
    });
    await ctx.scheduler.runAfter(0, internal.importacoes.promoverLote, {
      importacaoId: run._id,
    });
    return { agendado: true };
  },
});

// --- Promotion (scheduled batches) ------------------------------------------

export const promoverLote = internalMutation({
  args: { importacaoId: v.id("importacoes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await obterRun(ctx, args.importacaoId);
    exigirEstado(run, "a-promover");
    return null;
  },
});
```

The `promoverLote` body is completed in Task 6; here it only validates the estado so the scheduler reference compiles.

If `tsc` reports that `aprovarImportacao` "implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer" (the `internal.importacoes.promoverLote` self-reference), annotate the handler: `handler: async (ctx, args): Promise<{ agendado: boolean }> => {`.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run convex/importacoes.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/importacoes.ts convex/importacoes.test.ts
git commit -m "Import runs: staff review mutations and approval gate (#40)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Batched promotion and discontinuation

**Files:**
- Modify: `convex/importacoes.ts` (`promoverLote`, `camposProduto`)
- Modify: `convex/importacoes.test.ts`

**Interfaces:**
- Consumes `upsertProdutoPorRef(ctx, campos: ProdutoImport, gruposTocados)` from `./produtos`, `sincronizarGrupos` from `./lib/catalogoGrupos`, `LOTE_PROMOCAO`.
- Produces the completed `internal.importacoes.promoverLote({ importacaoId })`, safe to re-run.
- Test helpers used: `t`, `STAFF`, `staged`, `live`, `seedLive`, `criarRun`, `carregar`, `run`, `produtoPorRef`, `storeBlob` from Task 3.

- [ ] **Step 1: Write the failing tests**

Append to `convex/importacoes.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run convex/importacoes.test.ts -t promoção`
Expected: FAIL, run stays `a-promover` and refs are missing from `produtos`.

- [ ] **Step 3: Complete `promoverLote`**

In `convex/importacoes.ts`, replace the stub `promoverLote` with:

```ts
/** The 18 catalog fields of a staged row, as `upsertProdutoPorRef` wants them. */
function camposProduto(l: Doc<"skusEmRevisao">): ProdutoImport {
  return {
    ref: l.ref,
    ean: l.ean,
    marca: l.marca,
    nome: l.nome,
    nomeGrupo: l.nomeGrupo,
    familia: l.familia,
    segmento: l.segmento,
    sistema: l.sistema,
    tipoUnidade: l.tipoUnidade,
    componente: l.componente,
    gama: l.gama,
    grupoModelo: l.grupoModelo,
    atributos: l.atributos,
    descricao: l.descricao,
    pvpCents: l.pvpCents,
    ivaIncluido: l.ivaIncluido,
    tabelaOrigem: l.tabelaOrigem,
    pdfPaginas: l.pdfPaginas,
  };
}

/**
 * One promotion batch. Upserts up to LOTE_PROMOCAO unpromoted rows through
 * the catalog path (existing refs keep `imagens` and `estado`; new refs insert
 * as `rascunho`; a `descontinuado` ref that reappears is revived as
 * `rascunho`), marks them `promovido` and reschedules itself. The final pass
 * marks every live ref of the brand (by `marca` or by `tabelaOrigem`) that is
 * absent from the run `descontinuado` and closes the run as `aprovada`.
 * Rows already `promovido` are skipped, so re-running after a failed batch
 * (`npx convex run importacoes:promoverLote '{"importacaoId": "..."}'`)
 * resumes where it stopped.
 */
export const promoverLote = internalMutation({
  args: { importacaoId: v.id("importacoes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await obterRun(ctx, args.importacaoId);
    exigirEstado(run, "a-promover");
    const tocados = new Set<string>();

    const pendentes = await ctx.db
      .query("skusEmRevisao")
      .withIndex("by_importacao_promovido", (q) =>
        q.eq("importacaoId", run._id).eq("promovido", false),
      )
      .take(LOTE_PROMOCAO);

    if (pendentes.length > 0) {
      let reativados = 0;
      for (const linha of pendentes) {
        const anterior = await ctx.db
          .query("produtos")
          .withIndex("by_ref", (q) => q.eq("ref", linha.ref))
          .unique();
        const r = await upsertProdutoPorRef(ctx, camposProduto(linha), tocados);
        if (anterior?.estado === "descontinuado") {
          await ctx.db.patch(r.produtoId, { estado: "rascunho" });
          reativados++;
        }
        await ctx.db.patch(linha._id, { promovido: true });
      }
      await sincronizarGrupos(ctx, tocados);
      await ctx.db.patch(run._id, {
        numPromovidos: (run.numPromovidos ?? 0) + pendentes.length,
        numReativados: (run.numReativados ?? 0) + reativados,
      });
      await ctx.scheduler.runAfter(0, internal.importacoes.promoverLote, {
        importacaoId: run._id,
      });
      return null;
    }

    // Final pass: discontinue what the brand no longer sells. Never delete —
    // order lines reference refs.
    const refsDaRun = new Set((await linhasDaRun(ctx, run._id)).map((l) => l.ref));
    const daMarca = await ctx.db
      .query("produtos")
      .withIndex("by_marca", (q) => q.eq("marca", run.marca))
      .collect();
    const daTabela = await ctx.db
      .query("produtos")
      .withIndex("by_tabela", (q) => q.eq("tabelaOrigem", run.tabelaOrigem))
      .collect();
    const vivos = new Map<Id<"produtos">, Doc<"produtos">>();
    for (const p of [...daMarca, ...daTabela]) vivos.set(p._id, p);

    let descontinuados = 0;
    for (const p of vivos.values()) {
      if (refsDaRun.has(p.ref) || p.estado === "descontinuado") continue;
      await ctx.db.patch(p._id, { estado: "descontinuado" });
      tocados.add(p.grupoModelo);
      descontinuados++;
    }
    await sincronizarGrupos(ctx, tocados);
    await ctx.db.patch(run._id, {
      estado: "aprovada",
      numDescontinuados: descontinuados,
    });
    return null;
  },
});
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run convex/importacoes.test.ts`
Expected: PASS (19 tests). If the batching test observes `numPromovidos: 150` at the first assertion, the fake-timer advance ran both batches; change `advanceTimersByTimeAsync(0)` to `advanceTimersByTimeAsync(1)` and, if that still runs both, assert only the final state and keep the `criarRun` rejection check by calling it after `advanceTimersByTimeAsync` and before `finishAllScheduledFunctions`.

- [ ] **Step 5: Commit**

```bash
git add convex/importacoes.ts convex/importacoes.test.ts
git commit -m "Import runs: batched promotion with discontinued marking (#40)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Review queries: listar, obter, obterGrupo

**Files:**
- Modify: `convex/importacoes.ts`
- Modify: `convex/importacoes.test.ts`

**Interfaces:**
- Produces `api.importacoes.listar()`, `api.importacoes.obter({ importacaoId, pagina, porPagina, filtro? })`, `api.importacoes.obterGrupo({ importacaoId, grupoModelo })`, and the exported validators `resumoGrupoValidator`, `filtroGruposValidator` the review page (#41) will import.
- Consumes `resumirGrupos`, `gruposPorRever`, `filtrarGrupos` from `./lib/importacoes`; `importacaoValidator`, `skuEmRevisaoValidator`, `atributoValidator`, `estadoValidator`.

- [ ] **Step 1: Write the failing tests**

Append to `convex/importacoes.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run convex/importacoes.test.ts -t consultas`
Expected: FAIL, `listar` is not a function of `api.importacoes`.

- [ ] **Step 3: Implement the queries**

Append to `convex/importacoes.ts`:

```ts
// --- Queries (staff) ---------------------------------------------------------

export const resumoGrupoValidator = v.object({
  grupoModelo: v.string(),
  nomeGrupo: v.string(),
  marca: v.string(),
  familia: v.string(),
  componente: v.string(),
  numSkus: v.number(),
  numAvisos: v.number(),
  numNovos: v.number(),
  numAlterados: v.number(),
  numIguais: v.number(),
  revisto: v.boolean(),
  precisaRevisao: v.boolean(),
});

export const filtroGruposValidator = v.union(
  v.literal("todos"),
  v.literal("por-rever"),
  v.literal("com-avisos"),
  v.literal("alterados"),
  v.literal("novos"),
);

// The live `produtos` row a staged SKU would replace, reduced for the page.
const atualValidator = v.object({
  nome: v.string(),
  nomeGrupo: v.string(),
  grupoModelo: v.string(),
  pvpCents: v.number(),
  atributos: v.array(atributoValidator),
  estado: estadoValidator,
  numImagens: v.number(),
});

const paginaRevisaoValidator = v.object({
  pagina: v.number(),
  imagemUrl: v.union(v.string(), v.null()),
  pdfUrl: v.union(v.string(), v.null()),
});

/** Runs index: newest first. */
export const listar = query({
  args: {},
  returns: v.array(importacaoValidator),
  handler: async (ctx) => {
    await requireStaff(ctx);
    return await ctx.db.query("importacoes").order("desc").take(100);
  },
});

/**
 * One run with a page of group summaries. Groups are derived in memory from
 * the run's rows (runs are at most low thousands of rows), same offset
 * pagination as `produtos.listarAdmin`. `gruposPorRever` counts over the
 * whole run: zero means approval will pass the gate.
 */
export const obter = query({
  args: {
    importacaoId: v.id("importacoes"),
    pagina: v.number(),
    porPagina: v.number(),
    filtro: v.optional(filtroGruposValidator),
  },
  returns: v.union(
    v.null(),
    v.object({
      importacao: v.object({
        ...importacaoValidator.fields,
        pdfUrl: v.union(v.string(), v.null()),
      }),
      grupos: v.array(resumoGrupoValidator),
      totalGrupos: v.number(),
      numPaginas: v.number(),
      pagina: v.number(),
      gruposPorRever: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const run = await ctx.db.get(args.importacaoId);
    if (!run) return null;

    const resumos = resumirGrupos(await linhasDaRun(ctx, run._id));
    const porRever = gruposPorRever(resumos).length;
    const filtrados = filtrarGrupos(resumos, args.filtro ?? "todos");

    const porPagina = Math.max(1, Math.floor(args.porPagina));
    const numPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
    const pagina = Math.min(Math.max(0, Math.floor(args.pagina)), numPaginas - 1);
    const inicio = pagina * porPagina;

    const pdfUrl = run.pdf === undefined ? null : await ctx.storage.getUrl(run.pdf);
    return {
      importacao: { ...run, pdfUrl },
      grupos: filtrados.slice(inicio, inicio + porPagina),
      totalGrupos: filtrados.length,
      numPaginas,
      pagina,
      gruposPorRever: porRever,
    };
  },
});

/**
 * One staged group: its SKUs by price, each with the live counterpart (or
 * null), plus the PNG render and one-page PDF of every page they cite.
 */
export const obterGrupo = query({
  args: { importacaoId: v.id("importacoes"), grupoModelo: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      grupoModelo: v.string(),
      nomeGrupo: v.string(),
      revisto: v.boolean(),
      skus: v.array(
        v.object({
          ...skuEmRevisaoValidator.fields,
          atual: v.union(atualValidator, v.null()),
        }),
      ),
      paginas: v.array(paginaRevisaoValidator),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const run = await ctx.db.get(args.importacaoId);
    if (!run) return null;

    const linhas = await ctx.db
      .query("skusEmRevisao")
      .withIndex("by_importacao_grupo", (q) =>
        q.eq("importacaoId", run._id).eq("grupoModelo", args.grupoModelo),
      )
      .collect();
    const [primeira] = linhas;
    if (!primeira) return null;

    linhas.sort((a, b) => a.pvpCents - b.pvpCents || a.ref.localeCompare(b.ref));

    const skus = [];
    for (const linha of linhas) {
      const p = await ctx.db
        .query("produtos")
        .withIndex("by_ref", (q) => q.eq("ref", linha.ref))
        .unique();
      skus.push({
        ...linha,
        atual: p
          ? {
              nome: p.nome,
              nomeGrupo: p.nomeGrupo,
              grupoModelo: p.grupoModelo,
              pvpCents: p.pvpCents,
              atributos: p.atributos,
              estado: p.estado,
              numImagens: p.imagens.length,
            }
          : null,
      });
    }

    const numeros = [...new Set(linhas.flatMap((l) => l.pdfPaginas))].sort(
      (a, b) => a - b,
    );
    const paginas = [];
    for (const pagina of numeros) {
      const slot = await ctx.db
        .query("paginasCatalogo")
        .withIndex("by_tabela_pagina", (q) =>
          q.eq("tabelaOrigem", run.tabelaOrigem).eq("pagina", pagina),
        )
        .unique();
      paginas.push({
        pagina,
        imagemUrl:
          slot?.imagem === undefined ? null : await ctx.storage.getUrl(slot.imagem),
        pdfUrl:
          slot?.ficheiro === undefined ? null : await ctx.storage.getUrl(slot.ficheiro),
      });
    }

    return {
      grupoModelo: args.grupoModelo,
      nomeGrupo: primeira.nomeGrupo,
      revisto: linhas.every((l) => l.grupoRevisto),
      skus,
      paginas,
    };
  },
});
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run convex/importacoes.test.ts`
Expected: PASS (24 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/importacoes.ts convex/importacoes.test.ts
git commit -m "Import runs: staff queries for the review page (#40)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Verification and ticket notes

**Files:**
- No new files. Possibly `convex/importacoes.ts` for lint or type fixes.

- [ ] **Step 1: Full typecheck of the backend**

Run: `client-frontend/node_modules/.bin/tsc --noEmit -p convex/tsconfig.json 2>&1 | grep -v "vite/client\|Cannot find name 'process'"`
Expected: no lines. If an import in `convex/importacoes.ts` is unused after Task 7 (none should be), remove it.

- [ ] **Step 2: Front-end typecheck, since both import from `convex/`**

Run: `pnpm --dir admin-frontend typecheck 2>&1 | tail -5; pnpm --dir client-frontend typecheck 2>&1 | tail -5`
Expected: only the pre-existing `vite-plugins/mute-clerk-dev-warn.ts` error in each.

- [ ] **Step 3: Whole test suite**

Run: `pnpm vitest run`
Expected: every file PASS, including `catalogo.test.ts`, `fase1.test.ts`, `encomendas.test.ts`, `pagamentos.test.ts` (unchanged behaviour of `paginasCatalogo` and `produtos`).

- [ ] **Step 4: Front-end lint baseline unchanged**

Run: `pnpm --dir admin-frontend lint 2>&1 | grep -c "error" ; pnpm --dir client-frontend lint 2>&1 | grep -c "error"`
Expected: the same counts as before this branch (7 and 4 pre-existing per the verification baseline). No touched file is under either front end, so counts must not move.

- [ ] **Step 5: Commit any fix-ups**

```bash
git add -A convex
git commit -m "Import runs: verification fix-ups (#40)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Skip the commit when there is nothing staged.

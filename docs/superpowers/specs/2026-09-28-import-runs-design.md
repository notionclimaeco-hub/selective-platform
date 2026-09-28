# Import runs and staged SKUs in Convex (#40)

Part of map #38 (catalog reload). Vocabulary from `CONTEXT.md`, section
*Catalog import*: price table, import run, staged SKU, spec registry,
discontinued SKU.

## Goal

The Convex half of the reload pipeline: a place to stage an extracted price
table (an **import run** holding **staged SKUs**), a diff of every staged SKU
against the live catalog, a review gate, and promotion into `produtos` on
approval. The extraction toolkit (#42) pushes into it with the import secret.
The admin review page (#41) reads from it as staff.

Acceptance: a staged run can be loaded, diffed, approved and shows up in
`produtos` with `descontinuado` set on dropped refs. `pnpm typecheck`,
`vitest`, lint: no new errors.

## Data model (`convex/schema.ts`)

### `importacoes`

One row per import run (brand + year + extraction attempt).

| field | type | notes |
| --- | --- | --- |
| `marca` | string | brand slug, matches `produtos.marca` |
| `ano` | number | |
| `tabelaOrigem` | string | `{marca}-{ano}`, matches `produtos.tabelaOrigem` |
| `ficheiro` | string | price-table PDF file name |
| `pdf` | optional `_storage` id | the whole PDF, when uploaded |
| `estado` | `a-extrair` \| `em-revisao` \| `a-promover` \| `aprovada` \| `rejeitada` | |
| `numSkus`, `numGrupos`, `numNovos`, `numAlterados`, `numIguais`, `numComAvisos` | number | computed by `concluirCarregamento`; zero before |
| `numPromovidos`, `numReativados`, `numDescontinuados` | optional number | set when promotion finishes |
| `criadoEm` | number | |
| `decididoEm`, `decididoPor` | optional | staff decision (approve / reject) |
| `motivoRejeicao` | optional string | free text, or "substituída por nova extração" when superseded |

Indexes: `by_tabelaOrigem` (`tabelaOrigem`), `by_estado` (`estado`).

Estado transitions:

```
a-extrair --concluirCarregamento--> em-revisao --aprovarImportacao--> a-promover --promoverLote (last)--> aprovada
a-extrair | em-revisao --rejeitarImportacao--> rejeitada
a-extrair | em-revisao --criarImportacao(same tabelaOrigem)--> rejeitada (superseded)
```

### `skusEmRevisao`

One row per staged SKU.

- `importacaoId`: id of `importacoes`.
- The 18 import fields of `produtoImportFields` (`ref`, `ean?`, `marca`,
  `nome`, `nomeGrupo`, `familia`, `segmento?`, `sistema?`, `tipoUnidade?`,
  `componente`, `gama?`, `grupoModelo`, `atributos`, `descricao?`,
  `pvpCents`, `ivaIncluido`, `tabelaOrigem`, `pdfPaginas`).
- `compativelCom?`: array of strings, as sent by the extractor.
- `avisos`: array of strings. Extractor warnings plus registry warnings.
- `diff`: `novo` | `alterado` | `igual`.
- `precoAnteriorCents?`: live `pvpCents` whenever a live ref exists.
- `grupoRevisto`: boolean. Same value on every row of a group.
- `promovido`: boolean. Set by `promoverLote`.

Indexes: `by_importacao` (`importacaoId`), `by_importacao_ref`
(`importacaoId`, `ref`), `by_importacao_grupo` (`importacaoId`,
`grupoModelo`), `by_importacao_promovido` (`importacaoId`, `promovido`).

`estado` and `imagens` never appear on a staged SKU: they are app-managed.

### `paginasCatalogo`

Gains `imagem?: _storage id` (110 dpi PNG render). `ficheiro` becomes
optional so a PNG can be registered before its one-page PDF. Readers of
`ficheiro` (`produtos.fichasCatalogoDe`, `paginasCatalogo.listarPorTabela`,
`importData.limparCatalogo`) skip or null-check missing files; `limparCatalogo`
also deletes `imagem`.

## Shared validators (`convex/importacoes.ts`)

```ts
export const stagedSkuFields = {
  ...produtoImportFields,
  compativelCom: v.optional(v.array(v.string())),
  avisos: v.array(v.string()),
};
```

`produtoImportFields` moves from `produtos.ts` into `schema.ts` (which
already owns every validator it is built from) and `produtos.ts` re-exports
it, so the `skusEmRevisao` table and `carregarSkus` share one definition
without a circular import.

## Load path (secret-guarded, same `conferirSegredo` rule as `importData.ts`)

The secret check helper moves to `convex/lib/importSecret.ts` and is shared by
`importData.ts` and `importacoes.ts`.

- `criarImportacao({ secret, marca, ano, tabelaOrigem, ficheiro, pdf? })`
  → `{ importacaoId }`. Any run for the same `tabelaOrigem` in `a-extrair` or
  `em-revisao` is patched to `rejeitada` with `motivoRejeicao` "substituída por
  nova extração" and its staged rows are deleted. A run in `a-promover` blocks
  creation (throws) until promotion finishes.
- `gerarUploadUrl({ secret })` already exists in `importData.ts` and is reused
  for the PDF and the PNG renders.
- `carregarSkus({ secret, importacaoId, skus: stagedSkuFields[] })`
  → `{ carregados, erros: [{ ref, erro }] }`. Requires `estado: a-extrair`.
  Per SKU:
  1. `familia` in `FAMILIAS`, `sistema` in `SISTEMAS`, `pdfPaginas` positive
     integers, `pvpCents` non-negative integer, `tabelaOrigem` and `marca`
     equal to the run's. Failure → error, row skipped.
  2. `compativelCom`, when present and non-empty, is folded into `atributos`
     as `compativel-com` = items joined by `,` (only when the key is absent).
  3. `validarAtributos(familia, componente, atributos)`: `erros` → row
     rejected; `avisos` appended to the SKU's `avisos` (deduplicated).
  4. Duplicate `ref` inside the run (in-batch set plus one indexed lookup
     on `by_importacao_ref`) → error, row skipped.
  4b. `grupoModelo` already held by another brand in `produtos` → error,
     row skipped. Caught here so `upsertProdutoPorRef` cannot throw
     mid-promotion and strand the run in `a-promover`.
  5. Diff against `produtos` by `ref`: no live row → `novo`; live `pvpCents`
     differs → `alterado`; otherwise `igual`. `precoAnteriorCents` = live
     `pvpCents` when a live row exists.
  6. Insert with `grupoRevisto: false`, `promovido: false`.
  Batches are appended; the caller splits at ~100 SKUs.
- `concluirCarregamento({ secret, importacaoId })` → the counts. Requires
  `a-extrair`, at least one staged row. Computes `numSkus`, `numGrupos`
  (distinct `grupoModelo`), `numNovos`, `numAlterados`, `numIguais`,
  `numComAvisos` (rows with ≥1 aviso), sets `em-revisao`.
- `registarPaginaImagem({ secret, tabelaOrigem, pagina, imagem })`
  → `{ paginaId, substituido }`. Upserts the (tabelaOrigem, pagina) slot,
  deleting the previous `imagem` file. Implemented as `upsertPaginaImagem` in
  `paginasCatalogo.ts`, next to `upsertPagina`.

## Review path (staff, `requireStaff`)

- `marcarGrupoRevisto({ importacaoId, grupoModelo, revisto })`
  → `{ atualizados }`. Requires `em-revisao`. Patches every row of the group.
- `rejeitarImportacao({ importacaoId, motivo? })`. Requires `a-extrair` or
  `em-revisao`. Sets `rejeitada`, `decididoEm`, `decididoPor` (identity
  subject), `motivoRejeicao`. Staged rows are kept.
- `aprovarImportacao({ importacaoId })` → `{ agendado: true }`. Requires
  `em-revisao`. Gate: every group with any aviso or any `alterado` row must
  have `grupoRevisto: true`. Otherwise throws listing up to ten offending
  `grupoModelo`s. On pass: sets `a-promover`, `decididoEm`, `decididoPor`,
  and schedules `internal.importacoes.promoverLote` with `runAfter(0)`.

## Promotion (`promoverLote`, internal mutation, batched)

Each invocation, for the run in `a-promover`:

1. Take up to 100 rows with `promovido: false` (index
   `by_importacao_promovido`).
2. For each: `upsertProdutoPorRef(ctx, campos, gruposTocados)`. Existing refs
   keep `imagens` and `estado`; new refs insert as `rascunho`. After the
   upsert, if the live row was `descontinuado` before, patch `estado:
   rascunho` and count it as reactivated. Mark the row `promovido: true`.
3. `sincronizarGrupos(ctx, gruposTocados)`.
4. If rows remain: `runAfter(0, promoverLote)` and return.
5. Final pass (no rows left): collect live refs of the run's `marca`
   (`by_marca` prefix) and of the run's `tabelaOrigem` (`by_tabela`), union.
   Every live ref absent from the run's staged refs and not already
   `descontinuado` is patched to `descontinuado`; touched groups are synced.
   Never delete. Set `aprovada`, `numPromovidos`, `numReativados`,
   `numDescontinuados`.

Errors thrown by `upsertProdutoPorRef` (cross-brand group) abort the batch.
The run stays in `a-promover`; rows already marked `promovido` are not
redone, so re-running `internal.importacoes.promoverLote` by hand (`npx
convex run`) resumes safely. `aprovarImportacao` refuses a run that is not
`em-revisao`, so it cannot be used to retry. A `retomarPromocao` staff
mutation can be added by #41 if the page needs a button.

`importData.removerAusentes` stays with a deprecation comment: the v3
`catalog-brand-import` skill still calls it until #53 removes both.

## Queries (staff)

- `listar()` → runs ordered by `criadoEm` desc, `take(100)`, with counts and
  estado. Enough for the runs index page.
- `obter({ importacaoId, pagina, porPagina, filtro? })` where `filtro` is
  `todos` | `por-rever` | `com-avisos` | `alterados` | `novos`. Returns:
  - `importacao` header with counts, estado, decision fields and `pdfUrl`.
  - `grupos`: one page of group summaries sorted by `nomeGrupo` then
    `grupoModelo`: `grupoModelo`, `nomeGrupo`, `marca`, `familia`,
    `componente`, `numSkus`, `numAvisos`, `numNovos`, `numAlterados`,
    `numIguais`, `revisto`, `precisaRevisao` (numAvisos > 0 or numAlterados >
    0).
  - `totalGrupos` (after filter), `numPaginas`, `pagina` (clamped),
    `gruposPorRever` (precisaRevisao and not revisto, over the whole run):
    zero means approval will pass the gate.
  Groups are built in memory from the run's rows, the same approach as
  `produtos.listarAdmin`; runs are at most low thousands of rows.
- `obterGrupo({ importacaoId, grupoModelo })` → `null` or:
  - `grupoModelo`, `nomeGrupo`, `revisto`,
  - `skus` sorted by `pvpCents` then `ref`: every staged field plus `diff`,
    `precoAnteriorCents`, `avisos`, and `atual`: the live `produtos` row
    reduced to `{ nome, nomeGrupo, grupoModelo, pvpCents, atributos, estado,
    numImagens }` or `null`.
  - `paginas`: for the union of the SKUs' `pdfPaginas`, sorted:
    `{ pagina, imagemUrl, pdfUrl }` with nulls where a file is missing,
    resolved against the run's `tabelaOrigem`.

## Files

- `convex/schema.ts`: two tables, `paginasCatalogo` changes, shared
  validators (`estadoImportacaoValidator`, `diffValidator`,
  `stagedSkuFields`).
- `convex/lib/importSecret.ts`: `conferirSegredo` moved out of
  `importData.ts`.
- `convex/lib/importacoes.ts`: pure helpers with unit tests: diff
  classification, group summary derivation, gate check, `compativelCom`
  folding.
- `convex/importacoes.ts`: mutations, queries, `promoverLote`.
- `convex/paginasCatalogo.ts`: `upsertPaginaImagem`; null-safe
  `listarPorTabela`.
- `convex/produtos.ts`: null-safe `fichasCatalogoDe`.
- `convex/importData.ts`: use the shared secret helper; `limparCatalogo`
  deletes `imagem`; deprecation note on `removerAusentes`.
- `convex/lib/importacoes.test.ts`, `convex/importacoes.test.ts`.

## Tests

Unit (`convex/lib/importacoes.test.ts`): diff classification; gate check
over group summaries; `compativelCom` folding respects an existing key.

Integration (`convex/importacoes.test.ts`, convex-test, staff identity as in
`catalogo.test.ts`, `vi.useFakeTimers` + `finishAllScheduledFunctions` for
promotion):

1. Load: rows get `novo` / `alterado` / `igual` and `precoAnteriorCents`
   against seeded `produtos`; registry warnings land in `avisos`; a wrong
   type is rejected and reported; `concluirCarregamento` counts match.
2. Gate: approval throws while a group with avisos or `alterado` is not
   revisto; passes after `marcarGrupoRevisto`; groups that are `igual` and
   clean never block.
3. Promotion: after scheduled functions finish the run is `aprovada`, every
   staged ref exists in `produtos`, new refs are `rascunho`, an existing
   `publicado` ref keeps its `imagens` and `estado`, a `descontinuado` ref
   present in the run becomes `rascunho`.
4. Discontinuation: a live ref of the same marca under an older
   `tabelaOrigem` (`midea-sgt`) absent from the run becomes `descontinuado`;
   a ref of another brand is untouched; nothing is deleted;
   `catalogoGrupos` no longer lists a group whose only published SKU was
   discontinued.
5. Supersede: a second `criarImportacao` for the same `tabelaOrigem` rejects
   the open run and removes its rows.
6. Pages: `registarPaginaImagem` before and after `registarPagina` yields one
   row with both files; re-registering replaces the image file.
7. Auth: staff mutations and queries throw without the staff role; secret
   mutations throw with a wrong secret.

## Decisions taken

- `alterado` means a price change only, as the map's approval rule defines
  it. Other field changes are visible when a group is opened.
- Promotion runs in scheduled batches with the visible `a-promover` state
  rather than one atomic mutation, to stay under transaction limits on
  Daikin-sized tables.
- A discontinued ref that reappears in an approved run is revived as
  `rascunho`, so the office republishes it deliberately.
- New runs supersede open runs of the same `tabelaOrigem` instead of
  failing, so a re-run of the extractor needs no manual cleanup.
- Runs rejected by staff keep their staged rows for audit. Runs superseded
  by a new extraction lose them: the new run's rows are the replacement.
- `removerAusentes` is deprecated, not removed, until #53.

## Out of scope

- The admin review page (#41).
- Retry button for a failed promotion (add in #41 if needed).
- Yearly re-run diff presentation and partial approval (map: not yet
  specified).

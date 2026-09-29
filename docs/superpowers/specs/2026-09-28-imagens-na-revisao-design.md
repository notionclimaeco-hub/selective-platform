# Product images in the import review (candidates, selection, cutouts)

Part of map #38 (catalog reload). Vocabulary from `CONTEXT.md`, section
*Catalog import*: import run, staged SKU, product page (group). Follows the
import-runs design (`2026-09-28-import-runs-design.md`) and the extraction
toolkit design (`2026-09-28-extraction-toolkit-design.md`).

## Goal

Staff choose a group's photos while reviewing an import run, before
approval: see candidate photos gathered from the brand's official site (with
Megaclima and the PDF thumbnails as fallbacks), select and order them, upload
their own, and remove backgrounds. On approval the chosen list is applied to
every SKU of the group and the unchosen candidates are deleted so storage
holds only what the catalog uses.

Candidate gathering is done by the agent in the brand thread after every
extraction, with judgment: browse each series page, pick real packshots per
colour and per component. The existing crawl scripts become helpers, not the
decision-makers, because a plain crawler misses most products.

Decided with the user on 2026-09-28: option "3" (official site + Megaclima +
PDF thumbnails, plus manual upload) and approach A (candidates stored in
Convex, crawl agent-driven).

## Data model (`convex/schema.ts`)

Both tables are keyed by the deterministic `grupoModelo`
(`{marca}-{gama-slug}[-{componente}]`), so they are brand-wide and outlive
individual runs.

### `imagensCandidatas`

One row per candidate photo.

| field | type | notes |
| --- | --- | --- |
| `marca` | string | brand slug |
| `grupoModelo` | string | |
| `ficheiro` | `_storage` id | the image (JPEG/PNG/WebP, max 1600 px on the long side) |
| `fonte` | `site` \| `megaclima` \| `pdf` \| `upload` \| `recorte` | where it came from |
| `origemUrl` | optional string | page URL for `site`/`megaclima`; `pdf:<pagina>` for PDF thumbnails |
| `hash` | string | sha256 of the uploaded bytes; dedupe key |
| `largura`, `altura` | number | pixels |
| `cor` | optional string | registry colour value when known (from page, filename or ref suffix) |
| `origem` | optional `imagensCandidatas` id | for `recorte`: the candidate it was cut from |
| `criadoEm` | number | |

Indexes: `by_grupo` (`grupoModelo`), `by_hash` (`hash`), `by_marca` (`marca`).

### `imagensGrupo`

The decision for a group. One row per `grupoModelo`.

| field | type | notes |
| --- | --- | --- |
| `grupoModelo` | string | |
| `marca` | string | |
| `imagens` | array of `_storage` ids | ordered; first = cover |
| `porRef` | optional array of `{ ref, imagens }` | per-variant override (colour variants) |
| `atualizadoEm` | number | |
| `atualizadoPor` | string | identity subject |

Index: `by_grupo` (`grupoModelo`).

`skusEmRevisao` gains no image field. `produtos.imagens` remains the only
list the client reads.

## Functions (`convex/imagens.ts`)

Secret-guarded (`conferirSegredo`, called by `scripts/imagens/candidatas.mjs`):

- `registarCandidatas({ secret, candidatas: [...] })` → `{ criadas, repetidas }`.
  Batched (≤ 50). Upsert by `hash`: an existing hash updates `origemUrl`/`cor`
  only; the file id of the first upload is kept and the new upload is deleted.
  Validates `fonte`, positive dimensions and that the file exists.
- `limparCandidatas({ secret, marca, fonte? })` → `{ removidas }`. Deletes
  rows and files, except files referenced by any `imagensGrupo` list or any
  `produtos.imagens`.

Staff (`requireStaff`):

- `obterGrupoImagens({ grupoModelo })` → `{ candidatas: [{ _id, url, fonte,
  origemUrl, cor, largura, altura, origem, recorteId? }], escolhidas:
  { imagens: [{ ficheiro, url }], porRef: [...] } | null, atuais: [{ ref,
  imagens: [{ ficheiro, url }] }] }`. `recorteId` is the id of the `recorte`
  child when one exists. `atuais` lists the live products of the group with
  their current images, used to seed the strip when there is no decision yet.
- `definirImagensGrupo({ grupoModelo, marca, imagens, porRef? })` → null.
  Dedupes, verifies every file exists, upserts the row with the caller's
  subject.
- `adicionarCandidata({ marca, grupoModelo, ficheiro, fonte: "upload" |
  "recorte", origem?, largura, altura, hash })` → `{ candidataId }`. Same
  dedupe-by-hash rule.
- `removerCandidata({ candidataId })` → null. Refuses if the file is in a
  chosen list or in `produtos.imagens`.

Existing `imagens.definirImagens` (products page): when `aplicarAoGrupo` is
true it also upserts `imagensGrupo.imagens` for the product's group, so the
two surfaces agree.

## Agent crawl workflow (skill `catalog-brand-images`)

New skill under `.claude/skills/catalog-brand-images/` (mirrored in
`.agents/skills/`), linked from `catalog-pdf-extract` as step 7 ("imagens")
and from `catalog-brand-import`. Run by the brand thread after `enviar.py`.

1. **Targets**: `scripts/imagens/alvos.mjs <staged.json>` writes
   `product-scaffold/imagens/<marca>/alvos.json`: every group with refs,
   gama, tipoUnidade, componente, the colour axis (values of `cor`) and
   whether it is an accessory. Accessories are attempted only when the site
   has an obvious page; otherwise skipped without a note.
2. **Official site first**. The agent, in Playwright (headless Chromium
   already installed), opens the brand's listing pages and, per group, finds
   the series page by name and ref. It saves packshots into
   `product-scaffold/imagens/<marca>/<grupoModelo>/` following the rules:
   front view per colour, indoor and outdoor units as separate files, no
   lifestyle scenes, banners, icons or images under 400 px on the long side;
   for outdoor groups only outdoor shots. The existing `crawl-*.mjs` scripts
   are helpers for listing pages and DAM/gallery URL extraction (they keep
   the per-brand TLS and URL quirks); the agent decides what a packshot is.
3. **Fallbacks in order**: Megaclima price-list packshots
   (`crawl-megaclima-curl.mjs --brand <marca>` as helper), then PDF
   thumbnails through `pdf_images.py --only <grupo>`. Every fallback use is
   listed in the PR, as map #38 requires.
4. **Manifest**: `product-scaffold/imagens/<marca>/candidatas.json`:
   `{ "<grupoModelo>": [{ "ficheiro": "…/01.jpg", "fonte": "site", "origemUrl": "…", "cor": "branco" }] }`.
   The agent writes it; `scripts/imagens/candidatas.mjs --brand <marca>
   [--dry-run]` resizes (sharp, max 1600 px, JPEG quality 85 or PNG when the
   source has alpha), hashes, uploads through `importData.gerarUploadUrl` and
   calls `registarCandidatas` in batches of 50. Idempotent by hash. Optional
   `--recortar` runs the local `uvx rembg` batch (`lib/rembg.mjs`) and
   uploads each cutout as a `recorte` candidate with `origem` set.
5. **Coverage report**: `candidatas.mjs` prints and writes
   `product-scaffold/imagens/<marca>/cobertura.md`: per group the count by
   source; lists of groups with none, multi-colour groups missing a colour,
   outdoor groups with only indoor-looking files (by filename/`cor` hints).
   The PR pastes it. QA bar: every equipment group has at least one `site`
   or `megaclima` candidate, or a written reason.

The old chain `crawl → targets → match → preview → process → upload` is
retired for new brands; `match.mjs` aliases become notes in
`references/brands.md`. `catalog-brand-import` keeps its photo section only
as history until #53 rewrites it.

## Review page UI (`admin-frontend`)

An **Imagens** panel inside each group card on `/importacoes/{id}`, opened
on demand (a button "Imagens (n)" on the card; the group query already loads
lazily). Built from the existing products-page image manager: its sortable
strip, upload dropzone and object-URL handling move into shared components
under `src/components/imagens/` (`faixa-ordenavel.tsx`, `zona-upload.tsx`,
`use-imagens.ts` state hook) and `components/produtos/image-manager.tsx`
becomes a thin wrapper over them.

Panel layout:

- **Escolhidas**: ordered strip; first has a "capa" badge; drag to reorder;
  X returns the image to the candidates; "Recortar fundo" per image, or a
  before/after toggle when a `recorte` exists. Seeded from `escolhidas`, else
  from `atuais` of the first ref, else empty.
- **Candidatas**: thumbnails grouped by source (Site, Megaclima, PDF,
  Upload, Recortes), each with a link to `origemUrl` and the colour badge.
  Click adds to the strip. A dropzone here uploads new files as `upload`
  candidates (client-side resize to 1600 px with a canvas before upload,
  sha256 via `crypto.subtle`).
- **Por variante**: selector "grupo | <ref>…". Picking a ref shows its own
  strip seeded from the group list and saves under `porRef`. Colour groups
  show the hint "N cores, 1 lista" while the group list is shared.
- **Guardar** writes `definirImagensGrupo` for the whole panel (no autosave),
  toast with "Reverter" following the app's settings-edit pattern
  (`conta-dialog.tsx`).

Run header: "grupos sem imagens" count next to "por rever"; filter option
`sem-imagens` in `importacoes.obter` (groups with neither a decision nor live
images). Photos never block approval.

Phone (390 px): strips scroll horizontally, candidates in a 3-column grid,
drag via the long-press pointer sensor already used on the products page.

## Background removal in the browser

- Library `@imgly/background-removal` (WASM, Apache-2). Model (~80 MB, default model)
  downloads on first use per browser and is cached; the button shows "a
  descarregar o modelo" the first time, then "a recortar".
- Flow: fetch the storage URL → run the model → PNG with alpha → preview in
  place with "Manter original" → on confirm, upload through
  `imagens.gerarUploadUrl` and `adicionarCandidata({ fonte: "recorte",
  origem })`; the cutout replaces the original in the strip and the original
  stays a candidate, so before/after is a swap between the two files.
- An existing `recorte` child is reused: the button becomes the toggle.
- One image at a time; no batch button. Bulk pre-cutting stays in
  `candidatas.mjs --recortar` (local `uvx rembg`), which produces the same
  `recorte` rows.

## Promotion and cleanup (`convex/importacoes.ts`)

- In `promoverLote`, after `upsertProdutoPorRef` for a staged row: if an
  `imagensGrupo` row exists for the row's `grupoModelo`, set
  `produtos.imagens` to the `porRef` entry for that ref when present, else
  the group list (via `definirImagensProduto` without fan-out). Groups
  without a decision keep whatever the product had; new refs stay without
  images and therefore `rascunho`, as today. Touched groups are synced.
- Final pass: for every `grupoModelo` of the run, delete `imagensCandidatas`
  rows (and files) whose `ficheiro` is not in the group's chosen lists and
  not in any `produtos.imagens`. Record `numImagensAplicadas` and
  `numCandidatasRemovidas` on the run (optional numbers in `importacoes`).
- Rejected runs keep their candidates until the next approval of the brand
  or an explicit `limparCandidatas`.

## Tests

- `convex/imagens.test.ts` (convex-test): `registarCandidatas` idempotent by
  hash and drops the duplicate file; `definirImagensGrupo` rejects a missing
  file and stores `porRef`; `removerCandidata` refuses a chosen file;
  `obterGrupoImagens` seeds `atuais` from live products; `definirImagens`
  with `aplicarAoGrupo` updates `imagensGrupo`.
- `convex/importacoes.test.ts` additions: promotion applies the group list
  and a `porRef` override, preserves images of groups without a decision,
  deletes only unchosen candidates and never a chosen or live file, counts.
- Front end: unit test for the panel state reducer (add, remove, reorder,
  swap cutout, per-ref override); Playwright screenshots of the panel at
  390 px and 1440 px on the seeded review run using the staff test user.
- Scripts: `candidatas.mjs --dry-run` on a fixture manifest checks resize,
  hash and batch shapes without network.

## Out of scope

- Batch cutouts in the browser, cropping or other edits.
- Client catalog display changes (it keeps reading `produtos.imagens`).
- Retiring `catalog-brand-import` (ticket #53).

## Deviations recorded during implementation (2026-09-29)

- Promotion patches `produtos.imagens` directly (not through
  `definirImagensProduto`) and, right after each batch, deletes the replaced
  files nothing references any more (`ficheirosReferenciados`, all brands:
  legacy uploads share a file across brands); the scheduled cleanup keeps
  any file chosen by any decision of the brand.
- Candidate dedupe is per (`grupoModelo`, `hash`), index `by_grupo_hash`: the
  same bytes in two groups are two rows and two files.
- `definirImagensProduto` orphan protection uses `ficheirosReferenciados`
  (every brand's products, candidates and decisions).
- The panel does not fork the group list when a ref is selected; an override
  is created on the first edit and dropped on save when it equals the group
  list.
- Save feedback is a `sonner` toast with "Reverter" (the admin app gained
  `sonner`).
- `redimensionar` keeps WebP as WebP; the strip's sensors are Mouse, Touch
  (long press) and Keyboard; object URLs come from `useObjectUrls`.
- The panel scopes `atuais` and `porRef` to the run's staged refs.
- `@imgly/background-removal`'s default model is ~80 MB (not ~40 MB) and its
  assets load from IMG.LY's CDN.
- `cobertura.md` "só interior" ignores neutral filenames and matches UI/UE
  as delimited tokens.
- `limparCandidatasDaRun` uses the brand-wide kept set.
- The group card's button reads "Imagens" with no candidate count: the count
  would cost a read per group in `importacoes.obter`.
- Cleanup and promotion delete a file only when `ficheirosReferenciados`
  (products, candidates and decisions of every brand, catalog pages, run
  PDFs) no longer holds it; `limparCatalogo` also wipes candidates and
  decisions. A products-page edit of one variant becomes that ref's `porRef`
  override when the group has a decision, so approval does not revert it.

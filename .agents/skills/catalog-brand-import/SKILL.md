---
name: catalog-brand-import
description: >
  Imports a brand price table into the Selective catalog: CSV products,
  product photos (crawl/match/process/upload), and one-page catalog PDFs.
  Use when the user provides a brand CSV, image zip/crawl, or
  `*-paginas-pdf.zip`, or asks to import/upload Nipon, Hisense, Mitsubishi,
  Daikin, or Midea catalog data into Convex. Also covers secondary PT
  image sources Megaclima (megaclima.pt) and Disterm (disterm.pt).
---

# Catalog brand import

End-to-end playbook for loading one brand into Convex. Working files stay under
gitignored `product-scaffold/` and `.import-data/`. Live assets go to Convex
Storage via secret-guarded `convex/importData.ts`.

## Hard rules

1. **Ask before DB writes** for products/images unless the user already approved
   (PDF page uploads after products exist are usually fine when the user says
   “upload the PDFs”).
2. Require root `.env`: `VITE_CONVEX_URL` (or `CONVEX_URL`) + `IMPORT_SECRET`.
3. Never commit `product-scaffold/`, `.import-data/`, or crawl caches.
4. Prefer `npx convex run` / HttpClient mutations over inventing new APIs.

## Pipeline (order)

```
CSV → products (rascunho)
  → images: crawl → targets → match → preview → [approve] → process → upload
  → PDF pages → publicarComImagens (optional)
```

### 1) Products from CSV (schema v3)

CSV = 18 columns, UTF-8, QUOTE_ALL, CRLF. 1 row = 1 SKU. Header order:

`ref,ean,nome,nomeGrupo,marca,familia,segmento,sistema,tipoUnidade,componente,gama,atributos,descricao,pvpCents,ivaIncluido,tabelaOrigem,grupoModelo,pdfPaginas`

There are NO fixed spec columns: every spec/variant axis lives in the single
`atributos` column (ordered `chave=valor` pairs joined by `;`). Keys whose
values vary within a `grupoModelo` become columns of the product page's
variant table; constant keys render as spec chips. Canonical spec keys the
extractor should always try to fill (omit when the PDF lacks them):
`frio-kw`, `calor-kw`, `btu`, `classe-energetica` (`frio/calor`), `seer`, `scop`,
`refrigerante`, `wifi` (`sim|opcional|nao`), `unidades-max`.

Import object shape sent to `importData.importarProdutos` matches
`produtoImportFields` (no `imagens`/`estado` — those are app-managed). Transform
rules for the generator:

- **Empty string → omit** the key (optional fields). Array fields default to `[]`.
- `atributos`: split on `";"`, then split each token on the first `"="`
  into `{ chave, valor }`, preserving order (order = display order).
  Empty → `[]`. Values are stored as strings verbatim (numbers use `.`).
- `pdfPaginas`: comma-separated positive ints → `number[]` (e.g. `"26,30,36"` →
  `[26,30,36]`). Empty → `[]`.
- Integer: `pvpCents`.
- `ivaIncluido`: `"1"`/`"true"` → `true`, else `false` (brand tables: `false`).
- **Required**: `ref`, `nome`, `nomeGrupo`, `marca`, `familia`, `componente`,
  `grupoModelo`, `pvpCents`, `ivaIncluido`, `tabelaOrigem`. Every SKU belongs to
  a `grupoModelo` (a standalone product is a group of one whose attributes are
  all rendered as spec chips).

Validated on import (rows rejected with a clear error):

- `familia` ∈ `ar-condicionado, bombas-de-calor, aqs, ventilacao, chillers,
  ventiloconvectores, cortinas-de-ar, purificadores-de-ar,
  acessorios-e-controlo, outros`.
- `sistema` (if present) ∈ `mono-split, multi-split, vrf, rooftop, monobloco,
  bibloco`.
- `componente` ∈ `conjunto, unidade-interior, unidade-exterior, deposito,
  acessorio, comando`.
- `segmento` (if present) ∈ `domestico, comercial, industrial`.

Other notes:

- Upsert via `importData.importarProdutos` in batches (~50). Inserts as
  `rascunho` with empty `imagens`; updates preserve `estado`/`imagens`.
- Full rebuilds, not deltas: after upserting a brand's rows, call
  `importData.removerAusentes({ secret, tabelaOrigem, refsMantidos })` once to
  delete rows dropped from the latest CSV (and their orphaned images).
- No cross-brand groups: every SKU in a `grupoModelo` must share the same `marca`.

Staging JSON example: `.import-data/<marca>-<ano>-products.json`.

### 2) Product images

**Novo fluxo (v4):** as fotos entram como candidatas com a skill
`catalog-brand-images` e são escolhidas na página de revisão. O pipeline abaixo
fica só para marcas já carregadas até ao #53.

Scripts live in `scripts/imagens/` (see that README). Commands:

```bash
pnpm imagens:crawl -- --brand <marca>   # or brand-specific crawler
# Secondary PT distributors (fill gaps after official-site crawl):
node scripts/imagens/crawl-megaclima-curl.mjs              # all our brands
node scripts/imagens/crawl-megaclima-curl.mjs --brand daikin
pnpm imagens:targets                    # from DB (needs IMPORT_SECRET)
# For brands not yet in DB: build targets from CSV into product-scaffold/targets.json
pnpm imagens:match
pnpm imagens:preview -- --brand <marca> --serve
# Rembg runs on ALL images. In http://127.0.0.1:3847 pick Original vs Cutout
# per image → Guardar escolha → product-scaffold/image-choice.json
pnpm imagens:process -- --brand <marca> --choice-from product-scaffold/image-choice.json
pnpm imagens:upload -- --brand <marca>
```

Notes:

- Config: `scripts/imagens/crawl.config.json` (seeds, link pattern, URL filters).
- Aliases: `scripts/imagens/match.mjs` (`ALIASES` slug → crawl `pageSlug`).
- Manual overrides: `product-scaffold/manual/<slug>/`.
- **UI vs UE photos:** `match.mjs` classifies targets by `componente` /
  nome / slug (`unidade-interior` vs `unidade-exterior`) and crawled files by
  filename/alt/page (`exterior`, `unidad-exterior`, `AUW`/`AMW`, `multisplit-*`).
  Exterior targets only keep outdoor-classified packshots — never reuse the
  indoor gallery from the same series page. When a brand site has no series-
  specific outdoor shot (common on Hisense mural pages), alias the UE group to
  a page that *does* contain an outdoor packshot (e.g. Comfort UNIDAD EXTERIOR
  or multi outdoor). Prefer series-specific outdoor photos when they appear.
- **All colours of a multi-colour series:** before approving images, audit every
  `grupoModelo` whose variants differ by `cor=` (or by a colour suffix in the
  ref: AW/AS/AB, CW/CS/CB, BW/BS/BB, DG/DY/DP…). For each such group, the
  matched gallery must include at least one packshot identifiable as each
  colour present in the CSV. Gaps are a crawl/match bug, not “optional”:
  1. Check the brand page for per-colour packshots (Daikin often embeds them
     in AEM JSON — `content/dam/.../packshots/...` — not only as `<img src>`;
     `crawl-daikin-curl.mjs` must extract those relative DAM paths).
  2. Colour-specific product pages (`ftxj-aw` / `ftxj-as` / `ftxj-ab`, …) and
     designer sub-ranges (Stylish Seiren DG/DY/DP) must be aliased **and
     merged** into the same group (`match.mjs` `collectFiles` + `ALIASES`),
     not left as a single winning colour page.
  3. Sister models that share the shell (e.g. CTXA multi = Stylish FTXA) reuse
     the same colour galleries via alias.
  4. Re-scrape the missing colour, rematch, rembg, then reload the review page
     before asking the user to pick Original/Cutout/Excluir.
- Mitsubishi PT site: Node `fetch` fails TLS leaf verify — use
  `scripts/imagens/crawl-mitsubishi-curl.mjs` (curl) instead of Playwright.
- Brand preview: `pnpm imagens:preview -- --brand <marca> --serve` always runs
  rembg on all matched images, then lets you pick Original vs Cutout per image.
  Choices → `product-scaffold/image-choice.json`. Tell the agent to process+upload
  with that file (or say “usa o image-choice.json”).
- **Ask the user** before `process`/`upload` when images are new.

#### Secondary image sources (PT distributors)

Prefer official brand sites first. When a family still has no packshot, also
crawl these multi-brand PT distributors:

| Source | URL | How | Notes |
| --- | --- | --- | --- |
| **Megaclima** | https://www.megaclima.pt/ (hub: `/ventilacao/domestico/`, AC under `/ar-condicionado-lisboa/…`) | `node scripts/imagens/crawl-megaclima-curl.mjs` | Public brand price lists (`precario-*?brand=…`) with packshots named `{marca}_{tipo}_{serie}_*.png`. Crawler stores each shot under the **product** marca (daikin/mitsubishi/…) so `match.mjs` can score it. Covers Daikin, Mitsubishi, Hisense, Midea (+ others ignored). |
| **Disterm** | https://www.disterm.pt/produtos.html | Manual only | Product catalog is behind login (Joomla K2 + BT Login). Public pages only show category heroes (`/images/com_droppics/…`) — not usable as packshots. After an authenticated browse, drop useful photos into `product-scaffold/manual/<slug>/`. |

Match prefers official-site crawls over Megaclima when scores tie (`source:
"megaclima"` is slightly penalized). Add Megaclima pageSlugs to `ALIASES` in
`match.mjs` when a series name differs from the official-site slug.

#### Last resort: packshots from the price PDF

When every crawl leaves a group without a photo, rip the thumbnail the price
table itself prints next to the product's rows:

```bash
python3 .claude/skills/catalog-pdf-extract/scripts/pdf_images.py \
  product-scaffold/pdf-extract/<marca>/<csv> --only-missing --skip-accessories
pnpm imagens:match     # attaches product-scaffold/pdf-images/<marca>/<slug>/ (fonte "pdf")
```

`match.mjs` only uses these for entries that ended with zero crawl files, so a
later crawl always wins. They are ~100-200 px thumbnails: acceptable for long-
tail accessories and commercial units, not for hero products. The extractor
drops marketing banners, diagrams and lifestyle shots, and refuses any image it
can't tie to that group's own rows on the page — an empty gallery beats the
neighbouring product's photo.

### 3) Catalog PDF pages

Zip of one-page PDFs named `<tabelaOrigem>-p<N>.pdf`
(e.g. `mitsubishi-2026-p15.pdf`, `hisense-2026-p7.pdf`).

```bash
# extract to .import-data/<marca>-pages/
# then upload each file:
#   gerarUploadUrl → POST PDF → registarPagina({ tabelaOrigem, pagina, ficheiro })
```

`scripts/importNipon.mjs --pages <dir>` does the same (also imports products if
`--products` is set). Idempotent by `(tabelaOrigem, pagina)`.

Products resolve covers via `pdfPaginas` → `paginasCatalogo`.

### 4) Publish

After images (and optionally PDFs) are attached:

```bash
npx convex run produtos:publicarComImagens '{}'
```

Publishes every product with ≥1 image (all brands). Families still without
photos stay `rascunho`.

## Brand-specific notes

See [references/brands.md](references/brands.md).

## Done checklist

- [ ] Products upserted, error count reported
- [ ] Image preview approved (if new crawl)
- [ ] Images uploaded (`aplicarAoGrupo` for families)
- [ ] PDF pages registered for the brand `tabelaOrigem`
- [ ] `publicarComImagens` run if user wants them live
- [ ] Summarize: created/updated, families with/without images, pages uploaded

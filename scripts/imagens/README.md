# Product image pipeline

Local, repeatable pipeline: crawl brand sites → match to catalog families →
normalize PNGs → bulk upload to Convex.

All working files live under **`product-scaffold/`** (gitignored). Brand logos
that *are* committed live under `images/logos/`. Live catalog images are served
from Convex Storage.

```bash
pnpm imagens:crawl      # → product-scaffold/crawl-raw/ + manifest.json
# Brand-specific / secondary crawlers (curl):
#   node scripts/imagens/crawl-mitsubishi-curl.mjs
#   node scripts/imagens/crawl-daikin-curl.mjs
#   node scripts/imagens/crawl-midea-curl.mjs
#   node scripts/imagens/crawl-megaclima-curl.mjs [--brand daikin]
pnpm imagens:targets    # → product-scaffold/targets.json (needs IMPORT_SECRET)
# Brand not imported into Convex yet? Build its targets from the extraction CSV
# (replaces that brand's entries; re-run imagens:targets after the import):
#   node scripts/imagens/targets-from-csv.mjs product-scaffold/pdf-extract/daikin/daikin-2026-produtos.csv
pnpm imagens:match      # → product-scaffold/mapping.json + review.html
pnpm imagens:preview -- --brand hisense --serve   # rembg ALL, then pick cutout vs original
# Open http://127.0.0.1:3847 — choose Original/Cutout/Excluir → Guardar escolha
pnpm imagens:process -- --brand hisense --choice-from product-scaffold/image-choice.json
pnpm imagens:upload -- --brand hisense
```

Flags: `--brand`, `--only <slug>`, `--force`, `--skip-rembg`,
`--choice-from <image-choice.json>`.

**Picking inside the extraction review page:** the same original/cutout/exclude
picker is embedded per group in the `catalog-pdf-extract` review page, next to
the PDF pages, so photos can be chosen while the CSV is being reviewed:

```bash
python3 .claude/skills/catalog-pdf-extract/scripts/review.py \
  product-scaffold/pdf-extract/daikin/daikin-2026-produtos.csv \
  -o product-scaffold/review-daikin-2026.html --serve
```

It writes the same `image-choice.json` (merging, so other brands survive).

**Original / cutout / exclude:** rembg always runs for every matched image
(cached). In the preview UI you pick which version to ship per image, or
**Excluir** to drop it from process/upload; “Guardar escolha” writes
`product-scaffold/image-choice.json`. `process` rembg’s everything, then uses
cutout or original per that file (default cutout) and skips `exclude`.
`--skip-rembg` skips background removal entirely.

**Secondary sources:** after the official brand crawl, also run Megaclima
(`crawl-megaclima-curl.mjs`) to fill packshot gaps from
https://www.megaclima.pt/ price lists. Disterm
(https://www.disterm.pt/produtos.html) is login-gated — use
`product-scaffold/manual/<slug>/` after an authenticated browse. See the
`catalog-brand-import` skill for details.

**UI vs UE:** `match.mjs` prefers outdoor packshots for `unidade-exterior`
targets (filename/alt/page heuristics) and indoor for `unidade-interior`.
Do not reuse indoor series galleries for UE groups.

**All colours:** when a `grupoModelo` varies by `cor=` (or colour suffixes in
the ref — AW/AS/AB, CW/CS/CB, BW/BS/BB, DG/DY/DP…), the matched gallery must
cover every colour in the CSV. Prefer merging colour-specific crawl pages and
brand landing packshots (Daikin Stylish Seiren, Emura AW/AS/AB) via `ALIASES`
+ `collectFiles` in `match.mjs`. If a colour is missing, scrape it before the
preview/review picker — see the `catalog-brand-import` skill.

**PDF fallback:** for groups no crawl covers, rip the thumbnail printed next to
the product in the brand's own price table:

```bash
python3 .claude/skills/catalog-pdf-extract/scripts/pdf_images.py \
  product-scaffold/pdf-extract/daikin/daikin-2026-produtos.csv \
  --only-missing --skip-accessories
pnpm imagens:match   # attaches product-scaffold/pdf-images/<marca>/<slug>/ as fonte "pdf"
```

`match.mjs` only falls back to these when a target ends with zero crawl files,
so a later crawl always wins. Expect ~100-200 px thumbnails.

Idempotent: crawl skips known URLs; process skips existing PNGs; upload reuses
storage by file hash (`product-scaffold/.upload-state.json`).

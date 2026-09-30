# Brand-specific import notes

Keep this short. Prefer fixing scripts/config over growing this file.

Site, TLS, UI/UE and crawler notes per brand (and the Megaclima / Disterm
distributors) moved to
`.claude/skills/catalog-brand-images/references/brands.md`.

## Nipon

- 2025 reload (#45) goes through `catalog-pdf-extract` (import run `nipon-2025`,
  brand parts in `marcas/nipon/`); photos: niponcomfort.com crawl + the photos
  the previous catalog had per ref.
- Many aliases already in `match.mjs`.

## Hisense

- Config seeds under `crawl.config.json` → `hisense`.
- PDF zip: `hisense-2026-p<N>.pdf` → `tabelaOrigem: hisense-2026`.

## Mitsubishi Electric

- Give each SKU `atributos` (e.g. `frio-kw=2.5;calor-kw=3.2`) so the product
  page can build the variant table; synthesize from capacity/BTU when the
  export lacks it.
- PDF zip: `mitsubishi-2026-p<N>.pdf` → `tabelaOrigem: mitsubishi-2026`.

## Midea

- Products CSV used `tabelaOrigem: midea-sgt`; PDF zip is `midea-2026-p*.pdf`.
  Import overrides products to `tabelaOrigem: midea-2026` so pages resolve.
- PDF pages cover 2–12 and 14–22 (no page 13 in the zip).

## Daikin

- CSV `tabelaOrigem: daikin-2026` matches PDF zip `daikin-2026-p*.pdf`.
- Give each SKU `atributos` (synthesize from capacity/ref when the export
  lacks it) so grouped SKUs are distinguishable in the variant table.
- Map noisy Daikin catalog headers to a valid `familia` slug (see SKILL.md list)
  before import — invalid families are rejected.

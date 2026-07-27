# Brand-specific import notes

Keep this short. Prefer fixing scripts/config over growing this file.

## Nipon

- Site: niponcomfort.com — crawl via Playwright (`pnpm imagens:crawl -- --brand nipon`).
- Image URLs under `/pic/`; many aliases already in `match.mjs`.
- Import script: `scripts/importNipon.mjs` (products + pages).

## Hisense

- Site: hisense.pt — Playwright crawl; prefer `domcontentloaded` (site never
  reaches networkidle). Strip WP size suffixes (`-1200x800.jpg` → original).
- Config seeds under `crawl.config.json` → `hisense`.
- PDF zip: `hisense-2026-p<N>.pdf` → `tabelaOrigem: hisense-2026`.
- Secondary: `node scripts/imagens/crawl-megaclima-curl.mjs --brand hisense`.
- **UI / UE split:** catalog has separate `*-ui` / `*-ue` groups. Mural product
  pages on hisense.pt almost only show indoor galleries; Comfort includes
  `COMFORT-UNIDAD-EXTERIOR-.jpg`, and multi pages / Megaclima
  `hisense_exterior_*` are true outdoor packshots. UE aliases must point at
  those outdoor sources — do **not** map `*-ue` to the same indoor series page
  as `*-ui`. Conduta/coluna `AUW*` UE rows use multi outdoor packshots, not
  `hisense-conduta-*` indoor duct shots.

## Mitsubishi Electric

- Site: mitsubishielectric.pt (Liferay). Node TLS often fails with
  `UNABLE_TO_VERIFY_LEAF_SIGNATURE` — use
  `node scripts/imagens/crawl-mitsubishi-curl.mjs` instead of Playwright.
- Document URLs append `/<uuid>?t=…` after the file extension; strip before
  download (curl crawler already does this).
- Many series pages exist (`/msz-ln`, `/pead-m`, …); Mr.Slim ZM/SZ and
  accessories often have no dedicated photos.
- Give each SKU `atributos` (e.g. `frio-kw=2.5;calor-kw=3.2`) so the product
  page can build the variant table; synthesize from capacity/BTU when the
  export lacks it.
- PDF zip: `mitsubishi-2026-p<N>.pdf` → `tabelaOrigem: mitsubishi-2026`.
- Secondary: `node scripts/imagens/crawl-megaclima-curl.mjs --brand mitsubishi`
  for mural/cassete packshots missing on the official PT site.

## Midea

- Products CSV used `tabelaOrigem: midea-sgt`; PDF zip is `midea-2026-p*.pdf`.
  Import overrides products to `tabelaOrigem: midea-2026` so pages resolve.
- Images: https://www.sgtmidea.com/ (SGT exclusive PT distributor), not midea.com/pt.
  Crawler: `node scripts/imagens/crawl-midea-curl.mjs` (WooCommerce gallery + og:image).
  Weak proxies to review: porta-split/h-pack → Lite; twin systems → cassete compacta.
- PDF pages cover 2–12 and 14–22 (no page 13 in the zip).
- Secondary: Megaclima also lists Midea mural/cassete — run
  `node scripts/imagens/crawl-megaclima-curl.mjs --brand midea` if SGT gaps remain.

## Daikin

- CSV `tabelaOrigem: daikin-2026` matches PDF zip `daikin-2026-p*.pdf`.
- Give each SKU `atributos` (synthesize from capacity/ref when the export
  lacks it) so grouped SKUs are distinguishable in the variant table.
- Map noisy Daikin catalog headers to a valid `familia` slug (see SKILL.md list)
  before import — invalid families are rejected.
- Images: https://www.daikin.pt/ — crawler
  `node scripts/imagens/crawl-daikin-curl.mjs` probes
  `/pt_pt/products/product.html/<SERIES>.html` + residential marketing pages.
  Packshots from `my.daikin.eu` DAM. Many accessory/UTA/chiller families have
  no packshot pages → stay without photos.
- Secondary: Megaclima mural price lists often have Sensira / Comfora / Perfera /
  Stylish / Emura packshots — run
  `node scripts/imagens/crawl-megaclima-curl.mjs --brand daikin` after the
  official crawl to fill gaps.

## Secondary distributors (all brands)

### Megaclima — https://www.megaclima.pt/

- Multi-brand PT installer price lists (AC, ventilação, cortinas de ar, …).
- Useful hub: https://www.megaclima.pt/ventilacao/domestico/ ; AC packshots live
  under `/ar-condicionado-lisboa/{domestico,comercial}/precario-*?brand=…`.
- Crawler: `node scripts/imagens/crawl-megaclima-curl.mjs` (`--brand <marca>`
  optional). Stores under the product marca with pageSlugs like
  `daikin-mural-sensira`. Config seeds also in `crawl.config.json` → `megaclima`.

### Disterm — https://www.disterm.pt/produtos.html

- PT wholesaler (solar, AC, bombas de calor, ventilação, …). Broader catalog
  than Megaclima, but **product detail pages require login**.
- Public `/produtos/*.html` pages only expose category hero images — skip for
  automated crawl. For gaps, log in manually and drop photos into
  `product-scaffold/manual/<slug>/`.

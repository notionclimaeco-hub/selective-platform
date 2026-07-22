# Product image pipeline

Local, repeatable pipeline: crawl brand sites → match to catalog families →
normalize PNGs → bulk upload to Convex.

All working files live under **`product-scaffold/`** (gitignored). Brand logos
that *are* committed live under `images/logos/`. Live catalog images are served
from Convex Storage.

```bash
pnpm imagens:crawl      # → product-scaffold/crawl-raw/ + manifest.json
pnpm imagens:targets    # → product-scaffold/targets.json (needs IMPORT_SECRET)
pnpm imagens:match      # → product-scaffold/mapping.json + review.html
# Open product-scaffold/review.html; drop overrides in product-scaffold/manual/<slug>/
pnpm imagens:process    # → product-scaffold/produtos/<marca>/<slug>/01.png …
pnpm imagens:upload     # → Convex storage + produtos.imagens (aplicarAoGrupo)
```

Flags: `--brand nipon`, `--only <slug>`, `--force`, `--skip-rembg`.

Idempotent: crawl skips known URLs; process skips existing PNGs; upload reuses
storage by file hash (`product-scaffold/.upload-state.json`).

# Extraction toolkit and catalog-pdf-extract skill v4 (#42)

Part of map #38 (catalog reload). Vocabulary from `CONTEXT.md`, section
*Catalog import*: price table, import run, staged SKU, spec registry,
compatibility.

## Goal

The Python half of the reload pipeline: what an agent thread runs, section by
section, to turn a brand price table into a staged import run in Convex
(#40). Deterministic scripts do the mechanical work (map, table-row
reconstruction, ref/price pairing, grouping, naming, registry validation,
upload); the agent corrects the map by hand and answers the QA list.

Acceptance: running the toolkit on the Hisense 2026 PDF produces a staged run
with zero errors and warnings only where the PDF is genuinely ambiguous. Unit
tests for ref/price pairing, skeleton grouping and registry validation on
fixture pages.

## Layout

```
.claude/skills/catalog-pdf-extract/
├── SKILL.md                      # rewritten around map → extract → group → validate → send → review
├── references/standards.md       # unchanged (v4)
├── scripts/
│   ├── _comum.py                 # shared helpers: refs, prices, slugs, registry, JSON
│   ├── mapa.py                   # 1. PDF → mapa.json
│   ├── extrair.py                # 2. mapa.json + PDF → linhas-<seccao>.json
│   ├── agrupar.py                # 3. linhas-*.json → <marca>-<ano>-staged.json (no avisos yet)
│   ├── validar.py                # 4. registry + coherence checks, writes avisos (+ optional CSV v3)
│   ├── paginas.py                # 5. page renders (110 dpi PNG) + one-page PDFs
│   ├── enviar.py                 # 6. upload PDF, renders and staged SKUs to Convex
│   └── pdf_images.py             # kept: packshot fallback used by the packshot tickets
└── tests/                        # pytest, fixture pages built with PyMuPDF
```

`review.py`, `verify.py` and `name_fix.py` are removed: the review page moves
to the admin app (#41), the missing-value pass is replaced by registry
warnings on the review page, and the naming rules are ported into
`agrupar.py`.

Working directory per brand: `product-scaffold/pdf-extract/<marca>/`
(gitignored). All scripts read and write there by default.

## Data flow

```
tabela.pdf ──mapa.py──▶ mapa.json ──(agent edits)──▶
   ──extrair.py --seccao <id>──▶ linhas-<id>.json (raw rows, confidence per field)
   ──agrupar.py──▶ <marca>-<ano>-staged.json (ImportRunJson, avisos: [])
   ──validar.py──▶ same file, avisos filled (+ <marca>-<ano>-produtos.csv on --csv)
   ──paginas.py──▶ paginas/<tabelaOrigem>-p<N>.png + .pdf
   ──enviar.py──▶ Convex import run (criarImportacao → carregarSkus → registarPagina[Imagem] → concluirCarregamento)
```

## 1. `mapa.py <pdf> [--marca m --ano a] [-o mapa.json]`

Reads the PDF and proposes a **map**: sections → pages → classification.

Strategies, tried in order:

1. **Outline** (`doc.get_toc()`, Mitsubishi): every entry is a section.
2. **Index pages** (Daikin, Hisense, Nipon): pages whose lines end in a
   page number and hold the word ÍNDICE / Índice or at least eight such
   lines. Printed page numbers are converted to PDF page indexes by reading
   the footer number of a few pages (`offset = pdf_index − printed`).
3. **Per-page headers** (Midea): the largest-font line in the top 15 % of
   every page; consecutive pages with the same header form one section.

A section is `{ id, titulo, paginas: [n, …], familia, segmento, sistema,
tipoUnidade, componente, gama, tipo, semPreco }` where `tipo` is `tabela`
(default), `compatibilidade` (a UE × UI matrix) or `ignorar` (cover, index,
marketing, conditions). Classification is proposed from keywords in the
title and its parent heading (Gama Residencial / Comercial / VRF /
Aerotermia): e.g. "Multi-Inverter Exterior" → `ar-condicionado / comercial /
multi-split / exterior / unidade-exterior`; "Cassete 1x1" → `mono-split /
cassete-4-vias / conjunto`; "Acessórios" → `acessorios-e-controlo /
acessorio`; "Hi-Water" → `aqs / conjunto`. Unrecognised titles get
`familia: null` and the agent fills them in.

Pages: a section runs from its own page to the page before the next section.
Several sections may share a page (Hisense prints three tables on page 18);
`extrair.py` splits the page by the position of each section's title. Rule
enforced by `validar_mapa`: **every page of the PDF belongs to at least one
section** (`ignorar` counts), every section has a classification unless it is
`ignorar`, and every section title is found on its first page. A page above
which no title of its section is printed inherits nothing: `extrair.py`
assigns rows to the nearest section title above them on the same page, and
rows above the first title on a page go to the section whose range started on
an earlier page (the "(continuação)" case); otherwise it is an error.

The agent edits the file by hand before extracting. Fields the agent most
often changes: `gama` (series name shown on the site; default is the cleaned
title), `tipoUnidade`, `componente`, `semPreco` (sections printed with
"preços sob consulta").

## 2. `extrair.py <pdf> --mapa mapa.json --seccao <id> | --todas`

Words with coordinates per page (`page.get_text("words")`), bucketed into
**bands** by `round(y0 / 3)`. Table-row reconstruction:

- A **row** is a band that contains a ref token. Ref token: starts with an
  uppercase letter, has at least one digit, only `A–Z 0–9 - / . # ( ) *`,
  length ≥ 4, and is not an EAN (13 digits), a price, a dimension, a tubing
  size or a voltage.
- **Ref/price pairing by layout proximity**: a band without a ref that holds
  a price (`1.450 €`, `1455€`, `130 €`) attaches to the nearest ref row above
  it within 9 pt (Hisense prints the price one band below the row when the
  cell wraps). A ref row without a price and with no such band gets
  `pvpCents: null`; in sections marked `semPreco` this is expected, elsewhere
  it becomes a warning downstream.
- **Continuation bands**: a band without ref and without price (only
  numbers, tubing, voltage) within 9 pt below a UE row merges into that row
  (Hisense aerotermia prints kW under the UE ref).
- **Combined refs** `A / B` or `A/B` on one row (UI + UE, UI + panel) give a
  `conjunto` row with `ref: "A/B"` and `refs: ["A", "B"]`; the live catalog
  already keys conjuntos that way.
- **Column headers**: the bands above the first row of a table are scanned
  for the known header words (Referência, Modelo, EAN, Capacidade,
  Arrefecimento, Aquecimento, Classe, Dimensões, Tubagem, Fluido, Alimentação,
  Caudal, CV, depósito, Descrição, Preço). Each header word gives a column
  x-centre; a row word is assigned to the nearest column. Columns are used
  for the fields whose shape is ambiguous (which decimal is frio vs calor,
  which integer is caudal vs CV vs litros, where the description starts).
  Shape-based detection is used for the unambiguous fields: EAN, price,
  energy class (`A++ / A+`), refrigerant (`R32`, `R290`, `R410A`), voltage
  (`220-240V` → monofasica, `380-415V` → trifasica), tubing (`1/4'' - 3/8''`),
  dimensions (`910×190×447`, first = unit, second = packaging, packaging
  dropped), BTU (`9k`), min/max ranges (`2,6 (1,0-4,0)` → `frio-kw=2.6`,
  `frio-kw-min=1.0`, `frio-kw-max=4.0`), `2×1` multi prefix (`unidades-max`),
  and the category words Interior / Exterior / UE / UI / Acessórios /
  Ventilação (componente hint).
- **Sub-headers** inside a table (bands with no ref, no price, no EAN, few
  words) are kept as context for the rows below them: `BRANCO` / `PRETO` →
  `cor`, `Baixa|Média|Alta Pressão` → `pressao-estatica`, `Turbo|Super
  Inverter` and similar series markers → `serie` (appended to the gama by
  `agrupar.py`).
- Every field carries a **confidence**: `1.0` shape match, `0.8`
  column-assigned, `0.5` heuristic (attached price, continuation band). Rows
  carry `pdfPaginas`, `seccao`, `y`, and the reconstructed `texto` for the
  reviewer.
- **Compatibility matrices** (`tipo: compatibilidade`): the header band gives
  the column labels (UI refs or capacities such as `2,5 kW`); each row is a
  UE ref, an optional unit count and one cell per column. `x` / `✓` cells
  become entries of `compativelCom` on the UE row; a price cell becomes an
  extra `conjunto` row `{UE}/{coluna}` with that price. The UE row is emitted
  with `soCompatibilidade: true` so `agrupar.py` merges it into the UE SKU
  extracted from the price table instead of creating a second one.

Output: `linhas-<seccao>.json` = `{ seccao, linhas: [...] }`.

## 3. `agrupar.py --mapa mapa.json --marca m --ano a [--ficheiro nome.pdf]`

Reads every `linhas-*.json`, emits `<marca>-<ano>-staged.json` in the
`ImportRunJson` shape with empty `avisos`.

- **componente**: row hint (Interior / UI → `unidade-interior`, Exterior /
  UE → `unidade-exterior`, combined ref → `conjunto`, Acessórios / no
  capacity and no dimensions in an equipment section → `acessorio`,
  controller words → `comando`), else the section default.
- **Series grouping**: within a section and componente, rows form one group
  per `serie` sub-header (Turbo / Super Inverter), never one product per
  capacity; UI and UE of the same series are separate groups. The ref prefix
  family (`ADT`, `AUW`, `QK`…) is *not* a split key: Hisense prints two
  families in one series (AVT/AUV chão-teto), and the live slugs are per
  series. The digit skeleton (`AUC105UR4RKC8` → `AUC#UR#RKC#`) is used by
  `validar.py` to warn about singles that share a skeleton. Accessories found
  inside an equipment section (panels, kits) become their own `acessorio`
  groups named after their description; accessories sharing a skeleton form a
  group only when an attribute distinguishes them. UI/UE sold apart inherit
  the kW of the conjunto printed next to them (by `UI/UE` ref or by the last
  capacity-bearing row above). Tanks listed under accessories ("Depósito de
  200L") are reclassified `aqs/deposito` with `deposito-l`.
- **grupoModelo**: port of `grupoModeloDeterministico` (`convex/lib/
  stagedSku.ts`): `{marca}-{gama-slug}` for conjuntos, `{marca}-{gama-slug}-
  {componente}` otherwise, ref slug when there is no gama.
- **Attributes**, in order: variant axes first (`cor`, `unidades-max`,
  `pressao-estatica`, `alimentacao`), then specs in registry order for the
  familia (`frio-kw`, `calor-kw`, `classe-energetica`, `btu`, `seer`,
  `scop`, `refrigerante`, `wifi`, `dimensoes-ui/ue`, `tubagem`,
  `frio-kw-min/max`, `calor-kw-min/max`, `caudal-m3h`, `deposito-l`, …).
  Values follow the registry conventions (`.` decimal, no units,
  `classe-energetica = frio/calor`, `dimensoes = AxLxP`). Keys the registry
  does not know for the familia are dropped and noted in `descricao`
  (`cv`, `ean` goes to its own field).
- **Duplicates**: the same ref printed in several sections or under several
  colour headers (the UE `AS25WM00W` under both BRANCO and PRETO) is emitted
  once, pages merged; an attribute that differs between the copies (`cor`)
  is dropped, because the ref is the same physical unit.
- **Naming** (port of `name_fix.py` rules, brand-neutral): `nomeGrupo =
  {tipoUnidade label} {gama}` with ` | Unidade Interior` / ` | Unidade
  Exterior` for units sold apart, never with capacity or colour;
  `nome = nomeGrupo + capacity suffix` (`3.5 kW` from `frio-kw`, else
  `calor-kw`, else `deposito-l` L, else `caudal-m3h` m³/h) plus
  `(até N UI)` for multi UE and `trifásico` when `alimentacao` varies in the
  group. Accessories: `nomeGrupo` = cleaned description (no footnote
  markers, no refs), `nome` = `nomeGrupo` for a group of one. Two groups
  never share a `nomeGrupo`: the series code is appended to the collider.
- `ean` from the row; `descricao` from the description column when present.
- `pvpCents: 0` for rows without a price, with an aviso: "preço sob
  consulta" when the table says so (note, `semPreco` in the map, or a
  section with no priced row at all), "sem preço na linha" otherwise.
- `** Modelo trifásico` footnotes: a ref printed with the same asterisk
  marker on the same page gets `alimentacao`; conjuntos inherit it from
  their UE ref.

## 4. `validar.py <staged.json> [--registo product-scaffold/spec-registry.json] [--csv]`

Never blocks: writes `avisos` into every SKU and prints a summary. Checks:

- **Registry** (`spec-registry.json` from `pnpm registry:json`): port of
  `validarAtributos` — wrong type / enum / pattern and duplicate key are
  written as `erro: …` avisos (Convex will reject the row; the agent must fix
  them before sending), unknown key, key outside its componentes and missing
  required key are plain avisos.
- **Taxonomy**: familia / sistema / componente / segmento enums, required
  fields, `marca` slug, `pvpCents` integer, `pdfPaginas` non-empty.
- **Group coherence**: same `nomeGrupo`, `familia`, `segmento`, `sistema`,
  `tipoUnidade`, `gama`, `componente` across the group; two SKUs with
  identical `atributos` in a group ("indistinguishable variants"); a group
  of several SKUs where some have no attributes.
- **Duplicate refs** across the run.
- **Broken series**: groups of one whose ref skeleton and `nomeGrupo` match
  another group of one with the same familia and componente.
- **Naming convention**: capacity (kW / BTU / L) or colour in `nomeGrupo`,
  colour in `nome`, dash separators, variant `nome` without a capacity suffix
  when the group varies by capacity.
- **Prices**: `pvpCents: 0` → "preço em falta / sob consulta"; the same
  price on every SKU of a multi-variant group is noted.
- `--csv` writes the optional CSV v3 export next to the JSON
  (`pdf_images.py` and spreadsheets still read it).

## 5. `paginas.py <pdf> --tabela-origem hisense-2026 [--paginas 12,13] [--staged staged.json]`

For every page cited in `pdfPaginas` (or the explicit list): a 110 dpi PNG
`paginas/<tabelaOrigem>-p<N>.png` and a one-page PDF
`paginas/<tabelaOrigem>-p<N>.pdf` (PyMuPDF `insert_pdf` + `save(garbage=4,
deflate=True)`, no Ghostscript). Skips files already present unless
`--forcar`.

## 6. `enviar.py <staged.json> --pdf tabela.pdf [--paginas paginas/] [--sem-pdf]`

Reads `VITE_CONVEX_URL` (or `CONVEX_URL`) and `IMPORT_SECRET` from the root
`.env`. Uses the Convex HTTP API (`POST {url}/api/mutation`, `{ path, args,
format: "json" }`) — no Node dependency in the Python toolkit.

1. `importData:gerarUploadUrl` → `POST` the PDF → storage id.
2. `importacoes:criarImportacao` (marca, ano, tabelaOrigem, ficheiro, pdf).
3. `importacoes:carregarSkus` in batches of 100; every `erros` entry is
   printed and the run is left open so the agent can fix and resend
   (`criarImportacao` supersedes the open run).
4. For every file in `paginas/`: upload, then `importacoes:registarPaginaImagem`
   for PNGs and `importData:registarPagina` for PDFs.
5. `importacoes:concluirCarregamento` → counts; prints the review path
   `/importacoes/<id>`.

`--dry-run` validates the JSON shape and prints the batches without
calling Convex.

## Tests (`tests/`, pytest)

Fixture pages are generated with PyMuPDF (`insert_text` at coordinates),
mimicking the Hisense layouts, so the repo stores no brand PDF. Cases:

- `test_comum.py`: ref token recognition, price parsing, slug and
  deterministic `grupoModelo` (same outputs as `stagedSku.ts`).
- `test_mapa.py`: index page + footer offset → sections with ranges; outline
  strategy; page coverage validation; classification keywords.
- `test_extrair.py`: ref/price pairing when the price wraps to the next
  band; combined `A / B` refs; continuation band under a UE row; column-based
  frio/calor assignment; sub-headers (colour, pressure, series); a
  compatibility matrix with `x` cells and a priced cell.
- `test_agrupar.py`: one series across capacities becomes one group with
  N variants; UI and UE of the same series are separate groups; colour
  variants share a group with `cor` first; the shared UE ref under two colour
  headers is emitted once without `cor`; naming convention; panel rows in a
  cassette section become an `acessorio` group.
- `test_validar.py`: registry type error / unknown key / missing required
  (against a small inline registry), duplicate ref, indistinguishable
  variants, broken series, capacity in `nomeGrupo`.
- `test_hisense.py`: skipped unless
  `product-scaffold/pdf-extract/hisense/hisense-tabela-precos-2026.pdf`
  exists; runs the whole chain and asserts zero `erro:` avisos plus a handful
  of hand-checked anchors (ref, price, kW).

`pnpm test:pdf` runs `python3 -m pytest .claude/skills/catalog-pdf-extract/tests -q`.

## Decisions taken

- Sections are table headings, not whole pages: the Hisense table prints up
  to three tables per page with different `tipoUnidade`. The "every page in
  exactly one section" rule is kept at page-coverage level and the row-level
  rule "never inherit the previous section's classification" is enforced by
  positional assignment to the nearest section title on the same page.
- Conjunto refs are `UI/UE` (no spaces), the key the live catalog already
  uses, so the diff reports `igual` / `alterado` rather than `novo` for
  every conjunto.
- "Preços sob consulta" rows (Hisense VRF) are staged with `pvpCents: 0` and
  a warning, following the map's rule that everything printed is a product we
  sell; the review page shows the warning on every VRF group.
- Compatibility matrices give `compativelCom` on the UE; matrix cells that
  hold a price become `conjunto` SKUs. Hisense prints capacities, not refs,
  as matrix columns, so its `compativelCom` entries are capacity labels
  (`UI 2.5 kW`).
- Gama for Hisense commercial 1×1 tables is `"<table title> <Turbo|Super
  Inverter>"`, which reproduces the live slugs
  (`hisense-cassete-1x1-turbo-inverter`) so photos survive the reload.
- Registry errors are written as `erro:` avisos instead of dropping the SKU:
  the agent sees them in the summary and in the JSON, fixes the map or the
  script, and reruns. `enviar.py` refuses to send while any `erro:` remains
  unless `--forcar`.

## Out of scope

- Brand reloads themselves (#43–#47) and the brand-specific gama tables
  they may add to `mapa.py` keyword rules.
- Packshots (`pdf_images.py` is kept as is).
- The admin review page (#41).

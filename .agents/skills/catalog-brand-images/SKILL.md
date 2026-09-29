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

Pré-requisitos: a run já existe no Convex (depois do `enviar.py`); o `.env` da
raiz tem `IMPORT_SECRET` e o URL do Convex (`VITE_CONVEX_URL` ou
`CONVEX_URL`); `alvos.mjs` e `candidatas.mjs` correm a partir da raiz do repo
(os passos do catalog-pdf-extract fazem `cd` para a pasta da marca, por isso
volta à raiz antes).

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
- Ficheiros em `product-scaffold/imagens/{marca}/{grupoModelo}/NN.jpg` (ou `.png`) e
  regista o URL da página de onde veio.

## 3. Fallbacks, por esta ordem

1. Megaclima: `node scripts/imagens/crawl-megaclima-curl.mjs --brand {marca}`
   e escolher à mão o que serve. O crawler escreve em
   `product-scaffold/crawl-raw/{marca}/<pageSlug>/NN.png` e no `manifest.json`
   partilhado; detalhes por marca em [references/brands.md](references/brands.md).
   Copia (ou referencia) os escolhidos para a pasta do grupo com
   `"fonte": "megaclima"`.
2. Miniaturas do PDF: `python3 .claude/skills/catalog-pdf-extract/scripts/pdf_images.py <csv> --only <grupo>`
   (o CSV vem de `validar.py --csv`). Acrescenta `--pdf <caminho>` se o PDF não
   estiver ao lado do CSV, e `--include-ue` para grupos `unidade-exterior`
   (por omissão são saltados, porque a miniatura costuma ser da UI). O output
   fica em `product-scaffold/pdf-images/{marca}/{grupo}/NN.png`; no
   `candidatas.json` refere esses ficheiros com caminho absoluto ou relativo
   (`../../pdf-images/{marca}/{grupo}/NN.png`), `"fonte": "pdf"` e
   `"origemUrl": "pdf:<pagina>"`.

Cada uso de fallback fica listado no PR.

## 4. Manifesto e upload

`product-scaffold/imagens/{marca}/candidatas.json`:

```json
{ "hisense-air-master": [
    { "ficheiro": "hisense-air-master/01.jpg", "fonte": "site", "origemUrl": "https://hisense.pt/…", "cor": "branco" } ] }
```

O valor de `cor` tem de ser exatamente um dos `cores` desse grupo em
`alvos.json` (valores de cor do registo); senão o `cobertura.md` conta a cor
como em falta.

A mesma foto (os mesmos bytes) reutilizada noutro grupo tem de ser listada
outra vez nesse grupo: a deduplicação é por grupo. No `cobertura.md`, a marca
"só interior" ignora nomes de ficheiro neutros: só contam ficheiros com pistas
UI/UE ou interior/exterior (indoor/outdoor) no nome.

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

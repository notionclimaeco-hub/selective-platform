---
name: catalog-brand-images
description: >
  Gathers candidate product photos for a staged import run: the agent browses
  the brand's official site in Playwright group by group, saves the packshots
  (per colour, indoor/outdoor apart), falls back to Megaclima and the PDF
  thumbnails, uploads everything as candidates to Convex, then looks at every
  group's contact sheet and saves its own pick (cutouts, first = thumbnail)
  as the group's decision, and reports coverage. Use right after catalog-pdf-extract's enviar.py, or when a brand's review
  page shows groups without images.
---

# Catalog brand images (candidatas)

Cada extração acaba com este passo. O objetivo é que cada grupo em revisão
tenha candidatas de foto **e já uma escolha do agente** (recortes, o primeiro
é a capa) em `/importacoes/{id}`. A escolha do agente conta na aprovação; o
staff só abre os grupos que quer mudar e pode aprovar mesmo com grupos por
rever.

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

0. Outro site oficial da marca (ex.: Hisense tem hisense.pt, hisense.es e
   hisensehvac.com): continua a ser `fonte: "site"`. Ver
   [references/brands.md](references/brands.md).
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

3. Pesquisa pela ref em revendedores com pesquisa por referência —
   `node scripts/imagens/procurar-ref.mjs --brand {marca}` corre todos os
   grupos ainda sem candidatas (acessórios incluídos) em klima.pt e
   kaut-hisense.de (lista `DEALERS` no script; acrescentar lojas quando
   provarem valer a pena) e junta o que encontra ao `candidatas.json` com
   `"fonte": "web"` e a página como `origemUrl`. Só packshots do fabricante
   que o revendedor republica — nunca fotos próprias da loja ou de ambiente.
   Para o que sobra, pesquisa web à mão (brochuras da marca alojadas por
   distribuidores, etc.). Google/DuckDuckGo/Bing recusam ou baralham
   pesquisas por ref feitas por script; as pesquisas dos sites das lojas não.

Cada uso de fallback fica listado no PR.

## 4. Manifesto e upload

`product-scaffold/imagens/{marca}/candidatas.json`:

```json
{ "hisense-air-master": [
    { "ficheiro": "hisense-air-master/01.jpg", "fonte": "site", "origemUrl": "https://hisense.pt/…", "cor": "branco" } ] }
```

`fonte` ∈ `site` | `megaclima` | `web` | `pdf` | `upload` (o `recorte` é gerado).
`"aviso"` (opcional) diz porque é que a foto merece dúvida — UE genérica da
gama, série irmã, miniatura do PDF, marca de água de revendedor, modelo
anterior, imagem pequena (< 400 px). Aparece na miniatura na revisão e, quando
todas as candidatas de um grupo têm aviso, o grupo leva a etiqueta "Fotos a
rever" (filtro "Só fotos a rever"). Pôr aviso em tudo o que não é um packshot
confirmado da ref.

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
node scripts/imagens/candidatas.mjs --brand {marca} --recortar  # + recortes como "recorte"
```

`--recortar` usa a API do Photoroom quando `PHOTOROOM_API_KEY` está no `.env`
da raiz (1 chamada por ficheiro único que ainda não seja PNG transparente;
respeita o 429 do plano), senão `uvx rembg` local. Cache por hash em
`product-scaffold/.rembg-cache`, por isso repetir não volta a chamar a API.

Idempotente por hash: correr outra vez só acrescenta fotos novas.

Para limpar à mão as candidatas não usadas de uma marca (a aprovação da run já
o faz para os grupos da run), com `CONVEX_DEPLOYMENT` exportado:
`npx convex run imagens:limparCandidatas '{"secret":"…","marca":"hisense"}'`
(opcional `"fonte":"pdf"`). Mantém os ficheiros escolhidos num grupo ou em
produtos vivos.

## 5. Escolha do agente (capa + fotos)

Depois do upload com `--recortar`, o agente escolhe as fotos de cada grupo
olhando para elas, não por regra:

```bash
node scripts/imagens/folhas.mjs --brand {marca}           # folhas/{grupo}.png + folhas/indice.json
# ver cada folha, escrever product-scaffold/imagens/{marca}/escolhas.json
node scripts/imagens/escolhas.mjs --brand {marca} --dry-run
node scripts/imagens/escolhas.mjs --brand {marca}         # imagens.gravarEscolhasAgente
```

Cada folha numera as candidatas: cada foto seguida do seu recorte (azul),
avisos a âmbar. `escolhas.json` = `{ "grupoModelo": [n, …] }`, o primeiro
número é a capa. Com muitos grupos, dividir as folhas por subagentes (cada um
escreve a sua parte, junta-se no fim) e rever uma amostra.

Regras:

- **Só recortes.** Uma foto só entra sem recorte quando já é PNG transparente
  (não tem recorte próprio) ou o recorte está estragado (corta o produto,
  deixa fundo, apaga partes). O script avisa quando a escolha não é recorte.
- **O produto exato.** Descartar série irmã, modelo anterior, UE genérica de
  outra gama, fotos de ambiente, esquemas, logótipos, marca de água que o
  recorte não tirou, e imagens < 400 px quando há melhor.
- **Uma foto por vista, sem quase-duplicados.** Frente, ¾, e cada peça do
  produto (UI, UE, comando se vier na caixa) e cada cor do grupo. Normalmente
  2 a 4; 1 chega para acessórios.
- **A capa** é a peça pela qual o produto é conhecido, de frente, grande e
  nítida: a UI num conjunto (split, multi), a UE num grupo de UE, a própria
  máquina num monobloco/chiller/AQS, o objeto num acessório ou comando.
- **Conjunto com UE só genérica:** a UE genérica da mesma gama pode entrar
  depois das fotos da UI (o conjunto inclui-a), nunca como capa.
- **Tudo com aviso:** escolher o melhor mesmo assim (fica "Fotos a rever");
  sem nada aproveitável, deixar a lista vazia (`[]`): o grupo fica sem
  escolha e o staff vê-o em "Sem imagens".
- Nunca toca em grupos que uma pessoa já guardou (`folhas.mjs` salta-os e a
  mutation também); correr outra vez substitui só as escolhas do agente.

## 6. Cobertura (vai para o PR)

`cobertura.md`: contagens por fonte por grupo, grupos sem candidatas, grupos
com cores em falta, UE só com fotos de interior. Barra mínima: todos os grupos
de equipamento com pelo menos uma candidata de `site`, `megaclima` ou `web`,
ou uma razão escrita.

## Notas por marca

Ver [references/brands.md](references/brands.md).

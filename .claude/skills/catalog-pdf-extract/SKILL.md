---
name: catalog-pdf-extract
description: >
  Turns a brand price-table PDF (Hisense, Mitsubishi, Daikin, Midea, Nipon…)
  into a staged import run in Convex: map the PDF into sections, extract
  table rows section by section, group them into product pages, validate
  against the spec registry and push the staged SKUs plus page renders for
  review in the admin app. Use when the user provides a brand price PDF and
  asks to extract, reload, re-extract or stage a brand's catalog. Photos and
  the final cutover are other skills (catalog-brand-import).
---

# Catalog PDF extract (v4)

Um **import run** por tabela de preços: o PDF entra, sai um JSON de
**staged SKUs** (`{marca}-{ano}-staged.json`, contrato em
`convex/lib/stagedSku.ts`) carregado no Convex (#40) e revisto pelo staff em
`/importacoes/{id}` (#41). Aprovar promove para o catálogo; refs ausentes ficam
`descontinuado`. Ler primeiro
[references/standards.md](references/standards.md) (taxonomia, registo de
specs, convenção de nomes) e `CONTEXT.md` (secção *Catalog import*).

```
mapa.py → (corrigir mapa.json à mão) → extrair.py → agrupar.py → validar.py → paginas.py → enviar.py → revisão → aprovar
```

Os scripts vivem em `scripts/` (relativo a esta pasta); Python 3 + PyMuPDF
(`pip install pymupdf`), sem Node. Pasta de trabalho por marca:
`product-scaffold/pdf-extract/{marca}/` (gitignored) com o PDF lá dentro.
Antes de começar: `pnpm registry:json` (exporta o registo de specs para
`product-scaffold/spec-registry.json`, que `validar.py` lê).

## Inputs

- **PDF** da tabela de preços, copiado para
  `product-scaffold/pdf-extract/{marca}/{marca}-tabela-precos-{ano}.pdf`.
- **marca** (slug minúsculo) e **ano**; `tabelaOrigem` = `{marca}-{ano}`.
- `.env` da raiz com `VITE_CONVEX_URL` e `IMPORT_SECRET` (só para `enviar.py`).

## 1. Mapear o PDF

```bash
cd product-scaffold/pdf-extract/hisense
S=../../../.claude/skills/catalog-pdf-extract/scripts
python3 $S/mapa.py hisense-tabela-precos-2026.pdf --marca hisense --ano 2026   # → mapa.json
```

Lê o outline (Mitsubishi), as páginas de índice (Daikin, Hisense, Nipon) ou o
cabeçalho de cada página (Midea) e propõe **secções**: título → páginas →
`familia/segmento/sistema/tipoUnidade/componente` + `gama`. Cada página tem de
pertencer a pelo menos uma secção (`tipo: ignorar` para capa, índice,
marketing, condições); várias secções podem partilhar uma página — as linhas
vão para a secção cujo título está impresso acima delas nessa página, nunca
herdam a secção anterior.

**Corrigir `mapa.json` à mão antes de extrair.** O que costuma precisar:

- `familia`/`componente` em branco (`?` na listagem) e classificações
  erradas (ex.: uma secção VRF que foi para `bombas-de-calor`).
- `gama`: é o que o site mostra e entra no `grupoModelo` determinístico
  (`{marca}-{gama-slug}[-{componente}]`); por omissão é o título do índice.
  Manter as gamas que o catálogo já usa para as fotos sobreviverem
  (ex.: Hisense `Cassete 1x1` + subcabeçalho `Turbo Inverter` →
  `hisense-cassete-1x1-turbo-inverter`).
- `tipo: compatibilidade` nas matrizes UE × UI; `semPreco: true` nas tabelas
  "preços sob consulta" (também é detetado pela nota, mas ser explícito ajuda).
- Secções que o PDF imprime numa só tabela e o índice lista como duas: fundir
  (o script já funde subgamas de cor e títulos partilhados).
- Decisões de modelo que só o agente pode tomar: um "Kit de conexão UTA" com
  kW é `acessorios-e-controlo` ou `ventilacao`? Registar no PR.

`python3 $S/mapa.py --validar mapa.json` confirma o ficheiro editado.

## 2. Extrair, secção a secção

```bash
python3 $S/extrair.py hisense-tabela-precos-2026.pdf --seccao cassete-1x1   # uma
python3 $S/extrair.py hisense-tabela-precos-2026.pdf --todas                # todas → linhas-<id>.json
```

Palavras com coordenadas → bandas → linhas de tabela (banda com ref + bandas
coladas: preço que passou para a linha seguinte, kW debaixo da UE, descrição em
várias linhas). Campos por forma (EAN, preço, classe `A++/A+`, refrigerante,
tensão → `alimentacao`, tubagem, dimensões, BTU, `2×1` → `unidades-max`,
intervalos `(1,0-4,0)` → `*-min/*-max`) e pela coluna do cabeçalho
(`Arrefecimento`/`Aquecimento`/`depósito`/`Caudal`/`CV`/`Descrição`), cada um
com confiança (1.0 forma, 0.8 coluna, 0.6 posição, 0.5 heurística).
Subcabeçalhos entre linhas dão contexto (`BRANCO` → `cor`, `Baixa Pressão` →
`pressao-estatica`, `Turbo Inverter` → série); notas `* WIFI opcional` e
`* Preços sob consulta` aplicam-se à tabela. Refs `A / B` são conjuntos
(`ref: "A/B"`, como o catálogo já usa); matrizes dão `compativelCom` na UE e
conjuntos nas células com preço.

Ler o resumo: secções com **0 linhas** ou com **"sem preço"** fora das tabelas
sob consulta são sinal de mapa errado (título não encontrado, página a menos).
Abrir o `linhas-<id>.json` e conferir 2–3 linhas contra a página.

## 3. Agrupar

```bash
python3 $S/agrupar.py --marca hisense --ano 2026            # → hisense-2026-staged.json
```

Componente por linha (dica da tabela, refs do conjunto `UI/UE`, painel num
conjunto `UI/painel`, acessório quando não há capacidade), grupos por
**secção + componente + série do subcabeçalho** (nunca um produto por
capacidade; UI e UE da mesma série são grupos separados), `grupoModelo`
determinístico, atributos ordenados (eixos `cor`/`unidades-max`/
`pressao-estatica`/`alimentacao` primeiro, specs pela ordem do registo), refs
repetidas fundidas (páginas juntas; `cor` cai quando difere; preços diferentes
→ aviso), UI/UE avulsas herdam os kW do conjunto impresso ao lado, depósitos
listados como acessórios passam a `aqs/deposito`. Nomes: `nomeGrupo` =
`{tipo} {gama}` (+ ` | Unidade Interior/Exterior`), `nome` = nomeGrupo +
capacidade (+ `(até N UI)`, `trifásico` quando o grupo varia por fase).

## 4. Validar

```bash
python3 $S/validar.py hisense-2026-staged.json --csv       # reescreve o JSON com avisos (+ CSV v3)
```

Nunca bloqueia: escreve `avisos` em cada SKU e imprime o resumo por tipo.

- **`erro:`** = o Convex rejeitaria a linha (tipo/enum/padrão do registo,
  chave duplicada, taxonomia inválida, `pvpCents`/`pdfPaginas` mal formados).
  Corrigir **no mapa ou no script** e voltar a correr a cadeia — nunca editar
  o JSON à mão (a próxima extração apagava a correção). Objetivo: **0 erros**.
- Restantes avisos obrigam a abrir o grupo na revisão: chave desconhecida ou
  obrigatória em falta, ref duplicada, variantes com os mesmos atributos,
  série partida em grupos de 1, capacidade/cor no `nomeGrupo`, preço em falta
  ou sob consulta. Objetivo: avisos **só onde o PDF é mesmo ambíguo** (preços
  sob consulta, classe que a tabela não imprime, a mesma ref com dois preços,
  duas linhas iguais). Cada tipo de aviso que sobra explica-se no PR.
- `--csv` grava o export opcional `{marca}-{ano}-produtos.csv` (folhas de
  cálculo, `pdf_images.py` do fallback de packshots).

## 5. Páginas e envio

```bash
python3 $S/paginas.py hisense-tabela-precos-2026.pdf --tabela-origem hisense-2026 \
  --staged hisense-2026-staged.json                        # → paginas/hisense-2026-p<N>.png + .pdf
python3 $S/enviar.py hisense-2026-staged.json --pdf hisense-tabela-precos-2026.pdf --dry-run
python3 $S/enviar.py hisense-2026-staged.json --pdf hisense-tabela-precos-2026.pdf
```

`paginas.py` renderiza só as páginas citadas em `pdfPaginas` (PNG a 110 dpi
para a revisão, PDF de uma página para a ficha do catálogo). `enviar.py` faz
upload do PDF, cria a run (`criarImportacao` substitui uma run aberta da mesma
tabela), carrega os SKUs em lotes de 100 (`carregarSkus` revalida no registo e
faz o diff com o catálogo), regista as páginas e fecha com
`concluirCarregamento`, imprimindo `/importacoes/{id}`. Recusa enviar com
avisos `erro:` (salvo `--forcar`); SKUs rejeitados ficam listados e a run em
`a-extrair` para corrigir e reenviar.

**Perguntar ao utilizador antes de enviar** se ainda não aprovou a extração
(é uma escrita na base de dados, embora em staging).

## 6. Revisão e aprovação

Na app de admin, `/importacoes/{id}`: cada grupo com aviso ou preço alterado
deve ser aberto (`marcarGrupoRevisto`); com grupos por rever o botão passa a
"Aprovar mesmo assim" (`aprovarImportacao` com `forcar`). O agente entrega o
link e o resumo (contagens por família, tipos de aviso e a justificação de
cada um). A aprovação é do staff. O passo de imagens (## 7) corre ANTES de entregar o
link da revisão.

## 7. Imagens

Correr a skill `catalog-brand-images` antes de entregar o link da revisão:
junta as candidatas e grava a escolha do agente por grupo (recortes, capa
primeiro), que conta na aprovação; o staff só muda o que quiser.

## QA final (obrigatório no PR da marca)

- `mapa.json` sem avisos de título e `--validar` limpo; todas as páginas
  cobertas.
- **Contagens por família** vs índice do PDF (o resumo do `agrupar.py`).
- **3+ âncoras ref/preço** conferidas à mão no PDF (conjunto, UI avulsa,
  acessório) e **amostra de 10 linhas** revista (atributos, nomes, grupos).
- `validar.py`: 0 erros; lista dos tipos de aviso que ficam, cada um
  justificado; nenhum `nomeGrupo` com kW/BTU/L ou cor; 0 séries partidas.
- Grupos determinísticos batem com os slugs do catálogo atual sempre que a
  gama é a mesma (as fotos dependem disso).
- Screenshot da página de revisão a 390 px e 1440 px.
- `cobertura.md` (skill `catalog-brand-images`) no PR.

## Testes

`pnpm test:pdf` corre os testes (pytest) sobre páginas de fixture geradas com
PyMuPDF: emparelhamento ref/preço, refs combinadas, colunas do cabeçalho,
matrizes de compatibilidade, agrupamento, registo. `tests/test_hisense.py`
corre a cadeia inteira na tabela Hisense 2026 quando o PDF e o
`spec-registry.json` existem localmente.

## Notas por marca

- **Hisense 2026**: índice em duas colunas com números de página às vezes
  errados (o mapa confirma cada título na página); `UI / UE` nos conjuntos
  1×1, `UI / painel` nas cassetes multi; `** Modelo trifásico` só vale na
  página onde está (U4 = monofásico, U6 = trifásico ficam sem `alimentacao`
  fora dela); a mesma ref `HC25YC0U` tem preço de conjunto (p14) e de UI multi
  (p20) — fica o primeiro com aviso; tabelas VRF inteiras "sob consulta"
  (`pvpCents: 0` + aviso); "Kit de conexão UTA" traz kW/CV e fica em
  acessórios (o registo de acessórios aceita `frio-kw`/`calor-kw`/`cv`/
  `refrigerante`/`alimentacao`); "Unidades interiores 100% ar novo" (AVA-*)
  são UI VRF com kW → `ar-condicionado/vrf/uta/unidade-interior`; monoblocos
  (Hi-Therma II M, R32 Monobloco) e chillers imprimem "UE" mas o `agrupar.py`
  fá-los `conjunto` (a UE é o produto); `(U.I.)` na coluna da tubagem não é
  categoria; p20 "Multi-Inverter Max Comfort" são UI (refs sem `G`, iguais às
  do conjunto p14 → aviso de preços diferentes, genuíno).

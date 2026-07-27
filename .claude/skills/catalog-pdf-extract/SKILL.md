---
name: catalog-pdf-extract
description: >
  Extracts products from a brand price-table PDF into a schema v3 CSV and a
  flat ZIP of the referenced PDF pages, with an HTML review page the user
  approves before anything moves forward. Use when the user provides a brand
  price PDF (Hisense, Mitsubishi, Daikin, Midea, Nipon…) and asks to analyse
  it, extract/build the product CSV, regenerate the `*-paginas-pdf.zip`, or
  review the extracted product list. Importing into Convex is a separate
  skill (catalog-brand-import).
---

# Catalog PDF extract

Turns a brand price-table PDF into the two import artifacts:

1. **CSV schema v3** (18 columns) — see [references/standards.md](references/standards.md)
   for the full taxonomy, grouping model, naming rules and extraction rules.
   **Read it before extracting anything.**
2. **`{marca}-{ano}-paginas-pdf.zip`** — flat ZIP of the one-page PDFs
   referenced by the CSV `pdfPaginas` column.

The CSV is only final after the user approves it on the **review page**
(step 4). Never hand a CSV to the import pipeline without that approval.

## Inputs necessários

- **PDF** da tabela de preços da marca (anexado na página principal, secção
  *Tabelas de preços dos fornecedores*).
- **marca** (slug minúsculo, ex.: `mitsubishi`) e **ano** da tabela (ex.: `2026`).
- Se o CSV v3 já existir (só regenerar o ZIP), salta para o passo 6.

Working dir: no sandbox usar `/data/{marca}/` (re-descarregar dos anexos do
Notion se o sandbox tiver sido reposto — os ficheiros desaparecem entre
sessões); dentro do repo selective-platform usar
`product-scaffold/pdf-extract/{marca}/` (gitignored).

## Convenção de nomes

- CSV: `{marca}-{ano}-produtos.csv`
- Página individual: `{marca}-{ano}-p{N}.pdf` (ex.: `mitsubishi-2026-p9.pdf`)
- ZIP final: `{marca}-{ano}-paginas-pdf.zip` — **flat**, sem pastas dentro do zip.

## Processo passo a passo

### 1. Mapear o PDF

Antes de extrair linhas, mapear cada secção/página para
`familia`+`segmento`+`sistema`+`tipoUnidade` usando os cabeçalhos das páginas;
nunca herdar a classificação da secção anterior sem confirmar o cabeçalho.
Registar o mapa (página → classificação) para o QA final.

### 2. Extrair linhas → agrupar → emitir CSV

Seguir as *Regras de extração*, a secção *Atributos* e o *Schema CSV v3* dos
standards. A regra que mais falha (aconteceu no Hisense) é o agrupamento de
unidades vendidas à parte:

- **Nunca emitir 1 produto por capacidade.** Tabelas que listam UI ou UE
  avulsas — uma linha por capacidade (ex.: cassetes `AUC105UR4RKC8`,
  `AUC125UR4RKC8`, `AUC140UR4RKC8`, `AUC175UR4RKC8`) — são **um** `grupoModelo`
  com N variantes, não N grupos de 1.
- Teste mecânico: substituir dígitos da ref por `#` dá o esqueleto da série;
  mesmo esqueleto + mesma marca/família/`componente` → mesmo grupo.
- UI e UE da mesma série são grupos separados (um por `componente`), cada um
  com as suas variantes; conjuntos 1×1 são um terceiro grupo (`conjunto`).
- Grupo de 1 é o último recurso (produto realmente isolado) — os atributos
  dele são só specs (aparecem como chips na página de produto).
- **Tudo é atributo** (não há colunas fixas de specs): eixos de variação
  primeiro (`cor=`, `alimentacao=`…), specs depois. **Procurar sempre** as
  specs importantes — `frio-kw`, `calor-kw`, `btu`, `classe-energetica`
  (valor `frio/calor`, ex. `A+++/A++`; `-` se um lado faltar), `seer`, `scop`,
  `refrigerante`, `wifi` — e o preço; se o PDF não as der, **omitir** (nunca
  inventar). **Não** usar `classe-frio` / `classe-calor` separados. Chaves que
  variam no grupo viram
  colunas da tabela de modelos no site; chaves constantes viram chips de
  specs — por isso specs constantes ficam nos atributos, não se removem.
- Duas linhas do mesmo grupo nunca podem ter atributos exatamente iguais
  (seriam indistinguíveis na tabela) — se acontecer, falta um eixo.

Emparelhar ref↔preço por proximidade no layout; conflitos resolvem-se pela
menor distância. Preencher `pdfPaginas` em todas as linhas.

### 2b. Limpar títulos, gamas e refs (`name_fix.py`)

O site mostra `nomeGrupo` como título (cartão e página de produto) e imprime
`gama` ao lado, e a `ref` entra no URL — o extractor tende a deixar lá restos da
tabela. Correr sempre este passo no fim do post-pass da marca (é chamado pelo
`fix_warnings.py` da marca via `fix_all(rows, pdf)`), ou isolado:

```bash
python3 scripts/name_fix.py .../{marca}-{ano}-produtos.csv --pdf .../tabela.pdf
python3 scripts/name_fix.py .../{marca}-{ano}-produtos.csv --pdf .../tabela.pdf --apply
```

O que apanha (na Daikin 2026: 210 títulos, 5 refs, 6 SKUs, 36 famílias):

- **Notas de pé de página** no título (`3) Sensor…`, `Painel … (1)`) e frases
  cortadas a meio (`pelo que deverá adicionar o respetivo preço`, `Tecnologia de`).
- **Cabeçalhos de secção** do PDF (`NOVIDADE: gama Multi A8`, `OPÇÕES | VENTILAÇÃO`,
  `GAMA MULTI | SENSIRA`) e **specs** que pertencem aos atributos (`R-32`, `65ºC`,
  `24VDC/20W`, `Classes 4-6-8`) — nem no `nomeGrupo` nem na `gama`.
- **Grupo nomeado por uma variante** (`… ERGA04EV` num grupo de 3 refs): o
  título leva o código de série, o modelo concreto fica no `nome` da variante.
  Grupo de 1 mantém o código do modelo (é a identidade do produto).
- **Cor no título** → move para `cor=` (a convenção manda-a para atributo).
- **Refs com lixo**: notas dentro da ref (`BRP069C81(4`) e cores agrupadas
  (`BRC1HHD(K/S/W)7` → `BRC1HHDK7`). Refs com barra **fora** de parênteses não se
  partem (`SB.EKSH26P/2DB` vs `/3DB` são SKUs diferentes).
- **SKUs duplicados** (a mesma ref listada em várias páginas) e **fantasma**
  (colunas de spec lidas como ref, ex.: `24VDC/20W` a 320 €).
- **Acessórios arquivados como equipamento**: `componente=conjunto` sem qualquer
  potência não é uma máquina → `acessorios-e-controlo`/`acessorio`.

Ordem das fontes para reconstruir um título: o que sobra do título atual → a
descrição impressa ao lado da ref no PDF → a `descricao` da linha → o rótulo do
tipo/família (e só se esse rótulo for vago, a `gama`). No fim garante que dois
grupos não ficam com o mesmo título (senão são indistinguíveis no catálogo).

### 3. Gerar a página de revisão

```bash
python3 scripts/review.py /data/{marca}/{marca}-{ano}-produtos.csv \
  -o /data/{marca}/review-{marca}-{ano}.html
```

(o `scripts/` é relativo à pasta deste skill)

O script valida o CSV (obrigatórios, enums, tipos, refs duplicadas, coerência
de grupo, atributos duplicados dentro do grupo, **séries partidas em grupos
de 1**, e a **convenção de nomes**: `nomeGrupo` sem capacidade kW/BTU nem
cor; grupos que variam por capacidade têm de ter sufixo kW no `nome` da
variante) e gera um HTML self-contained estilo portal admin: um cartão por
`grupoModelo` com badges de taxonomia e a mesma tabela dinâmica do site —
uma coluna por chave que varia no grupo, chips para as specs constantes —
com filtros por texto/família/avisos.

**Ver PDF:** o script deteta o PDF ao lado do CSV (ou `--pdf caminho`) e cada
grupo ganha um botão *Ver PDF* + números de página clicáveis que abrem essa
página num painel lateral.

**Fotos (picker):** se `product-scaffold/mapping.json` já tiver a marca, cada
grupo mostra também as fotos do crawl com escolha Original / Cutout / Excluir
(mesma semântica do `scripts/imagens/preview.mjs`) e o filtro *só sem fotos*.
Antes de pedir aprovação: grupos com várias `cor=` têm de ter packshot de
**cada** cor (ver regra *All colours* na skill `catalog-brand-import`) — se
faltar, scrapear e rematchar, não avançar só com uma cor.
Para marcas ainda não importadas, gerar os targets a partir do próprio CSV:

```bash
node scripts/imagens/targets-from-csv.mjs product-scaffold/pdf-extract/{marca}/{csv}
pnpm imagens:match
node scripts/imagens/preview.mjs --brand {marca} --rembg-all   # cutouts
```

**Fallback: packshots tirados do próprio PDF.** Para os grupos que o crawl não
cobre, `pdf_images.py` vai às páginas de `pdfPaginas` e extrai as miniaturas
impressas na tabela:

```bash
python3 scripts/pdf_images.py product-scaffold/pdf-extract/{marca}/{csv} \
  --only-missing --skip-accessories --max-per-group 4
pnpm imagens:match      # liga product-scaffold/pdf-images/<marca>/<grupo>/ (fonte "pdf")
```

Descarta automaticamente banners de marketing, diagramas e fotos de ambiente,
e só aceita a imagem se conseguir ancorá-la às linhas do grupo na página (ou se
a página tiver uma única foto) — senão o grupo fica sem foto, que é melhor do
que ficar com a foto do produto ao lado. Unidades exteriores ficam de fora por
omissão (`--include-ue` força), porque as tabelas imprimem a UI do conjunto ao
lado das linhas da UE. São miniaturas (~100-200 px), portanto: **último
recurso**, depois de esgotar o crawl da marca e as fontes secundárias.

Para gravar as escolhas em `product-scaffold/image-choice.json` a página tem de
ser servida pelo próprio script (`--serve` faz merge, não apaga outras marcas):

```bash
python3 scripts/review.py .../{marca}-{ano}-produtos.csv \
  -o product-scaffold/review-{marca}-{ano}.html --serve   # http://127.0.0.1:3861
```

Sem `--serve`, *Guardar escolha* descarrega o JSON para mover à mão.
`--no-images` gera só a revisão do CSV.

Corrigir primeiro tudo o que o script apontar (stdout + banners no HTML);
o objetivo é **zero avisos** ou justificação explícita para cada um.
Em particular, nunca avançar com `nomeGrupo` a terminar em `… kW` / `… BTU`
(o título do site usa esse campo).

### 4. Verificação final, produto a produto (obrigatória)

Antes de pôr a página à frente do utilizador, passar o CSV pelo `verify.py`.
Faz três passagens e escreve `verificacao.md` + `verificacao.json` ao lado do
CSV:

```bash
# 1º as correções da marca (fix_warnings.py e afins), só depois o verify —
#    o post-pass da marca reconstrói atributos e apagaria o que o verify escreveu.
python3 scripts/verify.py product-scaffold/pdf-extract/{marca}/{marca}-{ano}-produtos.csv --apply
```

1. **Schema** — reaproveita a validação do `review.py` (colunas, enums,
   atributos, coerência de grupo, séries partidas, convenção de nomes).
2. **Valores em falta** — para cada SKU sem os specs esperados para a sua
   `familia`+`componente` (ou sem preço), volta à(s) página(s) do PDF, encontra
   a linha da ref e propõe o valor com a linha como prova. `--apply` escreve só
   as de confiança alta (par `2,0/ 2,5` = kW frio/calor; `8,75/ 5,15`, com duas
   casas, é SEER/SCOP e é ignorado) e ajusta o sufixo kW do `nome` das variantes
   quando o preenchimento torna o grupo variável por capacidade. Correr **duas
   ou três vezes** até dar `0 aplicadas`.
3. **Fotos** — cruza com `mapping.json`: lista os grupos não-acessório sem
   imagem e os que só têm foto vinda do PDF. Para cada um sem foto: crawl da
   marca (incl. fontes secundárias) → `pdf_images.py --only <grupo> --loose` →
   `product-scaffold/manual/<grupo>/`.

O que sobra no relatório é para tratar **um a um**: cada aviso residual ou é
corrigido no post-pass da marca (é lá que vivem as correções, não em edições
soltas ao CSV) ou é justificado ao utilizador. Sugestões de confiança
`media`/`baixa` são para ler e decidir, não para aplicar às cegas.

### 5. Ciclo de revisão com o utilizador (obrigatório)

1. Abrir/servir o HTML e entregar o caminho (ou link) ao utilizador.
2. O utilizador comenta (grupos mal partidos, nomes, gamas, famílias erradas,
   preços suspeitos…).
3. Aplicar o feedback **no CSV** (nunca só no HTML), regenerar a página
   (passo 3) e revalidar (passo 4) e repetir até o utilizador aprovar explicitamente.
4. Só depois da aprovação seguir para o ZIP (passo 6) e para o import
   (skill `catalog-brand-import`).

### 6. Extrair páginas únicas do CSV

Atenção: a coluna pode ter vários números separados por vírgula (e o campo vem
entre aspas); expandir intervalos com hífen se existirem.

```bash
python3 -c "
import csv
pages=set()
for row in csv.DictReader(open('/data/{marca}/{csv}')):
    for part in (row['pdfPaginas'] or '').replace(';',',').split(','):
        part=part.strip()
        if '-' in part:
            a,b=part.split('-'); pages.update(range(int(a),int(b)+1))
        elif part:
            pages.add(int(part))
print(' '.join(map(str,sorted(pages))))"
```

### 7. Separar e comprimir cada página (Ghostscript, perfil `/ebook`)

```bash
mkdir -p pages
for p in <lista de páginas>; do
  pdfseparate -f $p -l $p SOURCE.pdf /tmp/page.pdf
  gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dPDFSETTINGS=/ebook \
     -dNOPAUSE -dQUIET -dBATCH -o pages/{marca}-{ano}-p$p.pdf /tmp/page.pdf
done
```

**QA:** o número de PDFs em `pages/` tem de ser igual ao número de páginas
únicas do passo 6.

### 8. Criar o ZIP flat

```bash
cd pages && zip -q ../{marca}-{ano}-paginas-pdf.zip {marca}-{ano}-p*.pdf
```

### 9. Anexar / entregar

Anexar o ZIP à página **Produtos {Marca}**, substituindo o ZIP do PDF completo
se existir:

- Secção: `## Páginas do PDF (ZIP)` com uma linha a indicar quantas páginas
  contém (ex.: *77 páginas individuais comprimidas, nomeadas
  `mitsubishi-2026-p<N>.pdf` — apenas as páginas usadas pelos produtos do CSV*).
- Atualizar o callout da página para referir "ZIP com as páginas individuais
  do PDF referenciadas no CSV (coluna `pdfPaginas`)".

## QA final

- `verify.py` corrido até estabilizar: schema sem avisos (ou justificados),
  sem sugestões de confiança alta por aplicar, e a lista de grupos sem foto
  resolvida ou aceite pelo utilizador.
- Página de revisão aprovada pelo utilizador; avisos do `review.py` a zero
  (ou justificados um a um).
- `name_fix.py --apply` corrido até dar `0 títulos reescritos`, e nenhum
  `nomeGrupo` com kW/BTU, cor, nota de pé de página ou ref de variante.
- Contagens por família plausíveis vs índice do PDF; 3+ âncoras ref/preço
  verificadas no PDF; amostra de 10 linhas revista à mão.
- Contagem de ficheiros dentro do ZIP = páginas únicas no CSV.
- Cada nome de ficheiro corresponde diretamente aos valores de `pdfPaginas` —
  o backend pode mapear `pdfPaginas` → `{marca}-{ano}-p{N}.pdf` sem
  transformações.
- Tamanho do ZIP razoável (a compressão `/ebook` reduz bastante; ex.:
  Mitsubishi 77 páginas ≈ 9 MB).

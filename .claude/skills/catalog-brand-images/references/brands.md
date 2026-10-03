# Onde estão as páginas das séries, por marca

Notas curtas para o passo 2 do `SKILL.md`. Os `scripts/imagens/crawl-*.mjs`
sabem listar estas páginas; aqui fica só o que ajuda a decidir onde procurar.
Config de sementes: `scripts/imagens/crawl.config.json`.

## Hisense

- Site: hisense.pt (WordPress). O site nunca chega a `networkidle`: usar
  `domcontentloaded`. Os URLs de imagem têm sufixo de tamanho
  (`-1200x800.jpg`); tirar o sufixo para obter o original.
- O catálogo tem grupos `*-ui` e `*-ue` separados. As páginas de produto mural
  quase só mostram galerias de interior. A Comfort inclui
  `COMFORT-UNIDAD-EXTERIOR-.jpg`, e as páginas multi e as fotos
  `hisense_exterior_*` da Megaclima são packshots de exterior verdadeiros.
  Uma UE não vai buscar fotos à página da série da UI: procurar nestas fontes.
- UE das linhas conduta/coluna (`AUW*`): packshots de exterior das multi, não
  as fotos `hisense-conduta-*` (que são de interior).
- A página de categoria `/ar-condicionado-profissional/cassete/` lista a gama
  comercial inteira com `alt` = "Tipo REF" e ficheiros com as refs
  (`AUW105U4RA4-4AMW81U4RAA…png`): é a forma mais rápida de ligar packshot a
  ref; o `manifest.json` guarda o `alt`.
- hisense.pt só tem splits residenciais/comerciais. As outras gamas estão em
  dois sites oficiais, ambos `fonte: "site"`:
  - **hisense.es** (Hisense Iberia, mesma tabela): gama comercial completa com
    as refs atuais (`turbo-inverter/…`, `super-inverter/…`, páginas
    `exterior-auw*` só de UE), Multifunción II (`multifuncion/afw-*`, `afm/afs`
    = hydrobox), Hi-Water (`heat-pump/…`).
    `node scripts/imagens/crawl-hisense-es-curl.mjs` (curl, sitemap; muitos
    URLs do sitemap dão 404 — é normal; ~15 s/página).
  - **hisensehvac.com** (Hisense HVAC global): VRF (Hi-Smart/Hi-FLEXi, UI VRF
    por tipo), Hi-Therma (ATW), chillers, recuperadores.
    `node scripts/imagens/crawl-hisense-hvac-curl.mjs` — galeria `.scrolBox`,
    packshots a 710×400. Um `.png` pode ser BMP (Hi-Smart C+): converter.
- Megaclima: `node scripts/imagens/crawl-megaclima-curl.mjs --brand hisense`.
- Acessórios: `procurar-ref.mjs` encontra os residenciais/1x1 em klima.pt e
  os de VRF (comandos, gateways, sensores, caixas HCHS/HCHM) em
  kaut-hisense.de (distribuidor Hisense DE; as caixas `…XC` só existem lá
  como `…XA`, mesma caixa). hisensehvac.com tem os comandos VRF em
  `/control/index.aspx?nodeid=90|91|92|419` (cartões com o modelo no texto).
- Sem foto em lado nenhum (2026): Hi-Smart I centrífugo (brochura Hisense
  em aunadistribucion.com, `fonte: "web"`), depósito HDHWT (revendedor),
  derivadores HFQ, cabos/filtros/bombas de condensados VRF (ninguém os
  fotografa; acae.es lista-os mas sem imagem).

## Mitsubishi Electric

- Site: mitsubishielectric.pt (Liferay). O TLS do Node costuma falhar com
  `UNABLE_TO_VERIFY_LEAF_SIGNATURE`; para listar/descarregar usar
  `node scripts/imagens/crawl-mitsubishi-curl.mjs` (curl). Se abrires o site
  em Playwright, o mesmo problema pode surgir nos downloads.
- Os URLs de documentos acabam em `/<uuid>?t=…` depois da extensão; cortar
  isso antes de descarregar (o crawler curl já o faz).
- Há muitas páginas de série (`/msz-ln`, `/pead-m`, …). Mr.Slim ZM/SZ e
  acessórios muitas vezes não têm fotos próprias: cair para a Megaclima
  (`--brand mitsubishi`, boa para mural e cassete).

## Midea

- O distribuidor exclusivo em PT é a SGT: https://www.sgtmidea.com/ (não
  midea.com/pt). Galerias WooCommerce + `og:image`;
  `node scripts/imagens/crawl-midea-curl.mjs` extrai-as.
- Séries sem foto própria costumam ter só um substituto fraco (porta-split e
  h-pack → Lite; sistemas twin → cassete compacta): registar como fallback
  no PR.
- Se ficarem lacunas na SGT: `node scripts/imagens/crawl-megaclima-curl.mjs --brand midea`.

## Daikin

- Site: https://www.daikin.pt/. Páginas de série em
  `/pt_pt/products/product.html/<SERIE>.html`, mais páginas de marketing
  residencial. Os packshots vêm do DAM `my.daikin.eu`, muitas vezes embebidos
  em JSON do AEM (`content/dam/.../packshots/...`) e não como `<img src>`.
- Cores: as páginas por cor (`ftxj-aw` / `ftxj-as` / `ftxj-ab`, …) e as
  sub-gamas de design (Stylish Seiren DG/DY/DP) são páginas separadas: juntar
  as fotos de todas no mesmo grupo. Modelos irmãos que partilham a carcaça
  (CTXA multi = Stylish FTXA) reutilizam as galerias da série irmã, listadas
  outra vez no grupo.
- As páginas de série não estão no sitemap e o nome não se adivinha pelo
  `gama`: o slug é o prefixo da ref + sufixo da série (`FTXM-A`, `RXJ-A9`,
  `EHBX-E6V`, `EWAT-CZP`, `FWZ-AT`, `RXYSQ-TV9`); uma série que não existe
  devolve 404 com título "404 | Daikin". Sondar palpites tirados das refs dos
  grupos (2026: ~130 de 360 existiam) e ler as páginas
  `particular/products-and-advice/...` e `product-group/...` do sitemap, que
  ligam a mais séries. Uma página de série lista também comandos, fotos de
  instalação e ambientes: ficar com os ficheiros cujo nome tem a série
  (`_F`/`_L`/`_R`, `Front/Left/Right`).
- MDM: o ficheiro é `.tif` ou `.tiff` (o nome no HTML não chega para saber);
  o JPEG é `<ficheiro>/_jcr_content/renditions/cq5dam.web.1280.1280.jpeg`.
- As páginas residenciais têm packshots b2c em `b2c/shared/images/packshots/`
  e, para algumas gamas, em `b2c/portugal/imagens/products/` (Altherma 3 R F
  Mini, EKHWSP). Os UI Altherma (ECH2O, F, W) usam a mesma foto para R e H HT,
  e a ECH2O usa a bivalente (EHSXB): aviso nos grupos não bivalentes.
- Acessórios com página própria (Madoka, BRP069, DCS/DCM, painéis BYCQ/BYFQ)
  têm packshot; os restantes acessórios vêm do klima.pt (`procurar-ref.mjs`).
  UTA Compact R/T e a DucoBox Comfort não têm foto própria (2026).
- Megaclima costuma ter Sensira / Comfora / Perfera / Stylish / Emura:
  `node scripts/imagens/crawl-megaclima-curl.mjs --brand daikin`.

## Nipon

- Site: niponcomfort.com, via Playwright (`pnpm imagens:crawl -- --brand nipon`).
  Os URLs de imagem estão em `/pic/`.

## Distribuidores secundários (todas as marcas)

### Megaclima: https://www.megaclima.pt/

- Listas de preços multimarca para instaladores (AC, ventilação, cortinas de
  ar, …). Hub útil: https://www.megaclima.pt/ventilacao/domestico/. Os
  packshots de AC estão em
  `/ar-condicionado-lisboa/{domestico,comercial}/precario-*?brand=…`.
- `node scripts/imagens/crawl-megaclima-curl.mjs --brand {marca}` guarda os
  ficheiros em `product-scaffold/crawl-raw/{marca}/<pageSlug>/NN.png`
  (por exemplo `daikin-mural-sensira`); escolher à mão e copiar para a pasta do
  grupo com `fonte: "megaclima"`.

### Disterm: https://www.disterm.pt/produtos.html

- Grossista PT (solar, AC, bombas de calor, ventilação, …). As páginas de
  detalhe exigem login e as públicas só têm imagens de categoria: não usar
  para o crawl. Para lacunas, entrar à mão e guardar as fotos como
  `fonte: "upload"`.

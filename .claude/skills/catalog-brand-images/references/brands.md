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
- Megaclima: `node scripts/imagens/crawl-megaclima-curl.mjs --brand hisense`.

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
- Acessórios, UTA e chillers quase sempre não têm packshot: ficam sem fotos.
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

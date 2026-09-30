# Standards de produto (v4)

Taxonomia inspirada no catálogo Megaclima (megaclima.pt) — mantendo o que fazem bem (taxonomia ortogonal, specs normalizadas entre marcas, nomes funcionais legíveis) e corrigindo o que fazem mal (sem refrigerante/SEER/SCOP/kW, cores como séries duplicadas, mono/multi implícito). Alargada a **todo o nosso portefólio**, não só AC.

Hierarquia: **família → segmento → sistema → tipo de unidade → gama → modelo (ref) → variante**.

## Taxonomia

### Famílias (`familia`)

| familia | O que inclui | tipoUnidade típicos |
| --- | --- | --- |
| ar-condicionado | Splits residenciais e comerciais (1x1, multi, VRF) e rooftops | mural, mini-cassete, cassete-1-via, cassete-4-vias, conduta-baixa-pressao, conduta-media-pressao, conduta-alta-pressao, consola, chao-teto, exterior, rooftop |
| bombas-de-calor | Aerotermia para aquecimento central (Ecodan, Altherma, M-Thermal, Hi-Therma, H-Power…) | exterior, modulo-hidraulico, integrada |
| aqs | Bombas de calor de água quente sanitária, termoacumuladores e depósitos | monobloco-aqs, split-aqs, deposito |
| ventilacao | VMC / recuperadores de calor (Lossnay, EasyDan…), extratores, UTAs | vmc, recuperador-de-calor, extrator, uta |
| chillers | Chillers ar-água para AVAC (EWAA/EWYT…) | chiller |
| ventiloconvectores | Fan coils 2/4 tubos | mural, cassete, conduta, chao-teto, consola |
| cortinas-de-ar | Cortinas de ar | cortina-de-ar |
| purificadores-de-ar | Purificadores de ar | purificador |
| acessorios-e-controlo | Comandos, interfaces wifi, kits, sondas, bombas de condensados, filtros | comando, interface, kit, sonda, filtro, bomba-condensados |
| outros | Apenas quando nada acima serve — registar o caso na tabela de estado | — |

### Dimensões ortogonais

- `segmento`: `domestico` | `comercial` | `industrial`
- `sistema`: `mono-split` | `multi-split` | `vrf` | `rooftop` | `monobloco` | `bibloco` | vazio quando não se aplica. **VRV (Daikin) normaliza-se para `vrf`.**
- `componente`: `conjunto` | `unidade-interior` | `unidade-exterior` | `deposito` | `acessorio` | `comando`

## Modelo produto → variantes

- Cada SKU em staging = **1 SKU comprável** (`ref`). Cada `grupoModelo` = **1 produto no site**: é a página de produto, e as linhas do grupo são as variantes selecionáveis.
- `grupoModelo` é **determinístico** (v4), calculado por `grupoModeloDeterministico` em `convex/lib/stagedSku.ts`: `{marca}-{gama-slug}` para `conjunto`, `{marca}-{gama-slug}-{componente}` para os restantes componentes (ex.: `mitsubishi-msz-ef`, `hisense-air-master-unidade-interior`, `daikin-brc1h-comando`). O slug da gama é ASCII minúsculo com hífens simples. Assim as fotos de um grupo sobrevivem a recargas anuais. Produto sem gama → o slug da ref faz de série (grupo de 1, **último recurso**).
- **Grupo de 1 é o último recurso, nunca o default.** A unidade natural de agrupamento é a **série/gama**, não a ref. Se duas refs diferem apenas no código de capacidade (ex.: `AUC105UR4RKC8` / `AUC125UR4RKC8` / `AUC140UR4RKC8`), pertencem **obrigatoriamente** ao mesmo `grupoModelo` com `capacidade=`/`frio-kw=` a distingui-las em `atributos`. Isto aplica-se a **todos os componentes** — conjuntos, unidades interiores vendidas à parte, unidades exteriores, módulos hidráulicos, depósitos — mesmo quando o PDF as lista como linhas soltas sem cabeçalho de série.
  - Teste mecânico (o `scripts/review.py` verifica isto): substituir cada sequência de dígitos da `ref` por `#` dá o "esqueleto" da série (`AUC105UR4RKC8` → `AUC#UR#RKC#`). Refs da mesma marca+família com o mesmo esqueleto e o mesmo `componente` → mesmo grupo, salvo justificação explícita.
  - UI e UE da mesma série vendidas à parte são **grupos separados** (um por `componente`), cada um com as suas variantes de capacidade — nunca misturar componentes no mesmo grupo.
- Coerência do grupo: todas as linhas partilham `familia`, `segmento`, `sistema`, `tipoUnidade` e `gama`. Linha que não encaixe → parte-se o grupo.
- A cor vem quase sempre codificada no sufixo da ref (ex.: MSZ-EF25VGK**W**/**S**/**B** → branco/prateado/preto; comandos BRC1H52**W7**/**S7**/**K7**); mapear por marca e **nunca adivinhar** — sem mapa conhecido, a chave `cor` fica de fora.

## Atributos (`atributos`)

**Registo de specs (v4).** As chaves permitidas por `familia` vivem em `convex/lib/specRegistry.ts` (`REGISTO_SPECS`), com tipo (`numero` | `texto` | `enum` | `booleano`), unidade, rótulo português, componentes onde se aplicam, componentes onde são obrigatórias e as **três hero specs** por família (cartão do catálogo e topo da página de produto no telemóvel). `pnpm registry:json` exporta o registo para `product-scaffold/spec-registry.json`, que os scripts Python leem. **Este documento não repete a lista de chaves — o registo é a fonte de verdade.**

`validarAtributos(familia, componente, atributos)` devolve `{ erros, avisos }`:

- **Erro (SKU rejeitado):** tipo errado (`numero` sem ponto decimal ou com unidade), valor fora do enum, `texto` que falha o padrão (`classe-energetica`, `dimensoes*`, `compativel-com`), chave duplicada, família desconhecida.
- **Aviso (obriga a abrir na revisão):** chave desconhecida para a família, chave fora dos componentes onde se aplica (ex.: `unidades-max` numa UI), chave obrigatória em falta.

Convenções de valor que o registo assume: números com `.` decimal e sem unidades; `classe-energetica` = `frio/calor` (ex.: `A+++/A++`, `-` num lado em falta); `dimensoes*` = `AxLxP` em mm (`295x798x225`); `compativel-com` = lista de refs ou códigos de série separada por vírgulas, **sem `;`**; `booleano` = `sim` | `nao`; `cor` usa o vocabulário fechado do registo.

O produto **não tem colunas fixas de specs** — tem uma lista ordenada de pares `chave=valor` que carrega tanto os **eixos de variação** como as **especificações**. O UI decide a apresentação por grupo:

- Chaves cujos valores **variam** entre as linhas do grupo → **colunas da tabela de modelos** na página de produto (o cliente escolhe a linha/SKU).
- Chaves **constantes** no grupo (ou de um grupo de 1) → **chips de especificações** na caixa de compra.

Regras:

- Ordem = ordem de apresentação: **eixos de variação primeiro, specs depois** (no CSV opcional: pares `chave=valor` unidos por `;`, divididos pelo **primeiro** `=`).
- **Specs importantes — procurar sempre no PDF** e emitir quando existirem: `frio-kw` (arrefecimento nominal, kW), `calor-kw` (aquecimento nominal, kW), `btu` (arrefecimento, ≈ kW×3412 arredondado às centenas — só quando o PDF o dá ou a família o usa comercialmente), `classe-energetica`, `seer`, `scop`, `refrigerante` (R32, R290…), `wifi` (`sim` | `opcional` | `nao`), e o preço (coluna própria `pvpCents`). **Se o PDF não os der, omitem-se — nunca inventar.**
- **`classe-energetica` (padrão único, todas as marcas):** um só atributo com valor `frio/calor` (ex.: `A+++/A++`). O lado esquerdo é a classe de arrefecimento (SEER); o direito, a de aquecimento (SCOP). Normalizar `A⁺⁺⁺` → `A+++`. Se o PDF só der um dos lados, usar `-` no outro (`A+++/-` ou `-/A++`) — **nunca** emitir `classe-frio` / `classe-calor` separados.
- Eixos de variação típicos: `capacidade` (kW nominal — usar apenas quando o PDF não separa frio/calor, ex.: depósitos, AQS), `cor` (vocabulário fechado: `branco`, `branco-perola`, `preto`, `prateado`, `vermelho`, `cinzento`, `inox`), `unidades-max` (UE multi/VRF), `deposito` (ex.: `260L`), `pressao-estatica` (`baixa`|`media`|`alta`), `comando` (`infra`|`cabo`|`wifi`), `alimentacao` (`monofasica`|`trifasica`), `modo`… Eixo novo = chave nova, sem mudar o schema.
- **Não duplicar informação**: se `capacidade` seria sempre igual a `frio-kw` (ou a `calor-kw` nas bombas de calor), emitir só as chaves explícitas `frio-kw`/`calor-kw`. Specs constantes **podem e devem ficar** nos atributos (aparecem como chips) — ao contrário do v2, já não se removem.
- Valores: números com ponto decimal e sem unidades (`frio-kw=3.5`, `seer=8.6`); a unidade vive no rótulo da chave no UI. Valores nominais em slug minúsculo (`alimentacao=trifasica`).
- Linhas do mesmo grupo devem partilhar o mesmo conjunto de chaves sempre que o PDF o permita; spec em falta numa linha → omitir só nessa linha (a tabela mostra "—").
- **Duas linhas do mesmo grupo nunca podem ter atributos exatamente iguais** — seriam indistinguíveis na tabela. Se isso acontecer, falta um eixo (alimentação? pressão? cor?) ou o grupo está mal formado.

## Glossário da indústria

- **Mono-split**: 1 unidade interior (UI) + 1 unidade exterior (UE). **Multi-split**: 2–6 UI numa UE; o nº máx. de UI costuma vir no código da UE (MXZ-**3**F → 3).
- **VRF/VRV**: caudal de refrigerante variável, sistemas comerciais; VRV é marca registada da Daikin.
- **Rooftop**: AC compacto de cobertura para grandes espaços comerciais/industriais.
- **Monobloco vs bibloco (split)**: bomba de calor num só corpo exterior vs UE + módulo hidráulico interior.
- **AQS** = água quente sanitária · **UTA** = unidade de tratamento de ar · **VMC** = ventilação mecânica controlada · **ventiloconvector** = fan coil.
- **Cassete**: 1 via ou 4 vias · **Conduta**: baixa/média/alta pressão estática · **Comando**: infra | cabo | wifi.

## Contrato do SKU em staging (JSON v4)

O artefacto canónico de uma extração é **um JSON por import run** (`{marca}-{ano}-staged.json`), tipado em `convex/lib/stagedSku.ts` (`ImportRunJson` / `StagedSkuJson`):

```json
{
  "marca": "hisense",
  "ano": 2026,
  "tabelaOrigem": "hisense-2026",
  "ficheiro": "hisense-tabela-precos-2026.pdf",
  "skus": [
    {
      "ref": "AUC125UR4RKC8",
      "ean": "…",
      "nome": "Cassete 4 vias | Unidade Interior 12.5 kW",
      "nomeGrupo": "Cassete 4 vias | Unidade Interior",
      "marca": "hisense",
      "familia": "ar-condicionado",
      "segmento": "comercial",
      "sistema": "mono-split",
      "tipoUnidade": "cassete-4-vias",
      "componente": "unidade-interior",
      "gama": "AUC",
      "atributos": [{ "chave": "frio-kw", "valor": "12.5" }, { "chave": "calor-kw", "valor": "14.0" }],
      "descricao": "…",
      "pvpCents": 189900,
      "ivaIncluido": false,
      "tabelaOrigem": "hisense-2026",
      "grupoModelo": "hisense-auc-unidade-interior",
      "pdfPaginas": [26, 30],
      "compativelCom": ["AUW125U4R…"],
      "avisos": []
    }
  ]
}
```

- Cada SKU leva os **18 campos v3** como JSON: `atributos` é um array ordenado de `{chave, valor}`, `pdfPaginas` são números, `pvpCents` é inteiro em cêntimos **s/IVA** (`ivaIncluido: false` em todas as tabelas de marca).
- Campos novos: `ean?`, `compativelCom?: string[]` (refs ou códigos de série aceites — UE multi/VRF, comandos) e `avisos: string[]` (avisos do registo + dúvidas do extractor; o revisor tem de abrir todo o grupo com avisos).
- **Obrigatórios:** `ref`, `nome`, `nomeGrupo`, `marca`, `familia`, `componente`, `atributos`, `pvpCents`, `ivaIncluido`, `tabelaOrigem`, `grupoModelo`, `pdfPaginas`, `avisos`. Restantes: **omitidos quando desconhecidos — nunca inventar**.
- `marca` é **slug minúsculo**; `familia`, `sistema`, `componente` e `segmento` validam contra a Taxonomia (valor inválido = SKU rejeitado).
- Sem `imagens` / `estado`: são geridos pela app (a aprovação da run publica todos os SKUs e descontinua as refs da marca que faltam; imagens vêm da escolha de fotos na revisão).
- **Sem grupos cross-brand** — todos os SKUs de um `grupoModelo` têm a mesma `marca`.
- **Descontinuados, não apagados (v4):** ao aprovar um import run, as refs da mesma `tabelaOrigem`/marca ausentes do run aprovado passam a `estado: descontinuado` (linhas de encomenda referenciam refs). A regra `removerAusentes` do v3 deixa de existir.

### CSV v3 (export opcional)

O CSV de 18 colunas mantém-se apenas como **export de conveniência** (folha de cálculo, diff rápido); nunca é a fonte de import. Ordem fixa, UTF-8, QUOTE_ALL, CRLF:

```
ref,ean,nome,nomeGrupo,marca,familia,segmento,sistema,tipoUnidade,componente,gama,atributos,descricao,pvpCents,ivaIncluido,tabelaOrigem,grupoModelo,pdfPaginas
```

`atributos` = pares `chave=valor` unidos por `;` (por isso `compativel-com` não pode conter `;`); `pdfPaginas` = inteiros separados por vírgula; string vazia = campo omitido. `compativelCom` e `avisos` não têm coluna — vivem só no JSON.

Histórico: v2→v3 fundiu as colunas fixas de specs em `atributos` (`migrations:migrarParaAtributos`, `migrations:unificarClasseEnergetica`); v3→v4 acrescenta o registo de specs, o JSON de staging, o `grupoModelo` determinístico e a regra de descontinuados. O armazenamento em `produtos` não muda.

## Convenção de nomes (`nomeGrupo` e `nome`)

- `nomeGrupo` = `{Tipo de unidade legível} {Gama} {distintivo}` — **sem capacidade nem cor** (ex.: `Mural MSZ-EF Kirigamine Zen Wifi`, `Chão-Teto 1×1 Super Inverter`). É o título da página de produto e do cartão do catálogo.
- `nome` = `{nomeGrupo} {capacidade}` — ex.: `Mural MSZ-AY Wifi 3.5 kW`, `Multi Exterior MXZ-3F 6.8 kW (até 3 UI)`, `Bomba de Calor Monobloco M-Thermal Arctic 12 kW`, `Comando BRC1H52`. Usado na lista de orçamento / SKU; a capacidade **não** aparece no título da página.
- Unidades vendidas à parte levam o componente no `nomeGrupo` (ex.: `Cassete 1×1 Turbo Inverter | Unidade Interior`) e a capacidade no `nome` da variante (ex.: `Cassete 1×1 Turbo Inverter | Unidade Interior 3.5 kW`) — **um só grupo por série+componente**, nunca um produto por capacidade. Separador de componente: ` | ` (pipe), nunca travessão (`—` / `–`).
- Cor/acabamento vai para `atributos` (`cor=branco`…), nunca para o nome.
- Sempre em português; nunca usar a ref crua como nome (a ref tem coluna própria).
- **Artefactos proibidos em `nomeGrupo`:** `… 6.2 kW`, `… 24000 BTU`, `… 80L`, cores (`branco`, `preto`…). O `scripts/review.py` valida isto automaticamente.

## Regras de extração (PDF → JSON)

- Antes de extrair linhas, mapear cada secção/página do PDF para `familia`+`segmento`+`sistema`+`tipoUnidade` usando os cabeçalhos das páginas; **nunca herdar a classificação da secção anterior sem confirmar o cabeçalho**.
- UE de multi nunca herda o tipoUnidade das UI da mesma secção (é `exterior`).
- **Agrupar antes de emitir:** depois de extrair as linhas de uma secção, agrupar por série (esqueleto da ref + `componente`) e só então atribuir `grupoModelo`/`atributos`. Tabelas que listam UI ou UE avulsas por capacidade (padrão comum: uma linha por capacidade, ex.: cassetes AUC105/125/140/175) produzem **um grupo com N variantes**, não N produtos isolados.
- Emparelhar ref↔preço por proximidade no layout; conflitos resolvem-se pela menor distância.
- `gama`: rejeitar linhas-frase (>4 palavras); `nome`/`descricao`: limpar prefixos residuais (`=` , `•`…).
- QA mínimo antes de anexar: contagens por família plausíveis vs índice do PDF; 3+ âncoras ref/preço verificadas no PDF; amostra de 10 linhas revista à mão; **zero avisos de "série partida em grupos de 1" no `scripts/review.py`** (ou justificação explícita para cada um).

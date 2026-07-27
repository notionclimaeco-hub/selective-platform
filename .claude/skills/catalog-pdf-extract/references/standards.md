# Standards de produto (v3)

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

- Cada linha do CSV = **1 SKU comprável** (`ref`). Cada `grupoModelo` = **1 produto no site**: é a página de produto, e as linhas do grupo são as variantes selecionáveis.
- `grupoModelo` = slug `{marca}-{gama}` (ex.: `mitsubishi-msz-ef`, `midea-m-thermal-arctic`). Produto sem variantes → grupo de 1, com `grupoModelo` = slug da ref (**fallback genérico** — tudo cabe no modelo).
- **Grupo de 1 é o último recurso, nunca o default.** A unidade natural de agrupamento é a **série/gama**, não a ref. Se duas refs diferem apenas no código de capacidade (ex.: `AUC105UR4RKC8` / `AUC125UR4RKC8` / `AUC140UR4RKC8`), pertencem **obrigatoriamente** ao mesmo `grupoModelo` com `capacidade=`/`frio-kw=` a distingui-las em `atributos`. Isto aplica-se a **todos os componentes** — conjuntos, unidades interiores vendidas à parte, unidades exteriores, módulos hidráulicos, depósitos — mesmo quando o PDF as lista como linhas soltas sem cabeçalho de série.
  - Teste mecânico (o `scripts/review.py` verifica isto): substituir cada sequência de dígitos da `ref` por `#` dá o "esqueleto" da série (`AUC105UR4RKC8` → `AUC#UR#RKC#`). Refs da mesma marca+família com o mesmo esqueleto e o mesmo `componente` → mesmo grupo, salvo justificação explícita.
  - UI e UE da mesma série vendidas à parte são **grupos separados** (um por `componente`), cada um com as suas variantes de capacidade — nunca misturar componentes no mesmo grupo.
- Coerência do grupo: todas as linhas partilham `familia`, `segmento`, `sistema`, `tipoUnidade` e `gama`. Linha que não encaixe → parte-se o grupo.
- A cor vem quase sempre codificada no sufixo da ref (ex.: MSZ-EF25VGK**W**/**S**/**B** → branco/prateado/preto; comandos BRC1H52**W7**/**S7**/**K7**); mapear por marca e **nunca adivinhar** — sem mapa conhecido, a chave `cor` fica de fora.

## Atributos (`atributos`)

O produto **não tem colunas fixas de specs** — tem uma lista ordenada de pares `chave=valor` que carrega tanto os **eixos de variação** como as **especificações**. O UI decide a apresentação por grupo:

- Chaves cujos valores **variam** entre as linhas do grupo → **colunas da tabela de modelos** na página de produto (o cliente escolhe a linha/SKU).
- Chaves **constantes** no grupo (ou de um grupo de 1) → **chips de especificações** na caixa de compra.

Regras:

- Formato CSV: pares `chave=valor` unidos por `;`, divididos pelo **primeiro** `=`. A ordem é a ordem de apresentação: **eixos de variação primeiro, specs depois**.
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

## Schema CSV v3

**18 colunas**, ordem fixa (1 linha = 1 SKU comprável; `ref` é única e serve de chave de upsert):

```
ref,ean,nome,nomeGrupo,marca,familia,segmento,sistema,tipoUnidade,componente,gama,atributos,descricao,pvpCents,ivaIncluido,tabelaOrigem,grupoModelo,pdfPaginas
```

- Formato: UTF-8, QUOTE_ALL, terminadores CRLF (`\r\n`).
- **Obrigatórios:** `ref`, `nome`, `nomeGrupo`, `marca`, `familia`, `componente`, `pvpCents`, `ivaIncluido`, `tabelaOrigem`, `grupoModelo`. Restantes campos: **vazio quando desconhecido — nunca inventar** (no import, string vazia → campo omitido; `atributos`/`pdfPaginas` vazios → `[]`).
- `marca` é **slug minúsculo**: `hisense`, `daikin`, `mitsubishi`, `nipon`, `midea`…
- **Enums validados no import** (linha rejeitada se o valor for inválido): `familia`, `sistema` e `componente` (valores exatos da Taxonomia acima) e `segmento` (`domestico` | `comercial` | `industrial`).
- `pvpCents`: inteiro em cêntimos, **s/IVA**. `ivaIncluido`: `"1"`/`"true"` → true; as tabelas de marca são s/IVA → usar `0`/`false`.
- `atributos`: ver secção *Atributos* — pares `chave=valor` unidos por `;`, ordem preservada no import.
- `nomeGrupo` = nome do produto no site (sem capacidade nem cor); `nome` = nome da variante. `descricao` pode conter Markdown.
- `pdfPaginas`: inteiros positivos separados por vírgula (ex.: `26,30,36`); é a última coluna.
- **Sem colunas `fotoUrls` / `imagens` / `estado`** — as imagens seguem pelo pipeline de crawl/upload existente (Convex storage) e o `estado` é gerido pela app (imports novos entram como `rascunho`).
- `grupoModelo` obrigatório em **todos** os SKUs: produto isolado = grupo de 1 (os seus atributos aparecem como chips de specs). **Sem grupos cross-brand** — todos os SKUs de um `grupoModelo` têm a mesma `marca`.
- **Full rebuilds, não deltas:** depois do upsert das linhas de uma marca, chamar `importData.removerAusentes({ secret, tabelaOrigem, refsMantidos })` para apagar as refs que saíram do CSV mais recente.
- Migração v2→v3: `atributosVariante` + colunas fixas de specs (`capacidadeFrioKw`, `capacidadeCalorKw`, `capacidadeBtu`, `classeEnergeticaFrio`, `classeEnergeticaCalor`, `seer`, `scop`, `refrigerante`, `wifi`, `maxUnidadesInteriores`) fundem-se na coluna única `atributos` (eixos primeiro, specs depois, chaves: `frio-kw`, `calor-kw`, `btu`, `classe-energetica`, `seer`, `scop`, `refrigerante`, `wifi`, `unidades-max`). `classeEnergeticaFrio`+`classeEnergeticaCalor` (ou um `classeEnergetica` legado só de frio) → `classe-energetica=frio/calor`. No Convex: `migrations:migrarParaAtributos` + `migrations:unificarClasseEnergetica`.

## Convenção de nomes (`nomeGrupo` e `nome`)

- `nomeGrupo` = `{Tipo de unidade legível} {Gama} {distintivo}` — **sem capacidade nem cor** (ex.: `Mural MSZ-EF Kirigamine Zen Wifi`, `Chão-Teto 1×1 Super Inverter`). É o título da página de produto e do cartão do catálogo.
- `nome` = `{nomeGrupo} {capacidade}` — ex.: `Mural MSZ-AY Wifi 3.5 kW`, `Multi Exterior MXZ-3F 6.8 kW (até 3 UI)`, `Bomba de Calor Monobloco M-Thermal Arctic 12 kW`, `Comando BRC1H52`. Usado na lista de orçamento / SKU; a capacidade **não** aparece no título da página.
- Unidades vendidas à parte levam o componente no `nomeGrupo` (ex.: `Cassete 1×1 Turbo Inverter | Unidade Interior`) e a capacidade no `nome` da variante (ex.: `Cassete 1×1 Turbo Inverter | Unidade Interior 3.5 kW`) — **um só grupo por série+componente**, nunca um produto por capacidade. Separador de componente: ` | ` (pipe), nunca travessão (`—` / `–`).
- Cor/acabamento vai para `atributos` (`cor=branco`…), nunca para o nome.
- Sempre em português; nunca usar a ref crua como nome (a ref tem coluna própria).
- **Artefactos proibidos em `nomeGrupo`:** `… 6.2 kW`, `… 24000 BTU`, `… 80L`, cores (`branco`, `preto`…). O `scripts/review.py` valida isto automaticamente.

## Regras de extração (PDF → CSV)

- Antes de extrair linhas, mapear cada secção/página do PDF para `familia`+`segmento`+`sistema`+`tipoUnidade` usando os cabeçalhos das páginas; **nunca herdar a classificação da secção anterior sem confirmar o cabeçalho**.
- UE de multi nunca herda o tipoUnidade das UI da mesma secção (é `exterior`).
- **Agrupar antes de emitir:** depois de extrair as linhas de uma secção, agrupar por série (esqueleto da ref + `componente`) e só então atribuir `grupoModelo`/`atributos`. Tabelas que listam UI ou UE avulsas por capacidade (padrão comum: uma linha por capacidade, ex.: cassetes AUC105/125/140/175) produzem **um grupo com N variantes**, não N produtos isolados.
- Emparelhar ref↔preço por proximidade no layout; conflitos resolvem-se pela menor distância.
- `gama`: rejeitar linhas-frase (>4 palavras); `nome`/`descricao`: limpar prefixos residuais (`=` , `•`…).
- QA mínimo antes de anexar: contagens por família plausíveis vs índice do PDF; 3+ âncoras ref/preço verificadas no PDF; amostra de 10 linhas revista à mão; **zero avisos de "série partida em grupos de 1" no `scripts/review.py`** (ou justificação explícita para cada um).

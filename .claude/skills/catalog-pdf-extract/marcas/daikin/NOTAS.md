# Daikin 2026 — notas da tabela

`DAIKIN Tabela de Preços 2026.pdf`, 158 páginas (índice na p2, páginas impressas
= PDF − 1), ticket #47. Preços s/IVA.

## Leitura

- O leitor genérico não serve: cada linha das tabelas Sky Air e do resumo
  doméstico tem conjunto, UE e UI, cada um com o seu preço. `extrair.py` lê por
  âncoras (refs): o equipamento leva o primeiro preço à direita na mesma linha
  (refs seguidas sem preço entre elas — direita/esquerda das UTA — partilham-no) ou,
  sem preço na linha, o mais próximo na coluna (refs empilhadas `SB.FTXA20DP/DY/DG/
  DC/DL` partilham a linha de preço do meio); as listas "Ref | Descrição | Preço"
  dão a cada preço a âncora mais próxima.
- O que cada ref é decide `series.py` pela ref (a mesma UE aparece em dez páginas):
  componente, gama, tipo, série Sky Air pelo sufixo do conjunto (`_AV/_ANV/_ANY`
  Alpha, `_AS?` Advance, `_AZ(A)?` Active, `_RXMR/_ARX` exterior Perfera), cor
  pelo sufixo (Emura W/S/B, Stylish CW/CS/CB e os painéis D: DP, DY, DL, DG, DC) e
  atributos que o código do modelo diz e a tabela imprime noutra coluna (classe
  das UI Altherma, volume dos depósitos, kW das caldeiras, nº de coletores dos kits
  solares, lado das UTA, válvula de 3 vias dos ventiloconvectores).
- Modos por secção (ver `mapa.py`): `matriz` e `precoPorBaixo` (Altherma, fichas
  VAM/EKVDX/ERA/EWWQ, grelhas de opcionais UTA, kits solares), `colunasPreco`
  (Multi+ p53, painéis das cassetes p142), `descricao: esquerda|linha`,
  `porDescricao` (DucoBox numa lista de refs numéricas), `especificacoes:
  transpostas|fc`, `leitor: rooftops` (ref composta da série e do tamanho:
  `UATYA100BBAY1`, `EWAT085B-SS`, `EWAA011DV3P`, `VKM50JM`, como o catálogo anterior).
- Fichas das gamas domésticas (p14-22): só os acessórios; conjuntos, UE e UI vêm
  do resumo das p23-24. A Ururu Sarara (p13) só tem ficha.
- Matrizes Altherma: a célula é a soma UE + UI (sem ref de conjunto), vendem-se
  UE e UI. A p44 (assimétricos) e a p53 (Multi+) imprimem preço de conjunto sem
  ref: ficam as unidades. A p28 "conjuntos frequentes" idem.

## Correções

- `SB.FTXJ..A[WSB]` (p23) → `SB.FTXJ..A[WSB]9` como a ficha p14 e o catálogo.
- `FTXJ20A9S` (p26) → `FTXJ20AS9`; `VAM80J8` (p106) → `VAM800J8`.
- Kits de UI com painel/comando (`SB.FFA25A_WFW`, `SB.FCAG35_P`): kW da UI (aviso).
- Air Sense Pro + (p99): a ref impressa é o nome; R-Cycle (p145): preço por cima
  da linha "N.º de código" (`pos.py`).
- Caudal das UTA Compact pela tabela de características; conjuntos VAM com sensor
  CO2 herdam o caudal da unidade.
- Acessórios que só diferem na cor (painéis BYCQ140EW/EB, comandos Madoka
  BRC1H52W7/K7/S7) ficam num grupo com `cor`; séries vendidas por tamanho e impressas
  num bloco com uma só descrição (EKEXVA, coletores RMV/RMX, opcionais HPC EKM10/15/20,
  caixas EIWRX, opcionais das UTA) ficam num grupo com `tamanho`.

## Diferenças para o catálogo anterior (a tabela confirma o valor novo)

- Cassetes de ventiloconvectores FWF/FWC (p142-143): o catálogo tinha o preço do
  conjunto (unidade + painel + placa) na ref da unidade; agora a unidade tem o seu
  preço e painel/placa os seus.
- BRC073 205 € (era 25), BAFL502A250 270 €, KRCS01-6B 290 €, KRP1C64 210 € (p42),
  EKMSTC4/5, EKHVCONV4, EKSRPS4A, EKMBPP1A, EKCC9-W (o catálogo misturou linhas).
- Refs impressas por inteiro: `SB.EK200PCV/FIL260`, `SB.EKHLE200CV3/26`,
  `SB.EKECBUA3V/2A` (o catálogo cortava a parte depois da barra).

## Registo (acrescentado neste ticket)

`cor` madeira-clara, madeira-escura, castanho, azul (Stylish D); bombas de calor
`classe-kw` (as UI hydrobox/integradas não têm kW próprios: `calor-kw` deixou de ser
obrigatório nelas); AQS `coletores` (`deposito-l` só obrigatório no depósito);
ventilação `zonas`, `controlo`, `orientacao`, `tamanho`; ventiloconvectores
`valvula-3-vias`; acessórios `tamanho`.

## Avisos que ficam (genuínos)

- Classe energética em falta: Sky Air 12,5/14 kW (a tabela imprime "–"), conjuntos
  Altherma (só o desenho da etiqueta), rooftops.
- kW em falta: UI só para multi (CTXA15, CTXM15A, FTXM60R/71R, CVXM20B, CTXF) e UE
  Multi+ MWXM (p53 não os imprime); `SB.FHA71_FW_AZV` (p38: sem kW e a UE é ARXM71A).
- Astropure 2000: os dois modelos só diferem nos opcionais (UV, ecrã, filtro de carvão).
- VRV 5 (p30): preços sob consulta, sem linhas.

## Acessórios do catálogo anterior (revistos um a um na tabela)

- Reais e recuperados: Duco 00004636/37 (sensor de CO2 sem comando, 320 €), 00007012/13
  (DucoVent Design quadrado redondo, 105 €), BRYMA100 e EKPLEN200 (grelha da p112),
  E4V2N05OV3WA (FWP, 255 €), EDPD7 (40 €).
- Erros do catálogo anterior, ficam de fora: EKFCD80 é peça do kit `SB.EKWC/EKFCD80` (os
  475 € são do kit); KHRQ22M20T só aparece numa nota da p25 (a ref com preço é
  KHRQ22M20TA, p46); RZAG71 vem de uma nota; 00004995 (acoplamento multizona) está
  "Disponível brevemente" (o catálogo deu-lhe os 20 € do acoplamento D200 ao lado).
- Os outros são a mesma peça com a ref impressa por inteiro (`SB.EK200PCV/FIL260`,
  `SB.EKECBUA3V/2A`, `SB.EKHLE200CV3/26`, `K-KDU572KVE`, `ATD04UDSBR`).

## Nomes dos acessórios (`nomes.py`)

Muitas listas imprimem a descrição partida pelo bloco de refs ou só um rótulo de linha
("Temperatura", "Registo mistura —"): os títulos foram escritos a partir das linhas do PDF,
com a gama a que servem ("… (Energy Sky)", "… para FWQ-AT/FWE-F"). Séries vendidas por
tamanho ou cor num produto (`MESMO_GRUPO`, `MESMO_GRUPO_COR`); o tamanho é o que a tabela
imprime (coluna da grelha VAM, tamanho de UTA, gama de ventiloconvector). As baterias de
reaquecimento e os registos externos da UTA Compact R são os da Compact L de outro tamanho
(ALD03HWUA = R 01 = L 03, mesmo preço): um produto "UTA Compact R e L" com os dois. Sondas,
comandos e atuadores comuns às três Compact ficam "UTA Compact: …".

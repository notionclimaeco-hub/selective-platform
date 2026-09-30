# Nipon 2025 — notas da tabela

`NIPON_2025_.pdf`, 60 páginas, ticket #45. Preços s/IVA, refs `NI` + 7 dígitos.

## Leitura

- O índice (p2) imprime os números de página numa coluna à parte: o mapa é
  escrito todo em `mapa.py` (44 secções), com `posicoes`/`regiao` onde a
  página mistura fichas, listas e texto (p33-34, p36-37, p41-42, p46, p52-53).
- Fichas com um modelo por coluna, lidas por `extrair.py` (hook do
  `extrair.py --marca`): colunas pelas refs da linha "Código …", preço da
  linha "Preço S/IVA" abaixo, specs pelos rótulos à esquerda. O cabeçalho é a
  linha mais próxima acima da primeira linha de specs com nomes em ≥ 75 % das
  colunas.
- Gama comercial (p28-31) e Spirit SA (p45): códigos da UE, UI e grelha sem
  preço; vende-se a linha "Código conjunto" e os outros códigos vão para a
  descrição. Cassetes multi (p22): a grelha tem código mas não preço.
- Células impressas uma vez para várias colunas (alimentação, classe dos
  Spirit, os 1700 W da Innovus) valem para as colunas vazias mais próximas.
- Rótulos sem espaços na p30 ("Potênciatérmica") e ligaduras ﬁ/ﬂ: o rótulo
  compara-se normalizado e sem espaços.
- Venice: specs por tamanho na p54 (só a Venice base; as subtabelas
  "c/ Permutador" e "Brushless" ficam de fora), códigos e preços por versão
  (V, VF, VN, H, HF, HN) na p55 → um grupo por versão.
- `btu` = classe comercial no nome do modelo (PRIMISD**09**, M4-**36**DHW).
- Bombas de calor: `calor-kw` A7/W35 e `frio-kw` A35/W18 (piso radiante, as
  duas condições baixas). A classe impressa é de aquecimento a 35 °C / 55 °C
  (e AQS): fica `-/<classe 35 °C>`, como o padrão `frio/calor` pede. AQS:
  `-/<classe>`.
- p21 chama "Preta" à Primis Duo escura; a mesma página e a p15 dizem cinza
  antracite → `cor: cinzento` (`cores` no mapa).
- Flexus FX-200/300 "1S" = com serpentina solar: chave
  `serpentina-solar-m2` (acrescentada ao registo AQS neste ticket).

## Correções (`pos.py`)

- Nomes de acessórios impressos longe da linha de preço (legendas das caixas
  das p33-34 e p56); NRGA/1F W/B = um comando com `cor` branco/preto.
- p18-19: a classe das UE multi-split é desenho, não texto: A++/A+ em todas.
- Compatibilidade das UE multi-split lida das tabelas de combinações
  (p25-26): classes de UI 9/12/18/20/24 por UE; as AC+AQS aceitam também o
  depósito S200L GA. A p26 imprime "21" em duas combinações da M5-42 (não há
  UI dessa classe).

## Por resolver com a Nipon

- p46 H-Power 0270 (30 470 €) imprime a ref da 0140 (NI0516014): fica só a
  0140, com aviso.
- Serenus (p48): a tabela não imprime classe energética (aviso genuíno).

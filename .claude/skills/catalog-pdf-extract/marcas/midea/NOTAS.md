# Midea 2026 — notas da tabela

Tabela da SGT (distribuidor exclusivo), `MIDEA SGT.pdf`, 28 páginas, ticket #44.

## Leitura

- Fontes Type3 sem mapa Unicode: `mapa.palavras_da_pagina` repara os glifos
  quando o PDF tem preços com `¬` (euro = `¬`, `€` e `(` soltos no fim das
  palavras, `Azzz` = `A+++`, `˛` = `"`, `d` = `≤`).
- Sem índice e o cabeçalho de página só diz a gama larga: o mapa é escrito todo
  em `mapa.py` (79 secções, títulos repetidos fixados por `posicoes`, páginas de
  caixas em duas colunas com `regiao`, refrigerante e nº de tubos dos ícones em
  `atributos`).
- Linhas em três bandas: BTU/h + intervalo em cima; ref + `SEER: 8.5 / A+++` +
  `SCOP: 4.6 / A++` + preço; kW + intervalo em baixo. Medidas com rótulo
  (`Interior:` / `Painel:` / `Exterior:`), tubagem `Ø 6.35 (1/4")`.
- Conjuntos Twin `2x UI + 1x UE` (a quantidade às vezes noutra banda, o `+`
  às vezes perdido) → ref `2X-UI+UE` (formato do catálogo anterior) com os kW
  totais (`3.52 x 2` → 7.04).
- Tabelas com um modelo por coluna: M-Thermal, ventiloconvectores (valores
  alta/média/baixa → fica a alta), chillers, HRV, VRF.
- Preços com a pontuação trocada (`8,200,00€`, `3,850.00€`, `4.64000€`): lidos
  com aviso.

## Correções (`pos.py`)

- Refs: `M40E`/`M40B` → `M4OE`/`M4OB` (a matriz p13 usa a letra O),
  `MOX63OU` → `MOX630U` (como na p7).
- Bombas de calor de piscina (p15): colunas Arrefecimento/Aquecimento trocadas.
- VRF 560 (p23): frio 8.0 (Easyfit) e 50.0 (V8) → 56.0.
- Kits de válvulas 3 vias e placa multifunções têm preço sem ref: ficam as refs
  do catálogo anterior (`KIT-VALVULAS-3VIAS-2TUBOS`, `…-4TUBOS`,
  `PLACA-MULTIFUNCOES`).
- Compatibilidade das UE multi-split lida das matrizes de combinações (p9,
  p12-13): classes de capacidade das UI 7/9/12/18/24.

## Por resolver com a SGT

- p24 "Cassete 2 Vias" repete as refs da "Cassete 1 Via" (`MIH##Q1N18`): as UI
  de 2 vias ficam de fora até haver refs.
- H-Pack (`EU-HSR50N7-H1`): bomba de calor monobloco de interior, só aquecimento
  impresso.

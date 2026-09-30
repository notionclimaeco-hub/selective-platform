# Hisense 2026 — notas da tabela

`HISENSE (3).pdf`, 56 páginas, ticket #43. Correções ao mapa automático
(estratégia índice) em `mapa.py`.

- Índice em duas colunas com números de página às vezes errados: o mapa
  confirma cada título na página.
- `UI / UE` nos conjuntos 1×1, `UI / painel` nas cassetes multi.
- `** Modelo trifásico` só vale na página onde está (U4 = monofásico, U6 =
  trifásico ficam sem `alimentacao` fora dela).
- A mesma ref `HC25YC0U` tem preço de conjunto (p14) e de UI multi (p20): fica
  o primeiro, com aviso.
- Tabelas VRF inteiras "sob consulta" (`pvpCents: 0` + aviso).
- "Kit de conexão UTA" traz kW/CV e fica em acessórios (o registo de
  acessórios aceita `frio-kw`/`calor-kw`/`cv`/`refrigerante`/`alimentacao`).
- "Unidades interiores 100% ar novo" (AVA-*) são UI VRF com kW →
  `ar-condicionado/vrf/uta/unidade-interior`.
- Monoblocos (Hi-Therma II M, R32 Monobloco) e chillers imprimem "UE", mas o
  `agrupar.py` fá-los `conjunto` (a UE é o produto).
- `(U.I.)` na coluna da tubagem não é categoria.
- p20 "Multi-Inverter Max Comfort" são UI (refs sem `G`, iguais às do conjunto
  p14 → aviso de preços diferentes, genuíno).

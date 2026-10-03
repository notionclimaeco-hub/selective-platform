# Mitsubishi Electric 2026 — notas da tabela

`MITSUBISHI Tabela  de Preços 2026.pdf`, 223 páginas, ticket #46. Preços PVR
s/IVA. O PDF é um catálogo: 85 páginas têm preços, as outras são apresentação,
specs sem preço, tabelas de combinações e condições gerais.

## Leitura

- Sem índice útil (o outline só tem os capítulos): o mapa (`mapa.py`) é gerado
  a partir das séries de `series.py` e as páginas de cada secção são as que o
  leitor encontra com refs dessa série. A mesma UI aparece em várias páginas
  (conjunto na p9, avulsa nas matrizes das p26, p30, p34 e p36): a secção
  decide-se pela ref, nunca pela página.
- `extrair.py` tem um leitor por tipo de quadro e `PAGINAS` diz quais há em
  cada página: `split` (ficha com um modelo por coluna, linhas "PVR (…)" por
  cor/alimentação e "Unidade interior/exterior"), `modelos` (modelo no
  cabeçalho), `ecodan` (UE e UI com preço próprio), `matriz` (UI multi-split
  por classe de capacidade × série "MSZ-LN##VG(W/R/B/V)"), `lista`, `fancoil`,
  `caixas` (comandos MELANS), `rooftop`, `fixo`.
- Conjuntos split vendem-se como `UI/UE` (a ficha imprime as duas refs; o
  catálogo antigo usava só a ref da UI e inventava "-3F" para os trifásicos).
  A coluna "PLSZ-M35EA" é o nome do conjunto, não uma ref.
- Cores pela última letra da UI: LN W branco, R vermelho, B preto, V branco
  pérola; EF W branco, B preto, S prateado. O 1.º preço da matriz é o da 1.ª
  nota ("570€ (VGW) / 670€ (VGR/B/V)").
- Alimentação das UE pela letra a seguir à capacidade (V = monofásica, Y =
  trifásica): as fichas imprimem "Monofásica | Trifásica" uma vez para várias
  colunas.
- "PUZ-M100VKA/YKA" e "PUZ-ZM100V(Y)DA" na linha da UE: a do PVR (Monofásico)
  e a do PVR (Trifásico).
- PKA-M##LAL/KAL (p81): a ref que as fichas split imprimem (LAL até 50, KAL acima).
- Ecodan: vendem-se a UE e a UI (hydrobox) com o preço de cada uma; a linha
  "Conjunto" é a soma e não é produto. Hydroboxes num grupo por série (ERSC/
  ERSD/ERSE/ERSF e Duo ERST..C/D/F): cada uma liga a outra UE.
- Ventiloconvectores Climaveneta: a ref é o modelo impresso + versão (VC, V3V,
  COMPLETO, SMART), como o catálogo já usava; o eixo é a chave `versao`.
- Jet Towel: JT-SB… (vertical) é a Slim e JT-S2AP… (caixa) a Smart, como no site.
- Refrigerante impresso só como logótipo em PUMY-SM (R32), PUMY-SP/P e
  PUHZ-SW (R410A), QAHV (CO2): vem de `fixos` em `series.py`.

## Decisões

- Multi-split: não há preços de combinações. Vende-se a UE e cada UI ao seu
  preço; a compatibilidade da UE são as séries de UI da matriz de preços da
  mesma gama (p26 MXZ, MSZ-HR só com MXZ-HA; p30 PXZ; p34 PUMY-SM; p36
  PUMY-SP/P; p81 UE Twin PUZ-M/PUZ-ZM). As tabelas de combinações (p40-48)
  dão somas de classes, não refs.
- Fora (sem ref nem preço próprio): opcionais de chillers, UTAs e rooftops
  com preço por modelo (Interface Modbus, baterias…), "Unidade Exterior para
  s-AIRME" (combinação de PUZ-ZM), City Multi/Hybrid City Multi e IT Cooling
  close control (gamas sob consulta sem refs), EAHV (p141, sem preço).
- Sob consulta com ref: GUX, CAHV, QAHV, A1M-ATW, KIPlink BT9ZZ00008, ME-AC-*
  (p210): ficam com pvpCents 0 e aviso, como o VRF da Hisense.
- Os kits de distribuição da p81 repetem a lista da p83: só a p83 é lida.
- QAHV (bomba de calor CO2 para AQS) vai para bombas-de-calor: o registo AQS
  exige depósito.

- Listas com cabeçalho "REFERÊNCIAS" (p118-119, acessórios Climaveneta, refs de 10
  dígitos): a descrição é só a da linha da ref (entre itens há subtítulos de grupo).
- p210: FGBACNET e "MelcoBEMS Mini (A1M)" não têm dígitos (`refs_nome`). A mesma ref
  impressa para dois protocolos (ME-AC-700-50/100 KNX e MODBUS, MelcoBEMS Mini BACnet e
  Modbus) é um produto: as descrições juntam-se ("Interface KNX ou MODBUS (IP) …").

## Correções (`pos.py`)

- MAC-334IF / MAC-497IF / PAC-SJ95MA (p209) = MAC-334IF-E / … (p83): fica a ref "-E".
- p69 imprime as UE Classic Inverter 200/250 como PUZ-M200YDA/PUZ-M250YDA; a
  p81 vende-as como PUZ-M200YKA/PUZ-M250YKA → conjuntos corrigidos, com aviso.
- p114 a-LIFE2 HP 2T DLIO 1002: aquecimento impresso "807" → 8.07, com aviso.
- PAR-CT01MAA-S/SB/PB: um comando com `cor` e `tipo` (com/sem Bluetooth).
- P-RCC-E (p128, tampa do lugar do comando): a ref não tem dígitos (aceite pelo leitor de
  listas) e a descrição fala de "comando": fica acessório.

## Avisos que ficam (genuínos)

- classe-energetica: rooftops WSM2 e s-MEXT não imprimem classe; Mr. Slim
  125/140 e PEA 200/250 imprimem "-"; CAHV/QAHV sob consulta.
- calor-kw: s-MEXT e MSY-TP são só frio.
- PAC-SA88HA-E: 15 € na p83 (Mr. Slim) e 50 € na p130 (Lossnay).
- 5569010100 / 5569010200 (p119): 130 €/200 € para LIFE2 HP e 120 €/130 € para i-MXW.
- PLA-M60EA/SUZ-M60VA: "2.550" sem €.

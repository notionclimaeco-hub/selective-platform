#!/usr/bin/env python3
"""Correções ao mapa.json automático da Hisense 2026 (ticket #43).

Corre depois de `mapa.py` e antes de `extrair.py`. Cada edição está
justificada no comentário; as decisões de modelo vão para o PR.
"""
import json
from pathlib import Path

p = Path(__file__).with_name("mapa.json")
m = json.loads(p.read_text())
por_id = {s["id"]: s for s in m["seccoes"]}

# Hi-Therma II M (AHZ-*) é monobloco, como a R32 Monobloco (mesma família AHZ):
# a "UE" impressa é o produto inteiro.
por_id["hi-therma-ii-m"]["sistema"] = "monobloco"

# Título comprido do índice; o site chama-lhe Hi-Therma II Hydro. UE partilhada
# pelas duas variantes, UI = hydrobox (AHM) ou integra (AHS).
por_id["hi-therma-ii-hydro-split-e-hydro-integra"]["gama"] = "Hi-Therma II Hydro"

# p20: "Multi-Inverter Max Comfort" lista UI multi (HC*), não conjuntos.
s = por_id["multi-inverter-max-comfort"]
s["componente"] = "unidade-interior"
s["gama"] = "Multi-Inverter Interior Max Comfort"

# Matriz p21 = as UE de "Multi-inverter Exterior" (p18); mesma gama para que
# uma ref só na matriz (3AMW72U4RKC) caia no mesmo grupo.
por_id["capacidades-compativeis"]["gama"] = "Multi-inverter Exterior"

# p43 "Unidades interiores 100% ar novo" (AVA-*): unidades interiores VRF de ar
# novo com kW (não caudal) — são ar-condicionado/vrf, tipoUnidade uta, e não
# ventilação (o registo de ventilação exige caudal-m3h).
s = por_id["unidades-interiores-100-ar-novo"]
s.update({"familia": "ar-condicionado", "sistema": "vrf", "tipoUnidade": "uta",
          "componente": "unidade-interior", "gama": "100% Ar Novo"})

# p44 "Kit de conexão UTA" (HZX-*): kit de válvula de expansão para ligar UTA de
# terceiros ao VRF; fica em acessórios (o registo de acessórios aceita agora
# frio-kw/calor-kw/cv/refrigerante/alimentacao). Tabela "preços sob consulta".
por_id["kit-de-conexao-uta"]["semPreco"] = True

# Tabelas VRF inteiras "sob consulta" (detetadas pela nota; explícito ajuda).
for sid in ("mini-vrf-r32-h5", "mini-vrf-serie-l-c", "mini-vrf-hi-smart-a",
            "hi-smart-i-vrf-centrifugo", "multifuncoes", "multifuncoes-ii-r32",
            "serie-s", "s-especial-anticorrosao", "s5-bomba-de-calor", "serie-w",
            "conduta-de-baixa-pressao", "conduta-de-media-alta-pressao",
            "cassete-de-4-vias", "mini-cassete-de-4-vias", "cassete-de-1-via",
            "cassete-de-2-vias", "mural", "consola", "chao-teto",
            "chao-sem-envolvente", "coluna", "hydrobox-para-serie-s",
            "hydrobox-para-serie-multifuncoes", "unidades-interiores-100-ar-novo",
            "recuperadores-de-calor-de-fluxos-cruzados-com-bateria-dx",
            "derivadores-para-sistemas-vrf-2-e-3-tubos",
            "caixas-de-recuperacao-de-calor"):
    por_id[sid]["semPreco"] = True

# Gamas curtas (o tipo já entra no nome: "Recuperador de Calor …", "Chiller …").
por_id["recuperadores-de-calor-de-fluxos-cruzados-sem-bateria-dx"]["gama"] = "Fluxos Cruzados"
por_id["recuperadores-de-calor-de-fluxos-cruzados-com-bateria-dx"]["gama"] = "Fluxos Cruzados com Bateria DX"
por_id["chillers"]["gama"] = "Chiller"

p.write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n")
print("mapa.json corrigido")

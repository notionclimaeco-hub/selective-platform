from agrupar import agrupar

MAPA = {"numPaginas": 30, "seccoes": [
    {"id": "air-master", "titulo": "Air Master", "paginas": [12], "tipo": "tabela",
     "familia": "ar-condicionado", "segmento": "domestico", "sistema": "mono-split",
     "tipoUnidade": "mural", "componente": "conjunto", "gama": "Air Master", "semPreco": False},
    {"id": "cassete-1x1", "titulo": "Cassete 1x1", "paginas": [23, 24], "tipo": "tabela",
     "familia": "ar-condicionado", "segmento": "comercial", "sistema": "mono-split",
     "tipoUnidade": "cassete-4-vias", "componente": "conjunto", "gama": "Cassete 1x1", "semPreco": False},
    {"id": "multi-ue", "titulo": "Multi-Inverter Exterior", "paginas": [18], "tipo": "tabela",
     "familia": "ar-condicionado", "segmento": "comercial", "sistema": "multi-split",
     "tipoUnidade": "exterior", "componente": "unidade-exterior", "gama": "Multi-Inverter Exterior",
     "semPreco": False},
    {"id": "compat", "titulo": "Capacidades Compatíveis", "paginas": [21], "tipo": "compatibilidade",
     "familia": "ar-condicionado", "segmento": "comercial", "sistema": "multi-split",
     "tipoUnidade": "exterior", "componente": "unidade-exterior", "gama": "Multi-Inverter", "semPreco": True},
    {"id": "vrf-conduta", "titulo": "Conduta de Baixa Pressão", "paginas": [37], "tipo": "tabela",
     "familia": "ar-condicionado", "segmento": "comercial", "sistema": "vrf",
     "tipoUnidade": "conduta-baixa-pressao", "componente": "unidade-interior",
     "gama": "Conduta de Baixa Pressão", "semPreco": True},
    {"id": "acessorios", "titulo": "Acessórios", "paginas": [27], "tipo": "tabela",
     "familia": "acessorios-e-controlo", "segmento": "comercial", "sistema": None,
     "tipoUnidade": None, "componente": "acessorio", "gama": "Acessórios", "semPreco": False},
]}


def linha(ref, seccao, pagina, pvp, campos=None, contexto=None, hint=None, **extra):
    return {"ref": ref, "refs": ref.split("/") if "/" in ref else None, "ean": None, "pagina": pagina,
            "pdfPaginas": [pagina], "y": 100.0, "texto": ref, "campos": campos or {},
            "confianca": {}, "contexto": contexto or {}, "componenteHint": hint, "pvpCents": pvp,
            "numPrecos": 1 if pvp else 0, "seccao": seccao, "notas": [], "precoSobConsulta": False, **extra}


def run(linhas):
    return agrupar(linhas, MAPA, "hisense", 2026, "hisense-2026.pdf")


def test_serie_por_capacidade_da_um_grupo_com_variantes():
    out = run([
        linha("QK25WM0A", "air-master", 12, 145000, {"frio-kw": "2.6", "calor-kw": "3.2", "classe-energetica": "A+++/A+++"}),
        linha("QK35WM0A", "air-master", 12, 149500, {"frio-kw": "3.5", "calor-kw": "4.2", "classe-energetica": "A+++/A+++"}),
        linha("QK50FM0A", "air-master", 12, 189000, {"frio-kw": "5.0", "calor-kw": "5.4", "classe-energetica": "A+++/A+++"}),
    ])
    assert out["marca"] == "hisense" and out["ano"] == 2026 and out["tabelaOrigem"] == "hisense-2026"
    skus = out["skus"]
    assert {s["grupoModelo"] for s in skus} == {"hisense-air-master"}
    assert skus[0]["nomeGrupo"] == "Mural Air Master"
    assert [s["nome"] for s in skus] == ["Mural Air Master 2.6 kW", "Mural Air Master 3.5 kW", "Mural Air Master 5.0 kW"]
    assert skus[0]["componente"] == "conjunto" and skus[0]["tipoUnidade"] == "mural"
    assert skus[0]["gama"] == "Air Master" and skus[0]["pvpCents"] == 145000 and skus[0]["ivaIncluido"] is False
    assert skus[0]["atributos"][0] == {"chave": "frio-kw", "valor": "2.6"}
    assert skus[0]["avisos"] == []


def test_ui_e_ue_do_conjunto_sao_grupos_separados_por_componente():
    out = run([
        linha("AUC105UR4RKC8/AUW105U4RW8", "cassete-1x1", 23, 300000, {"frio-kw": "10.0", "calor-kw": "11.0"},
              {"serie": "Turbo Inverter"}, "conjunto"),
        linha("AUC105UR4RKC8", "cassete-1x1", 23, 100000, {"dimensoes": "840x272x840"}, {"serie": "Turbo Inverter"}),
        linha("AUW105U4RW8", "cassete-1x1", 23, 200000, {"dimensoes": "1100x875x450"}, {"serie": "Turbo Inverter"}),
        linha("AUC125UR4RKC8/AUW125U4RW8", "cassete-1x1", 24, 438000, {"frio-kw": "12.1", "calor-kw": "13.5"},
              {"serie": "Turbo Inverter"}, "conjunto"),
        linha("AUC125UR4RKC8", "cassete-1x1", 24, 106500, {"dimensoes": "840x272x840"}, {"serie": "Turbo Inverter"}),
        linha("AUW125U4RW8", "cassete-1x1", 24, 316500, {"dimensoes": "1100x875x450"}, {"serie": "Turbo Inverter"}),
    ])
    por_ref = {s["ref"]: s for s in out["skus"]}
    assert por_ref["AUC105UR4RKC8/AUW105U4RW8"]["grupoModelo"] == "hisense-cassete-1x1-turbo-inverter"
    assert por_ref["AUC105UR4RKC8/AUW105U4RW8"]["nomeGrupo"] == "Cassete 1x1 Turbo Inverter"
    assert por_ref["AUC105UR4RKC8"]["componente"] == "unidade-interior"
    assert por_ref["AUC105UR4RKC8"]["grupoModelo"] == "hisense-cassete-1x1-turbo-inverter-unidade-interior"
    assert por_ref["AUC105UR4RKC8"]["nomeGrupo"] == "Cassete 1x1 Turbo Inverter | Unidade Interior"
    assert por_ref["AUW105U4RW8"]["componente"] == "unidade-exterior"
    assert por_ref["AUW105U4RW8"]["grupoModelo"] == "hisense-cassete-1x1-turbo-inverter-unidade-exterior"
    assert {"chave": "dimensoes-ui", "valor": "840x272x840"} in por_ref["AUC105UR4RKC8"]["atributos"]
    assert {"chave": "dimensoes-ue", "valor": "1100x875x450"} in por_ref["AUW105U4RW8"]["atributos"]
    # a UI sold apart inherits the kW of its conjunto so the variant table can show it
    assert por_ref["AUC105UR4RKC8"]["nome"] == "Cassete 1x1 Turbo Inverter | Unidade Interior 10.0 kW"
    assert {"chave": "frio-kw", "valor": "10.0"} in por_ref["AUC105UR4RKC8"]["atributos"]
    assert por_ref["AUC125UR4RKC8"]["pdfPaginas"] == [24]


def test_variantes_de_cor_partilham_grupo_e_a_ue_comum_sai_uma_vez_sem_cor():
    out = run([
        linha("QK25WM0A", "air-master", 12, 145000, {"frio-kw": "2.6"}, {"cor": "branco"}),
        linha("AS25WM00W", "air-master", 12, 103000, {"dimensoes": "785x540x260"}, {"cor": "branco"}, "unidade-exterior"),
        linha("QK25WM0B", "air-master", 12, 145000, {"frio-kw": "2.6"}, {"cor": "preto"}),
        linha("AS25WM00W", "air-master", 13, 103000, {"dimensoes": "785x540x260"}, {"cor": "preto"}, "unidade-exterior"),
    ])
    por_ref = {s["ref"]: s for s in out["skus"]}
    assert len(out["skus"]) == 3
    assert por_ref["QK25WM0A"]["grupoModelo"] == por_ref["QK25WM0B"]["grupoModelo"] == "hisense-air-master"
    assert por_ref["QK25WM0A"]["atributos"][0] == {"chave": "cor", "valor": "branco"}
    assert por_ref["QK25WM0B"]["atributos"][0] == {"chave": "cor", "valor": "preto"}
    assert por_ref["QK25WM0A"]["nome"] == "Mural Air Master 2.6 kW"
    ue = por_ref["AS25WM00W"]
    assert ue["pdfPaginas"] == [12, 13]
    assert not any(a["chave"] == "cor" for a in ue["atributos"])
    assert ue["grupoModelo"] == "hisense-air-master-unidade-exterior"


def test_paineis_sem_potencia_numa_seccao_de_equipamento_sao_acessorios():
    out = run([
        linha("AUC105UR4RKC8", "cassete-1x1", 23, 100000, {"frio-kw": "10.0"}, {"serie": "Turbo Inverter"}),
        linha("PE-QFA-CD", "cassete-1x1", 23, 15000, {"dimensoes": "950x50x950"}, {"serie": "Turbo Inverter"}),
    ])
    painel = {s["ref"]: s for s in out["skus"]}["PE-QFA-CD"]
    assert painel["familia"] == "acessorios-e-controlo" and painel["componente"] == "acessorio"
    assert painel["grupoModelo"] == "hisense-pe-qfa-cd-acessorio"
    assert painel["nomeGrupo"] == "Painel PE-QFA-CD"
    assert painel.get("tipoUnidade") is None


def test_matriz_de_compatibilidade_funde_na_ue_da_tabela_de_precos():
    out = run([
        linha("2AMW42U4RGC", "multi-ue", 18, 100000, {"unidades-max": "2", "frio-kw": "4.1"}, hint="unidade-exterior"),
        linha("2AMW42U4RGC", "compat", 21, None, {"unidades-max": "2"}, hint="unidade-exterior",
              compativelCom=["UI 2.5 kW", "UI 3.5 kW"], soCompatibilidade=True),
        linha("3AMW72U4RKC", "compat", 21, None, {"unidades-max": "3"}, hint="unidade-exterior",
              compativelCom=["UI 2.5 kW"], soCompatibilidade=True),
    ])
    por_ref = {s["ref"]: s for s in out["skus"]}
    ue = por_ref["2AMW42U4RGC"]
    assert ue["compativelCom"] == ["UI 2.5 kW", "UI 3.5 kW"]
    assert ue["pdfPaginas"] == [18, 21] and ue["pvpCents"] == 100000
    assert ue["nome"] == "Multi-Inverter | Unidade Exterior 4.1 kW (até 2 UI)"
    assert ue["grupoModelo"] == "hisense-multi-inverter-unidade-exterior"
    orfa = por_ref["3AMW72U4RKC"]
    assert orfa["pvpCents"] == 0
    assert any("matriz" in a for a in orfa["avisos"])


def test_vrf_sem_preco_leva_aviso_e_gama_com_vrf():
    out = run([
        linha("AVE-05HJFDL", "vrf-conduta", 37, None, {"frio-kw": "1.7", "calor-kw": "1.9", "refrigerante": "R410A"},
              {"pressao-estatica": "baixa"}, "unidade-interior", precoSobConsulta=True),
    ])
    s = out["skus"][0]
    assert s["pvpCents"] == 0
    assert any("sob consulta" in a for a in s["avisos"])
    assert s["gama"] == "VRF Conduta de Baixa Pressão"
    assert s["grupoModelo"] == "hisense-vrf-conduta-de-baixa-pressao-unidade-interior"
    assert s["atributos"][0] == {"chave": "pressao-estatica", "valor": "baixa"}


def test_acessorios_sao_nomeados_pela_descricao_e_desambiguados():
    out = run([
        linha("YXE-C01U1", "acessorios", 27, 9000, {"descricao": "Controlador remoto por cabo com recetor IR"}),
        linha("YXE-E01U(E)", "acessorios", 27, 8000, {"descricao": "Controlador remoto por cabo com função deepcool"}),
        linha("B544(E)", "acessorios", 27, 8000, {"descricao": "Gateway de controlo (sistemas twin, triple)"}),
        linha("B545(E)", "acessorios", 27, 12500, {"descricao": "Gateway de controlo (sistemas twin, triple)"}),
    ])
    por_ref = {s["ref"]: s for s in out["skus"]}
    assert por_ref["YXE-C01U1"]["nomeGrupo"] == "Controlador remoto por cabo com recetor IR"
    assert por_ref["YXE-C01U1"]["componente"] == "comando"
    assert por_ref["YXE-C01U1"]["grupoModelo"] == "hisense-yxe-c01u1-comando"
    assert por_ref["YXE-C01U1"]["descricao"] == "Controlador remoto por cabo com recetor IR"
    assert por_ref["B544(E)"]["nomeGrupo"] != por_ref["B545(E)"]["nomeGrupo"]
    assert por_ref["B544(E)"]["nomeGrupo"].startswith("Gateway de controlo")
    assert por_ref["B544(E)"]["componente"] == "acessorio"
    assert len({s["nomeGrupo"] for s in out["skus"]}) == 4


def test_ui_e_ue_residenciais_herdam_os_kw_do_conjunto_impresso_acima():
    out = run([
        linha("CA25YR3B", "air-master", 15, 60500, {"frio-kw": "2.6", "calor-kw": "2.7"}),
        linha("CA25YR3BG", "air-master", 15, 17500, {"dimensoes": "790x255x200"}, hint="unidade-interior"),
        linha("CA25YR3BW", "air-master", 15, 43000, {"dimensoes": "660x483x240"}, hint="unidade-exterior"),
        linha("CA35LR03", "air-master", 15, 66000, {"frio-kw": "3.4", "calor-kw": "3.8"}),
        linha("CA35LR03G", "air-master", 15, 19000, {"dimensoes": "790x255x200"}, hint="unidade-interior"),
    ])
    por_ref = {s["ref"]: s for s in out["skus"]}
    assert por_ref["CA25YR3BG"]["nome"].endswith("| Unidade Interior 2.6 kW")
    assert por_ref["CA25YR3BW"]["nome"].endswith("| Unidade Exterior 2.6 kW")
    assert por_ref["CA35LR03G"]["nome"].endswith("| Unidade Interior 3.4 kW")


def test_serie_com_dois_prefixos_de_ref_fica_num_so_grupo():
    out = run([
        linha("AVT60UR4RB8/AUW60U4RK8", "cassete-1x1", 25, 217000, {"frio-kw": "6.2"}, {"serie": "Turbo Inverter"}, "conjunto"),
        linha("AUV105UR4RC8/AUW105U4RW8", "cassete-1x1", 25, 350000, {"frio-kw": "9.5"}, {"serie": "Turbo Inverter"}, "conjunto"),
    ])
    assert {s["grupoModelo"] for s in out["skus"]} == {"hisense-cassete-1x1-turbo-inverter"}


def test_painel_no_conjunto_ui_mais_painel_nao_e_unidade_exterior():
    sec_multi_ui = {"id": "multi-ui-cassete", "titulo": "Multi-Inverter Interior Cassete", "paginas": [18],
                    "tipo": "tabela", "familia": "ar-condicionado", "segmento": "comercial",
                    "sistema": "multi-split", "tipoUnidade": "cassete-4-vias", "componente": "unidade-interior",
                    "gama": "Multi-Inverter Interior Cassete", "semPreco": False}
    mapa = {"numPaginas": 30, "seccoes": MAPA["seccoes"] + [sec_multi_ui]}
    out = agrupar([
        linha("ACT26UR4RCC8/PE-QEA-LD", "multi-ui-cassete", 18, 75000, {}, hint="conjunto"),
        linha("ACT26UR4RCC8", "multi-ui-cassete", 18, 62000, {"frio-kw": "2.6", "calor-kw": "3.2"}),
        linha("PE-QEA-LD", "multi-ui-cassete", 18, 13000, {"dimensoes": "620x40x620"}),
    ], mapa, "hisense", 2026, "t.pdf")
    por_ref = {s["ref"]: s for s in out["skus"]}
    assert por_ref["PE-QEA-LD"]["componente"] == "acessorio"
    assert por_ref["ACT26UR4RCC8"]["componente"] == "unidade-interior"
    assert por_ref["ACT26UR4RCC8"]["grupoModelo"] == "hisense-multi-inverter-cassete-unidade-interior"
    assert por_ref["ACT26UR4RCC8/PE-QEA-LD"]["grupoModelo"] == "hisense-multi-inverter-cassete"
    assert por_ref["ACT26UR4RCC8/PE-QEA-LD"]["nome"] == "Multi-Inverter Cassete 2.6 kW"


def test_bomba_de_calor_e_recuperador_levam_o_rotulo_da_familia_sem_repetir():
    mapa = {"numPaginas": 50, "seccoes": MAPA["seccoes"] + [
        {"id": "split", "titulo": "Hi-Therma R32 Split", "paginas": [9], "tipo": "tabela",
         "familia": "bombas-de-calor", "segmento": "domestico", "sistema": "bibloco", "tipoUnidade": "exterior",
         "componente": "conjunto", "gama": "Hi-Therma R32 Split", "semPreco": False},
        {"id": "rec", "titulo": "Recuperadores de calor de fluxos cruzados", "paginas": [43], "tipo": "tabela",
         "familia": "ventilacao", "segmento": "comercial", "sistema": None, "tipoUnidade": "recuperador-de-calor",
         "componente": "conjunto", "gama": "Recuperadores de calor de fluxos cruzados", "semPreco": False}]}
    out = agrupar([
        linha("AHW-044HCDS1", "split", 9, 169600, {"frio-kw": "4.4", "calor-kw": "4.4"}, hint="unidade-exterior"),
        linha("HKF-25D1EC", "rec", 43, 171500, {"caudal-m3h": "250"}),
    ], mapa, "hisense", 2026, "t.pdf")
    por_ref = {s["ref"]: s for s in out["skus"]}
    assert por_ref["AHW-044HCDS1"]["nomeGrupo"] == "Bomba de Calor Hi-Therma R32 Split | Unidade Exterior"
    assert por_ref["HKF-25D1EC"]["nomeGrupo"] == "Recuperadores de calor de fluxos cruzados"
    assert por_ref["HKF-25D1EC"]["nome"] == "Recuperadores de calor de fluxos cruzados 250 m³/h"


def test_acessorios_com_o_mesmo_esqueleto_partem_se_pela_descricao():
    # Opções de UTA por tamanho: F7 e F9 têm o mesmo esqueleto (ARF#F#B) e os mesmos tamanhos.
    linhas = [linha(f"ARF0{t}F{f}B", "acessorios", 27, 10000 + t, {"descricao": f"Filtro F{f}", "tamanho": str(t)})
              for f in (7, 9) for t in (1, 2)]
    grupos = {}
    for s in run(linhas)["skus"]:
        grupos.setdefault(s["grupoModelo"], []).append(s["ref"])
    assert sorted(grupos.values()) == [["ARF01F7B", "ARF02F7B"], ["ARF01F9B", "ARF02F9B"]]

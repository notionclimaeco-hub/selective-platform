"""Layouts da tabela Midea 2026 (SGT): células em várias linhas, conjuntos Twin,
tabelas com um modelo por coluna, caixas de acessórios em duas colunas."""

from agrupar import agrupar
from conftest import escrever, linha, pagina_a4
from extrair import _preco, extrair_pagina
from mapa import localizar_titulo, reparar_glifos

SEC = {"id": "mural", "titulo": "Mural Breezeless S", "paginas": [1], "tipo": "tabela",
       "familia": "ar-condicionado", "segmento": "domestico", "sistema": "mono-split",
       "tipoUnidade": "mural", "componente": "conjunto", "gama": "Mural Breezeless S", "semPreco": False}


def cabecalho(p, y):
    linha(p, y, [(150, "Arrefecimento"), (215, "Aquecimento"), (280, "Classe"), (330, "Classe"),
                 (385, "Dimensões"), (460, "Linha")])
    linha(p, y + 3, [(60, "Modelo"), (530, "PVP")])
    linha(p, y + 9, [(155, "Btu/h"), (175, "(kW)"), (220, "Btu/h"), (240, "(kW)"), (285, "SEER"),
                     (335, "SCOP"), (385, "LxAxP"), (405, "(mm)"), (440, "Aspiração")])


def test_glifos_trocados_do_type3_da_midea():
    assert reparar_glifos("920,00¬") == "920,00€"
    assert reparar_glifos("EZ-09RD6€") == "EZ-09RD6"
    assert reparar_glifos("Azzz") == "A+++" and reparar_glifos("Az€") == "A+"
    assert reparar_glifos("(3/8˛)") == '(3/8")'
    assert reparar_glifos("12000 (4500~14900)(") == "12000 (4500~14900)"
    assert reparar_glifos("d") == "≤"


def test_linha_em_tres_bandas_com_seer_scop_e_dimensoes_rotuladas(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 120, "Mural Breezeless S", 11)
    cabecalho(p, 140)
    linha(p, 170, [(140, "9000 (2900~11200)"), (205, "13000 (3000~15500)"), (370, "Interior: 940x325x193")])
    linha(p, 173, [(60, "MSFAAU-09HFN8"), (262, "SEER: 8.5 / A+++"), (320, "SCOP: 4.6 / A++"),
                   (430, "Ø 6.35 (1/4\") / Ø 9.52 (3/8\")"), (525, "920,00€")])
    linha(p, 179, [(145, "2.63 (0.85~3.28)"), (210, "3.81 (0.88~4.54)"), (370, "Exterior: 765x555x303")])
    [l] = extrair_pagina(p, [SEC], 1)
    c = l["campos"]
    assert l["ref"] == "MSFAAU-09HFN8" and l["pvpCents"] == 92000
    assert c["btu"] == "9000" and c["frio-kw"] == "2.63" and c["calor-kw"] == "3.81"
    assert c["frio-kw-min"] == "0.85" and c["frio-kw-max"] == "3.28"
    assert c["seer"] == "8.5" and c["scop"] == "4.6" and c["classe-energetica"] == "A+++/A++"
    assert c["dimensoes-ui"] == "940x325x193" and c["dimensoes-ue"] == "765x555x303"
    assert c["tubagem"] == "1/4-3/8"
    assert l["componenteHint"] is None          # "Exterior:" é rótulo da medida, não a categoria


def test_conjunto_twin_com_quantidade_noutra_banda_e_ue_na_linha_de_baixo(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 120, "Conduta", 11)
    cabecalho(p, 140)
    sec = {**SEC, "id": "twin", "titulo": "Conduta", "tipoUnidade": "conduta"}
    linha(p, 170, [(69, "MTJ-12HWFNX(GA)"), (396, "700x200x450")])
    linha(p, 173, [(61, "2x"), (144, "12000 (1800~13334) x 2"), (372, "Interior:")])
    linha(p, 176, [(274, "SEER: 6.5 / A++"), (325, "SCOP: 4.1 / A+"), (520, "2.465,00€")])
    linha(p, 179, [(49, "+ 1x MOX430U-24HFN8-Q1(GA)"), (160, "3.52 (0.53~3.91) x 2"),
                   (372, "Exterior: 890x673x342")])
    linha(p, 200, [(51, "+ 2x MTJ-18HWFNX(GA)"), (520, "3.280,00€")])
    linha(p, 206, [(55, "1x MOD30U-36HFN8-R(GA)"), (150, "5.28")])
    por_ref = {l["ref"]: l for l in extrair_pagina(p, [sec], 1)}
    assert set(por_ref) == {"2X-MTJ-12HWFNX(GA)+MOX430U-24HFN8-Q1(GA)", "2X-MTJ-18HWFNX(GA)+MOD30U-36HFN8-R(GA)"}
    l = por_ref["2X-MTJ-12HWFNX(GA)+MOX430U-24HFN8-Q1(GA)"]
    assert l["refs"] == ["MTJ-12HWFNX(GA)", "MOX430U-24HFN8-Q1(GA)"] and l["componenteHint"] == "conjunto"
    assert l["pvpCents"] == 246500
    assert l["campos"]["frio-kw"] == "7.04" and l["campos"]["btu"] == "24000"   # "3.52 x 2" → total


def test_ue_e_deposito_na_mesma_linha_com_um_preco_cada(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 120, "CirQHP", 11)
    linha(p, 150, [(96, "Modelo"), (169, "Depósito"), (227, "Volume"), (268, "PVP"), (316, "PVP")])
    linha(p, 173, [(40, "M3OA-18HFN8-Q"), (153, "PLSX-100(30)/DN8-A"), (230, "100 L"),
                   (266, "1.600,00€"), (316, "1.100,00€")])
    sec = {**SEC, "id": "cirqhp", "titulo": "CirQHP", "componente": "unidade-exterior"}
    por_ref = {l["ref"]: l for l in extrair_pagina(p, [sec], 1)}
    assert por_ref["M3OA-18HFN8-Q"]["pvpCents"] == 160000
    assert por_ref["PLSX-100(30)/DN8-A"]["pvpCents"] == 110000
    assert por_ref["PLSX-100(30)/DN8-A"]["campos"]["deposito-l"] == "100"
    assert "deposito-l" not in por_ref["M3OA-18HFN8-Q"]["campos"]


def test_tabela_com_um_modelo_por_coluna(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 120, "M-Thermal Série HYGGE Tipo Split", 11)
    linha(p, 150, [(45, "Modelo Unidade Exterior"), (127, "MHA-V12WD2N8-E"), (200, "MHA-V14WD2N8-E"),
                   (343, "MHA-V12WD2RN8-E*")])
    linha(p, 171, [(44, "Modelo Módulo Hidrónico"), (203, "HB-A160CGN8-E")])
    linha(p, 195, [(52, "Aquecimento (kW)"), (146, "12.10"), (220, "14.0"), (365, "12.10")])
    linha(p, 219, [(50, "Arrefecimento (kW)"), (147, "10.0"), (220, "10.0"), (366, "10.0")])
    linha(p, 246, [(48, "PVP Unidade Exterior"), (138, "3.450,00€"), (211, "3.600,00€"), (357, "3,850.00€")])
    linha(p, 270, [(48, "PVP Módulo Hidrónico"), (211, "2.660,00€")])
    escrever(p, 41, 291, "*Nota: Modelo na versão trifásica.", 7)
    sec = {**SEC, "id": "hygge", "titulo": "M-Thermal Série HYGGE Tipo Split", "familia": "bombas-de-calor",
           "componente": "unidade-exterior"}
    por_ref = {l["ref"]: l for l in extrair_pagina(p, [sec], 1)}
    assert set(por_ref) == {"MHA-V12WD2N8-E", "MHA-V14WD2N8-E", "MHA-V12WD2RN8-E", "HB-A160CGN8-E"}
    ue = por_ref["MHA-V14WD2N8-E"]
    assert ue["campos"] == {"calor-kw": "14.0", "frio-kw": "10.0"} and ue["pvpCents"] == 360000
    tri = por_ref["MHA-V12WD2RN8-E"]
    assert tri["marcadorRef"] == 1 and tri["pvpCents"] == 385000 and tri["precoImpresso"] == "3,850.00€"
    modulo = por_ref["HB-A160CGN8-E"]
    assert modulo["pvpCents"] == 266000 and modulo["campos"] == {}   # linha que não cobre as colunas: sem kW
    assert any("trifásica" in n for n in ue["notas"])


def test_refs_partidas_em_duas_linhas_e_valores_alta_media_baixa(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 120, "Conduta DC 2 Tubos", 11)
    linha(p, 145, [(103, "MKT3-"), (149, "MKT3-")])
    linha(p, 148, [(55, "Modelo")])
    linha(p, 151, [(95, "V200G12-CL"), (142, "V300G12-CL")])
    linha(p, 172, [(44, "Arrefecimento"), (92, "2.45/2.05/1.59"), (142, "3.35/2.89/2.21")])
    linha(p, 196, [(59, "PVP"), (100, "320,00€"), (147, "375,00€")])
    sec = {**SEC, "id": "fc", "titulo": "Conduta DC 2 Tubos", "familia": "ventiloconvectores"}
    por_ref = {l["ref"]: l for l in extrair_pagina(p, [sec], 1)}
    assert por_ref["MKT3-V200G12-CL"]["campos"]["frio-kw"] == "2.45"
    assert por_ref["MKT3-V300G12-CL"]["pvpCents"] == 37500


def test_caixas_de_acessorios_em_duas_colunas_com_legenda(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 80, "Comandos e Acessórios", 20)
    for x, legenda, ref, preco in ((41, "COMANDO POR CABO", "KJR-29B/BK-E", "110,00€"),
                                   (301, "INTERFACE LIGAÇÃO WEB", "CCM-15(A)", "900,00€")):
        escrever(p, x, 140, legenda, 7)
        linha(p, 160, [(x + 40, "Modelo"), (x + 147, "PVP")])
        linha(p, 181, [(x + 30, ref), (x + 142, preco)])
    escrever(p, 41, 212, "COMANDO CCM-180A/BWS(A)", 7)
    linha(p, 232, [(81, "Modelo"), (188, "PVP")])
    linha(p, 253, [(66, "CCM-180A/BWS(A)"), (180, "1.215,00€")])
    base = {**SEC, "titulo": "Comandos e Acessórios", "familia": "acessorios-e-controlo",
            "componente": "acessorio", "posicoes": {"1": 90}}
    esq = {**base, "id": "esq", "regiao": {"x1": 297}}
    dir_ = {**base, "id": "dir", "regiao": {"x0": 297}}
    linhas = extrair_pagina(p, [esq, dir_], 1)
    por_ref = {l["ref"]: l for l in linhas}
    assert por_ref["KJR-29B/BK-E"]["seccao"] == "esq" and por_ref["CCM-15(A)"]["seccao"] == "dir"
    assert por_ref["KJR-29B/BK-E"]["refs"] is None                 # "/BK-E" não parte a ref
    assert por_ref["KJR-29B/BK-E"]["campos"]["descricao"] == "Comando por cabo"
    assert por_ref["CCM-15(A)"]["campos"]["descricao"] == "Interface ligação web"
    assert por_ref["CCM-180A/BWS(A)"]["campos"]["descricao"] == "Comando CCM-180A/BWS(A)"
    assert [l["ref"] for l in linhas].count("CCM-180A/BWS(A)") == 1


def test_precos_com_pontuacao_trocada():
    assert _preco("8,200,00€") == (820000, False)
    assert _preco("3,850.00€") == (385000, False)
    assert _preco("4.64000€") == (464000, False)
    assert _preco("1.215,00€") == (121500, True)
    assert _preco("SEER:") == (None, False)


def test_titulos_que_so_diferem_num_digito(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 300, "Conduta DC 2 Tubos", 11)
    escrever(p, 40, 460, "Conduta DC 4 Tubos", 11)
    assert localizar_titulo(p, "Conduta DC 4 Tubos")[0] > localizar_titulo(p, "Conduta DC 2 Tubos")[0]


MAPA = {"numPaginas": 1, "seccoes": [
    {"id": "hygge", "titulo": "HYGGE", "paginas": [1], "tipo": "tabela", "familia": "bombas-de-calor",
     "segmento": "domestico", "sistema": "bibloco", "tipoUnidade": "exterior", "componente": "unidade-exterior",
     "gama": "M-Thermal HYGGE", "semPreco": False, "atributos": {"refrigerante": "R32"},
     "porRef": [{"prefixo": "HB-", "componente": "unidade-interior", "tipoUnidade": "modulo-hidraulico",
                 "rotulo": "Módulo Hidráulico", "herdarKw": False}]},
    {"id": "cassete", "titulo": "Cassete Compacta", "paginas": [1], "tipo": "tabela",
     "familia": "ar-condicionado", "segmento": "comercial", "sistema": "mono-split",
     "tipoUnidade": "mini-cassete", "componente": "conjunto", "gama": "Cassete Compacta", "rotulo": "",
     "semPreco": False},
]}


def _linha(ref, seccao, pvp, campos=None):
    return {"ref": ref, "refs": None, "ean": None, "pagina": 1, "pdfPaginas": [1], "y": 100.0, "texto": ref,
            "campos": campos or {}, "confianca": {}, "contexto": {}, "componenteHint": None, "pvpCents": pvp,
            "numPrecos": 1, "seccao": seccao, "notas": [], "precoSobConsulta": False}


def test_por_ref_rotulo_e_atributos_da_seccao():
    out = agrupar([
        _linha("MHA-V12WD2N8-E", "hygge", 345000, {"calor-kw": "12.10", "frio-kw": "10.0"}),
        _linha("MHA-V14WD2N8-E", "hygge", 360000, {"calor-kw": "14.0", "frio-kw": "10.0"}),
        _linha("HB-A160CGN8-E", "hygge", 266000),
        _linha("MCA4U-09HFN8-Q6(GA)", "cassete", 123000, {"frio-kw": "2.64"}),
    ], MAPA, "midea", 2026, "midea.pdf")
    por_ref = {s["ref"]: s for s in out["skus"]}
    ue, modulo = por_ref["MHA-V14WD2N8-E"], por_ref["HB-A160CGN8-E"]
    assert ue["grupoModelo"] == "midea-m-thermal-hygge-unidade-exterior"
    assert ue["nome"] == "Bomba de Calor M-Thermal HYGGE | Unidade Exterior 14.0 kW"   # aerotermia: kW de calor
    assert {"chave": "refrigerante", "valor": "R32"} in ue["atributos"]
    # O módulo não tem kW, mas o mapa fixa o componente: não vira acessório nem herda os kW da UE.
    assert modulo["componente"] == "unidade-interior" and modulo["tipoUnidade"] == "modulo-hidraulico"
    assert modulo["nomeGrupo"] == "Módulo Hidráulico M-Thermal HYGGE | Unidade Interior"
    assert not any(a["chave"].endswith("-kw") for a in modulo["atributos"])
    assert por_ref["MCA4U-09HFN8-Q6(GA)"]["nomeGrupo"] == "Cassete Compacta"      # rotulo "" não repete o tipo

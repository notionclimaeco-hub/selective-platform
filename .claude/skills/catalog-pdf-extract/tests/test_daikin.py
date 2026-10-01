"""Partes da Daikin 2026 (`marcas/daikin/`): regras das refs e o leitor `pares`."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from _comum import parte_da_marca, raiz_repo
from agrupar import agrupar
from conftest import linha, pagina_a4

series = parte_da_marca("daikin", "series")
leitor = parte_da_marca("daikin", "extrair")


def sec(**extra):
    return {"id": "t", "titulo": "t", "paginas": [1], "tipo": "tabela", "familia": "ar-condicionado",
            "segmento": "comercial", "sistema": "mono-split", "tipoUnidade": None, "componente": "conjunto",
            "gama": "t", "semPreco": False, "herdarKw": False, **extra}


# --- Refs -----------------------------------------------------------------------------

@pytest.mark.parametrize("texto, refs", [
    ("FTXJ25AS9/AB9", ["FTXJ25AS9", "FTXJ25AB9"]),
    ("FTXA20DP/Y/G/C/L", ["FTXA20DP", "FTXA20DY", "FTXA20DG", "FTXA20DC", "FTXA20DL"]),
    ("BRC1H52W7/S7/K7", ["BRC1H52W7", "BRC1H52S7", "BRC1H52K7"]),
    ("FTXJ20A9S/AB9", ["FTXJ20AS9", "FTXJ20AB9"]),                 # gralha da p26
    ("SB.FTXJ20AW", ["SB.FTXJ20AW9"]),                             # p23 sem o 9 da ficha
    ("SB.EK200PCV/FIL260", ["SB.EK200PCV/FIL260"]),                # conjunto = ref inteira
    ("SB.EKECBUA3V/2A", ["SB.EKECBUA3V/2A"]),
])
def test_expandir_ref(texto, refs):
    assert series.expandir_ref(texto) == refs


def test_classificar_sky_air_pela_ref():
    c = series.classificar("SB.FCAG71_FW_ANY", {"regras": ["sky-air"]})
    assert (c["componente"], c["gama"], c["serie"], c["tipoUnidade"]) == (
        "conjunto", "Round Flow FCAG", "Alpha", "cassete-4-vias")
    assert series.classificar("SB.FHA100_FW_AZAY", {"regras": ["sky-air"]})["serie"] == "Active"
    assert series.classificar("RZASG100MY", {"regras": ["sky-air"]})["componente"] == "unidade-exterior"
    assert series.classificar("BRC1H52W7", {"regras": ["sky-air"]}) is None          # acessório
    assert series.alimentacao_da_ref("SB.FCAG71_FW_ANY") == "trifasica"
    assert series.alimentacao_da_ref("RZAG71NV1") == "monofasica"


def test_classificar_cor_e_derivados():
    assert series.classificar("SB.FTXA35DG", {"regras": ["ac-domestico"]})["cor"] == "cinzento"
    assert series.classificar("FTXJ50AB9", {"regras": ["ac-domestico"]})["cor"] == "preto"
    ui = series.classificar("EPSX10P30A", {"regras": ["altherma"]})
    assert ui["derivar"]("EPSX10P30A") == {"classe-kw": "10", "deposito-l": "300"}
    assert series._ui_altherma("EPVX14S23A9W") == {"classe-kw": "14", "deposito-l": "230", "alimentacao": "trifasica"}
    kit = series.classificar("SB.EKSV26P/3DBFI", {"regras": ["solar"]})
    assert kit["gama"] == "Solar Drain-Back Coletor Vertical 2,6 m² Cobertura Inclinada"
    assert kit["derivar"]("SB.EKSV26P/3DBFI") == {"coletores": "3"}


# --- Leitor "pares" -------------------------------------------------------------------

def test_linha_sky_air_conjuntos_ue_e_ui_cada_um_com_o_seu_preco(doc):
    p = pagina_a4(doc)
    linha(p, 200, [(59, "SB.FCAG71_FW_ANV"), (132, "4.420 €"), (159, "SB.FCAG71_FW_ANY"), (228, "5.055 €"),
                   (258, "6,80/7,50"), (289, "A++/A+"), (317, "6,83/4,22"), (346, "RZAG71NV1"), (390, "2.865 €"),
                   (417, "RZAG71NY1"), (462, "3.500 €"), (490, "FCAG71B"), (527, "1.015 €")], tamanho=6)
    out = {l["ref"]: l for l in leitor.ler_pares(p, 0, 842, sec(regras=["sky-air"]), 1)}
    assert {r: l["pvpCents"] for r, l in out.items()} == {
        "SB.FCAG71_FW_ANV": 442000, "SB.FCAG71_FW_ANY": 505500, "RZAG71NV1": 286500,
        "RZAG71NY1": 350000, "FCAG71B": 101500}
    conj = out["SB.FCAG71_FW_ANY"]
    assert conj["campos"] == {"frio-kw": "6.80", "calor-kw": "7.50", "classe-energetica": "A++/A+",
                              "seer": "6.83", "scop": "4.22", "alimentacao": "trifasica"}
    assert conj["contexto"] == {"serie": "Alpha"}
    assert out["FCAG71B"]["campos"] == {"frio-kw": "6.80", "calor-kw": "7.50"}   # sem classe nem SEER


def test_refs_empilhadas_partilham_a_linha_de_preco_do_meio(doc):
    p = pagina_a4(doc)
    for y, sufixo in ((300, "DP"), (308, "DY"), (316, "DG"), (322, "DC"), (332, "DL")):
        linha(p, y, [(184, f"SB.FTXA20{sufixo}")])
    linha(p, 316, [(258, "1.710 €"), (297, "2,0/2,5"), (334, "A+++/A+++"), (379, "8,75/5,15")])
    out = leitor.ler_pares(p, 0, 842, sec(regras=["ac-domestico"]), 23)
    assert {l["ref"]: l["pvpCents"] for l in out} == {
        f"SB.FTXA20{s}": 171000 for s in ("DP", "DY", "DG", "DC", "DL")}


def test_lista_ref_descricao_preco_em_duas_colunas(doc):
    p = pagina_a4(doc)
    linha(p, 427, [(44, "Painéis"), (113, "Descrição"), (252, "Preço s/ IVA"),
                   (310, "Acessórios"), (376, "Descrição"), (512, "Preço s/ IVA")])
    linha(p, 438, [(44, "BYCQ140E"), (113, "Painel Básico"), (261, "420 €"),
                   (310, "BAF552AA160"), (376, "Filtro de Alta Eficiência"), (523, "60 €")])
    linha(p, 450, [(44, "BYCQ140EW"), (113, "Painel Básico Branco"), (261, "580 €")])
    out = {l["ref"]: l for l in leitor.ler_pares(p, 0, 842, sec(regras=["sky-air"]), 36)}
    assert {r: (l["pvpCents"], l["campos"]["descricao"], l["componenteHint"]) for r, l in out.items()} == {
        "BYCQ140E": (42000, "Painel Básico", "acessorio"),
        "BAF552AA160": (6000, "Filtro de Alta Eficiência", "acessorio"),
        "BYCQ140EW": (58000, "Painel Básico Branco", "acessorio")}


def test_matriz_altherma_preco_por_baixo_da_ref(doc):
    p = pagina_a4(doc)
    linha(p, 563, [(214, "EPSX10P30A"), (299, "EPSX10P50A")])
    linha(p, 572, [(221, "6.670 €"), (307, "6.970 €")])
    linha(p, 584, [(165, "EPSK06AV3")])
    linha(p, 588, [(102, "5,6 / 6,0"), (219, "15.235 €"), (305, "15.535 €")])
    linha(p, 592, [(172, "8.565 €")])
    out = {l["ref"]: l for l in leitor.ler_pares(
        p, 0, 842, sec(familia="bombas-de-calor", leitor="matriz", regras=["altherma"], ordemKw="calor-frio"), 61)}
    assert {r: l["pvpCents"] for r, l in out.items()} == {
        "EPSX10P30A": 667000, "EPSX10P50A": 697000, "EPSK06AV3": 856500}
    assert out["EPSK06AV3"]["campos"] == {"calor-kw": "5.6", "frio-kw": "6.0", "alimentacao": "monofasica"}
    assert out["EPSX10P50A"]["campos"]["deposito-l"] == "500"


# --- agrupar: classificação por linha ----------------------------------------------------

def test_agrupar_usa_a_classificacao_da_linha():
    mapa = {"seccoes": [sec(id="p36", segmento="comercial", tipoUnidade="cassete-4-vias")]}
    base = {"refs": None, "ean": None, "pagina": 36, "pdfPaginas": [36], "y": 1.0, "texto": "",
            "confianca": {}, "contexto": {}, "seccao": "p36", "notas": [], "precoSobConsulta": False,
            "numPrecos": 1}
    linhas = [
        {**base, "ref": "RZAG71NV1", "campos": {"frio-kw": "6.8"}, "pvpCents": 286500,
         "componenteHint": "unidade-exterior",
         "classificacao": {"tipoUnidade": "exterior", "gama": "Sky Air Alpha RZAG"}},
        {**base, "ref": "SB.FCAG71_FW_ANV", "campos": {"frio-kw": "6.8"}, "pvpCents": 442000,
         "componenteHint": "conjunto", "contexto": {"serie": "Alpha"},
         "classificacao": {"tipoUnidade": "cassete-4-vias", "gama": "Round Flow FCAG"}},
    ]
    skus = {s["ref"]: s for s in agrupar(linhas, mapa, "daikin", 2026, "x.pdf")["skus"]}
    assert skus["RZAG71NV1"]["grupoModelo"] == "daikin-sky-air-alpha-rzag-unidade-exterior"
    assert skus["RZAG71NV1"]["tipoUnidade"] == "exterior"
    assert skus["SB.FCAG71_FW_ANV"]["grupoModelo"] == "daikin-round-flow-fcag-alpha"


# --- Mapa ---------------------------------------------------------------------------------

def test_mapa_daikin_cobre_todas_as_paginas():
    from mapa import validar_mapa
    m = parte_da_marca("daikin", "mapa").gerar(None, "daikin.pdf", "daikin", 2026)
    assert validar_mapa(m) == []


PDF = raiz_repo() / "product-scaffold" / "pdf-extract" / "daikin" / "daikin-tabela-precos-2026.pdf"


@pytest.mark.skipif(not PDF.is_file(), reason="tabela Daikin 2026 não está em product-scaffold/")
def test_ancoras_da_tabela_daikin_2026():
    staged = PDF.with_name("daikin-2026-staged.json")
    if not staged.is_file():
        pytest.skip("corre primeiro cadeia.py --marca daikin --ano 2026")
    skus = {s["ref"]: s for s in json.loads(Path(staged).read_text())["skus"]}
    # Âncoras conferidas à mão no PDF (conjunto, UE, UI, acessório, matriz, kit solar, lista).
    assert skus["SB.FTXM35A"]["pvpCents"] == 146500                     # p24
    assert skus["RZAG71NY1"]["pvpCents"] == 350000                      # p36
    assert skus["FCAG140B"]["pvpCents"] == 195500                       # p36
    assert skus["BRC1H52W7"]["pvpCents"] == 12000                       # p36
    assert skus["EPSK14AW1"]["pvpCents"] == 992500                      # p61 (por baixo da ref)
    assert skus["SB.EKSV26P/5DBFP"]["pvpCents"] == 818500               # p96
    assert skus["00004373"]["pvpCents"] == 370000                       # p104 (Duco)

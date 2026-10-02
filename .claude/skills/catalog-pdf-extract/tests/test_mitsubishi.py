"""Mitsubishi Electric 2026: leitor das fichas, matrizes multi-split e
pós-processamento (páginas de fixture), e a cadeia inteira quando o PDF e o
registo exportado existem localmente (ambos gitignored)."""

import json
from pathlib import Path

import pymupdf
import pytest

from _comum import raiz_repo
from agrupar import agrupar
from cadeia import construir_mapa, parte_da_marca, pos_processar
from conftest import linha, pagina_a4
from extrair import extrair_seccao
from mapa import validar_mapa
from validar import validar_run

RAIZ = raiz_repo(Path(__file__).resolve().parent)
PDF = RAIZ / "product-scaffold" / "pdf-extract" / "mitsubishi" / "mitsubishi-tabela-precos-2026.pdf"
REGISTO = RAIZ / "product-scaffold" / "spec-registry.json"

ex = parte_da_marca("mitsubishi", "extrair")
pos = parte_da_marca("mitsubishi", "pos")
series = parte_da_marca("mitsubishi", "series")


def _ler(page, leitor, opts=None):
    return getattr(ex, f"ler_{leitor}")(ex._linhas(ex._palavras(page)), 1, opts or {})


def test_ficha_split_vende_um_conjunto_por_cor_e_por_alimentacao(doc):
    p = pagina_a4(doc)
    linha(p, 140, [(102, "MODELO"), (215, "MSZ-LN25VG(W/R/B/V)"), (303, "PLA-M100EA")])
    linha(p, 153, [(150, "PVR"), (168, "(VGW)"), (240, "1.420€"), (328, "3.450€")])
    linha(p, 163, [(110, "PVR"), (128, "(VGR/VGB/VGV)"), (240, "1.520€")])
    linha(p, 173, [(130, "PVR"), (148, "(Trifásico)"), (240, "-"), (328, "3.490€")])
    linha(p, 183, [(26, "Unidade"), (60, "interior"), (224, "MSZ-LN25VG(R/B/V/W)"), (312, "PLA-M100EA")])
    linha(p, 193, [(26, "Unidade"), (60, "exterior"), (236, "MUZ-LN25VG"), (308, "PUZ-M100VKA/YKA")])
    linha(p, 203, [(36, "Capacidade"), (80, "nominal"), (200, "kW"), (249, "2.5"), (337, "9.5")])
    linhas = {l["ref"]: l for l in _ler(p, "split")}
    assert linhas["MSZ-LN25VGW/MUZ-LN25VG"]["pvpCents"] == 142000
    assert linhas["MSZ-LN25VGB/MUZ-LN25VG"]["pvpCents"] == 152000
    assert linhas["MSZ-LN25VGB/MUZ-LN25VG"]["contexto"]["cor"] == "preto"
    assert linhas["PLA-M100EA/PUZ-M100VKA"]["pvpCents"] == 345000
    assert linhas["PLA-M100EA/PUZ-M100YKA"]["contexto"]["alimentacao"] == "trifasica"
    assert linhas["PLA-M100EA/PUZ-M100YKA"]["seccao"] == "plsz-m"           # Classic Inverter (PUZ-M)
    assert linhas["MSZ-LN25VGW/MUZ-LN25VG"]["campos"]["frio-kw"] == "2.5"


def test_matriz_multi_split_le_precos_por_cor_e_alternativas_de_sufixo(doc):
    p = pagina_a4(doc)
    linha(p, 120, [(173, "MSZ-LN##VG(W/R/B/V)*"), (300, "SEZ-M##DA(1)"), (430, "PCA-M##KA/HA*2")])
    linha(p, 133, [(64, "Capacidade"), (106, "nominal"), (138, "frio/calor"), (170, "kW"),
                   (202, "2,5"), (213, "/"), (216, "3,2"), (318, "2,5"), (330, "/"), (334, "2,9")])
    linha(p, 143, [(43, "25"), (64, "PVR"), (175, "570€"), (194, "(VGW)"), (208, "/"), (213, "670€"),
                   (232, "(VGR/B/V)"), (318, "510€")])
    linha(p, 173, [(43, "71"), (64, "PVR"), (445, "1.250€/2.180€")])
    linhas = {l["ref"]: l for l in _ler(p, "matriz")}
    assert linhas["MSZ-LN25VGW"]["pvpCents"] == 57000
    assert linhas["MSZ-LN25VGR"]["pvpCents"] == 67000
    assert linhas["MSZ-LN25VGV"]["contexto"]["cor"] == "branco-perola"
    assert linhas["SEZ-M25DA"]["pvpCents"] == 51000
    assert linhas["SEZ-M25DA"]["campos"]["calor-kw"] == "2.9"
    assert linhas["PCA-M71KA"]["pvpCents"] == 125000
    assert linhas["PCA-M71HA"]["pvpCents"] == 218000
    assert linhas["SEZ-M25DA"]["componenteHint"] == "unidade-interior"


def test_ue_trifasica_pela_nota_da_ref():
    assert ex._ue_por_fase("PUZ-M100VKA/YKA", "trifasica") == "PUZ-M100YKA"
    assert ex._ue_por_fase("PUZ-M100VKA2/YKA2", "monofasica") == "PUZ-M100VKA2"
    assert ex._ue_por_fase("PUZ-ZM100V(Y)DA", "trifasica") == "PUZ-ZM100YDA"
    assert ex._ue_por_fase("SUZ-M35VA", None) == "SUZ-M35VA"


def test_series_classificam_o_conjunto_pela_ue_e_listas_pela_ref():
    assert series.seccao_de("PCA-M71KA/PUZ-ZM71VHA", "conjunto", 1) == "pcz-zm"
    assert series.seccao_de("PCA-M71HA/PUZ-ZM71VHA", "conjunto", 1) == "pciz-m"
    assert series.seccao_de("PCA-M71KA/SUZ-M71VA", "conjunto", 1) == "pcsz-m"
    assert series.seccao_de("PUZ-ZM100VDA", None, 1) == "puz-zm"          # UE Twin na matriz da p81
    assert series.seccao_de("ERST20D-VM2E", "acessorio", 1) == "erst-d"    # hydrobox numa lista
    assert series.seccao_de("PAC-YT52CRA", "comando", 1) == "comandos"


def _sku(ref, comp="unidade-exterior", pvp=100, **kw):
    return {"ref": ref, "componente": comp, "familia": kw.pop("familia", "ar-condicionado"), "pvpCents": pvp,
            "pdfPaginas": [kw.pop("pagina", 1)], "atributos": kw.pop("atributos", []), "avisos": [],
            "nome": "x", "nomeGrupo": "x", "gama": kw.pop("gama", None), **kw}


def test_pos_funde_ref_sem_e_e_le_a_fase_da_ue():
    run = {"skus": [_sku("MAC-334IF", "acessorio", 15000, familia="acessorios-e-controlo"),
                    _sku("MAC-334IF-E", "acessorio", 15000, familia="acessorios-e-controlo", pagina=83),
                    _sku("PUMY-P112YKM")]}
    pos._fundir_sufixo_e(run)
    pos._alimentacao_da_ref(run)
    por_ref = {s["ref"]: s for s in run["skus"]}
    assert "MAC-334IF" not in por_ref and por_ref["MAC-334IF-E"]["pdfPaginas"] == [1, 83]
    assert {"chave": "alimentacao", "valor": "trifasica"} in por_ref["PUMY-P112YKM"]["atributos"]


def test_pos_compatibilidade_das_ue_vem_das_matrizes_de_ui():
    run = {"skus": [_sku("MSZ-LN25VGW", "unidade-interior", gama="MSZ-LN", pagina=26),
                    _sku("MSZ-HR25VFK", "unidade-interior", gama="MSZ-HR", pagina=26),
                    _sku("MXZ-2F33VF"), _sku("MXZ-2HA40VF")]}
    pos._compatibilidade(run)
    por_ref = {s["ref"]: s for s in run["skus"]}
    assert por_ref["MXZ-2F33VF"]["compativelCom"] == ["MSZ-LN"]          # MSZ-HR: 'Só para MXZ-HA'
    assert por_ref["MXZ-2HA40VF"]["compativelCom"] == ["MSZ-HR"]


def test_mapa_da_mitsubishi_cobre_todas_as_paginas():
    if not PDF.is_file():
        pytest.skip("PDF da Mitsubishi 2026 em falta")
    mapa = construir_mapa(pymupdf.open(PDF), PDF.name, "mitsubishi", 2026)
    assert validar_mapa(mapa) == []


@pytest.mark.skipif(not (PDF.is_file() and REGISTO.is_file()),
                    reason="PDF da Mitsubishi 2026 ou spec-registry.json em falta")
def test_cadeia_mitsubishi_de_ponta_a_ponta():
    doc = pymupdf.open(PDF)
    mapa = construir_mapa(doc, PDF.name, "mitsubishi", 2026)
    linhas = [l for s in mapa["seccoes"] if s["tipo"] != "ignorar"
              for l in extrair_seccao(doc, mapa, s["id"], ex.extrair_pagina)]
    run = agrupar(linhas, mapa, "mitsubishi", 2026, PDF.name)
    assert pos_processar(run, doc, "mitsubishi")
    resumo = validar_run(run, json.loads(REGISTO.read_text(encoding="utf-8")))
    por_ref = {s["ref"]: s for s in run["skus"]}
    assert resumo["comErro"] == 0
    assert len(run["skus"]) == 914
    # Âncoras ref/preço conferidas no PDF (conjunto, conjunto trifásico, UI multi, UE Twin,
    # Ecodan, depósito, ventiloconvector, UTA, comando).
    assert por_ref["MSZ-LN25VGW/MUZ-LN25VG"]["pvpCents"] == 142000                # p9
    assert por_ref["PLA-M100EA/PUZ-M100YKA"]["pvpCents"] == 349000                # p59
    assert por_ref["MSZ-EF22VGKB"]["pvpCents"] == 46000                           # p26
    assert por_ref["PUZ-ZM250YKA"]["pvpCents"] == 575000                          # p81
    assert por_ref["ERST20D-VM2E"]["pvpCents"] == 510000                          # p95
    assert por_ref["EASYDAN IN50-6"]["pvpCents"] == 57000                         # p125
    assert por_ref["a-LIFE3 2T DLIO 1002 V3V"]["pvpCents"] == 78000               # p113
    assert por_ref["s-AIRME MF/B 3000"]["pvpCents"] == 1729000                    # p163
    assert por_ref["PAR-41MAA"]["pvpCents"] == 13500                              # p83, p206
    assert "MXZ-2HA40VF" in por_ref and por_ref["MXZ-2HA40VF"]["compativelCom"] == ["MSZ-HR"]

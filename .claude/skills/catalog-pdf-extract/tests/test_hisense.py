"""End-to-end on the real Hisense 2026 price table. Skipped unless the PDF and
the registry export are in place (both gitignored):

    product-scaffold/pdf-extract/hisense/hisense-tabela-precos-2026.pdf
    product-scaffold/spec-registry.json   (pnpm registry:json)
"""

from collections import Counter
from pathlib import Path

import pymupdf
import pytest

from _comum import raiz_repo
from agrupar import agrupar
from extrair import extrair_seccao
from mapa import gerar_mapa, validar_mapa
from validar import validar_run

RAIZ = raiz_repo(Path(__file__).resolve().parent)
PDF = RAIZ / "product-scaffold" / "pdf-extract" / "hisense" / "hisense-tabela-precos-2026.pdf"
REGISTO = RAIZ / "product-scaffold" / "spec-registry.json"

pytestmark = pytest.mark.skipif(not (PDF.is_file() and REGISTO.is_file()),
                                reason="PDF da Hisense 2026 ou spec-registry.json em falta")


@pytest.fixture(scope="module")
def run_hisense():
    import json
    doc = pymupdf.open(PDF)
    mapa = gerar_mapa(doc, PDF.name, "hisense", 2026)
    assert validar_mapa(mapa) == []
    linhas = []
    for s in mapa["seccoes"]:
        if s["tipo"] != "ignorar":
            linhas.extend(extrair_seccao(doc, mapa, s["id"]))
    run = agrupar(linhas, mapa, "hisense", 2026, PDF.name)
    resumo = validar_run(run, json.loads(REGISTO.read_text(encoding="utf-8")))
    return mapa, run, resumo


def test_mapa_cobre_todas_as_paginas_sem_avisos(run_hisense):
    mapa, _run, _resumo = run_hisense
    assert mapa["estrategia"] == "indice"
    assert not any(s.get("avisos") for s in mapa["seccoes"])


def test_run_sem_erros_e_avisos_so_onde_o_pdf_e_ambiguo(run_hisense):
    _mapa, run, resumo = run_hisense
    assert resumo["comErro"] == 0
    tipos = Counter()
    for s in run["skus"]:
        for a in s["avisos"]:
            tipos[a.split(":")[0].split("(")[0].strip()] += 1
    # VRF pages print "preços sob consulta": every VRF SKU carries that warning and nothing worse.
    assert tipos["preço sob consulta"] >= 300
    sem_preco = [s for s in run["skus"] if s["pvpCents"] == 0]
    assert all(any("sob consulta" in a or "matriz" in a for a in s["avisos"]) for s in sem_preco)


def test_ancoras_ref_preco_conferidas_a_mao(run_hisense):
    _mapa, run, _resumo = run_hisense
    por_ref = {s["ref"]: s for s in run["skus"]}
    attrs = lambda r: {a["chave"]: a["valor"] for a in por_ref[r]["atributos"]}
    # p12 Air Master: conjunto, UI e UE
    assert por_ref["QK25WM0A"]["pvpCents"] == 145000 and attrs("QK25WM0A")["frio-kw"] == "2.6"
    assert attrs("QK25WM0A")["classe-energetica"] == "A+++/A+++" and attrs("QK25WM0A")["cor"] == "branco"
    assert por_ref["QK25WM0AG"]["pvpCents"] == 42000 and por_ref["QK25WM0AG"]["componente"] == "unidade-interior"
    assert por_ref["AS25WM00W"]["pvpCents"] == 103000 and "cor" not in attrs("AS25WM00W")
    assert por_ref["AS25WM00W"]["pdfPaginas"] == [12]
    # p21 Conduta 1x1: conjunto "UI / UE" and the units sold apart
    assert por_ref["ADT26UX4RBL8/AUW26U4RS8"]["pvpCents"] == 135000
    assert por_ref["ADT26UX4RBL8/AUW26U4RS8"]["grupoModelo"] == "hisense-conduta-1x1-baixa-pressao-turbo-inverter"
    # the same UI is also listed as a multi-split indoor unit on p18: first occurrence wins, pages merge
    assert por_ref["ADT26UX4RBL8"]["grupoModelo"] == "hisense-multi-inverter-conduta-unidade-interior"
    assert por_ref["ADT26UX4RBL8"]["pdfPaginas"] == [18, 21] and por_ref["ADT26UX4RBL8"]["pvpCents"] == 53000
    assert por_ref["AUW26U4RS8"]["pvpCents"] == 82000
    assert por_ref["AUW26U4RS8"]["grupoModelo"] == "hisense-conduta-1x1-baixa-pressao-turbo-inverter-unidade-exterior"
    # p18/p21 multi UE with compatibility matrix
    assert por_ref["2AMW42U4RGC"]["pvpCents"] == 100000
    assert por_ref["2AMW42U4RGC"]["compativelCom"] == ["UI 2.5 kW", "UI 3.5 kW"]
    assert attrs("2AMW42U4RGC")["unidades-max"] == "2"
    # p9 accessory with description and p7 Hi-Water tank
    assert por_ref["HTS-E1000A1"]["pvpCents"] == 5400
    assert por_ref["HTS-E1000A1"]["descricao"].startswith("Sensor de temperatura")
    assert attrs("AH-80NH4GEB00")["deposito-l"] == "80" and por_ref["AH-80NH4GEB00"]["familia"] == "aqs"


def test_contagens_por_familia_batem_com_o_indice(run_hisense):
    _mapa, run, _resumo = run_hisense
    por_familia = Counter(s["familia"] for s in run["skus"])
    assert por_familia["ar-condicionado"] >= 450
    assert por_familia["bombas-de-calor"] >= 50
    assert por_familia["acessorios-e-controlo"] >= 100
    assert por_familia["aqs"] >= 5 and por_familia["ventilacao"] >= 20 and por_familia["chillers"] >= 2
    assert len({s["ref"] for s in run["skus"]}) == len(run["skus"])

"""Partes por marca (`marcas/<marca>/`) e a cadeia da Midea 2026 de ponta a ponta
(esta só corre com o PDF e o registo exportado localmente, ambos gitignored)."""

import json
from pathlib import Path

import pymupdf
import pytest

from _comum import raiz_repo
from agrupar import agrupar
from cadeia import construir_mapa, parte_da_marca, pos_processar
from extrair import extrair_seccao
from mapa import validar_mapa
from validar import validar_run

RAIZ = raiz_repo(Path(__file__).resolve().parent)
PDF_MIDEA = RAIZ / "product-scaffold" / "pdf-extract" / "midea" / "midea-tabela-precos-2026.pdf"
REGISTO = RAIZ / "product-scaffold" / "spec-registry.json"


def test_partes_da_marca_carregam_pelo_caminho():
    assert hasattr(parte_da_marca("midea", "mapa"), "gerar")
    assert hasattr(parte_da_marca("midea", "pos"), "corrigir")
    assert hasattr(parte_da_marca("hisense", "mapa"), "corrigir")
    assert parte_da_marca("hisense", "pos") is None
    assert parte_da_marca("marca-sem-pasta", "mapa") is None


def test_mapa_escrito_da_midea_e_valido():
    mapa = construir_mapa(None, "midea-tabela-precos-2026.pdf", "midea", 2026)
    assert validar_mapa(mapa) == []
    assert mapa["estrategia"] == "manual"
    ids = [s["id"] for s in mapa["seccoes"]]
    assert len(ids) == len(set(ids))


@pytest.mark.skipif(not (PDF_MIDEA.is_file() and REGISTO.is_file()),
                    reason="PDF da Midea 2026 ou spec-registry.json em falta")
def test_cadeia_midea_de_ponta_a_ponta():
    doc = pymupdf.open(PDF_MIDEA)
    mapa = construir_mapa(doc, PDF_MIDEA.name, "midea", 2026)
    linhas = [l for s in mapa["seccoes"] if s["tipo"] != "ignorar" for l in extrair_seccao(doc, mapa, s["id"])]
    run = agrupar(linhas, mapa, "midea", 2026, PDF_MIDEA.name)
    assert pos_processar(run, doc, "midea")
    resumo = validar_run(run, json.loads(REGISTO.read_text(encoding="utf-8")))
    por_ref = {s["ref"]: s for s in run["skus"]}
    assert resumo["comErro"] == 0
    assert len(run["skus"]) == 390
    # Âncoras ref/preço conferidas no PDF (conjunto, Twin, UI multi, módulo, acessório).
    assert por_ref["MTJ-36HWFN8-R(GA)"]["pvpCents"] == 288500
    assert por_ref["3X-MCA4U-18HRFNX(GA)+MOX630U-55HFN8-R(GA)"]["pvpCents"] == 494800
    assert por_ref["CB1-07HRFN8-I"]["pvpCents"] == 16500
    assert por_ref["HB-A160CGN8-E"]["pvpCents"] == 266000
    assert por_ref["KJR-29B/BK-E"]["pvpCents"] == 11000
    assert "M4OE-28HFN8-Q" in por_ref and "M40E-28HFN8-Q" not in por_ref
    assert len(por_ref["M2OH-14HFN8-Q"]["compativelCom"]) > 0

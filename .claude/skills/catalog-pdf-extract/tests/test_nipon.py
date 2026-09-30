"""Nipon 2025: fichas com um modelo por coluna (códigos e preço por baixo),
listas "Código | Descrição | Preço" e a cadeia de ponta a ponta (esta só corre
com o PDF e o registo exportado localmente, ambos gitignored)."""

import json
from pathlib import Path

import pymupdf
import pytest

from _comum import parte_da_marca, raiz_repo
from agrupar import agrupar
from cadeia import construir_mapa, pos_processar
from conftest import linha, pagina_a4
from extrair import extrair_seccao
from mapa import validar_mapa
from validar import validar_run

RAIZ = raiz_repo(Path(__file__).resolve().parent)
PDF = RAIZ / "product-scaffold" / "pdf-extract" / "nipon" / "nipon-tabela-precos-2025.pdf"
REGISTO = RAIZ / "product-scaffold" / "spec-registry.json"
NIPON = parte_da_marca("nipon", "extrair")

MURAL = {"id": "mural", "titulo": "Modelo Mural", "paginas": [1], "tipo": "tabela",
         "familia": "ar-condicionado", "segmento": "domestico", "sistema": "mono-split",
         "tipoUnidade": "mural", "componente": "conjunto", "gama": "Primis Duo", "semPreco": False}
COLS = (330, 400)


def ficha(p, y, linhas):
    for rotulo, unidade, valores in linhas:
        linha(p, y, [(60, rotulo)] + ([(270, unidade)] if unidade else []) +
              [(x, v) for x, v in zip(COLS, valores)])
        y += 12
    return y


def test_ficha_com_cores_classes_e_celula_partilhada(doc):
    p = pagina_a4(doc)
    linha(p, 60, [(60, "As unidades de ar condicionado PRIMIS DUO são altamente eficientes")])
    y = ficha(p, 100, [("Modelo Mural PRIMIS", None, ["PRIMISD09 GA", "PRIMISD12 GA"]),
                       ("Potência térmica", "kW", ["2.7", "3.5"]),
                       ("SEER", "W/W", ["8.5", "8.5"]),
                       ("Classe energética", None, ["A+++", "A++"]),
                       ("Potência térmica", "kW", ["3.0", "3.8"]),
                       ("SCOP", "W/W", ["5.7", "5.6"]),
                       ("Classe energética", None, ["A+++", "A+++"])])
    linha(p, y, [(60, "Alimentação elétrica (UE)"), (350, "220-240V~50Hz,1Ph")])
    linha(p, y + 12, [(60, "Dimensões (LxPxA)"), (270, "mm"), (320, "837x200x293"), (390, "993x222x311")])
    linha(p, y + 30, [(60, "Código Conjunto - Branca"), (320, "NI0115109"), (390, "NI0115112")])
    linha(p, y + 42, [(60, "Código Conjunto - Cinza antracite"), (320, "NI0115159"), (390, "NI0115162")])
    linha(p, y + 56, [(60, "Preço S/IVA"), (330, "750€"), (398, "1.150€")])
    linhas = {l["ref"]: l for l in NIPON.extrair_pagina(p, [MURAL], 1)}
    assert set(linhas) == {"NI0115109", "NI0115112", "NI0115159", "NI0115162"}
    a, b = linhas["NI0115109"], linhas["NI0115162"]
    assert a["pvpCents"] == 75000 and b["pvpCents"] == 115000
    assert a["contexto"] == {"cor": "branco"} and b["contexto"] == {"cor": "cinzento"}
    assert a["campos"]["frio-kw"] == "2.7" and a["campos"]["calor-kw"] == "3.0"
    assert a["campos"]["classe-energetica"] == "A+++/A+++" and b["campos"]["classe-energetica"] == "A++/A+++"
    assert a["campos"]["btu"] == "9000" and b["campos"]["btu"] == "12000"
    # "220-240V…" impresso uma vez para as duas colunas.
    assert a["campos"]["alimentacao"] == b["campos"]["alimentacao"] == "monofasica"
    assert b["campos"]["dimensoes-ui"] == "993x222x311"
    assert a["campos"]["descricao"] == "Modelo PRIMISD09 GA da gama Primis Duo"


def test_ficha_comercial_vende_o_codigo_conjunto(doc):
    p = pagina_a4(doc)
    sec = {**MURAL, "id": "cassete", "segmento": "comercial", "gama": "Cassete XB"}
    y = ficha(p, 100, [("MONO-SPLIT CASSETE", None, ["XB12 GB", "XB36 GB3"]),
                       ("Potência térmica", "kW", ["3.5", "10.5"])])
    linha(p, y, [(60, "Código U.E"), (320, "NI0161112"), (390, "NI0161336")])
    linha(p, y + 12, [(60, "Código U.I"), (320, "NI0171212"), (390, "NI0171236")])
    linha(p, y + 24, [(60, "Código grelha"), (320, "NI0190142"), (390, "NI0190144")])
    linha(p, y + 36, [(60, "Código conjunto"), (320, "NI0188412"), (390, "NI0188436")])
    linha(p, y + 50, [(60, "Preços/IVA"), (330, "1450€"), (398, "2900€")])
    linhas = NIPON.extrair_pagina(p, [sec], 1)
    assert [(l["ref"], l["pvpCents"]) for l in linhas] == [("NI0188412", 145000), ("NI0188436", 290000)]
    assert linhas[1]["campos"]["alimentacao"] == "trifasica"          # GB3 no modelo
    assert "unidade exterior NI0161336" in linhas[1]["campos"]["descricao"]
    assert "grelha NI0190144" in linhas[1]["campos"]["descricao"]


def test_lista_com_modelo_a_esquerda_e_preco_na_linha_colada(doc):
    p = pagina_a4(doc)
    sec = {**MURAL, "id": "acessorios", "familia": "acessorios-e-controlo", "componente": "acessorio",
           "gama": "Acessórios", "sufixo": "p/ Venice"}
    linha(p, 100, [(60, "Código"), (110, "Descrição"), (300, "Preço s/iva")])
    linha(p, 112, [(60, "NI2039062"), (110, "Controlo CIVO"), (300, "109€")])
    linha(p, 124, [(300, "260,00 €")])
    linha(p, 127, [(40, "até"), (60, "NI5006010"), (110, "Sensor de C02")])
    linha(p, 140, [(20, "NCPG/03"), (60, "NI0195300"), (300, "25€")])
    linhas = {l["ref"]: l for l in NIPON.extrair_pagina(p, [sec], 1)}
    assert linhas["NI2039062"]["pvpCents"] == 10900
    assert linhas["NI2039062"]["campos"]["descricao"] == "Controlo CIVO p/ Venice"
    assert linhas["NI5006010"]["pvpCents"] == 26000
    assert linhas["NI5006010"]["campos"]["descricao"] == "Sensor de CO2 p/ Venice"
    assert linhas["NI0195300"]["campos"]["descricao"].startswith("NCPG/03")


def test_mapa_escrito_da_nipon_e_valido():
    mapa = construir_mapa(None, PDF.name, "nipon", 2025)
    assert validar_mapa(mapa) == []
    assert mapa["estrategia"] == "manual"


@pytest.mark.skipif(not (PDF.is_file() and REGISTO.is_file()),
                    reason="PDF da Nipon 2025 ou spec-registry.json em falta")
def test_cadeia_nipon_de_ponta_a_ponta():
    doc = pymupdf.open(PDF)
    mapa = construir_mapa(doc, PDF.name, "nipon", 2025)
    linhas = [l for s in mapa["seccoes"] if s["tipo"] != "ignorar"
              for l in extrair_seccao(doc, mapa, s["id"], NIPON.extrair_pagina)]
    run = agrupar(linhas, mapa, "nipon", 2025, PDF.name)
    assert pos_processar(run, doc, "nipon")
    resumo = validar_run(run, json.loads(REGISTO.read_text(encoding="utf-8")))
    por_ref = {s["ref"]: s for s in run["skus"]}
    assert resumo["comErro"] == 0
    assert len(run["skus"]) == 280
    # Âncoras ref/preço conferidas no PDF (conjunto, UI multi, UE, VMC, lista, Venice).
    assert por_ref["NI0115159"]["pvpCents"] == 75000                       # p15 Primis Duo cinza 09
    assert por_ref["NI0135124"]["pvpCents"] == 65000                       # p22 cassete 8 vias UI 24
    assert por_ref["NI0120442"]["pvpCents"] == 215000                      # p18 M5-42 GB
    assert por_ref["NI5005130"]["pvpCents"] == 295500                      # p36 EVAS1300 HA
    assert por_ref["NI2039068"]["pvpCents"] == 9570                        # p56 termostato TP 95,70 €
    assert por_ref["NI2034520"]["pvpCents"] == 95200                       # p55 Venice HF 103
    assert por_ref["NI0188436"]["grupoModelo"] == "nipon-cassete-8-vias-xb"
    assert por_ref["NI2032002"]["grupoModelo"] == "nipon-venice-v"
    assert "NI0130120" in por_ref["NI0125036"]["compativelCom"]            # AC+AQS aceita o depósito

import pymupdf

from conftest import escrever, pagina_a4
from mapa import gerar_mapa, propor_classificacao, validar_mapa


def doc_com_indice(offset: int = 0) -> pymupdf.Document:
    """Cover, index page, then table pages whose footer prints the page number
    (printed = pdf index − offset, like tables that skip the cover)."""
    d = pymupdf.open()
    capa = pagina_a4(d)
    escrever(capa, 100, 200, "Tabela de Preços 2026", 20)
    indice = pagina_a4(d)
    escrever(indice, 60, 80, "ÍNDICE", 14)
    escrever(indice, 60, 120, "GAMA AEROTERMIA", 9)
    for y, (titulo, pag) in enumerate([("Hi-Water", 4 - offset), ("Hi-Therma R32 Split", 5 - offset),
                                         ("Multi-Inverter Exterior", 6 - offset),
                                         ("Cassete 1x1", 6 - offset), ("Acessórios", 7 - offset)]):
        escrever(indice, 60, 140 + y * 14, titulo, 9)
        escrever(indice, 400, 140 + y * 14, f"{pag:02d}", 9)
    for i in range(3, 9):
        p = pagina_a4(d)
        escrever(p, 40, 40, "Gama", 8)
        if i == 4:
            escrever(p, 40, 130, "Hi-Water", 12)
        if i == 5:
            escrever(p, 40, 130, "Hi-Therma R32 Split", 12)
        if i == 6:
            escrever(p, 40, 110, "Multi-Inverter Exterior", 12)
            escrever(p, 40, 400, "Cassete 1x1", 12)
        if i == 7:
            escrever(p, 40, 110, "Acessórios", 12)
        escrever(p, 290, 810, f"{i - offset:02d}", 8)
    return d


def test_indice_gera_seccoes_com_intervalos_de_paginas():
    mapa = gerar_mapa(doc_com_indice(), "tabela.pdf")
    por_titulo = {s["titulo"]: s for s in mapa["seccoes"]}
    assert mapa["estrategia"] == "indice"
    assert por_titulo["Hi-Water"]["paginas"] == [4]
    assert por_titulo["Hi-Therma R32 Split"]["paginas"] == [5]
    assert por_titulo["Multi-Inverter Exterior"]["paginas"] == [6]
    assert por_titulo["Cassete 1x1"]["paginas"] == [6]
    assert por_titulo["Acessórios"]["paginas"] == [7, 8]
    ignoradas = [s for s in mapa["seccoes"] if s["tipo"] == "ignorar"]
    assert sorted(p for s in ignoradas for p in s["paginas"]) == [1, 2, 3]


def test_indice_corrige_desfasamento_entre_numero_impresso_e_indice_pdf():
    mapa = gerar_mapa(doc_com_indice(offset=1), "tabela.pdf")
    por_titulo = {s["titulo"]: s for s in mapa["seccoes"]}
    assert mapa["desfasamento"] == 1
    assert por_titulo["Hi-Water"]["paginas"] == [4]
    assert por_titulo["Acessórios"]["paginas"] == [7, 8]


def test_outline_tem_prioridade_sobre_o_indice():
    d = doc_com_indice()
    d.set_toc([[1, "Aerotermia", 4], [2, "Hi-Water", 4], [2, "Split", 5], [1, "Comercial", 6]])
    mapa = gerar_mapa(d, "tabela.pdf")
    assert mapa["estrategia"] == "outline"
    titulos = [s["titulo"] for s in mapa["seccoes"] if s["tipo"] != "ignorar"]
    assert titulos == ["Hi-Water", "Split", "Comercial"]
    assert [s["paginas"] for s in mapa["seccoes"] if s["tipo"] != "ignorar"] == [[4], [5], [6, 7, 8]]


def test_cabecalhos_por_pagina_quando_nao_ha_indice():
    d = pymupdf.open()
    for titulo in ["Mural Xtreme", "Mural Xtreme", "Cassete Compacta"]:
        p = pagina_a4(d)
        escrever(p, 40, 60, titulo, 16)
        escrever(p, 40, 200, "ABC123 6926597789521 1.000 €", 7)
    mapa = gerar_mapa(d, "tabela.pdf")
    assert mapa["estrategia"] == "cabecalhos"
    assert [(s["titulo"], s["paginas"]) for s in mapa["seccoes"]] == [
        ("Mural Xtreme", [1, 2]), ("Cassete Compacta", [3])]


def test_classificacao_proposta_por_palavras_chave():
    assert propor_classificacao("Multi-Inverter Exterior", "Gama Comercial") == {
        "familia": "ar-condicionado", "segmento": "comercial", "sistema": "multi-split",
        "tipoUnidade": "exterior", "componente": "unidade-exterior"}
    assert propor_classificacao("Cassete 1x1", "Gama Comercial")["tipoUnidade"] == "cassete-4-vias"
    assert propor_classificacao("Cassete 1x1", "Gama Comercial")["sistema"] == "mono-split"
    assert propor_classificacao("Air Master", "Gama Residencial") == {
        "familia": "ar-condicionado", "segmento": "domestico", "sistema": "mono-split",
        "tipoUnidade": "mural", "componente": "conjunto"}
    assert propor_classificacao("Hi-Water", "Gama Aerotermia")["familia"] == "aqs"
    assert propor_classificacao("Hi-Therma R32 Monobloco", "Gama Aerotermia") == {
        "familia": "bombas-de-calor", "segmento": "domestico", "sistema": "monobloco",
        "tipoUnidade": "exterior", "componente": "conjunto"}
    assert propor_classificacao("Acessórios", "Gama VRF")["familia"] == "acessorios-e-controlo"
    assert propor_classificacao("Controlo Individual", "Gama VRF")["componente"] == "comando"
    assert propor_classificacao("Recuperadores de calor de fluxos cruzados", "Gama VRF")["familia"] == "ventilacao"
    assert propor_classificacao("Chillers", "Gama Aerotermia")["familia"] == "chillers"
    assert propor_classificacao("Mini VRF R32 H5", "Unidades Exteriores")["sistema"] == "vrf"
    assert propor_classificacao("Capacidades Compatíveis", "Gama Comercial")["tipo"] == "compatibilidade"
    assert propor_classificacao("Coisa desconhecida", "")["familia"] is None


def test_validar_mapa_exige_todas_as_paginas_e_classificacao():
    mapa = {"numPaginas": 4, "seccoes": [
        {"id": "capa", "titulo": "Capa", "paginas": [1], "tipo": "ignorar"},
        {"id": "a", "titulo": "A", "paginas": [2, 3], "tipo": "tabela",
         "familia": "ar-condicionado", "componente": "conjunto"},
        {"id": "b", "titulo": "B", "paginas": [3], "tipo": "tabela", "familia": None,
         "componente": "conjunto"},
    ]}
    erros = validar_mapa(mapa)
    assert any("página 4" in e for e in erros)
    assert any("b" in e and "familia" in e for e in erros)
    mapa["seccoes"][2]["familia"] = "ar-condicionado"
    mapa["seccoes"].append({"id": "c", "titulo": "C", "paginas": [4], "tipo": "tabela",
                            "familia": "outros", "componente": "acessorio"})
    assert validar_mapa(mapa) == []


def doc_indice_hisense() -> pymupdf.Document:
    """Index laid out like Hisense 2026: two columns on one band, the page
    number sometimes on its own band, two-line titles, colour sub-ranges,
    an all-caps parent heading, and one entry whose printed page is wrong."""
    d = pymupdf.open()
    pagina_a4(d)  # capa
    idx = pagina_a4(d)
    escrever(idx, 60, 60, "ÍNDICE", 14)
    # band 1: two columns
    escrever(idx, 60, 100, "Hi-Water", 8); escrever(idx, 150, 100, "03", 8)
    escrever(idx, 380, 100, "Multi-Inverter Exterior", 8); escrever(idx, 517, 100, "04", 8)
    # title with the number on the next band
    escrever(idx, 60, 116, "Energy Pro X", 8)
    escrever(idx, 150, 128, "03", 8)
    # colour sub-ranges on the right column
    escrever(idx, 380, 116, "Multi-Inverter Interior Air Master Branco", 8); escrever(idx, 517, 116, "04", 8)
    escrever(idx, 380, 132, "Multi-Inverter Interior Air Master Preto", 8); escrever(idx, 517, 132, "04", 8)
    # all-caps parent heading sharing its page with a real entry
    escrever(idx, 380, 148, "UNIDADES INTERIORES", 8); escrever(idx, 517, 148, "05", 8)
    # two-line title
    escrever(idx, 380, 164, "Recuperadores de calor de fluxos", 8)
    escrever(idx, 380, 176, "cruzados sem bateria DX", 8); escrever(idx, 517, 176, "05", 8)
    # printed page wrong by one (Perla is on page 6, index says 5)
    escrever(idx, 60, 148, "Perla", 8); escrever(idx, 150, 148, "05", 8)
    escrever(idx, 60, 164, "Condições Gerais de Venda", 8); escrever(idx, 150, 164, "07", 8)
    titulos = {3: ["Hi-Water", "Energy Pro X"], 4: ["Multi-Inverter Exterior", "Multi-Inverter Interior Air Master"],
               5: ["Unidades Interiores", "Recuperadores de calor de fluxos cruzados"],
               6: ["Perla"], 7: ["Condições Gerais de Venda"]}
    for n in range(3, 8):
        p = pagina_a4(d)
        escrever(p, 40, 40, "Gama Comercial", 8)
        for j, t in enumerate(titulos[n]):
            escrever(p, 40, 120 + j * 250, t, 12)
        escrever(p, 290, 810, f"{n:02d}", 8)
    return d


def test_indice_em_duas_colunas_e_numeros_noutra_banda():
    mapa = gerar_mapa(doc_indice_hisense(), "tabela.pdf")
    por_titulo = {s["titulo"]: s for s in mapa["seccoes"]}
    assert por_titulo["Hi-Water"]["paginas"] == [3]
    assert por_titulo["Energy Pro X"]["paginas"] == [3]
    assert por_titulo["Multi-Inverter Exterior"]["paginas"] == [4]


def test_titulo_em_duas_linhas_e_junto():
    mapa = gerar_mapa(doc_indice_hisense(), "tabela.pdf")
    titulos = [s["titulo"] for s in mapa["seccoes"]]
    assert "Recuperadores de calor de fluxos cruzados sem bateria DX" in titulos
    assert "cruzados sem bateria DX" not in titulos


def test_subgamas_de_cor_fundem_numa_seccao():
    mapa = gerar_mapa(doc_indice_hisense(), "tabela.pdf")
    titulos = [s["titulo"] for s in mapa["seccoes"]]
    assert "Multi-Inverter Interior Air Master" in titulos
    assert not any("Branco" in t or "Preto" in t for t in titulos)


def test_cabecalho_pai_em_maiusculas_nao_e_seccao():
    mapa = gerar_mapa(doc_indice_hisense(), "tabela.pdf")
    assert "UNIDADES INTERIORES" not in [s["titulo"] for s in mapa["seccoes"]]


def test_pagina_impressa_errada_e_corrigida_pelo_titulo_na_pagina():
    mapa = gerar_mapa(doc_indice_hisense(), "tabela.pdf")
    por_titulo = {s["titulo"]: s for s in mapa["seccoes"]}
    assert por_titulo["Perla"]["paginas"] == [6]
    assert por_titulo["Recuperadores de calor de fluxos cruzados sem bateria DX"]["paginas"] == [5]
    assert por_titulo["Perla"]["avisos"] == []


def test_condicoes_gerais_e_indice_sao_ignoradas():
    mapa = gerar_mapa(doc_indice_hisense(), "tabela.pdf")
    por_titulo = {s["titulo"]: s for s in mapa["seccoes"]}
    assert por_titulo["Condições Gerais de Venda"]["tipo"] == "ignorar"
    assert validar_mapa(mapa) == []


def test_entradas_do_indice_impressas_num_so_titulo_fundem():
    d = pymupdf.open()
    pagina_a4(d)
    idx = pagina_a4(d)
    escrever(idx, 60, 60, "ÍNDICE", 14)
    for y, (t, n) in enumerate([("Hi-Water", 3), ("Hydro-Split", 3), ("Hydro-integra", 3), ("Perla", 4)]):
        escrever(idx, 60, 100 + y * 14, t, 8); escrever(idx, 200, 100 + y * 14, f"{n:02d}", 8)
    p3 = pagina_a4(d)
    escrever(p3, 40, 40, "Gama Aerotermia", 8)
    escrever(p3, 40, 129, "Hi-Water", 12)
    escrever(p3, 40, 420, "Hi-Therma II Hydro-Split e Hydro-Integra", 12)
    escrever(p3, 290, 810, "03", 8)
    p4 = pagina_a4(d)
    escrever(p4, 40, 40, "Gama Residencial", 8)
    escrever(p4, 40, 120, "Perla", 12)
    escrever(p4, 290, 810, "04", 8)
    mapa = gerar_mapa(d, "tabela.pdf")
    titulos = [s["titulo"] for s in mapa["seccoes"] if s["tipo"] != "ignorar"]
    assert titulos == ["Hi-Water", "Hi-Therma II Hydro-Split e Hydro-Integra", "Perla"]
    assert validar_mapa(mapa) == []


def test_bomba_de_calor_em_contexto_vrf_e_unidade_exterior_vrf():
    assert propor_classificacao("S5 Bomba de Calor", "Exteriores · Gama VRF Unidades") == {
        "familia": "ar-condicionado", "segmento": "comercial", "sistema": "vrf",
        "tipoUnidade": "exterior", "componente": "unidade-exterior"}

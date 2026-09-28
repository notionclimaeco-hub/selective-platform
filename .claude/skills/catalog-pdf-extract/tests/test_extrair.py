import pymupdf

from conftest import escrever, linha, pagina_a4
from extrair import extrair_pagina, extrair_seccao

SEC_MURAL = {"id": "air-master", "titulo": "Air Master", "paginas": [1], "tipo": "tabela",
             "familia": "ar-condicionado", "segmento": "domestico", "sistema": "mono-split",
             "tipoUnidade": "mural", "componente": "conjunto", "gama": "Air Master", "semPreco": False}


def cabecalho_residencial(page, y):
    linha(page, y, [(40, "Referência"), (105, "EAN-13"), (165, "Capacidade"), (205, "Arrefecimento"),
                    (265, "Aquecimento"), (320, "Classe"), (365, "Dimensões"), (455, "Ø Tubagem"),
                    (500, "Fluido"), (540, "Preço unit.")])
    linha(page, y + 9, [(165, "(BTU/h)"), (205, "(kW)"), (265, "(kW)"), (320, "energética*"),
                        (365, "(L×A×P) (mm)"), (455, "(polegadas)"), (500, "Frigorigéneo"), (540, "s/IVA")])


def pagina_residencial(d):
    p = pagina_a4(d)
    escrever(p, 40, 40, "Gama Residencial", 8)
    escrever(p, 40, 141, "Air Master", 14)
    cabecalho_residencial(p, 171)
    escrever(p, 40, 195, "Air Master BRANCO", 8)
    linha(p, 204, [(40, "QK25WM0A"), (105, "6926597789521"), (165, "9k"), (205, "2,6 (1,0-4,0)"),
                   (265, "3,2 (1,6-4,2)"), (320, "A+++ / A+++"), (455, "1/4”-3/8\""), (500, "R32")])
    escrever(p, 540, 207, "1.450 €")
    linha(p, 219, [(40, "QK25WM0AG"), (105, "6926597789545"), (165, "Interior"), (365, "830×310×215"),
                   (410, "900×380×285")])
    escrever(p, 540, 222, "420 €")
    linha(p, 234, [(40, "AS25WM00W"), (105, "6926597789538"), (165, "Exterior"), (365, "785×540×260"),
                   (410, "910×600×360"), (540, "1.030 €")])
    escrever(p, 40, 339, "Air Master PRETO", 8)
    linha(p, 351, [(40, "QK25WM0B"), (105, "6926597794761"), (165, "9k"), (205, "2,6 (1,0-4,0)"),
                   (265, "3,2 (1,6-4,2)"), (320, "A+++ / A+++"), (455, "1/4”-3/8\""), (500, "R32"),
                   (540, "1.450 €")])
    escrever(p, 40, 380, "* WIFI opcional", 6)
    return p


def test_preco_na_banda_seguinte_emparelha_com_a_ref_acima(doc):
    p = pagina_residencial(doc)
    linhas = extrair_pagina(p, [SEC_MURAL], 1)
    por_ref = {l["ref"]: l for l in linhas}
    assert set(por_ref) == {"QK25WM0A", "QK25WM0AG", "AS25WM00W", "QK25WM0B"}
    assert por_ref["QK25WM0A"]["pvpCents"] == 145000
    assert por_ref["QK25WM0A"]["confianca"]["pvpCents"] == 0.5
    assert por_ref["QK25WM0AG"]["pvpCents"] == 42000
    assert por_ref["AS25WM00W"]["pvpCents"] == 103000
    assert por_ref["AS25WM00W"]["confianca"]["pvpCents"] == 1.0


def test_campos_por_forma_na_linha_do_conjunto(doc):
    p = pagina_residencial(doc)
    l = {l["ref"]: l for l in extrair_pagina(p, [SEC_MURAL], 1)}["QK25WM0A"]
    c = l["campos"]
    assert l["ean"] == "6926597789521"
    assert c["btu"] == "9000"
    assert c["frio-kw"] == "2.6" and c["frio-kw-min"] == "1.0" and c["frio-kw-max"] == "4.0"
    assert c["calor-kw"] == "3.2" and c["calor-kw-min"] == "1.6" and c["calor-kw-max"] == "4.2"
    assert c["classe-energetica"] == "A+++/A+++"
    assert c["tubagem"] == "1/4-3/8"
    assert c["refrigerante"] == "R32"
    assert c["wifi"] == "opcional"
    assert l["pdfPaginas"] == [1] and l["seccao"] == "air-master"


def test_componente_e_dimensoes_das_unidades_avulsas(doc):
    p = pagina_residencial(doc)
    por_ref = {l["ref"]: l for l in extrair_pagina(p, [SEC_MURAL], 1)}
    assert por_ref["QK25WM0AG"]["componenteHint"] == "unidade-interior"
    assert por_ref["QK25WM0AG"]["campos"]["dimensoes"] == "830x310x215"
    assert "dimensoes-embalagem" not in por_ref["QK25WM0AG"]["campos"]
    assert por_ref["AS25WM00W"]["componenteHint"] == "unidade-exterior"
    assert por_ref["QK25WM0A"]["componenteHint"] is None


def test_subcabecalho_de_cor_vale_para_as_linhas_abaixo(doc):
    p = pagina_residencial(doc)
    por_ref = {l["ref"]: l for l in extrair_pagina(p, [SEC_MURAL], 1)}
    assert por_ref["QK25WM0A"]["contexto"]["cor"] == "branco"
    assert por_ref["AS25WM00W"]["contexto"]["cor"] == "branco"
    assert por_ref["QK25WM0B"]["contexto"]["cor"] == "preto"


SEC_CONDUTA = {"id": "conduta-1x1-baixa-pressao", "titulo": "Conduta 1x1 Baixa Pressão", "paginas": [1],
               "tipo": "tabela", "familia": "ar-condicionado", "segmento": "comercial",
               "sistema": "mono-split", "tipoUnidade": "conduta-baixa-pressao", "componente": "conjunto",
               "gama": "Conduta 1x1 Baixa Pressão", "semPreco": False}


def test_refs_combinadas_dao_conjunto_e_serie_do_subcabecalho(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 40, "Gama Comercial", 8)
    escrever(p, 40, 285, "Conduta 1x1 Baixa Pressão", 14)
    cabecalho_residencial(p, 315)
    escrever(p, 40, 336, "Turbo INVERTER", 8)
    linha(p, 345, [(40, "ADT26UX4RBL8 / AUW26U4RS8"), (165, "9k"), (205, "2,6 (1,3 - 3,6)"),
                   (265, "3,2 (1,3 - 4,0)"), (320, "A++ / A+"), (455, "1/4'' - 3/8''"), (500, "R32"),
                   (540, "1.350 €")])
    linha(p, 357, [(40, "ADT26UX4RBL8"), (105, "6926597724485"), (365, "910×190×447"),
                   (410, "1080×285×565"), (540, "530 €")])
    linha(p, 369, [(40, "AUW26U4RS8"), (105, "6926597724515"), (365, "810×580×280"),
                   (410, "940×640×420"), (540, "820 €")])
    por_ref = {l["ref"]: l for l in extrair_pagina(p, [SEC_CONDUTA], 1)}
    conj = por_ref["ADT26UX4RBL8/AUW26U4RS8"]
    assert conj["refs"] == ["ADT26UX4RBL8", "AUW26U4RS8"]
    assert conj["componenteHint"] == "conjunto"
    assert conj["pvpCents"] == 135000
    assert conj["campos"]["frio-kw"] == "2.6" and conj["campos"]["frio-kw-max"] == "3.6"
    assert conj["campos"]["classe-energetica"] == "A++/A+"
    assert conj["contexto"]["serie"] == "Turbo Inverter"
    assert por_ref["ADT26UX4RBL8"]["componenteHint"] is None
    assert por_ref["AUW26U4RS8"]["campos"]["dimensoes"] == "810x580x280"


SEC_SPLIT = {"id": "hi-therma-r32-split", "titulo": "Hi-Therma R32 Split", "paginas": [1], "tipo": "tabela",
             "familia": "bombas-de-calor", "segmento": "domestico", "sistema": "bibloco",
             "tipoUnidade": "exterior", "componente": "conjunto", "gama": "Hi-Therma R32 Split", "semPreco": False}


def test_banda_de_continuacao_sob_a_ue_funde_na_linha(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 40, "Gama Aerotermia", 8)
    escrever(p, 40, 114, "Hi-Therma R32 Split", 14)
    linha(p, 141, [(160, "Arrefecimento"), (215, "Aquecimento"), (270, "Dimensões"), (360, "Ø Tubagem"),
                   (520, "Preço unit.")])
    linha(p, 144, [(40, "Categoria"), (85, "Modelo"), (150, "EAN-13"), (420, "Alimentação Elétrica")])
    linha(p, 147, [(160, "(kW)"), (215, "(kW)"), (270, "(L x A x P) (mm)"), (360, "(polegadas)"), (520, "s/IVA")])
    linha(p, 162, [(40, "UE"), (85, "AHW-044HCDS1"), (150, "6943634895168"), (270, "900×750×340"), (520, "1.696 €")])
    linha(p, 168, [(160, "4,4"), (215, "4,4"), (360, "1/4” - 1/2”"), (420, "220-240V/50Hz")])
    linha(p, 177, [(40, "UI SPLIT"), (85, "AHM-044HCDSAA"), (150, "6943634895458"), (270, "520×890×320"), (520, "2.777 €")])
    por_ref = {l["ref"]: l for l in extrair_pagina(p, [SEC_SPLIT], 1)}
    ue = por_ref["AHW-044HCDS1"]
    assert ue["componenteHint"] == "unidade-exterior"
    assert ue["pvpCents"] == 169600
    assert ue["campos"]["frio-kw"] == "4.4" and ue["campos"]["calor-kw"] == "4.4"
    assert ue["campos"]["alimentacao"] == "monofasica"
    assert ue["campos"]["tubagem"] == "1/4-1/2"
    assert ue["campos"]["dimensoes"] == "900x750x340"
    assert por_ref["AHM-044HCDSAA"]["componenteHint"] == "unidade-interior"
    assert "frio-kw" not in por_ref["AHM-044HCDSAA"]["campos"]


SEC_AQS = {"id": "hi-water", "titulo": "Hi-Water", "paginas": [1], "tipo": "tabela", "familia": "aqs",
           "segmento": "domestico", "sistema": None, "tipoUnidade": "monobloco-aqs",
           "componente": "conjunto", "gama": "Hi-Water", "semPreco": False}


def test_colunas_do_cabecalho_distinguem_deposito_de_potencia(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 40, "Gama Aerotermia", 8)
    escrever(p, 40, 129, "Hi-Water", 14)
    linha(p, 156, [(210, "Capacidade de")])
    linha(p, 159, [(160, "Capacidade do"), (280, "Dimensões"), (520, "Preço unit.")])
    linha(p, 162, [(40, "Categoria"), (85, "Modelo"), (135, "EAN-13"), (210, "Aquecimento"),
                   (360, "Fluido Frigorigéneo"), (430, "Alimentação Elétrica")])
    linha(p, 168, [(160, "depósito (L)"), (280, "(L x A x P) (mm)"), (520, "s/IVA")])
    linha(p, 171, [(210, "(kW)*")])
    linha(p, 183, [(40, "Aerotermia"), (85, "AH-80NH4GEB00"), (135, "6926597781082"), (165, "80"),
                   (215, "0.95"), (280, "540×1170×565"), (360, "R290"), (430, "220-240V/50Hz"), (520, "1.655 €")])
    linha(p, 198, [(40, "Aerotermia"), (85, "AH-100NH4GFB00"), (135, "6926597779737"), (165, "100"),
                   (215, "0.95"), (280, "540×1280×565"), (360, "R290"), (430, "220-240V/50Hz"), (520, "1.805 €")])
    por_ref = {l["ref"]: l for l in extrair_pagina(p, [SEC_AQS], 1)}
    l = por_ref["AH-80NH4GEB00"]
    assert l["campos"]["deposito-l"] == "80"
    assert l["campos"]["calor-kw"] == "0.95"
    assert l["confianca"]["deposito-l"] == 0.8
    assert l["campos"]["refrigerante"] == "R290"
    assert l["campos"]["alimentacao"] == "monofasica"
    assert por_ref["AH-100NH4GFB00"]["campos"]["deposito-l"] == "100"


SEC_ACESS = {"id": "acessorios", "titulo": "Acessórios", "paginas": [1], "tipo": "tabela",
             "familia": "acessorios-e-controlo", "segmento": "comercial", "sistema": None,
             "tipoUnidade": None, "componente": "acessorio", "gama": "Acessórios", "semPreco": False}


def test_descricao_de_acessorio_inclui_linhas_adjacentes(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 105, "Acessórios", 14)
    linha(p, 138, [(40, "Referência"), (130, "Descrição"), (430, "EAN-13"), (520, "Preço unit.")])
    linha(p, 162, [(40, "YXE-C01U1*"), (130, "CONTROLADOR REMOTO POR CABO COM RECETOR IR"),
                   (430, "6946087399450"), (520, "90 €")])
    linha(p, 183, [(130, "CONTROLADOR REMOTO POR CABO COM FUNÇÃO DEEPCOOL (COMPATÍVEL COM GAMA RESIDENCIAL, MULTI-SPLIT E")])
    linha(p, 186, [(40, "YXE-E01U(E)"), (430, "6926597708935"), (520, "80 €")])
    linha(p, 189, [(130, "COMERCIAL)")])
    linha(p, 318, [(40, "PE-FBA-C (ADT26~35)"), (130, "PAINEL 3D PARA CONDUTA BPE"), (520, "170 €")])
    por_ref = {l["ref"]: l for l in extrair_pagina(p, [SEC_ACESS], 1)}
    assert por_ref["YXE-C01U1"]["campos"]["descricao"] == "Controlador remoto por cabo com recetor IR"
    assert por_ref["YXE-C01U1"]["pvpCents"] == 9000
    assert por_ref["YXE-E01U(E)"]["campos"]["descricao"] == (
        "Controlador remoto por cabo com função deepcool (compatível com gama residencial, multi-split e comercial)")
    assert por_ref["YXE-E01U(E)"]["ean"] == "6926597708935"
    assert por_ref["PE-FBA-C"]["campos"]["descricao"] == "Painel 3D para conduta BPE"
    assert por_ref["PE-FBA-C"]["campos"]["compativel-com"] == "ADT26~35"


def test_linhas_vao_para_a_seccao_cujo_titulo_esta_acima(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 40, "Gama Comercial", 8)
    escrever(p, 40, 108, "Multi-Inverter Exterior", 14)
    linha(p, 141, [(40, "Tipo"), (70, "Referência"), (140, "EAN-13"), (210, "Capacidade"), (250, "Arrefecimento"),
                   (310, "Aquecimento"), (370, "Classe"), (540, "Preço unit.")])
    linha(p, 159, [(40, "2×1"), (70, "2AMW42U4RGC"), (140, "6926597710174"), (210, "14k"), (250, "4,1 (1,0-5,5)"),
                   (310, "4,5 (1,0-6,0)"), (370, "A++ / A+"), (540, "1.000 €")])
    escrever(p, 40, 297, "Multi-Inverter Interior Conduta", 14)
    linha(p, 324, [(40, "Referência"), (140, "EAN-13"), (210, "Capacidade"), (250, "Arrefecimento"),
                   (310, "Aquecimento"), (540, "Preço unit.")])
    escrever(p, 40, 348, "Baixa Pressão estática", 8)
    linha(p, 360, [(40, "ADT26UX4RBL8"), (140, "6926597724485"), (210, "9k"), (250, "2,6"), (310, "3,2"),
                   (540, "530 €")])
    escrever(p, 40, 414, "Média Pressão estática", 8)
    linha(p, 426, [(40, "ADT52UX4RGM8"), (140, "6926597739335"), (210, "18k"), (250, "5,0"), (310, "5,5"),
                   (540, "700 €")])
    ue = {"id": "multi-ue", "titulo": "Multi-Inverter Exterior", "paginas": [1], "tipo": "tabela",
          "familia": "ar-condicionado", "segmento": "comercial", "sistema": "multi-split",
          "tipoUnidade": "exterior", "componente": "unidade-exterior", "gama": "Multi-Inverter", "semPreco": False}
    ui = {"id": "multi-ui-conduta", "titulo": "Multi-Inverter Interior Conduta", "paginas": [1],
          "tipo": "tabela", "familia": "ar-condicionado", "segmento": "comercial", "sistema": "multi-split",
          "tipoUnidade": "conduta", "componente": "unidade-interior", "gama": "Multi-Inverter Conduta",
          "semPreco": False}
    linhas = extrair_pagina(p, [ui, ue], 1)
    por_ref = {l["ref"]: l for l in linhas}
    assert por_ref["2AMW42U4RGC"]["seccao"] == "multi-ue"
    assert por_ref["2AMW42U4RGC"]["campos"]["unidades-max"] == "2"
    assert por_ref["ADT26UX4RBL8"]["seccao"] == "multi-ui-conduta"
    assert por_ref["ADT26UX4RBL8"]["contexto"]["pressao-estatica"] == "baixa"
    assert por_ref["ADT52UX4RGM8"]["contexto"]["pressao-estatica"] == "media"


def test_matriz_de_compatibilidade(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 99, "Capacidades Compatíveis", 14)
    linha(p, 129, [(40, "Unidade Exterior"), (150, "Nº Unidades Interiores"), (330, "Capacidade")])
    linha(p, 144, [(250, "2,5 kW"), (330, "3,5 kW"), (410, "5,0 kW"), (490, "7,0 kW")])
    linha(p, 156, [(40, "2AMW42U4RGC"), (170, "2"), (258, "x"), (338, "x")])
    linha(p, 183, [(40, "3AMW62U4RJC"), (170, "3"), (258, "x"), (338, "x"), (418, "x")])
    sec = {"id": "compat", "titulo": "Capacidades Compatíveis", "paginas": [1], "tipo": "compatibilidade",
           "familia": "ar-condicionado", "segmento": "comercial", "sistema": "multi-split",
           "tipoUnidade": "exterior", "componente": "unidade-exterior", "gama": "Multi-Inverter", "semPreco": True}
    por_ref = {l["ref"]: l for l in extrair_pagina(p, [sec], 1)}
    assert por_ref["2AMW42U4RGC"]["compativelCom"] == ["UI 2.5 kW", "UI 3.5 kW"]
    assert por_ref["2AMW42U4RGC"]["campos"]["unidades-max"] == "2"
    assert por_ref["2AMW42U4RGC"]["soCompatibilidade"] is True
    assert por_ref["3AMW62U4RJC"]["compativelCom"] == ["UI 2.5 kW", "UI 3.5 kW", "UI 5.0 kW"]


def test_matriz_com_refs_e_precos_gera_conjuntos(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 99, "Combinações", 14)
    linha(p, 144, [(250, "MSZ-AP25VG"), (330, "MSZ-AP35VG")])
    linha(p, 156, [(40, "MXZ-2F42VF"), (258, "x"), (338, "1.500 €")])
    sec = {"id": "combos", "titulo": "Combinações", "paginas": [1], "tipo": "compatibilidade",
           "familia": "ar-condicionado", "segmento": "domestico", "sistema": "multi-split",
           "tipoUnidade": "exterior", "componente": "unidade-exterior", "gama": "Multi", "semPreco": False}
    linhas = extrair_pagina(p, [sec], 1)
    por_ref = {l["ref"]: l for l in linhas}
    assert por_ref["MXZ-2F42VF"]["compativelCom"] == ["MSZ-AP25VG", "MSZ-AP35VG"]
    assert por_ref["MXZ-2F42VF/MSZ-AP35VG"]["pvpCents"] == 150000
    assert por_ref["MXZ-2F42VF/MSZ-AP35VG"]["componenteHint"] == "conjunto"


def test_extrair_seccao_percorre_as_paginas_do_mapa(doc):
    pagina_residencial(doc)
    p2 = pagina_a4(doc)
    escrever(p2, 40, 40, "Gama Residencial", 8)
    escrever(p2, 40, 123, "Air Master (continuação)", 14)
    cabecalho_residencial(p2, 150)
    linha(p2, 204, [(40, "QK35WM0A"), (105, "6926597789552"), (165, "12k"), (205, "3,5 (1,0-4,4)"),
                    (265, "4,2 (1,6-4,8)"), (320, "A+++ / A+++"), (455, "1/4”-3/8\""), (500, "R32"), (540, "1.495 €")])
    mapa = {"numPaginas": 2, "seccoes": [{**SEC_MURAL, "paginas": [1, 2]}]}
    linhas = extrair_seccao(doc, mapa, "air-master")
    refs = [l["ref"] for l in linhas]
    assert refs == ["QK25WM0A", "QK25WM0AG", "AS25WM00W", "QK25WM0B", "QK35WM0A"]
    assert linhas[-1]["pdfPaginas"] == [2]


def test_rotulos_de_funcionalidades_acima_do_cabecalho_nao_sao_linhas(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 40, "Gama Residencial", 8)
    escrever(p, 40, 141, "Air Master", 14)
    linha(p, 153, [(60, "anti corrosão"), (150, "energética"), (230, "HI-NANO"), (300, "Silencioso"), (370, "Inteligente")])
    cabecalho_residencial(p, 171)
    linha(p, 204, [(40, "QK25WM0A"), (105, "6926597789521"), (165, "9k"), (205, "2,6"), (265, "3,2"),
                   (320, "A+++ / A+++"), (500, "R32"), (540, "1.450 €")])
    escrever(p, 40, 300, "* Compatível com controlo centralizado através da interface B544(E)", 6)
    refs = [l["ref"] for l in extrair_pagina(p, [SEC_MURAL], 1)]
    assert refs == ["QK25WM0A"]


def test_nota_de_preco_sob_consulta_marca_as_linhas(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 40, "Gama VRF", 8)
    escrever(p, 40, 114, "Mural", 14)
    linha(p, 141, [(40, "Categoria"), (100, "Modelo"), (170, "EAN-13"), (260, "Arrefecimento"), (320, "Aquecimento")])
    linha(p, 159, [(40, "UI - R410A"), (100, "AVS-07HJFA"), (170, "6943634847211"), (260, "2,2"), (320, "2,8")])
    escrever(p, 40, 200, "* Preços sob consulta", 6)
    sec = {**SEC_MURAL, "id": "mural-vrf", "titulo": "Mural", "sistema": "vrf", "componente": "unidade-interior"}
    l = extrair_pagina(p, [sec], 1)[0]
    assert l["ref"] == "AVS-07HJFA"
    assert l["pvpCents"] is None and l["precoSobConsulta"] is True
    assert l["campos"]["refrigerante"] == "R410A"
    assert l["componenteHint"] == "unidade-interior"


def test_euro_duplicado_nao_estraga_o_preco(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 141, "Chão-Teto 1x1", 14)
    cabecalho_residencial(p, 171)
    linha(p, 204, [(40, "AUW125U4RW8"), (105, "6926597730912"), (365, "1100×875×450"), (540, "3.165 €")])
    escrever(p, 556, 204, "€")
    l = extrair_pagina(p, [{**SEC_MURAL, "titulo": "Chão-Teto 1x1"}], 1)[0]
    assert l["pvpCents"] == 316500


def test_numeros_ficam_na_descricao_de_acessorios_pela_ordem(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 40, "Gama VRF", 8)
    escrever(p, 40, 123, "Derivadores", 14)
    linha(p, 150, [(40, "Categoria"), (100, "Modelo"), (200, "EAN-13"), (300, "Descrição")])
    linha(p, 165, [(40, "Acessórios"), (100, "HFQ-104HF#ES"), (200, "6943634881468"),
                   (300, "Colector de 4 saídas para sistemas a dois tubos, até 8 CV")])
    linha(p, 192, [(40, "Acessórios"), (100, "HFQ-102F#ES"), (200, "6943634845514"),
                   (300, "Derivador para unidades interiores, até 11,9 CV")])
    sec = {**SEC_ACESS, "id": "derivadores", "titulo": "Derivadores"}
    por_ref = {l["ref"]: l for l in extrair_pagina(p, [sec], 1)}
    assert por_ref["HFQ-104HF#ES"]["campos"]["descricao"] == "Colector de 4 saídas para sistemas a dois tubos, até 8 CV"
    assert por_ref["HFQ-102F#ES"]["campos"]["descricao"] == "Derivador para unidades interiores, até 11,9 CV"
    assert "frio-kw" not in por_ref["HFQ-102F#ES"]["campos"]


def test_titulo_da_seccao_nao_e_subcabecalho_de_serie(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 40, "Gama Comercial", 8)
    escrever(p, 40, 513, "Multi-inverter Interior Cassete", 14)
    linha(p, 540, [(40, "Referência"), (105, "EAN-13"), (165, "Capacidade"), (205, "Arrefecimento"),
                   (265, "Aquecimento"), (540, "Preço unit.")])
    linha(p, 576, [(40, "ACT26UR4RCC8"), (105, "6926597724478"), (165, "9k"), (205, "2,6"), (265, "3,2"), (540, "620 €")])
    sec = {**SEC_MURAL, "id": "multi-ui-cassete", "titulo": "Multi-inverter Interior Cassete",
           "componente": "unidade-interior"}
    l = extrair_pagina(p, [sec], 1)[0]
    assert "serie" not in l["contexto"]


def test_segunda_palavra_de_categoria_nao_vira_descricao(doc):
    p = pagina_a4(doc)
    escrever(p, 40, 114, "Hi-Therma R32 Split", 14)
    linha(p, 144, [(40, "Categoria"), (85, "Modelo"), (150, "EAN-13"), (520, "Preço unit.")])
    linha(p, 177, [(40, "UI SPLIT"), (85, "AHM-044HCDSAA"), (150, "6943634895458"), (270, "520×890×320"), (520, "2.777 €")])
    l = extrair_pagina(p, [SEC_SPLIT], 1)[0]
    assert l["componenteHint"] == "unidade-interior"
    assert "descricao" not in l["campos"]

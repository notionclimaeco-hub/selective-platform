"""Daikin 2026 (`DAIKIN Tabela de Preços 2026.pdf`, 158 páginas, ticket #47): mapa.

Hook `gerar(doc, ficheiro, marca, ano)` do `cadeia.py`: o índice (p2) dá as
gamas, mas as páginas misturam fichas, tabelas-resumo, listas de acessórios e
matrizes, por isso o mapa é escrito aqui página a página. As tabelas são
lidas por `marcas/daikin/extrair.py`; o que cada ref é (conjunto, UE, UI,
gama, cor) decide `marcas/daikin/series.py`, não a secção.

Campos além do mapa automático (lidos pelo hook):
- `leitor`: `pares` (default) — ver extrair.py.
- `regras`: conjuntos de regras de `series.REGRAS` que a secção usa.
- `soComPreco`: fichas que imprimem as refs da UI e da UE sem preço (só o
  conjunto se vende): refs de equipamento sem preço ficam de fora.
- `descricao: "esquerda"`: listas "Descrição | Referência | Preço".
- `colunas: {chave: [x0, x1]}`: specs por coluna quando a ordem das tabelas
  de AC (kW, classe, SEER/SCOP) não serve.
- `posicoes: {"<página>": y}` início da secção na página (default 0); a
  secção acaba onde começa a seguinte da mesma faixa (`regiao: {x0, x1}`).
"""
AC, BC, AQS, VMC, FC = "ar-condicionado", "bombas-de-calor", "aqs", "ventilacao", "ventiloconvectores"
CH, PUR, CORT, ACESS = "chillers", "purificadores-de-ar", "cortinas-de-ar", "acessorios-e-controlo"


def sec(id_, titulo, paginas, familia, componente="conjunto", segmento=None, sistema=None,
        tipoUnidade=None, gama=None, **extra):
    paginas = paginas if isinstance(paginas, list) else [paginas]
    return {"id": id_, "titulo": titulo, "paginas": paginas, "tipo": extra.pop("tipo", "tabela"),
            "familia": familia, "segmento": segmento, "sistema": sistema, "tipoUnidade": tipoUnidade,
            "componente": componente, "gama": gama or titulo, "semPreco": False, "herdarKw": False,
            "avisos": [], **extra}


def ignorar(id_, titulo, paginas, **extra):
    paginas = paginas if isinstance(paginas, list) else [paginas]
    return {"id": id_, "titulo": titulo, "paginas": paginas, "tipo": "ignorar", "avisos": [], **extra}


def dom(id_, titulo, paginas, **extra):
    """Páginas da gama doméstica: conjuntos, UE e UI pela ref (`ac-domestico`)."""
    return sec(id_, titulo, paginas, AC, "conjunto", "domestico", "mono-split", "mural",
               regras=extra.pop("regras", ["ac-domestico"]), **extra)


def sky(id_, titulo, paginas, **extra):
    return sec(id_, titulo, paginas, AC, "conjunto", "comercial", "mono-split", None,
               regras=extra.pop("regras", ["sky-air", "ac-domestico"]), **extra)


SECCOES = [
    ignorar("capa-indice-contactos", "Capa, índice, contactos e portais", list(range(1, 7))),
    ignorar("purificadores-apresentacao", "Purificadores de Ar Residencial", 7),
    sec("purificadores-residenciais", "Purificadores de Ar Residencial", 8, PUR, "conjunto", "domestico", None,
        "purificador", regras=["outros-equipamentos"], precoPorBaixo={"dy": 16}, especificacoes="transpostas",
        posicoes={"8": 440}),
    sec("astropure", "Astropure 2000", 9, PUR, "conjunto", "comercial", None, "purificador",
        regras=["outros-equipamentos"]),
    ignorar("gama-domestica-apresentacao", "A nossa gama split", [10, 11, 12, 15, 16]),
    # p13-22 fichas: só o conjunto tem preço (as UI/UE da ficha não), mais acessórios.
    # A Ururu Sarara só tem ficha; as outras gamas estão no resumo das p23-24, por isso das
    # fichas lêem-se só os acessórios (os cabeçalhos "SB.FTXA20" / "CS/CB" partem as refs).
    dom("ururu-sarara", "Unidade Mural Ururu Sarara", 13, soComPreco=True, especificacoes="transpostas"),
    dom("emura", "Unidade Mural Emura", 14, soAcessorios=True),
    dom("stylish", "Unidade Mural Stylish", 17, soAcessorios=True),
    dom("perfera-mural", "Unidade Mural Perfera", 18, soAcessorios=True),
    dom("comfora", "Unidade Mural Comfora", 19, soAcessorios=True),
    dom("sensira", "Unidade Mural Sensira", 20, soAcessorios=True),
    dom("conduta-baixo-perfil", "Unidade de condutas de baixo perfil", 21, soAcessorios=True),
    dom("perfera-chao", "Perfera de chão", 22, soAcessorios=True),
    # p23-24 resumo: conjunto, UE e UI com preço em cada linha.
    dom("mono-split-residencial", "Gama Residencial - Mono Split", [23, 24]),
    # p25 Multi Split (UE) e Mini VRV (UE), caixas de distribuição; matriz de compatibilidade por baixo.
    dom("multi-split-ue", "Gama Multi Split e Mini VRV", 25, posicoes={"25": 90},
        colunas={"unidades-max": [215, 270], "kw": [400, 470], "classe-energetica": [475, 560]}),
    dom("mini-vrv", "Mini VRV", 25, posicoes={"25": 236},
        colunas={"unidades-max": [295, 380], "kw": [395, 470], "alimentacao": [475, 560]}),
    ignorar("multi-split-compatibilidade", "Unidades exteriores compatíveis", 25, posicoes={"25": 420}),
    dom("multi-split-ui", "Unidades interiores da gama residencial R-32", 26,
        regras=["multi-kits", "ac-domestico", "sky-air"]),
    ignorar("multi-split-especificacoes", "Especificações técnicas das unidades", [27, 29]),
    dom("multi-sensira", "Gama Multi Split Sensira", 28,
        colunas={"unidades-max": [110, 135], "kw": [255, 290]}),
    ignorar("multi-sensira-conjuntos", "Consulta rápida conjuntos frequentes (sem ref de conjunto)", 28,
            posicoes={"28": 630}),
    ignorar("vrv-5", "VRV 5 S-series (preços sob consulta)", 30),
    sec("onecta", "Daikin Onecta", 31, ACESS, "acessorio", posicoes={"31": 560}),
    sec("opcoes-split", "Opções - Split", 32, ACESS, "acessorio", posicoes={"32": 60}),
    ignorar("sky-air-apresentacao", "Madoka Plus e Sky Air", [33, 34, 35]),
    sky("cassete-round-flow", "Cassete 8 vias Round flow", 36),
    sky("cassete-totalmente-plana", "Cassete 4 vias totalmente plana 60 x 60", 37),
    sky("horizontal-a-vista", "Horizontal à vista", 38),
    sky("mural-sky-air", "Mural Perfera / Mural", 39),
    sky("conduta-media-pressao", "Condutas Média Pressão Estática", 40),
    sky("conduta-baixa-pressao-chao", "Condutas Baixa Pressão Estática / Unidade de Chão", 41),
    sky("conduta-alta-pressao", "Condutas Alta Pressão Estática", 42),
    sky("armario-vertical", "Unidade de chão Armário vertical", 43),
    sky("conjuntos-assimetricos", "Conjuntos assimétricos", 44),
    sky("dupla-tripla", "Aplicações dupla, tripla e 2x dupla", 45, regras=["sky-air", "multi-kits"]),
    ignorar("dupla-tripla-combinacoes", "Tabela de combinação", 46, posicoes={"46": 0}),
    sec("derivadores-sky-air", "Derivadores para aplicações Sky Air", 46, ACESS, "acessorio",
        posicoes={"46": 425}, regiao={"x0": 30, "x1": 360}, descricao="esquerda"),
    sec("kit-multizonas", "Kit Multizonas", 47, ACESS, "acessorio", descricao="esquerda",
        regras=["multizonas"]),
    sec("gestao-controlo", "Sistemas de Gestão e Controlo", 48, ACESS, "acessorio"),
    ignorar("cloud-plus-e-tecnologia-mista", "Daikin Cloud Plus, Tecnologia mista", [49, 50, 51, 52]),
    # --- Tecnologia mista (p53-56) ---------------------------------------------------
    sec("multi-plus", "Multi + Água Quente Sanitária", 53, AC, "unidade-exterior", "domestico", "multi-split",
        "exterior", regras=["multi-plus"], colunas={"unidades-max": [198, 212, "MWXM"]}, posicoes={"53": 450},
        colunasPreco=[{"rx": "^(EKHWET|CKHWS)", "x": [480, 515]}, {"rx": "MWXM", "x": [515, 560]}]),
    sec("multi-plus-homehub", "Homehub", 53, ACESS, "acessorio", posicoes={"53": 630}),
    ignorar("multi-plus-especificacoes", "Multi+ dados técnicos e Multi+ com hidrobox (brevemente)",
            [54, 55, 56, 57, 58]),
    # --- Aquecimento: Daikin Altherma (p59-75). Matrizes UE × UI: preço por baixo de cada ref. ---
    *[sec(f"altherma-{i}", t, pg, BC, "unidade-exterior", "domestico", "bibloco", "exterior", leitor="matriz",
          regras=["altherma"], ordemKw="calor-frio") for i, (t, pg) in enumerate([
        ("Daikin Altherma 4 H ECH2O classes 4-6-7", 59), ("Daikin Altherma 4 H W/F classes 4-6-7", 60),
        ("Daikin Altherma 4 H ECH2O classes 6-14", 61), ("Daikin Altherma 4 H W/F classes 6-14", 62),
        ("Daikin Altherma 3 H HT ECH2O", 63), ("Daikin Altherma 3 H HT W/F", 64),
        ("Daikin Altherma 3 R ECH2O classes 4-8", 67), ("Daikin Altherma 3 R W/F classes 4-8", 68),
        ("Daikin Altherma 3 R ECH2O classes 11-16", 69), ("Daikin Altherma 3 R W/F classes 11-16", 70)])],
    sec("altherma-4h-acessorio-1", "Acessório (4 H ECH2O 4-6-7)", 59, ACESS, "acessorio",
        posicoes={"59": 740}, descricao="esquerda"),
    sec("altherma-4h-acessorio-2", "Acessório (4 H ECH2O 6-14)", 61, ACESS, "acessorio",
        posicoes={"61": 740}, descricao="esquerda"),
    *[sec(f"altherma-resistencias-{pg}", "Resistências elétricas", pg, ACESS, "acessorio",
          posicoes={str(pg): 690}, regiao={"x0": 30, "x1": 310}, descricao="esquerda") for pg in (63, 67, 69)],
    *[sec(f"altherma-kits-{pg}", "Kits para ligações simplificadas", pg, ACESS, "acessorio",
          posicoes={str(pg): 690}, regiao={"x0": 310, "x1": 600}, descricao="esquerda") for pg in (63, 67, 69)],
    *[sec(f"altherma-acessorios-{pg}", "Acessórios para bombas de calor Daikin Altherma", pg, ACESS,
          "acessorio", descricao="esquerda", refNumerica=True) for pg in (65, 66, 77, 78)],
    sec("altherma-3m", "Daikin Altherma 3 M", [71, 72], BC, "conjunto", "domestico", "monobloco", "exterior",
        regras=["altherma"], colunas={"calor-kw": [170, 235], "frio-kw": [270, 330]},
        posicoes={"71": 690, "72": 620}),
    sec("altherma-3rf-mini", "Daikin Altherma 3 R F Mini", [73, 85], BC, "conjunto", "domestico", "bibloco",
        "integrada", regras=["altherma"], posicoes={"73": 360, "85": 360}),
    sec("altherma-3rf-mini-acessorios", "Acessórios para a Daikin Altherma 3 R F Mini", [73, 85], ACESS,
        "acessorio", descricao="esquerda", posicoes={"73": 425, "85": 470}),
    sec("altherma-3-geo", "Daikin Altherma 3 GEO", 74, BC, "conjunto", "domestico", None, "integrada",
        regras=["altherma"], posicoes={"74": 480}, colunas={"calor-kw": [170, 235], "frio-kw": [270, 330]}),
    sec("altherma-3-ws", "Daikin Altherma 3 WS", 75, BC, "conjunto", "domestico", None, "integrada",
        regras=["altherma"], posicoes={"75": 480}, colunas={"calor-kw": [170, 235], "frio-kw": [270, 330]}),
    ignorar("altherma-apresentacao", "Aquecimento (fotos)", [57, 58, 76]),
    sec("altherma-hpc", "Daikin Altherma HPC", 79, FC, "conjunto", "domestico", None, "consola", regras=["hpc"],
        colunas={"dimensoes": [130, 185], "frio-kw": [270, 310], "calor-kw": [400, 440]}),
    sec("altherma-hpc-acessorios", "Daikin Altherma HPC - Acessórios", 80, ACESS, "acessorio",
        descricao="esquerda"),
    sec("altherma-ufh", "Daikin Altherma UFH", [81, 82], ACESS, "acessorio", descricao="esquerda"),
    sec("controlo-multizona-sem-fios", "Controlo Multizona sem fios", 83, ACESS, "acessorio",
        descricao="esquerda", posicoes={"83": 640}),
    sec("controlo-multizona-com-fios", "Controlo Multizona com fios", 84, ACESS, "acessorio",
        descricao="esquerda", posicoes={"84": 700}),
    sec("altherma-m-aqs", "Daikin Altherma M AQS", 86, AQS, "conjunto", "domestico", "monobloco",
        "monobloco-aqs", regras=["aqs"], posicoes={"86": 500}),
    sec("altherma-m-aqs-acessorios", "Acessórios Altherma M AQS", 86, ACESS, "acessorio",
        posicoes={"86": 690}, descricao="esquerda"),
    sec("altherma-3-cw", "Daikin Altherma 3 CW", 87, "outros", "conjunto", "domestico", None, None,
        regras=["caldeiras"], posicoes={"87": 400}),
    sec("altherma-3-cw-acessorios", "Acessórios caldeira de condensação mural Daikin Altherma 3 CW", 87,
        ACESS, "acessorio", posicoes={"87": 585}, descricao="esquerda"),
    sec("depositos-pressurizados", "Depósitos pressurizados", 88, AQS, "deposito", "domestico", None, "deposito",
        regras=["aqs"], posicoes={"88": 130}),
    ignorar("depositos-pressurizados-compatibilidade", "Depósitos AQS pressurizados — compatibilidade", 88,
            posicoes={"88": 300}),
    sec("depositos-ech2o", "Depósitos despressurizados ECH2O", 89, AQS, "deposito", "domestico", None, "deposito",
        regras=["aqs"], posicoes={"89": 200}),
    ignorar("depositos-ech2o-compatibilidade", "Compatibilidade entre depósitos ECH2O", 90, posicoes={"90": 0}),
    sec("depositos-ech2o-kits", "Kits de ligação entre bombas de calor e depósitos ECH2O", 90, ACESS, "acessorio",
        posicoes={"90": 700}, descricao="esquerda", refNumerica=True),
    sec("depositos-ech2o-acessorios", "Acessórios para depósitos ECH2O", 91, ACESS, "acessorio",
        descricao="esquerda", refNumerica=True),
    ignorar("altherma-st-apresentacao", "Daikin Altherma ST (foto)", 92),
    sec("altherma-st-cesi", "Conjunto Solar Térmico - Sistema CESI Drain-Back", 93, AQS, "conjunto",
        "domestico", regras=["solar"], posicoes={"93": 260}),
    sec("altherma-st-componentes", "Painéis solares térmicos e componentes", [93, 94, 95], ACESS, "acessorio",
        descricao="esquerda", refNumerica=True, posicoes={"93": 470}),
    sec("altherma-st-kits", "Daikin Altherma ST — conjuntos", [96, 97], AQS, "conjunto", "domestico",
        regras=["solar"], precoPorBaixo={"dy": 120}, refAposRotulo=True),
    # --- Ventilação (p98-112) -----------------------------------------------------------
    ignorar("ventilacao-apresentacao", "Ventilação, Air Sense Pro (lido em pos.py), DUCO",
            [98, 99, 100, 101, 102, 103, 110, 113, 125, 129, 135]),
    sec("ducobox", "Ducobox e acessórios", 104, VMC, "conjunto", "domestico", None, "vmc", refNumerica=True,
        porDescricao=[{"rx": r"^DucoBox Energy (Sky|Comfort Plus|Comfort|Premium)", "componente": "conjunto",
                       "familia": VMC, "segmento": "domestico", "tipoUnidade": "vmc", "rotulo": "",
                       "gama": "", "derivar": ["caudal-m3h", "zonas", "controlo", "orientacao"]}],
        posicoes={"104": 70}),
    sec("ducobox-acessorios-1", "Ducobox — acessórios (esquerda)", 104, ACESS, "acessorio", refNumerica=True,
        posicoes={"104": 432}, regiao={"x0": 30, "x1": 300}, descricao="esquerda", dyLista=14),
    sec("ducobox-acessorios-2", "Ducobox — acessórios (direita)", 104, ACESS, "acessorio", refNumerica=True,
        posicoes={"104": 432}, regiao={"x0": 300, "x1": 600}, descricao="esquerda", dyLista=14),
    # 00004995 (acoplamento multizona) "Disponível brevemente": sem preço (o catálogo
    # anterior deu-lhe os 20 € do acoplamento D200 ao lado).
    sec("ducoflex-1", "Ducoflex (esquerda)", 105, ACESS, "acessorio", refNumerica=True, descricao="esquerda",
        regiao={"x0": 30, "x1": 298}, dyLista=14, ignorarRefs="^00004995$"),
    sec("ducoflex-2", "Ducoflex (direita)", 105, ACESS, "acessorio", refNumerica=True, descricao="esquerda",
        regiao={"x0": 298, "x1": 600}, ignorarRefs="^00004995$"),
    sec("vam", "Ventilação com recuperação de energia", 106, VMC, "conjunto", "comercial", None,
        "recuperador-de-calor", regras=["ventilacao"], precoPorBaixo={"dy": 25},
        prefixarRefs=[[r"\d{3,4}(FC9|J8)", "VAM"]], especificacoes="transpostas"),
    sec("ekvdx", "Módulo DX para combinação com VAM", 107, VMC, "conjunto", "comercial", None, "uta",
        regras=["ventilacao"], precoPorBaixo={"dy": 15}, especificacoes="transpostas"),
    sec("vkm", "Ventilação com recuperação de energia, humidificação e tratamento do ar", 108, VMC, "conjunto",
        "comercial", None, "recuperador-de-calor", leitor="rooftops", regras=["ventilacao"]),
    ignorar("biddle", "Cortina de ar Biddle (sem preços)", 109),
    sec("era", "Unidade Daikin ERA", 111, AC, "unidade-exterior", "comercial", "vrf", "exterior",
        regras=["ventilacao"], precoPorBaixo={"dy": 15}, especificacoes="transpostas"),
    # p112: lista à esquerda (ref, descrição por baixo, preço à direita) e grelha por modelo de VAM/VKM.
    sec("opcoes-ventilacao", "Opções - Ventilação", 112, ACESS, "acessorio", descricao="linha",
        precoPorBaixo={"dy": 22}, colunasPreco=[{"rx": "^(BRC|DCS|DGE|DMS|DCM|EKMBDXB)", "x": [170, 210], "dy": 12}]),
    # --- Unidades de tratamento de ar (p114-121) -----------------------------------------------
    sec("uta-compact-r", "UTA Compact R", 114, VMC, "conjunto", "comercial", None, "uta", regras=["ventilacao"],
        posicoes={"114": 700}),
    sec("uta-compact-t", "UTA Compact T", 116, VMC, "conjunto", "comercial", None, "uta", regras=["ventilacao"],
        posicoes={"116": 700}),
    sec("uta-compact-l", "UTA Compact L", 118, VMC, "conjunto", "comercial", None, "uta", regras=["ventilacao"],
        posicoes={"118": 500}),
    # Grelhas de opcionais: preço por baixo da ref; direita/esquerda (…R / …L) empilhadas
    # partilham o preço por baixo da segunda.
    # Cada linha é uma opção vendida por tamanho de UTA (ARF01G4A … ARF07G4A): um grupo por
    # linha, com o tamanho tirado da ref.
    *[sec(f"uta-opcoes-{pg}", f"Opcionais {uta}", pg, ACESS, "acessorio", descricao="linha", regras=["ventilacao"],
          precoPorBaixo={"dy": 24}, ignorarRefs="^(ERA\\d|EKEXVA|EKEACB)", prefixoDescricao=uta,
          tamanhoDaRef=r"^A[RTL][A-Z](0[1-9]|1\d)") for pg, uta in (
        (115, "UTA Compact R"), (117, "UTA Compact T"), (119, "UTA Compact L"), (120, "UTA Modular R"),
        (121, "UTA Modular P"))],
    ignorar("uta-especificacoes", "UTA — especificações", [114, 116, 118], posicoes={"114": 0, "116": 0, "118": 0}),
    # --- Rooftops (p122-124) ---------------------------------------------------------------
    sec("rooftops", "Visão geral dos produtos RoofTop", [122, 123], AC, "conjunto", "industrial", "rooftop",
        "rooftop", leitor="rooftops", regras=["rooftops"]),
    # p124: só a coluna "Materiais | Preço"; a grelha à direita diz quantos de cada por série.
    sec("rooftops-acessorios", "Acessórios rooftops", 124, ACESS, "acessorio", descricao="esquerda",
        regiao={"x0": 30, "x1": 145}),
    # Coberturas de proteção: uma ref por série na grelha, com o preço por baixo.
    sec("rooftops-coberturas", "Cobertura de proteção contra a chuva", 124, ACESS, "acessorio",
        regiao={"x0": 250, "x1": 600}, posicoes={"124": 345}, precoPorBaixo={"dy": 9}, descricao="linha"),
    ignorar("rooftops-grelha", "Acessórios rooftops — quantidades por série", 124, regiao={"x0": 250, "x1": 600},
            posicoes={"124": 0}),
    ignorar("rooftops-grelha-2", "Acessórios rooftops — quantidades por série", 124,
            regiao={"x0": 250, "x1": 600}, posicoes={"124": 362}),
    # --- Chillers (p126-134) ---------------------------------------------------------------
    sec("mini-chiller", "Mini Chiller Inverter / Bomba de Calor Inverter", 126, CH, "conjunto", "comercial",
        None, "chiller", regras=["chillers"], colunas={"frio-kw": [285, 330], "calor-kw": [355, 400],
                                                       "alimentacao": [490, 560]}, descricao="esquerda"),
    sec("mini-chiller-grande", "EWAA-DV3P/DW1P e EWYA-DV3P/DW1P (011-016)", 127, CH, "conjunto", "comercial",
        None, "chiller", leitor="rooftops", regras=["chillers"]),
    sec("chiller-ewat-ewyt-czp", "EWAT-CZ / EWYT-CZ", 128, CH, "conjunto", "comercial", None, "chiller",
        regras=["chillers"], colunas=[["frio-kw", 280, 318, "EWAT"], ["seer", 365, 400, "EWAT"],
                                      ["frio-kw", 255, 290, "EWYT"], ["calor-kw", 315, 350, "EWYT"],
                                      ["scop", 372, 400, "EWYT"]], descricao="esquerda"),
    sec("chiller-ewye", "Bomba de Calor 70ºC Reversível", 130, CH, "conjunto", "comercial", None, "chiller",
        regras=["chillers"], colunas={"calor-kw": [255, 290], "frio-kw": [325, 360], "scop": [398, 430]}, descricao="esquerda"),
    sec("chiller-ewak-ewyk", "EWAK-CZ / EWYK-CZ", 131, CH, "conjunto", "comercial", None, "chiller",
        regras=["chillers"], colunas=[["frio-kw", 320, 360, "EWAK"], ["seer", 380, 405, "EWAK"],
                                      ["eer", 438, 470, "EWAK"], ["calor-kw", 300, 335, "EWYK"],
                                      ["scop", 336, 365, "EWYK"], ["cop", 366, 395, "EWYK"],
                                      ["frio-kw", 390, 425, "EWYK"], ["seer", 426, 455, "EWYK"],
                                      ["eer", 456, 480, "EWYK"]], descricao="esquerda"),
    sec("chiller-ewat-ewyt-b", "Chiller scroll EWAT-B / Multi-scroll EWYT-B", [132, 133], CH, "conjunto",
        "comercial", None, "chiller", leitor="rooftops", regras=["chillers"]),
    sec("chiller-ewwq", "Chiller água-água EWWQ-KCW1N", 134, CH, "conjunto", "comercial", None, "chiller",
        regras=["chillers"], precoPorBaixo={"dy": 35}, especificacoes="transpostas", descricao="esquerda"),
    # --- Ventiloconvectores (p136-144) ------------------------------------------------------
    # p142-143: as linhas das cassetes imprimem painel e placa (sem preço) e o preço do
    # conjunto (sem ref); painéis e placas lêem-se nas listas por baixo.
    *[sec(f"ventiloconvectores-{pg}-acessorios", "Comandos e acessórios", pg, ACESS, "acessorio",
          posicoes={str(pg): y}) for pg, y in ((142, 690), (143, 525))],
    *[sec(f"ventiloconvectores-{pg}", t, pg, FC, "conjunto", "comercial", None, None,
          regras=["ventiloconvectores", "fc-paineis"] if pg == 142 else ["ventiloconvectores"],
          especificacoes="fc", soEquipamento=pg in (142, 143), soComPreco=True,
          colunasPreco=[{"rx": "^BY", "x": [295, 330], "dy": 40}, {"rx": "^EKRP", "x": [380, 420], "dy": 40}]
          if pg == 142 else None) for pg, t in (
        (136, "Unidades de chão/teto com motor BLDC inverter"), (137, "Unidades de média pressão BLDC"),
        (138, "Unidades de média e alta pressão BLDC"), (139, "Unidades de chão/teto ON/OFF"),
        (140, "Unidades de média e alta pressão ON/OFF"), (141, "Comandos e acessórios"),
        (142, "Cassetes de protocolo fechado"), (143, "Cassetes de protocolo aberto"), (144, "Tipo mural"))],
    sec("r-cycle", "Daikin R-Cycle", 145, "outros", "conjunto", "comercial", regras=["outros-equipamentos"],
        precoPorBaixo={"dy": 15}),
    ignorar("combinacoes-condicoes", "Combinações possíveis, ícones, condições e contracapa", list(range(146, 159))),
]


def gerar(doc, ficheiro: str, marca: str, ano: int) -> dict:
    if doc is not None and len(doc) != 158:
        raise SystemExit(f"mapa Daikin 2026 escrito para 158 páginas; o PDF tem {len(doc)}")
    return {"ficheiro": ficheiro, "marca": marca, "ano": ano, "numPaginas": 158,
            "estrategia": "manual", "desfasamento": 1, "seccoes": [dict(s) for s in SECCOES]}

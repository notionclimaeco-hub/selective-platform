"""Midea 2026 (`MIDEA SGT.pdf`, 28 páginas, ticket #44): mapa de secções.

Hook `gerar(doc, ficheiro, marca, ano)` do `cadeia.py`: substitui o mapa
automático. A tabela não tem índice e o cabeçalho de cada página só diz a gama
larga ("Gama Doméstica", "M-Thermal"), por isso o mapa é escrito aqui secção a
secção, com o título impresso por cima de cada tabela.

Campos além do mapa automático (lidos por `extrair.py` / `agrupar.py`):
- `posicoes: {"<página>": y}` quando o título se repete na página ou não é
  uma linha só (p8 tem duas "Conduta").
- `regiao: {x0, x1}` nas páginas de acessórios em duas colunas (p14, p20).
- `atributos`: specs impressas como ícone (refrigerante, nº de tubos).
- `rotulo: ""` quando a gama já diz o tipo de unidade ("Cassete Compacta").
- `porRef`: produtos diferentes na mesma tabela (UE + depósito, UE + módulo).
"""
AC, BC, AQS, FC = "ar-condicionado", "bombas-de-calor", "aqs", "ventiloconvectores"
ACESS = "acessorios-e-controlo"
R32, R290, R410A = {"refrigerante": "R32"}, {"refrigerante": "R290"}, {"refrigerante": "R410A"}


def sec(id_, titulo, paginas, familia, componente, segmento=None, sistema=None, tipoUnidade=None,
        gama=None, **extra):
    paginas = paginas if isinstance(paginas, list) else [paginas]
    return {"id": id_, "titulo": titulo, "paginas": paginas, "tipo": extra.pop("tipo", "tabela"),
            "familia": familia, "segmento": segmento, "sistema": sistema, "tipoUnidade": tipoUnidade,
            "componente": componente, "gama": gama or titulo, "semPreco": extra.pop("semPreco", False),
            "avisos": [], **extra}


def ignorar(id_, titulo, paginas, **extra):
    paginas = paginas if isinstance(paginas, list) else [paginas]
    return {"id": id_, "titulo": titulo, "paginas": paginas, "tipo": "ignorar", "avisos": [], **extra}


def mono(id_, titulo, pagina, tipo, gama=None, segmento="domestico", **extra):
    return sec(id_, titulo, pagina, AC, "conjunto", segmento, "mono-split", tipo, gama, rotulo="",
               atributos=R32, **extra)


def twin(id_, titulo, pagina, tipo, gama, **extra):
    # Twin/Triplo/Quádruplo: 1 UE + N UI iguais a trabalhar juntas; vende-se o
    # conjunto (ref "2X-UI+UE"). Não é multi-split (as UI não são independentes).
    return sec(id_, titulo, pagina, AC, "conjunto", "comercial", "mono-split", tipo, gama, rotulo="",
               atributos=R32, **extra)


def multi_ui(id_, titulo, pagina, tipo, gama, segmento="domestico", **extra):
    return sec(id_, titulo, pagina, AC, "unidade-interior", segmento, "multi-split", tipo,
               f"{gama} Multi-Split", rotulo="", atributos=R32, **extra)


def fc(id_, titulo, pagina, tipo, gama, tubos=None, **extra):
    attrs = {"tubos": tubos} if tubos else {}
    return sec(id_, titulo, pagina, FC, "conjunto", "comercial", None, tipo, f"Ventiloconvector {gama}",
               rotulo="", atributos=attrs, **extra)


def vrf_ue(id_, titulo, pagina, gama, attrs, **extra):
    return sec(id_, titulo, pagina, AC, "unidade-exterior", "comercial", "vrf", "exterior", gama,
               semPreco=True, atributos=attrs, **extra)


def vrf_ui(id_, titulo, pagina, tipo, gama, **extra):
    return sec(id_, titulo, pagina, AC, "unidade-interior", "comercial", "vrf", tipo, gama,
               semPreco=True, rotulo="", **extra)


SECCOES = [
    ignorar("capa", "Capa", 1),
    # p2-3 Gama Doméstica
    sec("porta-split", "Porta-Split", 2, AC, "conjunto", "domestico", "mono-split", "portatil", "Porta-Split"),
    # H-Pack: bomba de calor monobloco de instalação interior (ar-água), só aquecimento impresso.
    sec("h-pack", "H-Pack", 2, BC, "conjunto", "domestico", "monobloco", None, "H-Pack"),
    mono("mural-breezeless-s", "Mural Breezeless S", 2, "mural"),
    mono("mural-penroseair-xt", "Mural Penroseair (XT)", 2, "mural"),
    mono("mural-solstice-ez", "Mural Solstice (EZ)", 3, "mural"),
    mono("mural-breezeless-e-cb1", "Mural Breezeless E (CB1)", 3, "mural"),
    # p3-6 Gama Comercial, mono-split
    mono("consola-de-chao", "Consola de Chão", 3, "consola", segmento="comercial"),
    mono("teto-chao", "Teto/Chão", 4, "chao-teto", segmento="comercial"),
    # "Cassete 1 Via" também é o título do destaque a meio da p4 (y 393).
    mono("cassete-1-via", "Cassete 1 Via", 4, "cassete-1-via", segmento="comercial", posicoes={"4": 612}),
    mono("cassete-compacta", "Cassete Compacta", 5, "mini-cassete", segmento="comercial"),
    mono("cassete-4-vias-super-slim", "Cassete 4 Vias Super Slim", 5, "cassete-4-vias", segmento="comercial"),
    mono("conduta", "Conduta", 5, "conduta", segmento="comercial"),
    sec("conduta-tipo-split", "Conduta Tipo Split", 6, AC, "conjunto", "comercial", "mono-split", "conduta",
        "Conduta Tipo Split", rotulo="", atributos=R410A),
    mono("armario-vertical", "Armário Vertical", 6, "coluna", segmento="comercial"),
    # p6-8 Sistemas Twin (conjuntos 2x/3x/4x UI + 1x UE)
    twin("twin-duplo-cassete", "Cassete Compacta/Cassete 4 Vias Super Slim", 6, "cassete-4-vias",
         "Cassete Twin Duplo", posicoes={"6": 645}),
    twin("twin-duplo-conduta", "Conduta", 7, "conduta", "Conduta Twin Duplo"),
    twin("twin-duplo-teto-chao", "Teto/Chão", 7, "chao-teto", "Teto/Chão Twin Duplo"),
    twin("twin-triplo-cassete", "Cassete Compacta", 7, "mini-cassete", "Cassete Compacta Twin Triplo"),
    twin("twin-triplo-conduta", "Conduta", 8, "conduta", "Conduta Twin Triplo", posicoes={"8": 162}),
    twin("twin-quadruplo-cassete", "Cassete Compacta", 8, "mini-cassete", "Cassete Compacta Twin Quádruplo"),
    twin("twin-quadruplo-conduta", "Conduta", 8, "conduta", "Conduta Twin Quádruplo", posicoes={"8": 658}),
    # p9 Multi-Split CirQHP: UE multi + depósito AQS, cada um com o seu PVP.
    sec("cirqhp", "Climatização e Produção de AQS com Recuperação de Calor", 9, AC, "unidade-exterior",
        "domestico", "multi-split", "exterior", "CirQHP", rotulo="Multi-Split", atributos=R32,
        posicoes={"9": 110}, componenteFixo=True,
        porRef=[{"prefixo": "PLSX", "familia": AQS, "componente": "deposito", "sistema": None,
                 "tipoUnidade": "deposito", "rotulo": "", "atributos": {}}]),
    # Combinações de capacidades (não são refs): lidas pelo pós-processamento da marca.
    ignorar("combinacoes-cirqhp", "Combinações Possíveis CirQHP Multi-Split", 9, posicoes={"9": 467}),
    # p10-13 Multi-Split. A tabela das UE está impressa como "UNIDADES INTERIORES".
    sec("multi-split-ue", "UNIDADES INTERIORES", 10, AC, "unidade-exterior", "domestico", "multi-split",
        "exterior", "Multi-Split", atributos=R32, posicoes={"10": 171}),
    multi_ui("multi-ui-breezeless-s", "Mural Breezeless S", 10, "mural", "Mural Breezeless S"),
    multi_ui("multi-ui-penroseair-xt", "Mural Penroseair (XT)", 10, "mural", "Mural Penroseair (XT)"),
    multi_ui("multi-ui-solstice-ez", "Mural Solstice (EZ)", 11, "mural", "Mural Solstice (EZ)"),
    multi_ui("multi-ui-breezeless-e-cb1", "Mural Breezeless E (CB1)", 11, "mural", "Mural Breezeless E (CB1)"),
    multi_ui("multi-ui-consola", "Consola de Chão", 11, "consola", "Consola de Chão", segmento="comercial"),
    multi_ui("multi-ui-teto-chao", "Teto/Chão", 11, "chao-teto", "Teto/Chão", segmento="comercial"),
    multi_ui("multi-ui-cassete-1-via", "Cassete 1 Via", 12, "cassete-1-via", "Cassete 1 Via", segmento="comercial"),
    multi_ui("multi-ui-cassete", "Cassete Compacta & Cassete 4 Vias", 12, "cassete-4-vias",
             "Cassete Compacta e 4 Vias", segmento="comercial"),
    multi_ui("multi-ui-conduta", "Conduta", 12, "conduta", "Conduta", segmento="comercial"),
    ignorar("combinacoes-multi-split", "Combinações Possiveis Multi-Split", [12, 13], posicoes={"12": 641}),
    # p14 Comandos e Acessórios, em duas colunas de caixas "legenda / Modelo | PVP".
    sec("acessorios-esquerda", "Comandos e Acessórios", 14, ACESS, "acessorio", gama=None,
        posicoes={"14": 110}, regiao={"x1": 297}),
    sec("acessorios-direita", "Comandos e Acessórios", 14, ACESS, "acessorio", gama=None,
        posicoes={"14": 110}, regiao={"x0": 297}),
    # p15 Bombas de calor AQS, piscina e AQS split
    sec("aqs-combo", "Bombas de Calor Combo", 15, AQS, "conjunto", "domestico", None, "monobloco-aqs",
        "Combo", atributos=R290),
    sec("aqs-ligacao-solar", "Bombas de Calor AQS com Ligação Solar", 15, AQS, "conjunto", "domestico", None,
        "monobloco-aqs", "Ligação Solar", atributos=R290),
    sec("piscina", "Bombas de Calor para Piscina", 15, BC, "conjunto", "domestico", "monobloco", "exterior",
        "Bomba de Calor para Piscina", rotulo="", atributos=R32, posicoes={"15": 410}),
    sec("aqs-split-r454c", "Bombas de Calor Tipo Split R454c", 15, AQS, "deposito", "domestico", "bibloco",
        "deposito", "Split R454C", rotulo="Bomba de Calor AQS", atributos={"refrigerante": "R454C"},
        porRef=[{"prefixo": "MHW-", "componente": "unidade-exterior", "tipoUnidade": "split-aqs"}]),
    # p16-17 M-Thermal (aerotermia), modelos em coluna
    sec("m-thermal-arctic", "M-Thermal Série Arctic Monobloco", 16, BC, "conjunto", "domestico", "monobloco",
        "exterior", "M-Thermal Arctic", rotulo="Bomba de Calor Monobloco", atributos=R290),
    sec("m-thermal-mars", "M-Thermal Série Mars", 16, BC, "conjunto", "comercial", "monobloco", "exterior",
        "M-Thermal Mars", rotulo="Bomba de Calor Monobloco", atributos=R290),
    sec("m-thermal-mars-large", "M-Thermal Série Mars Large", 16, BC, "conjunto", "comercial", "monobloco",
        "exterior", "M-Thermal Mars Large", rotulo="Bomba de Calor Monobloco", atributos=R290),
    sec("m-thermal-power", "M-Thermal Power Monobloco", 17, BC, "conjunto", "domestico", "monobloco",
        "exterior", "M-Thermal Power", rotulo="Bomba de Calor Monobloco", atributos=R32),
    # HYGGE tipo split: a mesma UE nas duas tabelas; o módulo muda (HB = módulo
    # hidráulico, HBT = módulo com depósito integrado) e não herda os kW da UE.
    sec("m-thermal-hygge", "M-Thermal Série HYGGE Tipo Split", 17, BC, "unidade-exterior", "domestico",
        "bibloco", "exterior", "M-Thermal HYGGE", atributos=R32, posicoes={"17": 395},
        porRef=[{"prefixo": "HB-", "componente": "unidade-interior", "tipoUnidade": "modulo-hidraulico",
                 "rotulo": "Módulo Hidráulico", "herdarKw": False}]),
    sec("m-thermal-hygge-deposito", "M-Thermal Série HYGGE Tipo Split", 17, BC, "unidade-exterior",
        "domestico", "bibloco", "exterior", "M-Thermal HYGGE", atributos=R32, posicoes={"17": 627},
        porRef=[{"prefixo": "HBT-", "componente": "unidade-interior", "tipoUnidade": "integrada",
                 "gama": "M-Thermal HYGGE com Depósito", "rotulo": "Módulo Hidráulico", "herdarKw": False}]),
    # p18-20 Ventiloconvectores (valores alta/média/baixa velocidade: fica a alta)
    fc("fc-cassete-1-via", "Cassete 1 Via", 18, "cassete", "Cassete 1 Via"),
    fc("fc-cassete-compacta-2-tubos", "Cassete Compacta DC 2 Tubos", 18, "cassete", "Cassete Compacta DC 2 Tubos", "2"),
    fc("fc-cassete-compacta-4-tubos", "Cassete Compacta DC 4 Tubos", 18, "cassete", "Cassete Compacta DC 4 Tubos", "4"),
    fc("fc-cassete-4-vias-2-tubos", "Cassete 4 Vias DC 2 Tubos", 18, "cassete", "Cassete 4 Vias DC 2 Tubos", "2"),
    fc("fc-cassete-4-vias-4-tubos", "Cassete 4 Vias DC 4 Tubos", 19, "cassete", "Cassete 4 Vias DC 4 Tubos", "4"),
    fc("fc-mural", "Mural", 19, "mural", "Mural"),
    # Duas linhas de modelos (MKH2 / MKH3) com "PVP H2" / "PVP H3": dois produtos.
    fc("fc-teto-chao-2-tubos", "Teto / Chão DC 2 Tubos", 19, "chao-teto", "Chão-Teto DC 2 Tubos H2", "2",
       porRef=[{"prefixo": "MKH3", "gama": "Ventiloconvector Chão-Teto DC 2 Tubos H3"}]),
    fc("fc-teto-chao-4-tubos", "Teto / Chão DC 4 Tubos", 20, "chao-teto", "Chão-Teto DC 4 Tubos", "4"),
    fc("fc-conduta-2-tubos", "Conduta DC 2 Tubos", 20, "conduta", "Conduta DC 2 Tubos", "2"),
    fc("fc-conduta-4-tubos", "Conduta DC 4 Tubos", 20, "conduta", "Conduta DC 4 Tubos", "4"),
    # Coluna da direita (kits de válvulas, sem ref impressa): pós-processamento da marca.
    sec("acessorios-ventiloconvectores", "Comandos e Acessórios", 20, ACESS, "acessorio", gama=None,
        posicoes={"20": 617}, regiao={"x1": 297}),
    # p21 Chillers
    sec("chiller-aqua-thermal-super", "Chiller Aqua Thermal Super", 21, "chillers", "conjunto", "comercial",
        None, "chiller", "Chiller Aqua Thermal Super", rotulo="", atributos=R32),
    sec("chiller-aqua-thermal-max", "CHILLER SÉRIA AQUA THERMAL MAX", 21, "chillers", "conjunto", "comercial",
        None, "chiller", "Chiller Aqua Thermal Max", rotulo="", atributos=R32, semPreco=True),
    sec("chiller-magboost-apex-pro", "CHILLER MAGBOOST APEX PRO", 21, "chillers", "conjunto", "comercial",
        None, "chiller", "Chiller MagBoost Apex Pro", rotulo="", atributos={"refrigerante": "R1234ZE"},
        semPreco=True),
    # p22 Recuperadores de calor (título só na faixa do topo) + comando
    sec("recuperadores-hrv", "Recuperadores de Calor", 22, "ventilacao", "conjunto", "comercial", None,
        "recuperador-de-calor", "HRV", posicoes={"22": 110}),
    sec("comandos-hrv", "Comandos", 22, ACESS, "acessorio", gama=None),
    # p22-25 Gama VRF, toda "preço sob consulta"
    vrf_ue("vrf-atom-t", "Mini VRF Atom T", 22, "Mini VRF Atom T", R32),
    vrf_ue("vrf-v8m", "Mini V8M", 22, "Mini VRF V8M", R32),
    vrf_ue("vrf-easyfit", "Mini VRF Série Easyfit", 23, "Mini VRF Easyfit", R410A),
    vrf_ue("vrf-v8s", "VRF V8S", 23, "VRF V8S", R410A),
    vrf_ue("vrf-v8", "VRF V8 (2-Tubos)", 23, "VRF V8", R410A),
    vrf_ue("vrf-v6r", "VRF V6R com Recuperação de Calor (3-Tubos)", 23, "VRF V6R Recuperação de Calor", R410A),
    vrf_ui("vrf-modulo-hidronico", "Módulo Hidrónico", 23, "modulo-hidraulico", "VRF Módulo Hidrónico",
           atributos=R410A),
    sec("vrf-kit-uta", "KIT UTA", 23, ACESS, "acessorio", "comercial", "vrf", None, "Kit UTA", semPreco=True),
    vrf_ui("vrf-ui-mural", "Mural", 24, "mural", "VRF Mural"),
    vrf_ui("vrf-ui-chao-com-envolvente", "Chão com Envolvente", 24, "consola", "VRF Chão com Envolvente"),
    vrf_ui("vrf-ui-chao-sem-envolvente", "Chão sem Envolvente", 24, "chao-sem-envolvente", "VRF Chão sem Envolvente"),
    vrf_ui("vrf-ui-teto-chao", "Teto/Chão", 24, "chao-teto", "VRF Teto/Chão"),
    vrf_ui("vrf-ui-cassete-1-via", "Cassete 1 Via", 24, "cassete-1-via", "VRF Cassete 1 Via"),
    vrf_ui("vrf-ui-cassete-2-vias", "Cassete 2 Vias", 24, "cassete-2-vias", "VRF Cassete 2 Vias"),
    vrf_ui("vrf-ui-cassete-compacta", "Cassete Compacta", 25, "mini-cassete", "VRF Cassete Compacta"),
    vrf_ui("vrf-ui-cassete-4-vias", "Cassete 4 Vias", 25, "cassete-4-vias", "VRF Cassete 4 Vias"),
    vrf_ui("vrf-ui-conduta-media", "Conduta Média Pressão Estática", 25, "conduta-media-pressao",
           "VRF Conduta Média Pressão"),
    vrf_ui("vrf-ui-conduta-alta", "Conduta Alta Pressão Estática", 25, "conduta-alta-pressao",
           "VRF Conduta Alta Pressão"),
    # Unidade de ar novo com kW (não caudal): UI VRF tipo uta, como a Hisense AVA-*.
    vrf_ui("vrf-ui-ar-novo", "Unidade de Tratamento de Ar Novo", 25, "uta", "VRF Unidade de Tratamento de Ar Novo"),
    ignorar("condicoes-gerais", "Condições Gerais de Venda", [26, 27, 28]),
]



def gerar(doc, ficheiro: str, marca: str, ano: int) -> dict:
    if doc is not None and len(doc) != 28:
        raise SystemExit(f"mapa Midea 2026 escrito para 28 páginas; o PDF tem {len(doc)}")
    return {"ficheiro": ficheiro, "marca": marca, "ano": ano, "numPaginas": 28,
            "estrategia": "manual", "desfasamento": 0, "seccoes": [dict(s) for s in SECCOES]}

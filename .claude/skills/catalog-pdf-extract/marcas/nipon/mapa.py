"""Nipon 2025 (`NIPON_2025_.pdf`, 60 páginas, ticket #45): mapa de secções.

Hook `gerar(doc, ficheiro, marca, ano)` do `cadeia.py`: substitui o mapa
automático. O índice (p2) imprime os números de página numa coluna à parte e
fora de ordem, por isso o mapa é escrito aqui tabela a tabela, com o título
impresso por cima de cada uma. As tabelas são lidas por `marcas/nipon/extrair.py`.

Campos além do mapa automático:
- `posicoes: {"<página>": y}` quando o título não se encontra sozinho (p34,
  p36-37, p52) ou a secção começa no topo de uma página partilhada.
- `regiao: {x0, x1}` na p46 (ficha H-Power à esquerda, acessórios à direita)
  e nas p41-42 (ícones e texto à esquerda das fichas Innovus e Flexus).
- `atributos`: specs impressas como ícone ou texto fora da tabela (R32, Wi-Fi,
  pressão da conduta, 2 tubos).
- `rotulo`: tipo de unidade legível quando a gama não o diz ("Armário").
- `porRef`: tipo de unidade por versão da Venice (vertical/horizontal).
- `cores`: palavra da linha "Código - …" → cor do registo, quando difere da
  leitura por omissão (Branca/Cinza/Preta).
- `sufixo`: contexto acrescentado à descrição dos acessórios de uma gama
  ("p/ EvaSlim 75") quando a linha não o diz.
"""
AC, BC, AQS, VMC, FC = "ar-condicionado", "bombas-de-calor", "aqs", "ventilacao", "ventiloconvectores"
ACESS = "acessorios-e-controlo"


def attrs(refrigerante=None, wifi=None, **extra):
    d = {}
    if refrigerante:
        d["refrigerante"] = refrigerante
    if wifi:
        d["wifi"] = wifi
    return {**d, **extra}


def sec(id_, titulo, paginas, familia, componente, segmento=None, sistema=None, tipoUnidade=None,
        gama=None, **extra):
    paginas = paginas if isinstance(paginas, list) else [paginas]
    return {"id": id_, "titulo": titulo, "paginas": paginas, "tipo": extra.pop("tipo", "tabela"),
            "familia": familia, "segmento": segmento, "sistema": sistema, "tipoUnidade": tipoUnidade,
            "componente": componente, "gama": gama or titulo, "semPreco": False, "avisos": [], **extra}


def ignorar(id_, titulo, paginas, **extra):
    paginas = paginas if isinstance(paginas, list) else [paginas]
    return {"id": id_, "titulo": titulo, "paginas": paginas, "tipo": "ignorar", "avisos": [], **extra}


def mono(id_, titulo, pagina, tipo, gama, wifi=None, segmento="domestico", **extra):
    extra_attrs = extra.pop("atributos", {})
    return sec(id_, titulo, pagina, AC, "conjunto", segmento, "mono-split", tipo, gama,
               atributos={**attrs("R32", wifi), **extra_attrs}, **extra)


def multi_ui(id_, titulo, pagina, tipo, gama, wifi=None, **extra):
    extra_attrs = extra.pop("atributos", {})
    return sec(id_, titulo, pagina, AC, "unidade-interior", "domestico", "multi-split", tipo,
               f"{gama} Multi-Split", atributos={**attrs("R32", wifi), **extra_attrs}, **extra)


def acess(id_, titulo, paginas, sufixo=None, componente="acessorio", **extra):
    return sec(id_, titulo, paginas, ACESS, componente, sufixo=sufixo, **extra)


SECCOES = [
    ignorar("capa", "Capa", 1),
    ignorar("indice", "Índice", 2),
    ignorar("apresentacao", "O que nos distingue … line-up", list(range(3, 15))),
    # p15-17 Gama Doméstica, mono-split (conjunto UI+UE; cor pela linha "Código Conjunto - …").
    mono("primis-duo", "Modelo Mural PRIMIS", 15, "mural", "Primis Duo", wifi="sim"),
    mono("vita", "Modelo Mural VITA", 16, "mural", "Vita", wifi="sim"),
    mono("topsmart", "Modelo Consola TOP SMART", 17, "consola", "TopSmart", wifi="sim"),
    # p18-20 Multi-split: UE, UE AC+AQS e o depósito que as AC+AQS aceitam.
    sec("multi-ue", "Modelo Unidade Exterior Multi-Split", 18, AC, "unidade-exterior", "domestico",
        "multi-split", "exterior", "Multi-Split", atributos=attrs("R32")),
    sec("multi-ue-aqs", "Modelo Unidade Exterior Multi-Split", 19, AC, "unidade-exterior", "domestico",
        "multi-split", "exterior", "Multi-Split AC+AQS", atributos=attrs("R32")),
    sec("deposito-aqs", "Depósito 200L", 20, AQS, "deposito", "domestico", None, "deposito",
        "Multi-Split AC+AQS", rotulo="", atributos=attrs("R32")),
    # p21-24 Multi-split, unidades interiores (duas tabelas por página).
    # p21 chama "Preta" à Primis Duo escura; o texto da mesma página e a p15 dizem
    # cinza antracite: a cor fica igual à do conjunto.
    multi_ui("multi-ui-primis-duo", "PRIMIS DUO", 21, "mural", "Primis Duo", wifi="sim",
             cores={"preta": "cinzento"}),
    multi_ui("multi-ui-vita", "VITA", 21, "mural", "Vita", wifi="sim"),
    multi_ui("multi-ui-cassete-8-vias", "CASSETE 8 VIAS", 22, "cassete-8-vias", "Cassete 8 Vias",
             wifi="opcional", rotulo=""),
    multi_ui("multi-ui-cassete-1-via", "CASSETE 1 VIA", 22, "cassete-1-via", "Cassete 1 Via",
             wifi="opcional", rotulo=""),
    multi_ui("multi-ui-topsmart", "TOPSMART", 23, "consola", "TopSmart", wifi="sim"),
    multi_ui("multi-ui-chao-teto", "CONSOLA CHÃO-TETO", 23, "chao-teto", "Chão-Teto", wifi="opcional"),
    multi_ui("multi-ui-conduta-baixa", "CONDUTA BAIXA PRESSÃO ESTÁTICA", 24, "conduta-baixa-pressao",
             "Conduta Baixa Pressão", atributos={"pressao-estatica": "baixa"}),
    multi_ui("multi-ui-conduta-alta", "CONDUTA ALTA PRESSÃO ESTÁTICA", 24, "conduta-alta-pressao",
             "Conduta Alta Pressão", wifi="sim", atributos={"pressao-estatica": "alta"}),
    # p25-26 Tabelas de combinações: lidas por marcas/nipon/pos.py (compativelCom das UE).
    ignorar("combinacoes-multi-split", "TABELA DE COMBINAÇÕES MULTI-SPLIT", [25, 26]),
    ignorar("gama-comercial", "Gama Comercial", 27),
    # p28-31 Gama Comercial, mono-split: a linha "Código conjunto" é o que se vende;
    # UE, UI e grelha têm código mas não preço (ficam na descrição).
    mono("cassete-xb", "MONO-SPLIT CASSETE", 28, "cassete-8-vias", "Cassete 8 Vias XB", wifi="opcional",
         segmento="comercial", rotulo=""),
    mono("consola-xc", "MONO-SPLIT CONSOLA CHÃO-TETO", 29, "chao-teto", "Chão-Teto XC", wifi="opcional",
         segmento="comercial"),
    mono("conduta-xd", "MONO-SPLIT CONDUTA", 30, "conduta-media-pressao", "Conduta XD", segmento="comercial",
         atributos={"pressao-estatica": "media"}),
    mono("armario-magnum", "MONO-SPLIT ARMÁRIO MAGNUM", 31, "armario", "Magnum", wifi="sim",
         segmento="comercial", rotulo="Armário"),
    ignorar("combinacoes-syncro", "COMBINAÇÕES SYNCRO", 32),
    # p33-34 Acessórios da gama AC.
    acess("comandos-remotos", "COMANDOS REMOTOS", 33, posicoes={"33": 120}),
    acess("comandos-com-fios", "COMANDOS COM FIOS", 33, componente="comando", posicoes={"33": 441}),
    acess("controlo-de-porta", "MÓDULO CONTROLO DE PORTA", 34, posicoes={"34": 141}),
    acess("derivacoes-syncro", "ACESSÓRIOS PARA COMBINAÇÕES SYNCRO", 34, sufixo="(Syncro)",
          posicoes={"34": 486}),
    acess("acessorio-deposito", "ACESSÓRIO PARA DEPÓSITO S200L GA", 34, sufixo="(depósito S200L GA)",
          posicoes={"34": 700}),
    ignorar("vmc", "VMC", 35),
    # p36-37 VMC: ficha + lista de acessórios por baixo.
    sec("evaslim-75", "EVASLIM75", 36, VMC, "conjunto", "domestico", None, "vmc", "EvaSlim 75",
        posicoes={"36": 0}),
    acess("acessorios-evaslim-75", "Acessórios EVASLIM 75", 36, sufixo="p/ EvaSlim 75"),
    sec("evabox-95", "EVABOX95", 37, VMC, "conjunto", "domestico", None, "vmc", "EvaBox 95",
        posicoes={"37": 0}),
    acess("acessorios-evabox-95", "Acessórios EVABOX95", 37, sufixo="p/ EvaBox 95"),
    ignorar("bombas-de-calor", "Bombas de calor (apresentação)", [38, 39, 40]),
    # p41-48 Bombas de calor.
    # p41: a coluna de ícones à esquerda imprime-se nas mesmas linhas da ficha.
    sec("innovus", "BOMBA DE CALOR AQS", 41, AQS, "conjunto", "domestico", "monobloco", "monobloco-aqs",
        "Innovus", atributos=attrs("R290"), regiao={"x0": 215}),
    # p42: o texto "Diferentes tipos de instalação" à esquerda imprime-se nas linhas da ficha.
    sec("flexus", "BOMBA DE CALOR AQS", 42, AQS, "conjunto", "domestico", "monobloco", "monobloco-aqs",
        "Flexus", atributos=attrs("R290"), regiao={"x0": 172}),
    sec("spirit-m", "MONOBLOCOSPIRIT", 43, BC, "conjunto", "domestico", "monobloco", "exterior", "Spirit M",
        rotulo="Bomba de Calor Monobloco", atributos=attrs("R32", "sim")),
    sec("spirit-s", "BOMBA DE CALOR SPLIT SPIRIT S", 44, BC, "conjunto", "domestico", "bibloco",
        "modulo-hidraulico", "Spirit S", rotulo="Bomba de Calor Bibloco", atributos=attrs("R32", "sim")),
    sec("spirit-sa", "BOMBA DE CALOR SPLIT SPIRIT SA", 45, BC, "conjunto", "domestico", "bibloco",
        "integrada", "Spirit SA", rotulo="Bomba de Calor Bibloco", atributos=attrs("R32", "sim")),
    sec("h-power", "H-POWER", 46, BC, "conjunto", "comercial", "monobloco", "exterior", "H-Power",
        rotulo="Bomba de Calor", atributos=attrs("R32"), posicoes={"46": 0}, regiao={"x1": 375}),
    acess("acessorios-h-power", "ACESSÓRIOS H-POWER", 46, sufixo="p/ H-Power", regiao={"x0": 375}),
    ignorar("piscina", "Bomba de calor de piscina (apresentação)", 47),
    sec("serenus", "Bomba de Calor de Piscina", 48, BC, "conjunto", "domestico", "monobloco", "exterior",
        "Serenus", rotulo="Bomba de Calor Piscina", atributos=attrs("R32", "sim"), posicoes={"48": 0}),
    acess("cobertura-serenus", "COBERTURA PROTETORA", 48),
    ignorar("ventiloconvectores", "Ventiloconvectores (apresentação)", [49, 50]),
    # p51-56 Ventiloconvectores.
    sec("supra-reverse", "Modelo Supra Reverse", 51, FC, "conjunto", "comercial", None, "consola",
        "Supra Reverse", rotulo="Ventiloconvector", atributos={"tubos": "2"}),
    sec("supra-slim", "Modelo Supra Slim", 52, FC, "conjunto", "comercial", None, "consola", "Supra Slim",
        rotulo="Ventiloconvector", atributos={"tubos": "2"}, posicoes={"52": 0}),
    acess("acessorios-supra", "Acessórios", 52, sufixo="p/ Supra", posicoes={"52": 700}),
    sec("milan", "Unidade Mural MILAN", 53, FC, "conjunto", "comercial", None, "mural", "Milan",
        rotulo="Ventiloconvector Mural", posicoes={"53": 0}),
    sec("hawaii", "Unidade Cassete HAWAII", 53, FC, "conjunto", "comercial", None, "cassete", "Hawaii",
        rotulo="Ventiloconvector Cassete"),
    acess("acessorios-hawaii", "Acessórios Ventiloconvetores HAWAII", 53, sufixo="p/ Hawaii"),
    # Venice: specs por tamanho na p54, códigos e preços por versão (V, VF, VN, H, HF, HN) na p55.
    sec("venice", "VENTILOCONVETOR VENICE COM E SEM MÓVEL", 55, FC, "conjunto", "comercial", None,
        "consola", "Venice", rotulo="Ventiloconvector", atributos={"tubos": "2"}, posicoes={"55": 0},
        porRef=[{"prefixo": p, "tipoUnidade": "chao-teto"} for p in ("NI20325", "NI20340", "NI20345")]),
    ignorar("venice-specs", "VENTILOCONVETOR DO TIPO CONSOLA - VENICE", 54),
    acess("acessorios-venice", "ACESSÓRIOS VENICE E UNIDADE TERMINAL", 56, sufixo="p/ Venice",
          posicoes={"56": 0}),
    ignorar("fim", "Garantia e contracapa", [57, 58, 59, 60]),
]


def gerar(doc, ficheiro: str, marca: str, ano: int) -> dict:
    if doc is not None and len(doc) != 60:
        raise SystemExit(f"mapa Nipon 2025 escrito para 60 páginas; o PDF tem {len(doc)}")
    return {"ficheiro": ficheiro, "marca": marca, "ano": ano, "numPaginas": 60,
            "estrategia": "manual", "desfasamento": 0, "seccoes": [dict(s) for s in SECCOES]}

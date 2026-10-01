"""Daikin 2026 (`DAIKIN Tabela de Preços 2026.pdf`, ticket #47): leitura das tabelas.

Hook `extrair_pagina(page, seccoes, numero)` do `extrair.py --marca daikin`:
substitui o leitor genérico em todas as páginas. Cada secção do mapa diz o
`leitor` da sua região (default `pares`):

- **pares**: âncoras = refs; cada ref leva o preço mais próximo à sua direita
  na mesma coluna (o preço impresso entre duas refs empilhadas — "SB.FTXJ20AS"
  e "SB.FTXJ20AB" — vale para as duas). Refs que a tabela `SERIES` conhece
  (conjuntos `SB.`, UE, UI) são produtos e leem as specs da linha; as outras
  são listas "Ref | Descrição | Preço" (acessórios, comandos), com a descrição
  à direita da ref.
"""
from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))      # series.py (depois de scripts/: `extrair` é o do toolkit)

from mapa import palavras_da_pagina  # noqa: E402
from series import alimentacao_da_ref, classificar, expandir_ref  # noqa: E402

PRECO_RX = re.compile(r"^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{2}))?€$")
REF_RX = re.compile(r"^(?:SB\.)?[0-9]?[A-Z][A-Z0-9\-_.]*[0-9][A-Z0-9\-_./+]*\*?$")
NUMERICA_RX = re.compile(r"^\d{5,10}(?:-[A-Z]{2,4})?$")       # Rotex/Duco: 162058, 164703-RTX, 00004939
NAO_REF_RX = re.compile(r"^(R-?\d|EN\d|ISO|IP\d|PM\d|CO2|H\d\d$|DIII|ePM|[A-Z]\d$|\d+[xX])")
MARCA_NOTA_RX = re.compile(r"^(\(\d+\))+\*?$|^\*+$|^\(\*+\)$")
PAR_RX = re.compile(r"^(\d+(?:,\d+)?)/(\d+(?:,\d+)?)$")
CLASSE_PAR_RX = re.compile(r"^(A\+{0,3}|[B-G]|-|–)/(A\+{0,3}|[B-G]|-|–)$")
CLASSE_RX = re.compile(r"^(A\+{0,3}|[B-G])$")
NOTA_COLADA_RX = re.compile(r"^([A-Z0-9][A-Za-z0-9\-_./]{3,}?)(?:\(\d+\))+\*?$")
CABECALHO_RX = re.compile(r"(?i)^(descri[çc][ãa]o|pre[çc]o|refer[êe]ncia)$")   # palavras que marcam um cabeçalho
SEM_DIGITOS_RX = re.compile(r"^[A-Z]{2,5}-[A-Z]{2,5}$")                       # RTD-RA, RTD-NET
NAO_REFS = {"DIII-NET", "R-32", "R-410A", "WI-FI", "UV-C"}
SERIE_FC_RX = re.compile(r"^FW[A-Z]-[A-Z]{2}$")                              # "Liga com FWQ-AT" (p136-141)
# Refs sem dígitos (Rotex, Duco, acessórios de ventiloconvectores e rooftops): EKEACB,
# ECLIPRAILA, KDECOUP, DRGATEWAYAA, FWCKLX, FCBAG, UATYACAP, PT.DOS_CONNECT, SHINKATOUCHBA/WA.
SEM_DIGITOS_LONGA_RX = re.compile(r"^(E[A-Z]{4,}|EK[A-Z]{2,}|K[A-Z]{5,}|DR[A-Z]{5,}|DOT[A-Z]{5,}|FW[A-Z]{4}|FCBAG|"
                                  r"UATYA[A-Z]{2,}|PT\.[A-Z_]+|SHINKATOUCH[A-Z/]*|FWEDA)$")
PALAVRAS = {"ESQUEMA", "ESQUERDA", "ESTRUTURA", "EXTERIOR", "EXTERIORES", "EXCLUSIVO", "EXEMPLO",
            "ESPECIALIZADO", "ENCOMENDA", "ENTREGA", "EUROVENT", "EKHHE", "EKHLE", "EKHWP", "EKEXVA",
            "EKVDX", "EKRUDAL"}


# --- Palavras ---------------------------------------------------------------------

def _palavras(page, y_ini: float, y_fim: float, seccao: dict) -> list[list]:
    r = seccao.get("regiao") or {}
    out = []
    for x0, y0, x1, y1, t in palavras_da_pagina(page):
        yc = (y0 + y1) / 2
        if not (y_ini <= yc < y_fim) or yc > page.rect.height - 22:      # rodapé
            continue
        if not (r.get("x0", 0) <= x0 < r.get("x1", 10_000)) or x0 < 30 and (y1 - y0) > 2 * (x1 - x0):
            continue
        if len(t) > 2 and (y1 - y0) > 1.6 * (x1 - x0):                  # texto na vertical
            continue
        t = t.replace("ﬁ", "fi").replace("ﬂ", "fl")
        m = NOTA_COLADA_RX.match(t)                    # "BRC073(1)" → "BRC073"
        if m:
            x1 = x0 + (x1 - x0) * len(m.group(1)) / len(t)
            t = m.group(1)
        out.append([x0, y0, x1, y1, t])
    # Conjuntos de lista "BYFQ60CW + EKRP1CAS5A" (painel + adaptador, p143): uma ref só.
    out.sort(key=lambda w: (round((w[1] + w[3]) / 2), w[0]))
    i = 0
    while i + 2 < len(out):
        a, mais, b = out[i], out[i + 1], out[i + 2]
        if (mais[4] == "+" and abs(a[1] - b[1]) < 3 and mais[0] - a[2] < 8 and b[0] - mais[2] < 8
                and e_ref(a[4]) and e_ref(b[4]) and not classificar(a[4], {}) and not classificar(b[4], {})):
            out[i:i + 3] = [[a[0], a[1], b[2], b[3], f"{a[4]}+{b[4]}"]]
        else:
            i += 1
    for rx, prefixo in seccao.get("prefixarRefs") or []:     # "VAM/VAM" + "150FC9" (p106)
        for w in out:
            if re.fullmatch(rx, w[4]):
                w[4] = prefixo + w[4]
    # Ref partida em duas linhas na célula ("SB.EKWHCTRL0_" / "CTRL1", p80; "FWEDA+" /
    # "SHINKATOUCHBA/WA", p141).
    for w in [w for w in out if w[4].endswith("_") or (w[4].endswith("+") and e_ref(w[4][:-1]))]:
        baixo = [o for o in out if 0 < o[1] - w[1] <= 10 and w[0] - 5 <= o[0] <= w[2] + 20 and o is not w
                 and re.match(r"^[A-Z]", o[4])]
        if baixo:
            o = min(baixo, key=lambda o: o[1])
            w[4] += o[4]
            out.remove(o)
    return _juntar(out)


def _juntar(palavras: list[list]) -> list[list]:
    """'2.935' + '€' → '2.935€'; '5,0/' + '5,8' → '5,0/5,8'."""
    palavras.sort(key=lambda w: (round((w[1] + w[3]) / 2), w[0]))
    out: list[list] = []
    for w in palavras:
        if (out and abs(out[-1][1] - w[1]) < 3 and 0 <= w[0] - out[-1][2] < 4 and re.fullmatch(r"\d{1,3}", out[-1][4])
                and re.fullmatch(r"\d{3}", w[4])
                and not (len(out) > 1 and out[-2][4] == "x")):            # "29" "140" "€" = 29.140 € (p134), não "x 2" "260 €"
            a = out.pop()
            out.append([a[0], a[1], w[2], a[3], a[4] + "." + w[4]])
            continue
        if out and abs(out[-1][1] - w[1]) < 3 and 0 <= w[0] - out[-1][2] < 9 and (
                (w[4] == "€" and re.fullmatch(r"[\d.,]+", out[-1][4]))
                or (w[4] == "/" and re.search(r"[\d+]$", out[-1][4]))
                or (re.fullmatch(r"\d{1,3}\.", out[-1][4]) and re.match(r"^\d{3}", w[4]))
                or (re.fullmatch(r"\d{1,3}", out[-1][4]) and re.fullmatch(r"\d{3}€", w[4]) and w[0] - out[-1][2] < 4)
                or (out[-1][4].endswith("/") and re.match(r"^[\dA-]", w[4])
                    and re.match(r"^[\d,.]+/$|^A\+*/$|^[A-Z0-9]", out[-1][4]))):
            a = out.pop()
            out.append([a[0], a[1], w[2], a[3], a[4] + w[4]])
        else:
            out.append(w)
    return out


def _yc(w) -> float:
    return (w[1] + w[3]) / 2


def preco(t: str) -> int | None:
    m = PRECO_RX.match(t)
    if not m:
        return None
    return int(m.group(1).replace(".", "")) * 100 + int(m.group(2) or 0)


def e_ref(t: str, seccao: dict | None = None) -> bool:
    t = t.rstrip("*./")
    if (seccao or {}).get("refNumerica") and NUMERICA_RX.match(t):
        return True
    if SEM_DIGITOS_RX.match(t) or re.match(r"^[A-Z]\.[A-Z]{3,}$", t) or SEM_DIGITOS_LONGA_RX.match(t):
        return t not in NAO_REFS and t not in PALAVRAS and not SERIE_FC_RX.match(t)
    if "+" in t and any(classificar(p, {}) for p in t.split("+")):               # "UE + UI" de um exemplo
        return False
    if not t.startswith("SB.") and any(p.isdigit() for p in t.split("/")[1:]):   # "FHA100/125/140": tamanhos
        return False
    return bool(REF_RX.match(t)) and len(t) >= 5 and not NAO_REF_RX.match(t) \
        and sum(c.isalpha() for c in t) >= 2 and not CLASSE_PAR_RX.match(t)


def _linha(ref: str, seccao: dict, pagina: int, y: float, campos: dict, pvp: int | None,
           componente: str | None = None, contexto: dict | None = None,
           classificacao: dict | None = None) -> dict:
    return {
        "ref": ref, "refs": None, "ean": None, "pagina": pagina, "pdfPaginas": [pagina], "y": y,
        "texto": ref, "campos": campos, "confianca": {k: 0.8 for k in campos},
        "componenteHint": componente, "pvpCents": pvp, "numPrecos": 1 if pvp is not None else 0,
        "precos": [pvp] if pvp is not None else [], "marcadorRef": 0, "precoImpresso": None,
        "seccao": seccao["id"], "contexto": contexto or {}, "notas": [], "precoSobConsulta": False,
        **({"classificacao": classificacao} if classificacao else {}),
    }


# --- Leitor "pares" ------------------------------------------------------------------

def _num(t: str) -> str:
    return t.replace(",", ".")


def _specs_da_linha(tokens: list[list], seccao: dict, ref: str = "") -> dict:
    """Specs de uma linha de conjunto/UE/UI. Com `colunas` no mapa
    ({chave: [x0, x1]}) cada célula vai para a sua chave; sem elas, a ordem das
    tabelas de AC: 1.º par numérico = kW frio/calor, par de classes, 2.º par =
    SEER/SCOP."""
    campos: dict[str, str] = {}
    colunas = seccao.get("colunas")
    if colunas:
        # {chave: [x0, x1(, rx)]} ou, com chaves repetidas por série, [[chave, x0, x1(, rx)], …]
        lista = [[k, *v] for k, v in colunas.items()] if isinstance(colunas, dict) else colunas
        for chave, x0, x1, *rx in lista:
            if rx and not re.search(rx[0], ref):
                continue
            celula = sorted((w for w in tokens if x0 <= (w[0] + w[2]) / 2 < x1), key=lambda w: w[0])
            if chave == "dimensoes":                      # "601 x 999 x 135" em várias palavras
                if celula:
                    _campo(campos, chave, " ".join(w[4] for w in celula))
                continue
            for w in celula:
                _campo(campos, chave, w[4])
        return campos
    if seccao.get("especificacoes") == "fc":
        return _specs_fc(tokens)
    pares = [w for w in tokens if PAR_RX.match(w[4])]
    classe = next((w for w in tokens if CLASSE_PAR_RX.match(w[4])), None)
    if pares:
        a, b = PAR_RX.match(pares[0][4]).groups()
        if seccao.get("ordemKw") == "calor-frio":          # Altherma: "Potência máx. (Aquec./Arref.)"
            a, b = b, a
        campos["frio-kw"], campos["calor-kw"] = _num(a), _num(b)
    if classe:
        f, c = CLASSE_PAR_RX.match(classe[4]).groups()
        f, c = f.replace("–", "-"), c.replace("–", "-")
        if f != "-" or c != "-":
            campos["classe-energetica"] = f"{f}/{c}"
    if len(pares) > 1:
        a, b = PAR_RX.match(pares[1][4]).groups()
        campos["seer"], campos["scop"] = _num(a), _num(b)
    return campos


def _specs_fc(tokens: list[list]) -> dict:
    """Ventiloconvectores: depois dos preços vêm as capacidades de arrefecimento e
    depois as de aquecimento (baixa/média/alta, ou por pressão estática): metade
    para cada, fica a maior (velocidade alta). Pares "2,0/1,5" (alta/baixa) contam
    como um valor."""
    valores: list[float] = []
    for w in sorted(tokens, key=lambda w: w[0]):
        m = PAR_RX.match(w[4])
        if m:
            valores.append(max(float(_num(m.group(1))), float(_num(m.group(2)))))
        elif re.fullmatch(r"\d+,\d+", w[4]):
            valores.append(float(_num(w[4])))
    if len(valores) < 2:
        return {}
    meio = len(valores) // 2
    fmt = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")          # noqa: E731
    return {"frio-kw": fmt(max(valores[:meio])), "calor-kw": fmt(max(valores[meio:]))}


def _campo(campos: dict, chave: str, texto: str) -> None:
    """Uma célula de coluna conhecida → chave(s) do registo."""
    t = texto.strip()
    if t in ("-", "–", "—"):
        return
    m = PAR_RX.match(t)
    if chave == "kw" and m:
        campos.setdefault("frio-kw", _num(m.group(1)))
        campos.setdefault("calor-kw", _num(m.group(2)))
    elif chave == "unidades-max" and m:                    # "2/3" = mín./máx. de UI
        campos.setdefault(chave, _num(m.group(2)))
    elif chave == "seer-scop" and m:
        campos.setdefault("seer", _num(m.group(1)))
        campos.setdefault("scop", _num(m.group(2)))
    elif chave == "classe-energetica":
        mc = CLASSE_PAR_RX.match(t)
        if mc:
            campos.setdefault(chave, f"{mc.group(1)}/{mc.group(2)}".replace("–", "-"))
        elif CLASSE_RX.match(t):
            campos.setdefault(chave, f"{t}/-")
    elif chave == "alimentacao":
        n = t.lower()
        if n.startswith("mono"):
            campos.setdefault(chave, "monofasica")
        elif n.startswith("tri"):
            campos.setdefault(chave, "trifasica")
    elif chave == "dimensoes":
        md = re.fullmatch(r"(\d+(?:,\d+)?)\s*[xX×]\s*(\d+(?:,\d+)?)\s*[xX×]\s*(\d+(?:,\d+)?)", t)
        if md:
            campos.setdefault(chave, "x".join(_num(g) for g in md.groups()))
    elif chave in ("kw", "seer-scop"):
        return                                        # célula sem o par "frio/calor"
    elif re.fullmatch(r"\d+(?:[.,]\d+)?", t):
        campos.setdefault(chave, _num(t) if "," in t else t)


def _derivar_descricao(desc: str, regra: dict) -> dict:
    """Atributos lidos da descrição de um equipamento numa lista ("DucoBox Energy
    Premium 325 - 1ZH - Esquerda", "DucoBox Energy Comfort D400 400m3/h")."""
    out: dict[str, str] = {}
    for chave in regra.get("derivar", []):
        if chave == "caudal-m3h":
            m = re.search(r"(\d{3,4})\s*m3/h", desc) or re.search(r"\bD(\d{3})\b", desc) or \
                re.search(r"Premium (\d{3})\b", desc)
            if m:
                out[chave] = m.group(1)
        elif chave == "zonas":
            m = re.search(r"\b(\d)Z[SH]\b", desc)
            if m:
                out[chave] = m.group(1)
        elif chave == "controlo":
            m = re.search(r"\b\dZ([SH])\b", desc)
            if m:
                out[chave] = {"S": "sensor", "H": "humidade"}[m.group(1)]
        elif chave == "orientacao":
            m = re.search(r"(?i)\b(esquerda|direita)\b", desc)
            if m:
                out[chave] = m.group(1).lower()
    return out


def _texto_por_colunas(ws: list[list]) -> str:
    """Texto de várias linhas que pode ocupar mais de uma coluna ("Acessório |
    Descrição"): cada linha parte-se onde há um intervalo > 10 pt, os inícios dos
    pedaços agrupam-se em colunas e lê-se coluna a coluna, de cima para baixo."""
    linhas: dict[int, list] = defaultdict(list)
    for w in ws:
        linhas[round(_yc(w))].append(w)
    pedacos = []                                   # (x de início, y, palavras)
    for y, l in linhas.items():
        l.sort(key=lambda w: w[0])
        atual = [l[0]]
        for w in l[1:]:
            if w[0] - atual[-1][2] > 10:
                pedacos.append((atual[0][0], y, atual))
                atual = [w]
            else:
                atual.append(w)
        pedacos.append((atual[0][0], y, atual))
    inicios: list[float] = []
    for x in sorted(p[0] for p in pedacos):
        if not inicios or x - inicios[-1] > 15:
            inicios.append(x)
    def coluna(x: float) -> int:
        return max(i for i, c in enumerate(inicios) if c <= x + 0.5)
    pedacos.sort(key=lambda p: (coluna(p[0]), p[1], p[0]))
    return " ".join(w[4] for p in pedacos for w in p[2])


def _e_nota(linha_ws: list[list], w, seccao: dict) -> bool:
    """Ref citada numa frase (nota de rodapé, descrição de outra linha): há uma
    palavra corrida colada à esquerda na mesma linha (salvo nas listas com a
    descrição à esquerda da ref)."""
    if seccao.get("descricao") not in ("esquerda", "linha") or w[4].endswith("."):
        # Só a palavra imediatamente à esquerda ("Tamanho 5 SB.ATB05RBM", p116, não é frase).
        antes = [o for o in linha_ws if o is not w and abs(_yc(o) - _yc(w)) <= 2.5 and o[2] <= w[0]]
        o = max(antes, key=lambda o: o[2], default=None)
        if o is not None and w[0] - o[2] < 14 and re.search(r"[a-zà-ú]{2}", o[4]) \
                and not MARCA_NOTA_RX.match(o[4]):
            return True
    # Continuação de uma descrição de várias linhas ("Sonda … para" / "FWEC10", p136):
    # palavra corrida a começar no mesmo x na linha logo acima.
    if not classificar(w[4].rstrip("*"), seccao) and any(
            3 < _yc(w) - _yc(o) <= 10 and abs(o[0] - w[0]) < 3 and re.search(r"[a-zà-ú]{2}", o[4])
            and not o[4].startswith("(") for o in linha_ws):       # "(por cabo)" é legenda da ref de cima
        return True
    # Linha de nota de rodapé ("(1) …", "Nota: …"), salvo equipamento conhecido (a linha
    # "Nota: … ligação EWYK020CZP-A1 19,9 …" da p131 é também uma linha da tabela).
    return not classificar(w[4].rstrip("*"), seccao) and any(
        abs(_yc(o) - _yc(w)) <= 2.5 and o[0] < w[0] and re.match(r"(?i)^(\(\d\)|nota:?|\*)$", o[4])
        and o[0] < 60 for o in linha_ws)


def ler_pares(page, y_ini: float, y_fim: float, seccao: dict, numero: int) -> list[dict]:  # noqa: C901
    ws = _palavras(page, y_ini, y_fim, seccao)
    # Refs citadas em frases não são âncoras, salvo equipamento conhecido nas secções
    # que imprimem a ref a seguir a um rótulo ("Referência do conjunto SB.EKSV26P/2DBFP", p96).
    ignorar = seccao.get("ignorarRefs")
    refs = [w for w in ws if e_ref(w[4], seccao) and not (ignorar and re.search(ignorar, w[4]))
            and (not _e_nota(ws, w, seccao) or (
        seccao.get("refAposRotulo") and classificar(w[4].rstrip("*"), seccao)))]
    precos = [w for w in ws if preco(w[4]) is not None]
    cabecalhos = sorted({round(_yc(w), 1) for w in ws if CABECALHO_RX.match(w[4])
                         and not any(abs(_yc(r) - _yc(w)) < 2.5 for r in refs)})
    def celula(w) -> tuple[float, float]:
        """Da ref até à ref seguinte à direita nas linhas vizinhas (±25 pt): as
        colunas são locais (a mesma página tem listas e tabelas com outras colunas)."""
        # "E2MV03A6 / E2MV06A6" (p141): a ref depois de uma barra partilha a célula da anterior.
        direita = [o[0] for o in refs if o[0] > w[0] + 20 and abs(_yc(o) - _yc(w)) <= 25 and not any(
            abs(_yc(b) - _yc(o)) < 3 and 0 <= o[0] - b[2] < 10 and b[4].endswith("/") for b in ws)]
        return w[0] - 2, (min(direita) - 2 if direita else 10_000)

    def mesma_coluna(a, b) -> bool:
        return abs(a[0] - b[0]) < 8

    def separado(ya: float, yb: float) -> bool:
        return any(min(ya, yb) < h < max(ya, yb) for h in cabecalhos)

    classif = {id(w): classificar(w[4].rstrip("*"), seccao) for w in refs}

    def tipo(r) -> str | None:
        c = classif[id(r)]
        return c["componente"] if c else None

    def na_celula(r, p) -> bool:
        x0, x1 = celula(r)
        if not (r[2] - 2 <= p[0] and x0 <= p[0] < x1) or separado(_yc(r), _yc(p)):
            return False
        # Preço de outra âncora mais à esquerda na mesma linha não conta.
        return not any(o is not r and abs(_yc(o) - _yc(p)) < 3 and r[2] < o[0] < p[0] for o in refs)

    preco_de: dict[int, list] = {}
    por_baixo = seccao.get("leitor") == "matriz" or bool(seccao.get("precoPorBaixo"))
    # Listas (acessórios): cada preço vai para a âncora mais próxima (empate = partilhado);
    # nas fichas com o preço por baixo da ref, como o equipamento (abaixo).
    for p in precos if not por_baixo else []:
        cands = [(abs(_yc(r) - _yc(p)), r) for r in refs if tipo(r) is None and na_celula(r, p)]
        if not cands:
            continue
        dmin = min(d for d, _ in cands)
        for d, r in cands:
            if d <= 11 and d - dmin < 1.5:
                atual = preco_de.get(id(r))
                if atual is None or d < atual[0]:
                    preco_de[id(r)] = [d, p]
    # Variantes empilhadas na mesma célula (BRC1HHDW7 / BRC1HHDS7 / BRC1HHDK7, p65) com um só
    # preço a meio: as que ficaram sem preço levam o da vizinha que só difere no fim da ref.
    for r in refs:
        if tipo(r) is not None or id(r) in preco_de:
            continue
        viz = [q for q in refs if id(q) in preco_de and tipo(q) is None and mesma_coluna(q, r)
               and abs(_yc(q) - _yc(r)) <= 20 and len(q[4]) == len(r[4]) and q[4][:-2] == r[4][:-2]]
        if viz:
            preco_de[id(r)] = preco_de[id(min(viz, key=lambda q: abs(_yc(q) - _yc(r))))]
    # Equipamento: cada ref leva o preço mais próximo da sua célula — refs empilhadas
    # ("SB.FTXA20DP/DY/DG/DC/DL") partilham a linha de preço do meio —, salvo se uma
    # ref de outro tipo na mesma coluna está mais perto dele (ficha: a UI por baixo
    # da linha "Preço do conjunto").
    def preco_na_linha(r):
        """Primeiro preço à direita na mesma linha, salvo se antes dele há um "–" (o
        preço da linha é de outra ref). Refs seguidas sem preço entre elas ("ARB01RAM
        ARB01LAM 9.220 €", direita/esquerda) partilham o preço."""
        linha = sorted((o for o in ws if abs(_yc(o) - _yc(r)) <= 3 and o[0] > r[2] - 1), key=lambda o: o[0])
        for o in linha:
            if preco(o[4]) is not None:
                return o
            if o[4] in ("–", "-", "—"):
                return None
        return None

    for r in refs:
        if tipo(r) is None and not por_baixo:
            continue
        if not seccao.get("colunasPreco") and seccao.get("leitor") != "matriz" and not seccao.get("precoPorBaixo"):
            p = preco_na_linha(r)
            if p is not None:
                preco_de[id(r)] = [0, p]
                continue
        coluna_preco = next((c for c in seccao.get("colunasPreco") or [] if re.search(c["rx"], r[4])), None)
        if coluna_preco:                         # tabela com várias colunas de preço (p53, p142)
            x0, x1 = coluna_preco["x"]
            cands = sorted((abs(_yc(p) - _yc(r)), p[0], p) for p in precos
                           if x0 <= p[0] < x1 and abs(_yc(p) - _yc(r)) <= coluna_preco.get("dy", 20))
        elif seccao.get("leitor") == "matriz" or seccao.get("precoPorBaixo"):
            # Preço impresso por baixo da ref, na mesma coluna: matrizes Altherma (logo
            # abaixo) e kits solares (linha "Preço do conjunto" no fim do bloco).
            dy = (seccao.get("precoPorBaixo") or {}).get("dy", 18)
            # Empate na distância vertical (a linha de preços inteira): a coluna mais próxima.
            cands = sorted((_yc(p) - _yc(r), abs((p[0] + p[2]) / 2 - (r[0] + r[2]) / 2), p) for p in precos
                           if 2 < _yc(p) - _yc(r) <= dy and abs((p[0] + p[2]) / 2 - (r[0] + r[2]) / 2) <= 30)
            cands = [(round(d, 0), dx, p) for d, dx, p in cands]
            cands.sort(key=lambda c: (c[0], c[1]))
        else:
            # Na célula à direita, ou centrado por baixo/cima da ref (cabeçalho das fichas, p13).
            cands = sorted((abs(_yc(r) - _yc(p)), p[0], p) for p in precos if na_celula(r, p) or (
                abs((p[0] + p[2]) / 2 - (r[0] + r[2]) / 2) <= 30 and not separado(_yc(r), _yc(p))))
        limite = coluna_preco.get("dy", 20) if coluna_preco else (seccao.get("precoPorBaixo") or {}).get("dy", 20)
        if tipo(r) is None and por_baixo and not coluna_preco and not any(d <= limite for d, _x, _p in cands):
            p = preco_na_linha(r)                # lista com o preço à direita numa página de fichas
            if p is not None:
                preco_de[id(r)] = [0, p]
            continue
        for d, _x, p in cands:
            if d > limite:
                break
            if any(o is not r and tipo(o) != tipo(r) and abs((o[0] + o[2]) / 2 - (r[0] + r[2]) / 2) < 20
                   and abs(_yc(o) - _yc(p)) < d for o in refs):
                continue
            preco_de[id(r)] = [d, p]
            break

    out: list[dict] = []
    # Palavras de descrição: fora das linhas de cabeçalho e das notas de rodapé
    # ("(1) Necessário adaptador…", "Nota: …").
    notas = {round(_yc(w), 1) for w in ws if re.match(r"(?i)^(\(\d+\)|nota:?|\*+)$", w[4])
             and not any(o[2] <= w[0] and abs(_yc(o) - _yc(w)) < 2.5 for o in ws if o is not w)}
    fora = cabecalhos + sorted(notas)
    outras = [w for w in ws if w not in refs and w not in precos and not MARCA_NOTA_RX.match(w[4])
              and not any(abs(_yc(w) - y) < 2.5 for y in fora)]
    for r in refs:
        c = classif[id(r)]
        achado = preco_de.get(id(r))
        pvp = preco(achado[1][4]) if achado else None
        if c is None:                                    # lista "Ref | Descrição | Preço"
            if (pvp is None and not seccao.get("semPreco")) or seccao.get("soEquipamento"):
                continue
            x0, x1 = celula(r)
            fim = achado[1][0] if achado else x1
            if seccao.get("descricao") == "linha":
                # Grelhas de opcionais (UTA, VAM, rooftops): o rótulo da linha à esquerda da
                # primeira coluna de refs.
                x_min = min(q[0] for q in refs if abs(_yc(q) - _yc(r)) <= 25) - 5
                rot = [o for o in outras if o[2] <= x_min and -6 <= _yc(o) - _yc(r) <= 14]
                desc = _texto_por_colunas(rot) if rot else ""
                if seccao.get("prefixoDescricao"):          # "UTA Compact R: G4 - ISO Coarse 55%"
                    desc = f"{seccao['prefixoDescricao']}: {desc}" if desc else seccao["prefixoDescricao"]
                for ref in expandir_ref(r[4].rstrip("./")):
                    campos = {"descricao": desc} if desc else {}
                    m = re.match(seccao.get("tamanhoDaRef") or r"(?!)", ref)
                    if m:                                    # opção por tamanho de UTA: ARF03G4A = tamanho 3
                        campos["tamanho"] = str(int(m.group(1)))
                    out.append(_linha(ref, seccao, numero, _yc(r), campos, pvp, componente="acessorio"))
                continue
            if seccao.get("descricao") == "esquerda":
                # "Descrição | Referência | Preço": da coluna "Descrição" do cabeçalho mais
                # próximo acima (ou do preço da coluna anterior) até à ref.
                ini = max([p[2] for p in precos if p[2] <= r[0]] + [0])
                faixa = (ini, r[0] - 1)
            else:                                        # à direita ou por baixo da ref
                faixa = (r[0] - 3, min(fim, x1))
            desc_ws = []
            for o in outras:
                if not (faixa[0] <= o[0] < faixa[1]) or separado(_yc(r), _yc(o)):
                    continue
                dono = min((q for q in refs if mesma_coluna(q, r) and classif[id(q)] is None),
                           key=lambda q: abs(_yc(q) - _yc(o)))
                if dono is r and abs(_yc(r) - _yc(o)) <= 14:
                    desc_ws.append(o)
            desc = _texto_por_colunas(desc_ws)
            regra = next((d for d in seccao.get("porDescricao") or [] if re.search(d["rx"], desc)), None)
            if regra is not None:                        # equipamento numa lista (DucoBox, p104)
                campos = {"descricao": desc, **_derivar_descricao(desc, regra)}
                cl = {k: v for k, v in regra.items() if k not in ("rx", "derivar")}
                if not cl.get("gama"):                   # a gama é o nome que a regra encontrou
                    cl["gama"] = re.search(regra["rx"], desc).group(0)
                out.append(_linha(r[4], seccao, numero, _yc(r), campos, pvp, componente=cl.pop("componente"),
                                  classificacao=cl))
                continue
            for ref in expandir_ref(r[4].rstrip("./")):
                out.append(_linha(ref, seccao, numero, _yc(r), {"descricao": desc} if desc else {},
                                  pvp, componente="acessorio"))
            continue
        if (pvp is None and seccao.get("soComPreco")) or seccao.get("soAcessorios"):
            continue
        # Produto: specs da linha (tokens a ≤ 6 pt da ref ou da linha do preço).
        y_ref = _yc(achado[1]) if achado else _yc(r)
        if seccao.get("leitor") == "matriz":
            tokens = [o for o in outras if -3 <= _yc(o) - _yc(r) <= 10]
        else:
            tokens = [o for o in outras if abs(_yc(o) - y_ref) <= 3 or abs(_yc(o) - _yc(r)) <= 2.5]
        campos = _specs_da_linha(tokens, seccao, r[4])
        if seccao.get("especificacoes") == "transpostas":
            campos.update({k: v for k, v in _specs_transpostas(ws, r, refs, y_fim, c, seccao).items()
                           if k not in campos})
        if c["componente"] in ("unidade-interior", "unidade-exterior"):
            # Classe e SEER/SCOP da linha são do conjunto (UE + UI), não da unidade.
            campos = {k: v for k, v in campos.items() if k not in ("classe-energetica", "seer", "scop")}
        for ref in expandir_ref(r[4]):
            cl = classificar(ref, seccao) or c
            alim = alimentacao_da_ref(ref)
            cmp = dict(campos)
            if alim and cl.get("fases"):
                cmp.setdefault("alimentacao", alim)
            if cl.get("derivar"):
                for k, v in cl["derivar"](ref).items():
                    cmp.setdefault(k, v)
            contexto = {k: cl[k] for k in ("serie", "cor") if cl.get(k)}
            classificacao = {k: v for k, v in cl.items()
                             if k in ("familia", "segmento", "sistema", "tipoUnidade", "gama", "rotulo")}
            out.append(_linha(ref, seccao, numero, _yc(r), cmp, pvp, componente=cl["componente"],
                              contexto=contexto, classificacao=classificacao))
    return out


# Fichas com um modelo por coluna: rótulo da linha → chave do registo.
ROTULOS_FICHA = (
    (re.compile(r"(?i)^card\b|cadr"), "cadr-m3h", "primeiro"),
    (re.compile(r"(?i)\bcaudal\b|fluxo de ar"), "caudal-m3h", "max"),
    (re.compile(r"(?i)efici[êe]ncia.*(temperatura|permuta)"), "rendimento-pct", "primeiro"),
    (re.compile(r"(?i)n[íi]vel de (press[ãa]o|pot[êe]ncia) sonora"), "nivel-sonoro-db", "max"),
    (re.compile(r"(?i)(capacidade|pot[êe]ncia)[^/]*arref|\barrefecimento\b"), "frio-kw", "primeiro"),
    (re.compile(r"(?i)(capacidade|pot[êe]ncia)[^/]*aquec|\baquecimento\b"), "calor-kw", "primeiro"),
    (re.compile(r"(?i)^eer\b"), "eer", "primeiro"),
    (re.compile(r"(?i)^cop\b"), "cop", "primeiro"),
    (re.compile(r"(?i)\bseer\b"), "seer", "primeiro"),
    (re.compile(r"(?i)\bscop\b"), "scop", "primeiro"),
    (re.compile(r"(?i)dimens"), "dimensoes", "dimensoes"),
    (re.compile(r"(?i)[áa]rea (aplic|recomend)"), "area-m2", "primeiro"),
)
NUM_RX = re.compile(r"\d+(?:[.,]\d+)?")


def _specs_transpostas(ws: list[list], r, refs: list[list], y_fim: float, c: dict, seccao: dict) -> dict:
    """Specs de uma ficha com um modelo por coluna (VAM, EKVDX, chillers…): as
    linhas abaixo da ref, a célula na coluna da ref (± meio passo entre colunas)
    e o rótulo à esquerda da primeira coluna."""
    vizinhas = sorted((q[0] + q[2]) / 2 for q in refs if abs(_yc(q) - _yc(r)) <= 3)
    xc = (r[0] + r[2]) / 2
    passo = min((b - a for a, b in zip(vizinhas, vizinhas[1:])), default=80)
    x_rotulo = min(vizinhas) - passo / 2 - 5
    # A ficha acaba na linha seguinte de refs da mesma série (as linhas "unidade interior
    # FTXZ25N" dentro da ficha da Ururu, p13, não contam).
    serie = re.match(r"^[A-Z.]*", r[4]).group(0)
    fim = min([_yc(q) for q in refs if _yc(q) > _yc(r) + 15 and abs((q[0] + q[2]) / 2 - xc) < passo / 2
               and re.match(r"^[A-Z.]*", q[4]).group(0) == serie] + [y_fim])
    linhas: dict[int, list] = defaultdict(list)
    for w in ws:
        if _yc(r) + 4 < _yc(w) < fim:
            linhas[round(_yc(w))].append(w)
    campos: dict[str, str] = {}
    rotulo_ant = ""
    classes: list[str] = []                       # "Etiqueta Energética": arrefecimento, aquecimento
    for y in sorted(linhas):
        l = linhas[y]
        rot = " ".join(w[4] for w in sorted(l, key=lambda w: w[0]) if w[2] <= x_rotulo)
        if re.search(r"(?i)etiqueta", rot):
            # Célula fundida sobre as colunas com a mesma classe: o valor mais próximo da linha.
            vals = [w for w in l if w[0] > x_rotulo and CLASSE_RX.match(w[4])]
            if vals:
                classes.append(min(vals, key=lambda w: abs((w[0] + w[2]) / 2 - xc))[4])
            continue
        if not rot or not re.search(r"[A-Za-z]{4}", rot):
            # Rótulo em várias linhas ("Potência de" / "Mín./Nom./Máx. kW" / "arrefecimento", p13).
            viz = [w for y2 in linhas if 0 < abs(y2 - y) <= 6 for w in linhas[y2] if w[2] <= x_rotulo]
            rot = " ".join([rot] + [w[4] for w in sorted(viz, key=lambda w: (w[1], w[0]))]).strip()
        elif re.search(r"(?i)m[íi]n\./nom", rot):
            viz = [w for y2 in linhas if 0 < abs(y2 - y) <= 6 for w in linhas[y2] if w[2] <= x_rotulo]
            rot = " ".join(w[4] for w in sorted(viz, key=lambda w: (w[1], w[0]))) + " " + rot
        rot = rot or rotulo_ant
        rotulo_ant = rot
        cel = " ".join(w[4] for w in sorted(l, key=lambda w: w[0])
                       if w[0] > x_rotulo and abs((w[0] + w[2]) / 2 - xc) <= passo / 2)
        if not cel or preco(cel.replace(" ", "")) is not None:
            continue
        for rx, chave, modo in ROTULOS_FICHA:
            if chave in campos or not rx.search(rot) or (chave == "caudal-m3h" and c.get("familia") == "purificadores-de-ar"):
                continue
            if chave in ("frio-kw", "calor-kw") and (re.search(r"(?i)absorvid|efici|consumo|%|dB|sonor|°C|temp", rot) or (
                    c.get("familia") == "ventilacao")):
                # Potência absorvida / eficiência, não capacidade; na ventilação (VAM, EKVDX) os kW
                # impressos são do conjunto com a UE ou da potência absorvida.
                break
            if modo == "dimensoes":
                m = re.search(r"(\d[\d.,]*)\s*[xX×]\s*(\d[\d.,]*)\s*[xX×]\s*(\d[\d.,]*)", cel)
                if m:
                    campos[chave] = "x".join(g.replace(".", "").replace(",", "") for g in m.groups())
            elif chave in ("frio-kw", "calor-kw") and re.fullmatch(r"[\d,.]+/[\d,.]+/[\d,.]+", cel.replace(" ", "")):
                campos[chave] = cel.replace(" ", "").split("/")[1].replace(",", ".")   # Mín./Nom./Máx.
            else:
                limpa = re.sub(r"\(\d\)", "", cel)
                limpa = re.sub(r"(?<=\d)\.(?=\d{3}\b)", "", limpa)          # "1.500" m³/h = 1500
                nums = [n.replace(",", ".") for n in NUM_RX.findall(limpa)]
                if nums:
                    v = max(nums, key=float) if modo == "max" else nums[0]
                    campos[chave] = v.rstrip("0").rstrip(".") if "." in v else v
            break
    if classes and c.get("componente") == "conjunto":
        campos["classe-energetica"] = f"{classes[0]}/{classes[1] if len(classes) > 1 else '-'}"
    return campos


def ler_rooftops(page, y_ini: float, y_fim: float, seccao: dict, numero: int) -> list[dict]:
    """Rooftops (p122-123) e chillers EWAT-B/EWYT-B (p132-133): a tabela imprime a série
    ("UATYA-BBAY1", "EWAT-B") e os tamanhos em colunas (25 … 190, 085-SS …), com a
    potência e o preço por baixo. A ref de cada tamanho compõe-se como no catálogo
    anterior: UATYA100BBAY1, EWAT085B-SS."""
    ws = _palavras(page, y_ini, y_fim, seccao)
    out = []
    for cab in [w for w in ws if re.match(r"^(UATYA-[A-Z0-9]+|EW[AY]T-B|EW[AY]A|VKM-J)\*?$", w[4])]:
        tamanhos = [w for w in ws if abs(_yc(w) - _yc(cab)) <= 3 and w[0] > cab[2]
                    and re.fullmatch(r"\d{2,3}(-[SX]S)?|\d{3}D[VW]\dP", w[4])]
        if len(tamanhos) < 3:
            continue
        abaixo = sorted({round(_yc(w)) for w in ws if 0 < _yc(w) - _yc(cab) <= 150})
        def rotulo(y):
            return " ".join(w[4] for w in sorted(ws, key=lambda w: w[0])
                            if abs(_yc(w) - y) <= 2 and w[2] < tamanhos[0][0] - 5)
        def linha_com(rx, continuar=False):
            # O rótulo da potência pode continuar na linha de baixo ("Potência de Nom." /
            # "aquecimento …", p122), mas só quando a linha não diz já o que é.
            for i, y in enumerate(abaixo):
                seguinte = abaixo[i + 1] if i + 1 < len(abaixo) and abaixo[i + 1] - y <= 10 else None
                rot = rotulo(y)
                if continuar and seguinte is not None and re.search(r"(?i)pot[êe]ncia|capacidade", rot) \
                        and not re.search(r"(?i)arref|aquec", rot):
                    rot += " " + rotulo(seguinte)
                if re.search(rx, rot):
                    return [w for w in ws if abs(_yc(w) - y) <= 2]
            return []
        precos = [w for w in linha_com(r"(?i)pre[çc]o") if preco(w[4]) is not None]
        frio = linha_com(r"(?i)cap\.?\s*arref|arrefecimento\s+nom|pot[êe]ncia de\b.*\barref|pdc", True)
        calor = [l for l in [linha_com(r"(?i)cap\.?\s*aquec|aquecimento\s+nom|pot[êe]ncia de\b.*\baquec", True)] if l]
        caudal = linha_com(r"(?i)\bcaudal\b")
        serie = cab[4].rstrip("*")
        for t in tamanhos:
            xc = (t[0] + t[2]) / 2
            def na_coluna(l):
                # Primeiro número da célula: "11,6(1)/11,5(2)" = condição da nota (1); "500/500/440" = máx.
                c = [re.match(r"^(\d+(?:,\d+)?)(?:\(\d\))?(?:/|$)", w[4]) for w in sorted(l, key=lambda w: w[0])
                     if abs((w[0] + w[2]) / 2 - xc) <= 14]
                c = [m.group(1) for m in c if m]
                return c[0].replace(",", ".") if c else None
            p = min(precos, key=lambda w: abs((w[0] + w[2]) / 2 - xc), default=None)
            pvp = preco(p[4]) if p is not None and abs((p[0] + p[2]) / 2 - xc) <= 14 else None
            campos = {k: v for k, v in (("frio-kw", na_coluna(frio)),
                                        ("calor-kw", na_coluna(calor[0]) if calor else None),
                                        ("caudal-m3h", na_coluna(caudal))) if v}
            if serie.startswith("UATYA"):
                ref = serie.replace("-", t[4])                       # UATYA-BBAY1 + 100 → UATYA100BBAY1
            elif re.fullmatch(r"EW[AY]A", serie):
                ref = serie + t[4]                                   # EWAA + 011DV3P → EWAA011DV3P
            elif serie == "VKM-J":
                ref = f"VKM{t[4]}JM"                                 # VKM-J + 50 → VKM50JM
            else:
                n, v = t[4].split("-")                               # EWAT-B + 085-SS → EWAT085B-SS
                ref = f"{serie[:4]}{n}B-{v}"
            cl = classificar(ref, seccao) or {}
            if cl.get("fases") and alimentacao_da_ref(ref):
                campos["alimentacao"] = alimentacao_da_ref(ref)
            if cl.get("familia") == "ventilacao":
                campos.pop("frio-kw", None)
                campos.pop("calor-kw", None)
            out.append(_linha(ref, seccao, numero, _yc(cab), campos, pvp, componente=cl.get("componente", "conjunto"),
                              classificacao={k: v for k, v in cl.items() if k in (
                                  "familia", "segmento", "sistema", "tipoUnidade", "gama", "rotulo")}))
    return out


LEITORES = {"pares": ler_pares, "matriz": ler_pares, "rooftops": ler_rooftops}


def _faixas(a: dict, b: dict) -> bool:
    ra, rb = a.get("regiao") or {}, b.get("regiao") or {}
    return ra.get("x0", 0) < rb.get("x1", 10_000) and rb.get("x0", 0) < ra.get("x1", 10_000)


def regioes(page, seccoes: list[dict], numero: int) -> list[tuple[float, float, dict]]:
    """[(y_inicio, y_fim, secção)]: cada secção começa em `posicoes[página]`
    (default 0) e acaba onde começa a seguinte da mesma faixa x."""
    inicios = [(float((s.get("posicoes") or {}).get(str(numero), 0)), s) for s in seccoes]
    out = []
    for y, s in inicios:
        fim = min((y2 for y2, s2 in inicios if y2 > y and s2 is not s and _faixas(s, s2)),
                  default=page.rect.height)
        out.append((y, fim, s))
    return out


def extrair_pagina(page, seccoes: list[dict], numero: int) -> list[dict]:
    out: list[dict] = []
    for y_ini, y_fim, seccao in regioes(page, seccoes, numero):
        if seccao.get("tipo") != "tabela":
            continue
        out += LEITORES[seccao.get("leitor", "pares")](page, y_ini, y_fim, seccao, numero)
    return out

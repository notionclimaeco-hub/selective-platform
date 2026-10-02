"""Mitsubishi Electric 2026 (`MITSUBISHI Tabela  de Preços 2026.pdf`, ticket #46).

Hook `extrair_pagina(page, seccoes, numero)` do `extrair.py --marca mitsubishi`:
substitui o leitor genérico em todas as páginas. A tabela é um catálogo, não
uma lista: cada página com preços tem um ou mais quadros de um destes tipos
(`PAGINAS` diz quais, por página, de cima para baixo):

- `split`: ficha com um modelo por coluna (Gama Doméstica, Mr. Slim). Linhas
  "PVR (…)" com o preço por coluna (uma por cor ou por alimentação), "Unidade
  interior" / "Unidade exterior" com as refs; vende-se o conjunto `UI/UE`.
- `ue`: ficha de unidades exteriores multi-split (MXZ, PXZ, PUMY): a ref é o
  modelo do cabeçalho.
- `modelos`: ficha com o modelo no cabeçalho (ou numa linha "Referência") e uma
  linha de preço (depósitos, MEHP-iB, chillers, rooftops, s-MEXT, s-AIRME).
- `ecodan`: conjuntos Ecodan com a UE e a UI em linhas próprias, cada uma com o
  seu preço; vendem-se as duas unidades (o conjunto é a soma).
- `matriz`: preços de UI multi-split por classe de capacidade (linhas 15…100)
  e série (colunas "MSZ-LN##VG(W/R/B/V)").
- `lista`: listas "DESCRIÇÃO | MODELO | COMPATIBILIDADE | PVR" e variantes.
- `fancoil`: ventiloconvectores Climaveneta, uma linha por modelo com dois
  preços (só o ventiloconvector / completo ou com válvula de 3 vias).
- `caixas`: comandos MELANS, preço numa caixa à direita com a ref por baixo.

Cada linha sai com a secção da série (`series.seccao_de`), a classificação é
da secção. Os preços por modelo sem ref (opcionais de chillers, UTAs e
rooftops) não são produtos: ficam de fora (NOTAS.md).
"""
from __future__ import annotations

import re
from collections import defaultdict
from statistics import median

from _comum import parte_da_marca
from mapa import normalizar, palavras_da_pagina

series = parte_da_marca("mitsubishi", "series")

PRECO_RX = re.compile(r"^(\d{1,3}(?:\.\d{3})+|\d+)€\**$")
PRECO_SEM_EURO_RX = re.compile(r"^\d{1,3}\.\d{3}$")          # p59 "2.550" (sem €)
NUM_RX = re.compile(r"\d+(?:[.,]\d+)?")
CLASSE_RX = re.compile(r"A\+{0,3}|(?<![A-Za-z])[B-G](?![A-Za-z])")
DIST_LINHA = 2.6


# --- Palavras, linhas e preços ------------------------------------------------------

def _palavras(page) -> list[tuple]:
    out = []
    for x0, y0, x1, y1, t in palavras_da_pagina(page):
        if len(t) > 1 and (y1 - y0) > 1.6 * (x1 - x0):            # texto na vertical
            continue
        if x0 > 570 or (y0 + y1) / 2 > page.rect.height - 30:       # separador lateral, rodapé
            continue
        out.append((x0, y0, x1, y1, t.replace("ﬁ", "fi").replace("ﬂ", "fl")))
    return out


def _linhas(palavras: list[tuple], y0: float = 0, y1: float = 10_000) -> list[dict]:
    linhas: list[dict] = []
    for w in sorted(palavras, key=lambda w: ((w[1] + w[3]) / 2, w[0])):
        yc = (w[1] + w[3]) / 2
        if not (y0 <= yc < y1):
            continue
        if linhas and yc - linhas[-1]["fim"] <= DIST_LINHA:
            linhas[-1]["ws"].append(w)
            linhas[-1]["fim"] = yc
        else:
            linhas.append({"y": yc, "fim": yc, "ws": [w]})
    for l in linhas:
        l["ws"].sort(key=lambda w: w[0])
        l["texto"] = " ".join(w[4] for w in l["ws"])
    return linhas


def _xc(w) -> float:
    return (w[0] + w[2]) / 2


def preco(t: str) -> int | None:
    t = t.strip()
    m = PRECO_RX.match(t)
    if m:
        return int(m.group(1).replace(".", "")) * 100
    return None


def _e_preco(t: str, sem_euro: bool = False) -> bool:
    return preco(t) is not None or (sem_euro and bool(PRECO_SEM_EURO_RX.match(t)))


def _preco_ou_sem_euro(t: str) -> int | None:
    p = preco(t)
    if p is None and PRECO_SEM_EURO_RX.match(t):
        p = int(t.replace(".", "")) * 100
    return p


def num(texto: str | None) -> str | None:
    """Primeiro número do texto, com ponto decimal ('2,5' → '2.5'; '12.1' fica)."""
    if not texto:
        return None
    m = NUM_RX.search(texto)
    return m.group(0).replace(",", ".") if m else None


def _parece_ref(t: str) -> bool:
    """Token com letras e dígitos, longo o bastante para ser uma ref ('PUZ-M100VKA/YKA')."""
    return len(t) >= 6 and bool(re.search(r"[A-Z]{2}", t)) and bool(re.search(r"\d", t)) and "€" not in t


def num_milhares(texto: str | None) -> str | None:
    """'1.100' (milhares) → '1100'; '15,8' → '15.8'."""
    if not texto:
        return None
    t = texto.strip()
    if re.fullmatch(r"\d{1,3}(?:\.\d{3})+", t):
        return t.replace(".", "")
    return num(t)


def dimensoes(texto: str | None) -> str | None:
    """'307x890x233' / '550 x 800(+69) x 285(+59.5)' / '1.390 x 900 x 420' → 'AxLxP'."""
    if not texto:
        return None
    t = re.sub(r"\(\+?[\d.,]+\)", "", texto)
    t = re.sub(r"^(\d{3,4})-(\d{3,4})-(\d{3,4})$", r"\1x\2x\3", t.strip())         # MXZ '796-950-330'
    t = re.sub(r"\s*[xX×]\s*", "x", t.strip())
    m = re.search(r"(\d[\d.]*)x(\d[\d.]*)x(\d[\d.]*)", t)
    if not m:
        return None
    return "x".join(re.sub(r"\.(?=\d{3}\b)", "", g).rstrip(".") for g in m.groups())


def classe(texto: str | None) -> str | None:
    if not texto:
        return None
    m = CLASSE_RX.search(texto.replace(" ", ""))
    return m.group(0) if m else None


def _norm(texto: str) -> str:
    return normalizar(texto)


def linha(ref: str, seccao: str, pagina: int, y: float, campos: dict, pvp: int | None, *,
          refs: list[str] | None = None, componente: str | None = None, contexto: dict | None = None,
          impresso: str | None = None) -> dict:
    campos = {k: v for k, v in campos.items() if v not in (None, "")}
    sec = series.seccao(seccao)
    if componente in (None, "acessorio", "comando") and sec["componente"] not in ("acessorio", "comando"):
        componente = sec["componente"]          # UE, hydrobox ou depósito listados como opção
    return {
        "ref": ref, "refs": refs, "ean": None, "pagina": pagina, "pdfPaginas": [pagina], "y": round(y, 1),
        "texto": ref, "campos": campos, "confianca": {k: 0.8 for k in campos},
        "componenteHint": componente, "pvpCents": pvp, "numPrecos": 1 if pvp is not None else 0,
        "precos": [pvp] if pvp is not None else [], "marcadorRef": 0, "precoImpresso": impresso,
        "seccao": seccao, "contexto": contexto or {}, "notas": [], "precoSobConsulta": False,
    }


# --- Grelha de uma ficha (um modelo por coluna) -------------------------------------

class Grelha:
    """Colunas pelos preços das linhas "PVR"; cada linha da ficha fica com o
    rótulo (palavras à esquerda das colunas) e as células por coluna. Células
    impressas uma vez para várias colunas (alimentação, dimensões iguais)
    enchem as colunas vazias mais próximas."""

    def __init__(self, linhas: list[dict], centros: list[float]):
        self.centros = sorted(centros)
        diffs = [b - a for a, b in zip(self.centros, self.centros[1:])]
        self.passo = median(diffs) if diffs else 80.0
        self.limite = self.centros[0] - 0.55 * self.passo
        self.linhas = []
        for l in linhas:
            rot = " ".join(w[4] for w in l["ws"] if _xc(w) < self.limite)
            refs = not rot or re.match(r"^(unidade|modelo|referencia|precos)", _norm(rot))
            self.linhas.append({"y": l["y"], "rotulo": rot, "norm": _norm(rot), "cel": self._celulas(l, refs),
                                "ws": l["ws"]})

    def coluna(self, x: float) -> int | None:
        i = min(range(len(self.centros)), key=lambda k: abs(self.centros[k] - x))
        return i if abs(self.centros[i] - x) <= 0.5 * self.passo else None

    def _celulas(self, l: dict, refs: bool = False) -> dict[int, str]:
        grupos: list[list] = []
        col_inicio: list[int | None] = []
        cheia = refs and sum(1 for w in l["ws"] if _xc(w) >= self.limite) >= len(self.centros)
        for w in l["ws"]:
            if _xc(w) < self.limite:
                continue
            # Numa linha de refs com uma palavra (ou mais) por coluna, uma célula nunca passa a
            # fronteira entre colunas ('MEHP-iB-G07 15Y MEHP-iB-G07 18Y', '2x PUZ-ZM 250YKA' colados).
            fronteira = cheia and bool(grupos) and self.coluna(_xc(w)) != col_inicio[-1]
            if grupos and not fronteira and w[0] - grupos[-1][2] <= 3.5 and not (
                    _e_preco(grupos[-1][4].split()[-1], True) and _e_preco(w[4], True)) and not (
                    _parece_ref(grupos[-1][4].split()[-1]) and _parece_ref(w[4])):
                a = grupos[-1]
                grupos[-1] = [a[0], a[1], w[2], a[3], f"{a[4]} {w[4]}"]
            else:
                grupos.append(list(w))
                col_inicio.append(self.coluna(_xc(w)))
        cels: dict[int, list[str]] = defaultdict(list)
        partilhados = []
        poucos = len(grupos) <= len(self.centros) / 2
        for g in grupos:
            largo = g[2] - g[0] >= 0.9 * self.passo
            i = self.coluna(_xc(g))
            longe = i is None or abs(self.centros[i] - _xc(g)) > 0.3 * self.passo
            valor = not (_parece_ref(g[4]) or _e_preco(g[4].split()[0], True))
            if valor and (poucos or largo or longe) and len(grupos) < len(self.centros):
                partilhados.append(g)
            elif i is not None:
                cels[i].append(g[4])
        out = {i: " ".join(v) for i, v in cels.items()}
        if partilhados:
            for i, c in enumerate(self.centros):
                if i not in out:
                    g = min(partilhados, key=lambda g: abs(_xc(g) - c))
                    out[i] = g[4]
        return out

    def procurar(self, rx: str, depois: float = -1, antes: float = 10_000) -> list[dict]:
        r = re.compile(rx)
        return [l for l in self.linhas if depois < l["y"] < antes and r.search(l["norm"])]

    def primeira(self, rx: str, depois: float = -1, antes: float = 10_000) -> dict | None:
        ls = self.procurar(rx, depois, antes)
        return ls[0] if ls else None


def _linhas_pvr(linhas: list[dict], sem_euro: bool = False) -> list[dict]:
    """Linhas com 'PVR' à esquerda dos preços e pelo menos um preço (ou '-')."""
    out = []
    for l in linhas:
        ws = l["ws"]
        i = next((k for k, w in enumerate(ws) if w[4].upper().startswith("PVR")), None)
        if i is None:
            continue
        precos = [w for w in ws[i + 1:] if _e_preco(w[4], sem_euro)]
        if precos and not any(w[4].startswith("(") and w[4].endswith("€)") for w in ws):
            out.append(l)
    return out


def _centros_dos_precos(pvrs: list[dict], sem_euro: bool = True) -> list[float]:
    def depois_do_pvr(ws):
        i = next((k for k, w in enumerate(ws) if w[4].upper().startswith("PVR")), -1)
        return ws[i + 1:]
    xs = sorted(_xc(w) for l in pvrs for w in depois_do_pvr(l["ws"])
                if _e_preco(w[4], sem_euro) or w[4] in ("-", "n/a"))
    centros: list[list[float]] = []
    for x in xs:
        if centros and x - centros[-1][-1] < 18:
            centros[-1].append(x)
        else:
            centros.append([x])
    return [median(c) for c in centros]


def _blocos(linhas: list[dict], inicio_rx: str = r"^(modelo|modelos)\b(?! lossnay)") -> list[list[dict]]:
    """Fichas da página: cada uma começa numa linha 'MODELO …'."""
    r = re.compile(inicio_rx)
    blocos: list[list[dict]] = []
    for k, l in enumerate(linhas):
        if r.search(_norm(l["texto"])):
            # Os modelos podem estar impressos um pouco acima do rótulo 'MODELO' (chillers).
            acima = [x for x in linhas[max(0, k - 2):k] if l["y"] - x["y"] <= 6]
            if blocos:
                blocos[-1] = [x for x in blocos[-1] if x not in acima]
            blocos.append([*acima, l])
        elif blocos:
            blocos[-1].append(l)
    return blocos


def _corte_notas(bloco: list[dict]) -> list[dict]:
    out = []
    for l in bloco:
        n = _norm(l["texto"])
        if re.match(r"^(notas?|referencias)\b", n) and out:
            break
        out.append(l)
    return out


# --- Specs das fichas ---------------------------------------------------------------

def _valor(g: Grelha, l: dict | None, i: int) -> str | None:
    return l["cel"].get(i) if l else None


def specs_split(g: Grelha, i: int) -> dict:
    """Specs de uma ficha de conjunto split (Doméstica, Mr. Slim) na coluna i."""
    c: dict[str, str | None] = {}
    caps = g.procurar(r"^capacidade nominal")
    frio = caps[0] if caps else None
    calor = caps[1] if len(caps) > 1 else None
    c["frio-kw"] = num(_valor(g, frio, i))
    c["calor-kw"] = num(_valor(g, calor, i))
    if frio:
        mm = g.primeira(r"^min-max", depois=frio["y"], antes=frio["y"] + 15)
        a = re.findall(r"\d+(?:[.,]\d+)?", _valor(g, mm, i) or "")
        if len(a) == 2:
            c["frio-kw-min"], c["frio-kw-max"] = num(a[0]), num(a[1])
    if calor:
        mm = g.primeira(r"^min-max", depois=calor["y"], antes=calor["y"] + 15)
        a = re.findall(r"\d+(?:[.,]\d+)?", _valor(g, mm, i) or "")
        if len(a) == 2:
            c["calor-kw-min"], c["calor-kw-max"] = num(a[0]), num(a[1])
    seer = g.primeira(r"^seer")
    scop = g.primeira(r"^scop")
    c["seer"] = num(_valor(g, seer, i))
    c["scop"] = num(_valor(g, scop, i))
    cf = g.primeira(r"categoria energetica", depois=seer["y"], antes=seer["y"] + 15) if seer else None
    cc = g.primeira(r"categoria energetica", depois=scop["y"], antes=scop["y"] + 15) if scop else None
    kf, kc = classe(_valor(g, cf, i)), classe(_valor(g, cc, i))
    if kf or kc:
        c["classe-energetica"] = f"{kf or '-'}/{kc or '-'}"
    dims = g.procurar(r"^dimensoes")
    if dims:
        c["dimensoes-ui"] = dimensoes(_valor(g, dims[0], i))
    if len(dims) > 1:
        c["dimensoes-ue"] = dimensoes(_valor(g, dims[-1], i))
    return c


def _refrigerante(texto: str) -> str | None:
    m = re.search(r"\bR-?(32|290|410A|513A|454B)\b", texto.upper().replace("R410a".upper(), "R410A"))
    return f"R{m.group(1)}" if m else None


# --- Leitores ------------------------------------------------------------------------

def ler_split(linhas: list[dict], pagina: int, opts: dict) -> list[dict]:
    out = []
    for bloco in _blocos(linhas):
        bloco = _corte_notas(bloco)
        pvrs = _linhas_pvr(bloco, sem_euro=True)
        if not pvrs:
            continue
        g = Grelha(bloco, _centros_dos_precos(pvrs))
        ui_l = g.primeira(r"^unidade interior")
        ue_l = g.primeira(r"^unidade exterior")
        alim_l = g.primeira(r"^alimentacao")
        refrig = _refrigerante(" ".join(l["texto"] for l in bloco)) or opts.get("refrigerante")
        for i in range(len(g.centros)):
            ui = _valor(g, ui_l, i)
            ue = _valor(g, ue_l, i)
            if not ui or not ue:
                continue
            specs = {**specs_gerais(g, i), **{k: v for k, v in specs_split(g, i).items() if v}}
            specs.pop("dimensoes", None) if specs.get("dimensoes-ui") else None
            specs["refrigerante"] = refrig
            for pl in pvrs:
                gl = next(x for x in g.linhas if x["y"] == pl["y"])
                cel = gl["cel"].get(i, "")
                tok = next((t for t in cel.split() if _e_preco(t, True)), None)
                if tok is None:
                    continue
                pvp = _preco_ou_sem_euro(tok)
                rot = gl["rotulo"]
                fluxo = re.search(r"\b(OVER|UNDER)\b", pl["texto"])     # s-MEXT: insuflação por cima/baixo
                for ref_ui, cor in _variantes_cor(ui, rot):
                    if fluxo:
                        ref_ui = f"{ref_ui} {fluxo.group(1)}"
                    alim = _alimentacao(rot, _valor(g, alim_l, i))
                    ref_ue = _ue_por_fase(re.sub(r"^(\d)x\s*", r"\1x ", ue), alim)
                    ref = f"{ref_ui}/{ref_ue}"
                    ctx = {k: v for k, v in (("cor", cor), ("alimentacao", alim)) if v}
                    out.append(linha(ref, series.seccao_de(ref, "conjunto", pagina), pagina, pl["y"],
                                     specs, pvp, refs=[ref_ui, ref_ue], componente="conjunto", contexto=ctx,
                                     impresso=None if preco(tok) is not None else tok))
    return out


CORES_LETRA = {"W": "branco", "R": "vermelho", "B": "preto", "V": "branco-perola", "S": "prateado"}
CORES_NOME = {"branco": "branco", "preto": "preto", "silver": "prateado", "prata": "prateado"}


def _variantes_cor(ui: str, rotulo: str) -> list[tuple[str, str | None]]:
    """'MSZ-LN25VG(R/B/V/W)' + rótulo 'PVR (VGR/VGB/VGV)' → [(MSZ-LN25VGR, vermelho), …]."""
    m = re.match(r"^(.+?)\(([A-Z/]+)\)$", ui.replace(" ", ""))
    if not m:
        return [(ui if ui.startswith("s-MEXT") else ui.replace(" ", ""), None)]
    base = m.group(1)
    letras = m.group(2).split("/")
    sufixos = re.search(r"\(([A-Z/]+)\)", rotulo.replace(" ", ""))
    if sufixos and not re.search(r"(?i)fasic", sufixos.group(1)):
        letras = [s[-1] for s in sufixos.group(1).split("/")]
    return [(base + l, CORES_LETRA.get(l)) for l in letras]


def _alimentacao(rotulo: str, alim: str | None) -> str | None:
    r = _norm(rotulo)
    if "trifasic" in r:
        return "trifasica"
    if "monofasic" in r:
        return "monofasica"
    a = _norm(alim or "")
    if "trifasic" in a and "monofasic" not in a:
        return "trifasica"
    if "monofasic" in a and "trifasic" not in a:
        return "monofasica"
    return None


def _ue_por_fase(ue: str, alim: str | None) -> str:
    """'PUZ-M100VKA/YKA' → PUZ-M100VKA (monofásica) | PUZ-M100YKA (trifásica)."""
    ue = ue.replace(" ", "")
    m = re.match(r"^(.+?)V\(Y\)(.+)$", ue)                       # 'PUZ-ZM100V(Y)DA'
    if m:
        return m.group(1) + ("Y" if alim == "trifasica" else "V") + m.group(2)
    m = re.match(r"^(.+?)([A-Z]{2,3}\d?)/([A-Z]{2,3}\d?)$", ue)       # 'PUZ-M100VKA2/YKA2'
    if not m:
        return ue
    return m.group(1) + (m.group(3) if alim == "trifasica" else m.group(2))


# --- Fichas com o modelo no cabeçalho (UE multi, depósitos, chillers, …) ----------------

ROTULO_SPECS = [
    # (regex no rótulo normalizado, chave, parser). A primeira linha que casa ganha.
    (r"^(consumo|potencia absorvida|eer|cop|caudal|nivel|pressao|temperatura|corrente|eficiencia|"
     r"fator|peso|seer|scop|gama)|temperatura|consumo|absorvida", None, None),
    (r"^(capac[a-z.]*|potencia)( nominal| total)? (de )?(arrefecimento|frio)|^frio nominal|^arrefecimento"
     r"|(arrefecimento|frio) nominal", "frio-kw", "num"),
    (r"^(capac[a-z.]*|potencia)( nominal| total)? (de )?(aquecimento|calor)|^calor nominal|^aquecimento"
     r"|(aquecimento|calor) nominal", "calor-kw", "num"),
]


def specs_gerais(g: Grelha, i: int) -> dict:
    """Specs comuns às fichas com o modelo no cabeçalho: kW de frio e calor,
    SEER/SCOP (e a classe entre parênteses), unidades interiores máx., dimensões."""
    c: dict[str, str | None] = {}
    for l in g.linhas:
        n, v = l["norm"], l["cel"].get(i)
        if not v or not n:
            continue
        if re.search(r"unidades interiores (max|de ar|conectaveis)|n. de unidades interiores", n) and "unidades-max" not in c:
            c["unidades-max"] = num(v)
            continue
        if re.match(r"^(coeficiente energetico )?seer ?/ ?scop", n):
            a = re.findall(r"\d+(?:[.,]\d+)?", v)
            if len(a) == 2:
                c.setdefault("seer", num(a[0]))
                c.setdefault("scop", num(a[1]))
            continue
        if re.match(r"^(coeficiente energetico )?seer", n) or re.match(r"^classe energetica seer", n):
            c.setdefault("seer", num(re.sub(r"\(.*?\)", "", v)) or num(re.search(r"\((.*?)\)", v).group(1)
                                                                        if "(" in v else None))
            if classe(v):
                c.setdefault("_classe-frio", classe(v))
            continue
        if re.match(r"^scop", n):
            c.setdefault("scop", num(v))
            if "(" in v and classe(re.search(r"\((.*?)\)", v).group(1)):
                c.setdefault("_classe-calor", classe(re.search(r"\((.*?)\)", v).group(1)))
            continue
        if re.match(r"^dimensoes", n) and "dimensoes" not in c:
            c["dimensoes"] = dimensoes(v)
            continue
        dep = re.fullmatch(r"(\d{2,4})\s*L(/\d+L)?", v.strip())      # '150L', TT '200L/60L' (AQS/inércia)
        if dep and "deposito-l" not in c:
            c["deposito-l"] = dep.group(1)
            continue
        if re.match(r"^(tamanho caudal nominal|caudal (de ar )?nominal|caudal de ar nominal|caudal maximo do ar)", n):
            c.setdefault("caudal-m3h", num_milhares(v.split()[0]))
            continue
        if re.match(r"^caudal para operacao", n):             # GUX '350~800' → o máximo
            c.setdefault("caudal-m3h", num_milhares(v.split("~")[-1].strip()))
            continue
        if n == "resistencia":                                   # Jet Towel: com/sem resistência
            c.setdefault("tipo", re.sub(r"\s+", " ", v.strip()).lower())
            continue
        if n == "cor":
            c.setdefault("cor", CORES_NOME.get(_norm(v)))
            continue
        if re.match(r"^(fonte de )?alimentacao", n) and "alimentacao" not in c:
            a = _norm(v)
            if re.search(r"trifas|3 fases|^400 ?3|/3/|3 n ?400", a):
                c["alimentacao"] = "trifasica"
            elif re.search(r"monofas|1 fase|^230 ?1|/1/", a):
                c["alimentacao"] = "monofasica"
            continue
        if re.search(r"classificacao energetica", n):          # MEHP-iB: a 1.ª é a de aquecimento A7/W35
            if classe(v):
                c.setdefault("_classe-calor", classe(v))
            continue
        if re.match(r"^capac[a-z.]* nominal aquecimento arrefecimento", n):      # MEHP-iB: '6,68 / 6,25'
            a = re.findall(r"\d+(?:[.,]\d+)?", v)
            if len(a) == 2:
                c.setdefault("calor-kw", num(a[0]))
                c.setdefault("frio-kw", num(a[1]))
            continue
        if re.match(r"^capacidade w\d\d|^potencia( kw)?$", n):     # Ecodan CAHV 'Capacidade W55ºC …', QAHV 'Potência'
            c.setdefault("calor-kw", num(v))
            continue
        for rx, chave, _p in ROTULO_SPECS:
            if re.search(rx, n):
                if chave and chave not in c:
                    c[chave] = num(v)
                break
    kf, kc = c.pop("_classe-frio", None), c.pop("_classe-calor", None)
    if kf or kc:
        c["classe-energetica"] = f"{kf or '-'}/{kc or '-'}"
    return c


def _modelos_da_linha(bloco: list[dict], g: Grelha, rx: str) -> dict[int, str]:
    """Modelo por coluna: a linha cujo rótulo casa `rx` mais as linhas de
    cabeçalho coladas (PUMY-SM imprime 'PUMY-SM' por cima de '112VKM')."""
    alvo = next((l for l in g.linhas if re.search(rx, l["norm"])), None)
    if alvo is None:
        return {}
    if len(alvo["cel"]) < len(g.centros) / 2:     # 'MODELO' centrado numa célula de duas linhas (chillers)
        perto = [l for l in g.linhas if abs(l["y"] - alvo["y"]) <= 12 and not l["norm"]
                 and sum(1 for v in l["cel"].values() if re.search(r"[A-Za-z]{2}.*\d|\d.*[A-Za-z]", v)) >= len(g.centros) / 2]
        if perto:
            alvo = min(perto, key=lambda l: abs(l["y"] - alvo["y"]))
    partes: dict[int, list[tuple[float, str]]] = defaultdict(list)
    for l in g.linhas:
        if abs(l["y"] - alvo["y"]) <= 9 and (l is alvo or not l["norm"] or l["norm"] == alvo["norm"]):
            for i, v in l["cel"].items():
                partes[i].append((l["y"], v))
    return {i: "".join(t for _y, t in sorted(v)) for i, v in partes.items()}


def ler_modelos(linhas: list[dict], pagina: int, opts: dict) -> list[dict]:
    out = []
    for bloco in _blocos(linhas, opts.get("inicio", r"^(modelo|modelos)\b(?! lossnay)")):
        bloco = _corte_notas(bloco)
        pvrs = _linhas_pvr(bloco, sem_euro=True)
        if opts.get("pvr"):
            pvrs = [l for l in pvrs if re.search(opts["pvr"], _norm(l["texto"]))]
        consulta = False
        if not pvrs:                                   # 'PVR Sob consulta' por coluna (GUX, CAHV)
            pvrs = [l for l in bloco if re.match(r"^pvr sob consulta", _norm(l["texto"]))]
            if not pvrs:
                continue
            consulta = True
            pvrs[0] = {**pvrs[0], "ws": [w for w in pvrs[0]["ws"] if w[4] != "PVR"]}
            centros = [_xc(w) for w in pvrs[0]["ws"] if w[4] == "Sob"]
            centros = [c + 15 for c in centros]
        else:
            centros = _centros_dos_precos(pvrs[:1])
        g = Grelha(bloco, centros)
        refs = _modelos_da_linha(bloco, g, opts.get("ref", r"^(modelo|modelos|referencia)\b"))
        refrig = _refrigerante(" ".join(l["texto"] for l in linhas)) or opts.get("refrigerante")
        if opts.get("pares"):                 # p125: cada 'PVR' tem a sua linha 'Referência' por cima
            for pl in pvrs:
                out.extend(_par_ref_pvr(g, pl, pagina, opts))
            continue
        pl = pvrs[0]
        gl = next(x for x in g.linhas if x["y"] == pl["y"])
        for i in range(len(g.centros)):
            ref = refs.get(i)
            tok = next((t for t in gl["cel"].get(i, "").split() if _e_preco(t, True)), None)
            if not ref or (tok is None and not consulta):
                continue
            ref = re.sub(r"\s*\(.*?\)\s*$", "", ref).strip().rstrip("*")    # 'JT-S2AP-W-NE (CAIXA METÁLICA)'
            specs = specs_gerais(g, i)
            specs["refrigerante"] = refrig
            if opts.get("descricao"):
                specs["descricao"] = opts["descricao"]
            comp = opts.get("componente", "unidade-exterior")
            l = linha(ref, series.seccao_de(ref, comp, pagina), pagina, pl["y"], specs,
                      _preco_ou_sem_euro(tok) if tok else None, componente=comp,
                      impresso=None if tok is None or preco(tok) is not None else tok)
            l["precoSobConsulta"] = consulta
            out.append(l)
    return out


def _par_ref_pvr(g: Grelha, pl: dict, pagina: int, opts: dict) -> list[dict]:
    """Depósitos de inércia: 'N.º DE LIGAÇÕES … 4' / 'Referência' / 'PVR' repetidos por variante."""
    gl = next(x for x in g.linhas if x["y"] == pl["y"])
    ref_l = max((x for x in g.procurar(r"^referencia") if x["y"] < pl["y"]), key=lambda x: x["y"], default=None)
    lig_l = max((x for x in g.procurar(r"de ligacoes") if ref_l and x["y"] < ref_l["y"]), key=lambda x: x["y"],
                default=None)
    ligacoes = num(" ".join(lig_l["cel"].values())) if lig_l else None
    out = []
    for i in range(len(g.centros)):
        ref = _valor(g, ref_l, i)
        tok = next((t for t in gl["cel"].get(i, "").split() if preco(t) is not None), None)
        if not ref or tok is None:
            continue
        specs = {**specs_gerais(g, i), "ligacoes": ligacoes}
        comp = opts.get("componente", "deposito")
        out.append(linha(ref, series.seccao_de(ref, comp, pagina), pagina, pl["y"], specs, preco(tok),
                         componente=comp))
    return out


def ler_rooftop(linhas: list[dict], pagina: int, opts: dict) -> list[dict]:
    """Rooftops WSM2: um modelo por coluna; cada linha 'WSM/AR - VERSÃO …' é uma
    versão com preço próprio → ref 'WSM2-052-AR'. 'n/a' = não existe."""
    out = []
    bloco = _corte_notas([l for l in linhas])
    pvrs = [l for l in _linhas_pvr(bloco) if re.match(r"^wsm", _norm(l["texto"]))]
    if not pvrs:
        return out
    g = Grelha([l for l in bloco if not re.match(r"^(precos|k200|controlador|interface|bateria|free|plane|"
                                                  r"controlo|pressostato|apoios)", _norm(l["texto"]))],
               _centros_dos_precos(pvrs))
    refs = _modelos_da_linha(bloco, g, r"^modelo\b")
    refrig = _refrigerante(" ".join(l["texto"] for l in linhas))
    for pl in pvrs:
        versao = re.match(r"WSM/([A-Z\-]+)", pl["texto"]).group(1)
        gl = next(x for x in g.linhas if x["y"] == pl["y"])
        for i, ref in refs.items():
            tok = next((t for t in gl["cel"].get(i, "").split() if preco(t) is not None), None)
            if tok is None:
                continue
            specs = specs_gerais(g, i)
            specs["refrigerante"] = refrig
            r = f"{ref}-{versao}"
            out.append(linha(r, series.seccao_de(r, "conjunto", pagina), pagina, pl["y"], specs, preco(tok),
                             componente="conjunto"))
    return out


# --- Matrizes de UI multi-split (classe de capacidade × série) ---------------------------

SERIE_RX = re.compile(r"^([A-Z]{2,4}-[A-Z]{0,2})(\(Y\))?##([A-Z]+)(\(([A-Z/]+)\))?(/[A-Z]+)?")


def _serie(token: str) -> dict | None:
    """'MSZ-LN##VG(W/R/B/V)*' → {pre: 'MSZ-LN', suf: 'VG', cores: [W,R,B,V]};
    'PCA-M##KA/HA*2' → alternativas KA, HA; 'MLZ-KP(Y)##VG' → MLZ-KP (KY nas notas)."""
    t = re.sub(r"\*+\d*$|\(\d\)$", "", token.strip())
    t = re.sub(r"\(\d\)", "", t).rstrip("*")
    m = SERIE_RX.match(t)
    if not m:
        return None
    alternativas = [m.group(3)] + ([m.group(6)[1:]] if m.group(6) else [])
    cores = m.group(5).split("/") if m.group(5) else []
    return {"pre": m.group(1), "sufixos": alternativas, "cores": cores, "texto": token}


def _celulas_matriz(l: dict, centros: list[float], passo: float) -> dict[int, str]:
    grupos: list[list] = []
    for w in l["ws"]:
        if _xc(w) < centros[0] - 0.6 * passo:
            continue
        if grupos and w[0] - grupos[-1][2] <= 4.5:
            a = grupos[-1]
            grupos[-1] = [a[0], a[1], w[2], a[3], f"{a[4]} {w[4]}"]
        else:
            grupos.append(list(w))
    out: dict[int, str] = {}
    for gr in grupos:
        i = min(range(len(centros)), key=lambda k: abs(centros[k] - _xc(gr)))
        if abs(centros[i] - _xc(gr)) <= 0.6 * passo:
            out[i] = f"{out[i]} {gr[4]}" if i in out else gr[4]
    return out


def ler_matriz(linhas: list[dict], pagina: int, opts: dict) -> list[dict]:
    comp = None                                # UI ou UE (p81), pela série da ref
    out = []
    # Cabeçalhos: linhas com padrões '##'; cada um vale até ao cabeçalho seguinte.
    cabecalhos = [l for l in linhas if any("##" in w[4] for w in l["ws"])]
    refrig_pagina = _refrigerante(" ".join(l["texto"] for l in linhas))
    for k, cab in enumerate(cabecalhos):
        fim = cabecalhos[k + 1]["y"] if k + 1 < len(cabecalhos) else 10_000
        if k + 1 < len(cabecalhos) and cabecalhos[k + 1]["y"] - cab["y"] < 12:
            continue                                          # cabeçalho em duas linhas (MSZ-HR)
        ws = [w for c in cabecalhos if 0 <= cab["y"] - c["y"] < 12 for w in c["ws"] if "##" in w[4]]
        cols = [(_xc(w), _serie(w[4])) for w in sorted(ws, key=lambda w: w[0])]
        cols = [(x, s) for x, s in cols if s]
        if not cols:
            continue
        centros = [x for x, _s in cols]
        passo = median([b - a for a, b in zip(centros, centros[1:])]) if len(centros) > 1 else 80
        corpo = [l for l in linhas if cab["y"] < l["y"] < fim]
        for j, l in enumerate(corpo):
            if not re.match(r"^(\d{2,3} )?pvr\b", _norm(l["texto"])):
                continue
            cls = re.match(r"^(\d{2,3})\b", l["texto"])
            if not cls:   # Mr. Slim: a classe vem numa linha à parte, entre a capacidade e o PVR
                perto = [x for x in corpo if abs(x["y"] - l["y"]) <= 9 and re.fullmatch(r"\d{2,3}", x["texto"])]
                cls = re.match(r"\d+", perto[0]["texto"]) if perto else None
            if not cls:
                continue
            classe_cap = cls.group(1) if cls.groups() else cls.group(0)
            precos = _celulas_matriz(l, centros, passo)
            cap_l = next((x for x in reversed(corpo[:j]) if _norm(x["texto"]).startswith("capacidade")
                          and l["y"] - x["y"] < 22), None)
            dim_l = next((x for x in corpo[j + 1:] if _norm(x["texto"]).startswith("dimensoes")
                          and x["y"] - l["y"] < 16), None)
            caps = _celulas_matriz(cap_l, centros, passo) if cap_l else {}
            dims = _celulas_matriz(dim_l, centros, passo) if dim_l else {}
            for i, cel in precos.items():
                serie = cols[i][1]
                toks = cel.split()
                valores = [preco(t) for t in re.split(r"[ /]", cel) if preco(t) is not None]
                if not valores:
                    continue
                nota = re.search(r"\(([A-Z]{3}-[A-Z0-9]+)\)", cel)            # '910€ (MLZ-KY20VG)'
                frio = calor = None
                a = re.findall(r"\d+(?:,\d+)?", caps.get(i, ""))
                if len(a) >= 2:
                    frio, calor = num(a[0]), num(a[1])
                specs = {"frio-kw": frio, "calor-kw": calor, "refrigerante": refrig_pagina,
                         "dimensoes": dimensoes(dims.get(i, "").replace(" ", ""))}
                if nota:
                    refs_precos = [(nota.group(1), valores[0], None)]
                elif serie["cores"]:
                    base = f"{serie['pre']}{classe_cap}{serie['sufixos'][0]}"
                    precos_cor = valores if len(valores) > 1 else valores * len(serie["cores"])
                    # 'W' primeiro ('570€ (VGW) / 670€ (VGR/B/V)'): o 1.º preço é o da 1.ª cor da nota.
                    rotulos = re.findall(r"\(VG[K]?([A-Z/]+)\)", cel.replace(" ", ""))
                    refs_precos = []
                    if len(valores) > 1 and rotulos:
                        for v, rot in zip(valores, rotulos):
                            for letra in rot.split("/"):
                                refs_precos.append((base + letra, v, CORES_LETRA.get(letra)))
                    else:
                        for letra, v in zip(serie["cores"], precos_cor):
                            refs_precos.append((base + letra, v, CORES_LETRA.get(letra)))
                elif len(serie["sufixos"]) > 1 and len(valores) == len(serie["sufixos"]):
                    refs_precos = [(f"{serie['pre']}{classe_cap}{suf}", v, None)
                                   for suf, v in zip(serie["sufixos"], valores)]
                else:
                    candidatos = [f"{serie['pre']}{classe_cap}{suf}" for suf in serie["sufixos"]]
                    refs_precos = [(_escolher(candidatos), valores[0], None)]
                for ref, v, cor in refs_precos:
                    ctx = {"cor": cor} if cor else {}
                    out.append(linha(ref, series.seccao_de(ref, comp, pagina), pagina, l["y"], specs, v,
                                     componente=comp, contexto=ctx))
    return out


REFS_CONHECIDAS: set[str] = set()


def _escolher(candidatos: list[str]) -> str:
    """'PKA-M35LAL/KAL': a ref que as fichas do PDF imprimem (LAL até 50, KAL acima)."""
    for c in candidatos:
        if c in REFS_CONHECIDAS:
            return c
    return candidatos[0]


# --- Listas de acessórios ---------------------------------------------------------------

def ler_lista(linhas: list[dict], pagina: int, opts: dict) -> list[dict]:
    """Listas com cabeçalho 'DESCRIÇÃO | MODELO | (COMPATIBILIDADE) | PVR' ou
    'Referência | Designação | PVR': a ref na coluna MODELO, o preço à direita na
    mesma linha (ou a ≤ 6 pt), a descrição na coluna da esquerda/direita."""
    x0, x1 = opts.get("x0", 0), opts.get("x1", 10_000)
    linhas = [{**l, "ws": [w for w in l["ws"] if x0 <= _xc(w) < x1]} for l in linhas]
    linhas = [{**l, "texto": " ".join(w[4] for w in l["ws"])} for l in linhas if l["ws"]]
    out = []
    cab = None
    ancoras = []
    for l in linhas:
        n = _norm(l["texto"])
        if re.search(r"\b(modelo|referencia)\b", n) and re.search(r"\bpvr\b", n):
            ws = {(_norm(w[4])): w for w in l["ws"]}
            col_ref = ws.get("modelo") or ws.get("referencia")
            col_desc = ws.get("descricao") or ws.get("designacao")
            col_compat = ws.get("compatibilidade")
            cab = {"y": l["y"], "ref": _xc(col_ref), "desc": col_desc, "compat": col_compat,
                   "pvr": _xc(ws.get("pvr"))}
            continue
        if cab is None:
            continue
        if opts.get("ref_x"):
            a, b = opts["ref_x"]
            refs = [w for w in l["ws"] if a <= _xc(w) < b and _parece_ref_lista(w[4], opts.get("numericas"))]
        else:
            refs = [w for w in l["ws"] if abs(_xc(w) - cab["ref"]) < 55
                    and _parece_ref_lista(w[4], opts.get("numericas"))]
        if refs:
            ancoras.append((l, refs[0], cab))
    for k, (l, wref, cab) in enumerate(ancoras):
        y_ant = (ancoras[k - 1][0]["y"] + l["y"]) / 2 if k and ancoras[k - 1][2] is cab else cab["y"] + 4
        y_seg = (ancoras[k + 1][0]["y"] + l["y"]) / 2 if k + 1 < len(ancoras) and ancoras[k + 1][2] is cab \
            else l["y"] + 14
        banda = [x for x in linhas if y_ant < x["y"] <= y_seg]
        pvp = None
        for x in sorted(banda, key=lambda x: abs(x["y"] - l["y"])):
            p = next((preco(w[4]) for w in x["ws"] if _xc(w) > cab["ref"] + 40 and preco(w[4]) is not None), None)
            if p is not None:
                pvp = p
                break
        consulta = pvp is None and any(re.search(r"(?i)sob\s+consulta", x["texto"]) for x in banda)
        if pvp is None and not consulta:
            continue
        esquerda = (bool(cab["desc"]) and _xc(cab["desc"]) < cab["ref"]) or opts.get("desc_esquerda", False)
        fim_desc = (_xc(cab["compat"]) - 50) if cab["compat"] is not None else cab["pvr"] - 30

        def na_desc(w, wref=wref, esquerda=esquerda, fim_desc=fim_desc):
            if preco(w[4]) is not None or w is wref or re.match(r"(?i)^sob$|^consulta", w[4]):
                return False
            if esquerda:
                return w[2] < wref[0] - 2
            return w[0] > wref[2] + 2 and _xc(w) < fim_desc

        # Subtítulos de grupo ('COMANDO E CONTROLO', 'Filtros simples G3…' mais à esquerda) ficam de fora.
        x_ini = min((w[0] for w in l["ws"] if na_desc(w)), default=None)
        desc_ws = []
        for x in banda:
            ws = [w for w in x["ws"] if na_desc(w)]
            if not ws:
                continue
            if x is not l:
                letras = "".join(ch for w in ws for ch in w[4] if ch.isalpha())
                if (x_ini is not None and ws[0][0] < x_ini - 6) or (letras.isupper() and len(ws) >= 2):
                    continue
            desc_ws.extend(ws)
        desc = " ".join(w[4] for w in sorted(desc_ws, key=lambda w: (round((w[1] + w[3]) / 2), w[0])))
        desc = re.split(r"\s*\bNOTAS?:", desc)[0]
        compat = ""
        if esquerda and cab["compat"] is not None:
            compat = " ".join(w[4] for x in banda for w in x["ws"]
                              if w[0] > wref[2] + 2 and _xc(w) < cab["pvr"] - 25 and preco(w[4]) is None)
        ref = _limpar_ref(wref[4])
        comp = opts.get("componente")
        desc = re.sub(r"\s+", " ", desc).strip(" -•")
        if compat:
            desc = f"{desc} (compatível com {compat.strip(' /')})"
        l2 = linha(ref, series.seccao_de(ref, comp or "acessorio", pagina), pagina, l["y"], {"descricao": desc},
                   pvp, componente=comp)
        l2["precoSobConsulta"] = consulta
        out.append(l2)
    return out


def _parece_ref_lista(t: str, numericas: bool = False) -> bool:
    t = t.rstrip("*")
    if numericas and re.fullmatch(r"\d{10}|A\d{3}", t):         # Climaveneta '5549097151', 'A104'
        return True
    return bool(re.fullmatch(r"[A-Z0-9][A-Za-z0-9\-/_.()]{4,}", t)) and bool(re.search(r"\d", t)) and \
        len(re.findall(r"[A-Z]", t)) >= 2 and preco(t) is None


def _limpar_ref(t: str) -> str:
    return t.rstrip("*").strip()


# --- Conjuntos Ecodan (UE e UI com preço próprio) -------------------------------------------

def ler_ecodan(linhas: list[dict], pagina: int, opts: dict) -> list[dict]:
    """'CAPACIDADE NOMINAL AQUEC./ARREF.' por coluna, linhas 'UNIDADE EXTERIOR' e
    'UNIDADE INTERIOR' com as refs, preços em 'PVR Unidade exterior' / 'Unidade
    interior' (o 'Conjunto' é a soma). Linhas de preço com uma ref no rótulo
    (Open Source: 'Controlador digital FTC7 PAC-IF081B-E') vendem essa ref."""
    out: list[dict] = []
    vistos: set[str] = set()
    for bloco in _blocos(linhas, r"^capacidade\b"):
        bloco = _corte_notas(bloco)
        precos = [l for l in bloco if sum(1 for w in l["ws"] if _e_preco(w[4], True)) >= 1
                  and not re.search(r"(?i)conjunto", l["texto"])]
        if not precos:
            continue
        g = Grelha(bloco, _centros_dos_precos([{"ws": [w for l in precos for w in l["ws"]]}]))
        ue_l = g.primeira(r"^unidade exterior")
        ui_l = g.primeira(r"^unidade interior")
        cap_l = g.primeira(r"^capacidade")
        alim_l = g.primeira(r"^alimentacao")
        dep = re.search(r"\b(\d{3})\s*L\b", " ".join(l["texto"] for l in bloco))     # '170L' na margem do quadro
        refrig = _refrigerante(" ".join(l["texto"] for l in linhas)) or opts.get("refrigerante")
        for pl in precos:
            gl = next(x for x in g.linhas if x["y"] == pl["y"])
            rot = gl["norm"]
            ref_rotulo = next((w[4] for w in pl["ws"] if _xc(w) < g.limite and _parece_ref(w[4])), None)
            for i, cel in gl["cel"].items():
                tok = next((t for t in cel.split() if _e_preco(t, True)), None)
                if tok is None:
                    continue
                if ref_rotulo:
                    ref, comp = ref_rotulo, "acessorio"
                elif "exterior" in rot:
                    ref, comp = _valor(g, ue_l, i), "unidade-exterior"
                elif "interior" in rot:
                    ref, comp = _valor(g, ui_l, i), "unidade-interior"
                else:
                    continue
                if not ref:
                    continue
                ref = ref.rstrip("*").replace(" ", "")
                if ref in vistos:
                    continue
                vistos.add(ref)
                campos: dict[str, str | None] = {"refrigerante": refrig if comp == "unidade-exterior" else None}
                if comp == "unidade-exterior":
                    a = re.findall(r"\d+(?:,\d+)?", _valor(g, cap_l, i) or "")
                    if a:
                        campos["calor-kw"] = num(a[0])
                    if len(a) > 1:
                        campos["frio-kw"] = num(a[1])
                    al = _norm(_valor(g, alim_l, i) or "")
                    campos["alimentacao"] = "trifasica" if "trif" in al else "monofasica" if "monof" in al else None
                elif comp == "unidade-interior" and dep:
                    campos["deposito-l"] = dep.group(1)
                if comp == "acessorio":
                    campos["descricao"] = re.sub(r"\s*" + re.escape(ref) + r".*", "", gl["rotulo"]).replace(
                        "PVR", "").strip()
                out.append(linha(ref, series.seccao_de(ref, comp, pagina), pagina, pl["y"], campos,
                                 _preco_ou_sem_euro(tok), componente=comp))
    return out


# --- Ventiloconvectores (uma linha por modelo, preços por versão) ----------------------------

VERSOES = {"VC": "vc", "VC V3V": "v3v", "V3V": "v3v", "COMPLETO": "completo", "VC COMPLETO": "completo",
           "SMART": "smart"}


def ler_fancoil(linhas: list[dict], pagina: int, opts: dict) -> list[dict]:
    out = []
    cab = None
    for k, l in enumerate(linhas):
        if re.match(r"^modelo\b", _norm(l["texto"])) or (l["texto"].startswith("PVR") and cab is None):
            # Rótulos das colunas de preço: palavras à direita (x > 450) das linhas do cabeçalho.
            ws = [w for x in linhas if abs(x["y"] - l["y"]) <= 9 for w in x["ws"] if w[0] > 440]
            cols: list[list] = []
            for w in sorted(ws, key=lambda w: _xc(w)):
                if cols and _xc(w) - cols[-1][-1][0] < 22:
                    cols[-1].append((_xc(w), w))
                else:
                    cols.append([(_xc(w), w)])
            rotulos = []
            for c in cols:
                palavras = [w[4] for _x, w in sorted(c, key=lambda t: (t[1][1], t[1][0])) if w[4] != "PVR"]
                rotulos.append((median(x for x, _w in c), " ".join(palavras)))
            cab = {"y": l["y"], "cols": rotulos}
            continue
        if cab is None or l["y"] - cab["y"] < 12:
            continue
        nome = [w for w in l["ws"] if w[0] < 115 and w[4] not in ("Motor", "AC", "DC")]
        if not nome or not re.match(r"^(i|a)?-?(LIFE|HWD|CXW|MXW)", nome[0][4]):
            if re.match(r"^notas", _norm(l["texto"])):
                cab = None
            continue
        modelo = re.sub(r"([A-Z])(\d{3,4})$", r"\1 \2", " ".join(w[4] for w in nome))   # 'DLIO402' colado
        resto = [w for w in l["ws"] if w[0] >= 115]
        cols = _colunas_fancoil(linhas, cab["y"])
        dims = [w for w in resto if w[0] < cols["frio"] - 40]

        def perto(w, chave):
            return min(cols, key=lambda k: abs(cols[k] - _xc(w))) == chave
        kws = [w for w in resto if re.fullmatch(r"\d+,\d+", w[4]) and _xc(w) > cols["frio"] - 40
               and (perto(w, "frio") or perto(w, "calor"))]
        caudal = [w for w in resto if "caudal" in cols and perto(w, "caudal") and preco(w[4]) is None
                  and _xc(w) > cols["frio"]]
        precos = [w for w in resto if preco(w[4]) is not None]
        d = dimensoes(" ".join(w[4] for w in dims))
        if d:                                   # impresso L x A x P → AxLxP
            lg, al, pr = d.split("x")
            d = f"{al}x{lg}x{pr}"
        frio = next((w for w in kws if perto(w, "frio")), None)
        calor = next((w for w in kws if perto(w, "calor")), None)
        campos = {"frio-kw": num(frio[4]) if frio else None, "calor-kw": num(calor[4]) if calor else None,
                  "caudal-m3h": num_milhares(caudal[0][4]) if caudal else None, "dimensoes": d,
                  "tubos": "4" if re.search(r"\b4T\b", modelo) else "2" if re.search(r"\b2T\b", modelo) else None}
        for w in precos:
            x, rot = min(cab["cols"], key=lambda c: abs(c[0] - _xc(w)))
            versao = VERSOES.get(rot.upper().strip())
            if versao is None:
                continue
            ref = f"{modelo} {versao.upper()}"           # 'a-LIFE3 2T DLIO 1002 V3V', como o catálogo
            out.append(linha(ref, series.seccao_de(modelo, "conjunto", pagina), pagina, l["y"],
                             {**campos, "versao": versao}, preco(w[4]), componente="conjunto"))
    return out


def _colunas_fancoil(linhas: list[dict], y_cab: float) -> dict[str, float]:
    """x das colunas ARREFECIMENTO / AQUECIMENTO / caudal MÁX. no cabeçalho (≤ 20 pt do MODELO)."""
    cols: dict[str, float] = {"frio": 247, "calor": 347}
    for l in linhas:
        if abs(l["y"] - y_cab) > 20:
            continue
        for w in l["ws"]:
            t = _norm(w[4])
            if t == "arrefecimento":
                cols["frio"] = _xc(w)
            elif t == "aquecimento":
                cols["calor"] = _xc(w)
            elif t.startswith("max"):
                cols["caudal"] = _xc(w) + 10
    return cols


# --- Comandos MELANS: preço numa caixa à direita, ref por baixo ---------------------------------

def ler_caixas(linhas: list[dict], pagina: int, opts: dict) -> list[dict]:
    """Cada caixa começa num título 'REF - Descrição' à esquerda; à direita, os
    preços com a ref (e uma nota) por baixo. Sem ref por baixo, vale a do título."""
    out = []
    titulos = [(l["y"], l["ws"][0][4], l["texto"]) for l in linhas
               if l["ws"][0][0] < 38 and _parece_ref_lista(l["ws"][0][4].split("(")[0])
               and re.search(r"\s[-–]\s", l["texto"])]
    for l in linhas:
        for w in l["ws"]:
            if w[0] < 480 or preco(w[4]) is None:
                continue
            titulo = max((t for t in titulos if t[0] < l["y"]), key=lambda t: t[0], default=None)
            abaixo = [x for x in linhas if 0 < x["y"] - l["y"] <= 14]
            ref = next((v[4].strip("()") for x in abaixo for v in x["ws"]
                        if v[0] >= 480 and _parece_ref_lista(v[4].strip("()"))), None)
            if ref is None and titulo:
                ref = titulo[1]
            if ref is None:
                continue
            ref = re.sub(r"\(.*", "", ref).rstrip("*")
            desc = re.split(r"\s[-–]\s", titulo[2], maxsplit=1)[1].rstrip("*") if titulo else ""
            out.append(linha(ref, series.seccao_de(ref, "comando", pagina), pagina, l["y"],
                             {"descricao": desc}, preco(w[4]), componente=opts.get("componente", "comando")))
    return out


def ler_fixo(linhas: list[dict], pagina: int, opts: dict) -> list[dict]:
    """Um produto avulso: a ref dada e o primeiro preço da região."""
    for l in linhas:
        p = next((preco(w[4].strip("()")) for w in l["ws"] if preco(w[4].strip("()")) is not None), None)
        if p is not None:
            ref = opts["ref"]
            return [linha(ref, series.seccao_de(ref, opts.get("componente", "acessorio"), pagina), pagina,
                          l["y"], {"descricao": opts.get("descricao")}, p, componente=opts.get("componente"))]
    return []


# Quadros com preço, por página (de cima para baixo). Páginas fora daqui não têm
# preços (apresentação, specs sem preço, tabelas de combinações, City Multi e IT
# Cooling "sob consulta" sem refs, condições gerais).
SPLIT = ("split", {})
PAGINAS: dict[int, list[tuple[str, dict]]] = {
    **{p: [SPLIT] for p in (9, 11, 13, 15, 17, 19, 21, 23, 25, 55, 57, 59, 60, 63, 65, 67, 68, 69, 71, 72, 73,
                            75, 76, 77, 79, 80, 182)},
    26: [("matriz", {"y1": 695}), ("lista", {"y0": 695})],
    27: [("modelos", {})],
    30: [("matriz", {"y1": 430}), ("lista", {"y0": 430, "ref_x": (430, 520), "desc_esquerda": True})],
    31: [("modelos", {})],
    34: [("matriz", {"y1": 620}), ("lista", {"y0": 620})],
    35: [("modelos", {"y1": 240}),
         ("modelos", {"y0": 240, "y1": 450, "componente": "acessorio",
                      "descricao": "Branch Box para unidades interiores Gama Doméstica e Mr.Slim (PUMY-SM)"})],
    36: [("matriz", {"y1": 690}), ("lista", {"y0": 690})],
    37: [("modelos", {})],
    38: [("modelos", {"y1": 300, "componente": "acessorio",
                      "descricao": "Branch Box para unidades interiores Gama Doméstica, Mr.Slim e Ecodan (PUMY-P/SP)"}),
         ("fixo", {"y0": 300, "y1": 400, "ref": "MSDD-50BR-E", "componente": "acessorio",
                   "descricao": "Tubo de distribuição para a PUMY ligar 2 caixas de derivação PAC-MK"}),
         ("lista", {"y0": 400, "ref_x": (130, 200), "componente": "unidade-interior"})],
    49: [("lista", {})],
    81: [("matriz", {})],                      # os kits de distribuição repetem-se na lista da p83
    83: [("lista", {})],
    **{p: [("ecodan", {})] for p in (94, 95, 100, 101, 103)},
    105: [("lista", {})],
    107: [("modelos", {"y1": 640, "componente": "conjunto"}), ("lista", {"y0": 640, "x1": 300}),
          ("lista", {"y0": 640, "x0": 300})],
    109: [("modelos", {"y1": 560, "inicio": r"^unidade exterior", "ref": r"^unidade exterior",
                       "componente": "conjunto"}),
          ("lista", {"y0": 560})],
    **{p: [("fancoil", {})] for p in (111, 112, 113, 114, 115, 116, 117)},
    118: [("lista", {"numericas": True})],
    119: [("lista", {"numericas": True})],
    **{p: [("modelos", {"inicio": r"^capacidade( de aqs inercia)? \d", "ref": r"^referencia",
                        "componente": "deposito", "pares": p == 125})]
       for p in (122, 123, 124, 125)},
    127: [("modelos", {"y1": 300, "componente": "conjunto"}), ("lista", {"y0": 300})],
    128: [("modelos", {"y1": 300, "componente": "conjunto"}), ("lista", {"y0": 300})],
    129: [("modelos", {"componente": "conjunto"})],
    130: [("lista", {})],
    131: [("modelos", {"componente": "conjunto"})],
    138: [("modelos", {"pvr": r"^mech", "componente": "conjunto"})],
    139: [("modelos", {"pvr": r"^mehp", "componente": "conjunto"})],
    **{p: [("modelos", {"pvr": r"^s ?airme pvr", "ref": r"^precos", "componente": "conjunto"})]
       for p in (162, 163, 164, 165, 166, 167)},
    174: [("rooftop", {})],
    175: [("rooftop", {})],
    181: [SPLIT],
    206: [("caixas", {})],
    207: [("lista", {"componente": "comando"})],
    208: [("caixas", {}),
          ("fixo", {"y0": 680, "y1": 690, "ref": "PAC-SC51KUA", "componente": "acessorio",
                    "descricao": "Fonte de alimentação para o controlador AT-50B"})],
    209: [("caixas", {})],
    210: [("lista", {"componente": "comando"})],
    211: [("lista", {"componente": "comando"})],
    215: [("modelos", {"componente": "conjunto"})],
    217: [("modelos", {"componente": "conjunto"})],
}
LEITORES = {"split": ler_split, "modelos": ler_modelos, "matriz": ler_matriz, "lista": ler_lista,
            "ecodan": ler_ecodan, "fancoil": ler_fancoil, "caixas": ler_caixas, "fixo": ler_fixo,
            "rooftop": ler_rooftop}

_cache: dict[tuple[int, int], list[dict]] = {}


def _conhecer(doc) -> None:
    """Refs das UI impressas nas fichas split (para escolher 'PKA-M##LAL/KAL' nas matrizes)."""
    if REFS_CONHECIDAS:
        return
    for numero, quadros in PAGINAS.items():
        if SPLIT in quadros:
            for l in ler_split(_linhas(_palavras(doc[numero - 1])), numero, {}):
                REFS_CONHECIDAS.update(l["refs"] or [])


def ler_pagina(page, numero: int) -> list[dict]:
    chave = (id(page.parent), numero)
    _conhecer(page.parent)
    if chave not in _cache:
        linhas = _linhas(_palavras(page))
        out: list[dict] = []
        for leitor, opts in PAGINAS.get(numero, []):
            ls = [l for l in linhas if opts.get("y0", 0) <= l["y"] < opts.get("y1", 10_000)]
            out.extend(LEITORES[leitor](ls, numero, opts))
        _cache[chave] = out
    return _cache[chave]


def extrair_pagina(page, seccoes: list[dict], numero: int) -> list[dict]:
    return ler_pagina(page, numero)

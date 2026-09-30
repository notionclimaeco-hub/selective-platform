#!/usr/bin/env python3
"""2. Extração de linhas: PDF + mapa.json → linhas-<secção>.json

    python3 extrair.py tabela.pdf --mapa mapa.json --seccao cassete-1x1
    python3 extrair.py tabela.pdf --mapa mapa.json --todas

Por página: palavras com coordenadas → bandas de 3 pt → linhas de tabela
(banda com referência + bandas coladas a ≤ 6 pt: preço que passou para a
linha seguinte, kW impressos debaixo da UE, descrição em várias linhas).
Cada campo sai com uma confiança: 1.0 forma inequívoca (EAN, preço, classe,
dimensões, tubagem, tensão), 0.8 atribuído pela coluna do cabeçalho, 0.6
por posição, 0.5 heurística (preço colado da banda seguinte).

As linhas de uma página vão para a secção cujo título está impresso mais
acima delas nessa página; nunca herdam a classificação da secção anterior.
Matrizes de compatibilidade (`tipo: compatibilidade`) dão `compativelCom`
na UE e linhas `conjunto` nas células com preço.

Com `--marca`, `marcas/<marca>/extrair.py` pode ler as páginas que o leitor
genérico não percebe: `extrair_pagina(page, seccoes, numero)` devolve as
linhas da página (mesmo formato) ou None para usar o leitor genérico.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

import pymupdf

from _comum import EAN_RX, e_ref, escrever_json, ler_json, parse_preco, parte_da_marca, slug
from mapa import normalizar, palavras_da_pagina, posicao_titulo, validar_mapa

DIST_COLAGEM = 6.0        # pt: banda de descrição colada antes da linha
DIST_CONTINUACAO = 9.0    # pt: banda sem ref colada depois da linha (preço, kW, descrição)
DIST_COLUNA = 45.0        # pt: distância máxima número ↔ centro da coluna

# --- Token shapes -------------------------------------------------------------

PRECO_TOKEN_RX = re.compile(r"^(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?€$")
# Preços com a pontuação trocada mas sem ambiguidade (Midea): "8,200,00€",
# "3,850.00€", "4.64000€". Leem-se e a linha leva aviso para confirmar.
PRECO_TORTO_RX = re.compile(r"^(\d{1,3}(?:,\d{3})+),(\d{2})€$|^(\d{1,3}(?:,\d{3})+)\.(\d{2})€$|^(\d{1,3})\.(\d{3})(\d{2})€$")
_DIM = r"\(?\d{1,3}(?:\.\d{3})?\d*(?:\+\d+)*\)?"     # "1.055" = milhares (Midea)
DIM_RX = re.compile(rf"^{_DIM}[x×]{_DIM}[x×]{_DIM}$")
FRACAO_RX = re.compile(r"\d(?:-\d)?/\d{1,2}")
FRAC_TOKEN_RX = re.compile(r"^-?\(?[\d\-]*\d/\d{1,2}\)?[”\"'’]*-?$")
TENSAO_RX = re.compile(r"^(\d{3})V?-(\d{3})V/\d{2,3}Hz$")
REFRIG_RX = re.compile(r"^R-?(32|290|410A|407C|134A|454B|454C|1234ZE)$", re.I)
BTU_RX = re.compile(r"^(\d{1,3})k$")
MULTI_RX = re.compile(r"^(\d)[x×]1$")
INTERVALO_RX = re.compile(r"^\((\d+(?:[.,]\d+)?)[-~](\d+(?:[.,]\d+)?)\)$")
FAIXA_RX = re.compile(r"^(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)$")    # "2.9-7.16" sem parênteses
NUMERO_PAR_RX = re.compile(r"^\((\d+(?:[.,]\d+)?)\)$")          # "9000 (2.63)": kW entre parênteses
QTD_RX = re.compile(r"^(\d)[x×]$")                               # "2x MCA4U-… + 1x MOX…" (Twin)
DIM_ROTULO = {"interior:": "dimensoes-ui", "exterior:": "dimensoes-ue", "painel:": None}
DIM_COLADA_RX = re.compile(r"^(.+?)\(?((?:Interior|Exterior|Painel):)$")   # "600x1.934x455(Exterior:"
NUMERO_RX = re.compile(r"^\d+(?:[.,]\d+)?$")
CLASSE_PAR_RX = re.compile(r"(?<![A-Za-z0-9\-])(A\+{0,3}|[B-G])\s*/\s*(A\+{0,3}|[B-G])(?![A-Z0-9+])")
CLASSE_TOKEN_RX = re.compile(r"^\(?[a-z]*(A\+{0,3}|[B-G])[a-z]*\.?\)?$|^/$")
GAMA_REFS_RX = re.compile(r"^\(?([A-Z]{2,5}\d{1,3}~\d{1,3})\)?$")
SOB_CONSULTA_RX = re.compile(r"(?i)pre[çc]os?\b[^.]{0,40}?sob(?:re)?\s+consulta")
NOTA_WIFI_RX = re.compile(r"(?i)wi-?fi\s+(opcional|inclu[íi]d[oa]|incorporado)")
KW_LABEL_RX = re.compile(r"^\d+(?:[.,]\d+)?$")

CATEGORIA_HINT = {
    "INTERIOR": "unidade-interior", "UI": "unidade-interior", "SPLIT": "unidade-interior",
    "INTEGRA": "unidade-interior", "HYDROBOX": "unidade-interior",
    "EXTERIOR": "unidade-exterior", "UE": "unidade-exterior",
    "ACESSÓRIOS": "acessorio", "ACESSORIOS": "acessorio",
}
# Words that hint the componente but also describe the product (stay in the text).
CATEGORIA_DESCRITIVA = {"PAINEL": "acessorio", "KIT": "acessorio"}
CATEGORIA_SEM_HINT = {"AEROTERMIA", "VENTILAÇÃO", "VENTILACAO", "CHILLER", "CHILLERS", "-", "–"}

# Words that only appear in column headers.
HEADER_WORDS = {
    "referencia", "modelo", "ean", "ean13", "capacidade", "arrefecimento", "aquecimento",
    "classe", "energetica", "dimensoes", "tubagem", "fluido", "frigorigeneo", "preco", "unit",
    "siva", "categoria", "tipo", "alimentacao", "eletrica", "descricao", "caudal", "cv",
    "deposito", "embalagem", "polegadas", "mm", "kw", "btuh", "m3h", "l", "lxaxp", "poleg",
    "com", "de", "do", "da", "o", "e", "n", "unidades", "interiores", "exterior", "unidade",
    "pvp", "seer", "scop", "linha", "liquido", "aspiracao", "polg", "net", "volume", "configuracao",
}
COLUNAS = {  # header word → column key; first occurrence wins
    "arrefecimento": "frio-kw", "aquecimento": "calor-kw", "deposito": "deposito-l",
    "caudal": "caudal-m3h", "cv": "cv", "descricao": "descricao", "capacidade": "btu", "volume": "deposito-l",
    "preco": "preco", "referencia": "ref", "modelo": "ref", "ean13": "ean", "ean": "ean",
    "classe": "classe-energetica", "fluido": "refrigerante", "alimentacao": "alimentacao",
    "tubagem": "tubagem", "dimensoes": "dimensoes", "categoria": "categoria", "tipo": "categoria",
}
COLUNAS_NUMERICAS = ("frio-kw", "calor-kw", "deposito-l", "caudal-m3h", "cv")

CORES = {"branco": "branco", "brancos": "branco", "preto": "preto", "pretos": "preto",
         "prateado": "prateado", "prata": "prateado", "cinzento": "cinzento", "inox": "inox",
         "vermelho": "vermelho", "branco-perola": "branco-perola"}
PRESSAO_RX = re.compile(r"(?i)\b(baixa|m[ée]dia|alta)\s+press[ãa]o")
ACRONIMOS = {"IR", "BPE", "UTA", "AQS", "VRF", "KNX", "DX", "PC", "LCD", "APP", "3D", "UV-C", "LED",
             "USB", "CV", "BTU", "BMS", "IOS", "AC", "DC", "II", "III", "HP", "TWIN", "TRIPLE",
             "ON", "OFF", "MODBUS", "BACNET", "R32", "R410A", "R290", "AVD", "ADT", "AVW", "HDHWT"}


# --- Bands --------------------------------------------------------------------

def bandas_da_pagina(page: pymupdf.Page) -> list[dict]:
    """[{y, palavras: [(x0, x1, texto)]}] ordenadas por y."""
    por_y: dict[int, list[tuple[float, float, str]]] = defaultdict(list)
    for x0, y0, x1, _y1, w in palavras_da_pagina(page):
        por_y[round(y0 / 3)].append((x0, x1, w))
    return [{"y": k * 3.0, "palavras": sorted(v)} for k, v in sorted(por_y.items())]


def _limpar_ref(token: str) -> str:
    """Tira o marcador de nota ('*') e passa a maiúsculas as refs impressas em
    minúsculas ('mmcs-12hrn8-qrd0', 'M40E-28hfn8-q'); 'MVi-252…' e '(At)' ficam."""
    t = token.rstrip("*").strip()
    return t.upper() if re.search(r"[a-z]{2}", t) else t


def chave_cabecalho(token: str) -> str:
    """'EAN-13' → 'ean13', '(BTU/h)' → 'btuh', 'energética*' → 'energetica'."""
    return re.sub(r"[^a-z0-9]", "", normalizar(token).replace(" ", ""))


def _tem_ref(banda: dict) -> bool:
    ancora = any(EAN_RX.match(t) for _a, _b, t in banda["palavras"]) or _tem_preco(banda)
    for _x0, _x1, t in banda["palavras"]:
        limpo = _limpar_ref(t)
        if not e_ref(limpo) or chave_cabecalho(t) in HEADER_WORDS:
            continue
        if re.search(r"\d", limpo) or ancora:  # "HI-NANO" só conta com EAN/preço ao lado
            return True
    return False


def _tem_preco(banda: dict) -> bool:
    return any(PRECO_TOKEN_RX.match(t.replace(" ", "")) or PRECO_TORTO_RX.match(t) or t == "€"
               for _x0, _x1, t in banda["palavras"])


def _preco(token: str) -> tuple[int | None, bool]:
    """(cêntimos, bem formatado) de uma célula de preço; (None, False) se não é preço."""
    t = token.replace(" ", "")
    if PRECO_TOKEN_RX.match(t):
        return parse_preco(t.replace("€", " €")), True
    m = PRECO_TORTO_RX.match(t)
    if not m:
        return None, False
    g = [x for x in m.groups() if x is not None]
    inteiro, cent = (g[0].replace(",", ""), g[1]) if len(g) == 2 else (g[0] + g[1], g[2])
    return int(inteiro) * 100 + int(cent), False


def _pares_conjunto(bandas: list[dict]) -> tuple[list[tuple[int, str]], set[tuple[float, float]]]:
    """'2x' + ref e '1x' + ref de um conjunto Twin, mesmo quando o PDF imprime a
    quantidade numa banda e a ref noutra (±6 pt). Devolve os pares por ordem de
    leitura e as posições (y, x0) consumidas."""
    toks = [(b["y"], x0, x1, t) for b in bandas for x0, x1, t in b["palavras"]]
    pares, usados = [], set()
    for y, x0, x1, t in sorted(toks):
        mq = QTD_RX.match(t)
        if not mq:
            continue
        cand = [(abs(y2 - y), a2, y2, _limpar_ref(t2)) for y2, a2, _b2, t2 in toks
                if 0 <= a2 - x1 <= 15 and abs(y2 - y) <= 6 and e_ref(_limpar_ref(t2))]
        if cand:
            _d, a2, y2, ref = min(cand)
            pares.append((int(mq.group(1)), ref))
            usados |= {(y, x0), (y2, a2)}
    return pares, usados


def _e_cabecalho(banda: dict) -> bool:
    palavras = [chave_cabecalho(t) for _x0, _x1, t in banda["palavras"]]
    palavras = [p for p in palavras if p]
    if not palavras:
        return False
    conhecidas = sum(1 for p in palavras if p in HEADER_WORDS or p.startswith("energetica"))
    return conhecidas / len(palavras) >= 0.5 and conhecidas >= 1


def _e_nota(banda: dict) -> bool:
    primeira = banda["palavras"][0][2]
    return primeira.startswith("*") or primeira.lower() in ("nota:", "notas:")


def _colunas_do_cabecalho(banda: dict, colunas: dict[str, float]) -> None:
    for x0, x1, t in banda["palavras"]:
        palavra = chave_cabecalho(t)
        chave = COLUNAS.get(palavra)
        # "Modelo Depósito | Volume do Depósito": a coluna dos litros é a do "Volume".
        if chave and (chave not in colunas or palavra == "volume"):
            colunas[chave] = (x0 + x1) / 2


def _subcabecalho(banda: dict, contexto: dict) -> bool:
    """Cor / pressão estática / série impressas entre linhas da tabela."""
    palavras = [t for _x0, _x1, t in banda["palavras"]]
    if not (1 <= len(palavras) <= 5) or _tem_ref(banda) or _tem_preco(banda):
        return False
    texto = " ".join(palavras)
    if any(EAN_RX.match(p) for p in palavras) or any(NUMERO_RX.match(p) for p in palavras):
        return False
    baixo = normalizar(texto)
    for p in baixo.split():
        if p in CORES:
            contexto["cor"] = CORES[p]
            return True
    m = PRESSAO_RX.search(texto)
    if m:
        contexto["pressao-estatica"] = {"baixa": "baixa", "media": "media", "alta": "alta"}[
            normalizar(m.group(1))]
        return True
    if re.search(r"(?i)\b(inverter|serie|série|gama|premium|standard|plus|pro)\b", texto):
        contexto["serie"] = " ".join(w.capitalize() for w in texto.split())
        return True
    return False


# --- Row parsing --------------------------------------------------------------

def _juntar_tokens(palavras: list[tuple[float, float, str]]) -> list[tuple[float, float, str]]:
    """Cola pedaços que o PDF parte: '1.450' '€', '(1,3' '-' '3,6)', '973×' '303×227',
    '1/4''' '-' '3/8''', 'A+++' '/' 'A+++'."""
    out: list[list] = []
    i = 0
    while i < len(palavras):
        x0, x1, t = palavras[i]
        if out and t == "€":
            if not out[-1][2].endswith("€"):
                out[-1][1], out[-1][2] = x1, out[-1][2] + "€"
        elif out and (t.startswith("×") or out[-1][2].endswith(("×", "x")) and re.match(r"^\d", t)
                      and re.search(r"\d[x×]$", out[-1][2] + "x")):
            out[-1][1], out[-1][2] = x1, out[-1][2] + t
        elif out and t == "/" or (out and out[-1][2] == "/" and CLASSE_TOKEN_RX.match(t)):
            out[-1][1], out[-1][2] = x1, out[-1][2] + t
        elif out and re.match(r"^\(\d", out[-1][2]) and ")" not in out[-1][2] and not out[-1][2].startswith("(1-"):
            out[-1][1], out[-1][2] = x1, out[-1][2] + t
        elif out and FRAC_TOKEN_RX.match(t) and (FRAC_TOKEN_RX.match(out[-1][2]) or out[-1][2] in ("-", "--")):
            out[-1][1], out[-1][2] = x1, out[-1][2] + t
        elif out and t in ("-", "--") and FRAC_TOKEN_RX.match(out[-1][2]) and i + 1 < len(palavras) \
                and FRAC_TOKEN_RX.match(palavras[i + 1][2]):
            out[-1][1], out[-1][2] = x1, out[-1][2] + t
        elif out and t == "-" and INTERVALO_RX.match(out[-1][2] + t + (palavras[i + 1][2] if i + 1 < len(palavras) else "")):
            out[-1][1], out[-1][2] = x1, out[-1][2] + t
        elif out and out[-1][2].endswith("-") and out[-1][2].startswith("(") and re.match(r"^\d", t):
            out[-1][1], out[-1][2] = x1, out[-1][2] + t
        else:
            out.append([x0, x1, t])
        i += 1
    return [(a, b, c) for a, b, c in out]


def _num(texto: str) -> str:
    return texto.replace(",", ".")


def _dimensoes(texto: str) -> str:
    def soma(m: re.Match) -> str:
        return str(sum(int(n) for n in m.group(0).strip("()").split("+")))
    t = re.sub(r"(\d)\.(\d{3})(?!\d)", r"\1\2", texto)       # 1.055 → 1055
    t = re.sub(r"\(\d+(?:\+\d+)+\)", soma, t)
    return t.replace("×", "x")


def _pre_leitura(tokens: list[tuple[float, float, str]], pre: dict,
                 acessorios: bool = False) -> list[tuple[float, float, str]]:
    """Consome as células que só se leem em sequência e devolve o resto:
    'SEER: 8.5 / A+++' e 'SCOP: 4.6 / A++' (seer, scop e as duas classes),
    'Ø 6.35' (o diâmetro em mm não é kW), '… x 2' (multiplicador do Twin),
    'Interior:/Exterior:/Painel:' + dimensões e '2x REF' (quantidades de um
    conjunto). '(2.63)' passa a número."""
    toks = []
    for x0, x1, t in tokens:
        m = DIM_COLADA_RX.match(t)
        if m and DIM_RX.match(m.group(1)):
            toks += [(x0, x1, m.group(1)), (x0, x1, m.group(2))]
        else:
            toks.append((x0, x1, t))
    out: list[tuple[float, float, str]] = []
    i = 0
    while i < len(toks):
        x0, x1, t = toks[i]
        prox = toks[i + 1][2] if i + 1 < len(toks) else ""
        if t in ("SEER:", "SCOP:"):
            chave = t[:-1].lower()
            j = i + 1
            while j < len(toks) and j <= i + 3:
                v = toks[j][2].rstrip("/")
                if NUMERO_RX.match(v) and chave not in pre:
                    pre[chave] = _num(v)
                elif re.fullmatch(r"A\+{0,3}|[B-G]", v):
                    pre[f"classe-{chave}"] = v
                elif toks[j][2] != "/":
                    break
                j += 1
            i = j
            continue
        if t == "Ø" and NUMERO_RX.match(prox):
            i += 2
            continue
        if t in ("x", "×") and re.fullmatch(r"\d", prox):
            pre.setdefault("multiplicador", int(prox))
            i += 2
            continue
        if t.lower() in DIM_ROTULO:
            if DIM_RX.match(prox.replace(" ", "")):
                chave = DIM_ROTULO[t.lower()]
                if chave:
                    pre.setdefault(chave, _dimensoes(prox))
                i += 2
            else:
                i += 1                       # "Exterior:" sem medida não é a categoria da linha
            continue
        if NUMERO_RX.match(t) and prox == "L" and "deposito-l" not in pre:
            pre["deposito-l"] = (x0, _num(t))
            i += 2
            continue
        mq = QTD_RX.match(t)
        if mq and not acessorios and e_ref(_limpar_ref(prox)):
            pre.setdefault("conjunto", []).append((int(mq.group(1)), _limpar_ref(prox)))
            i += 2
            continue
        if mq or t == "+":
            i += 1
            continue
        mp = NUMERO_PAR_RX.match(t)
        out.append((x0, x1, mp.group(1) if mp else t))
        i += 1
    return out


def _escalar(valor: str, n: int) -> str:
    v = round(float(valor) * n, 2)
    return str(int(v)) if v == int(v) and "." not in valor else f"{v:.2f}".rstrip("0").rstrip(".")


def frase(texto: str) -> str:
    """Descrição em maiúsculas → frase (acrónimos e códigos com dígitos mantêm-se)."""
    t = re.sub(r"\s+", " ", texto).strip()
    letras = [c for c in t if c.isalpha()]
    if not letras or sum(c.isupper() for c in letras) / len(letras) < 0.8:
        return t
    palavras = []
    for w in t.split():
        nu = w.strip("(),.;:")
        if nu.upper() in ACRONIMOS or re.search(r"\d", nu) or (len(nu) <= 2 and nu.isupper() and nu.isalpha() and nu in ACRONIMOS):
            palavras.append(w)
        else:
            palavras.append(w.lower())
    s = " ".join(palavras)
    return s[0].upper() + s[1:]


def _linha_de_bandas(bandas: list[dict], colunas: dict[str, float], pagina: int,
                     acessorios: bool = False) -> dict | None:
    """Uma linha de tabela a partir da banda com ref + bandas coladas."""
    campos: dict[str, str] = {}
    conf: dict[str, float] = {}
    ref_banda = next(b for b in bandas if _tem_ref(b))
    pre: dict = {}
    pares, usados = ([], set()) if acessorios else _pares_conjunto(bandas)
    if len(pares) >= 2:
        pre["conjunto"] = pares
        bandas = [{"y": b["y"], "palavras": [p for p in b["palavras"] if (b["y"], p[0]) not in usados]}
                  for b in bandas]
        ref_banda = next((b for b in bandas if b["y"] == ref_banda["y"]), ref_banda)
    tokens = _pre_leitura(_juntar_tokens(ref_banda["palavras"]), pre, acessorios)
    coladas = [b for b in bandas if b is not ref_banda]
    extra = [tok for b in coladas for tok in _pre_leitura(_juntar_tokens(b["palavras"]), pre, acessorios)]

    refs: list[str] = []
    marcador = 0
    prefixo: list[str] = []
    residual: list[tuple[float, str]] = []
    hint: str | None = None
    numeros: list[tuple[float, str, int]] = []
    intervalos: list[tuple[float, str, str]] = []
    precos: list[tuple[float, int, float]] = []   # (x, cents, confiança)
    dims: list[str] = []
    tortos: list[str] = []
    refs_x: list[float] = []
    ean: str | None = None
    texto_tokens: list[str] = []

    def classificar(x0: float, x1: float, t: str, colado: bool) -> None:
        nonlocal ean, hint
        texto_tokens.append(t)
        tt = t.replace(" ", "")
        limpo = _limpar_ref(t)
        if not refs and not e_ref(limpo) and not EAN_RX.match(tt) and not MULTI_RX.match(tt) \
                and not REFRIG_RX.match(tt) and not TENSAO_RX.match(tt):
            # antes da ref: categoria / prefixo descritivo
            up = normalizar(t).upper().replace(" ", "")
            if up in CATEGORIA_HINT:
                if hint is None:
                    hint = CATEGORIA_HINT[up]
            elif up not in CATEGORIA_SEM_HINT and up:
                if up in CATEGORIA_DESCRITIVA and hint is None:
                    hint = CATEGORIA_DESCRITIVA[up]
                prefixo.append(t)
            return
        if e_ref(limpo) and not colado and (not refs or not (numeros or ean or precos)):
            nonlocal marcador
            marcador = max(marcador, len(t) - len(t.rstrip("*")))
            refs_x.append(x0)
            partes = [p for p in re.split(r"/(?=[A-Z])", limpo) if p]
            if len(partes) > 1 and not acessorios and all(
                    e_ref(p) and len(p) >= 6 and re.search(r"\d", p) for p in partes):
                refs.extend(partes)
            elif limpo.endswith("/"):
                refs.append(limpo.rstrip("/"))
            else:
                refs.append(limpo)
            return
        if t == "/" and refs and not (numeros or ean or precos):
            return
        if EAN_RX.match(tt):
            ean = ean or tt
            return
        cents, bem = _preco(tt)
        if cents is not None:
            precos.append((x0, cents, 0.5 if colado or not bem else 1.0))
            if not bem:
                tortos.append(tt)
            return
        if DIM_RX.match(tt):
            dims.append(_dimensoes(tt))
            return
        if FRAC_TOKEN_RX.match(tt) or (tt.count("/") >= 1 and FRACAO_RX.search(tt) and re.search(r"[”\"'’]", tt)):
            fracs = FRACAO_RX.findall(tt)
            if fracs:
                atuais = campos["tubagem"].split("-") if "tubagem" in campos else []
                campos["tubagem"], conf["tubagem"] = "-".join((atuais + fracs)[:2]), 1.0
                return
        mt = TENSAO_RX.match(tt)
        if mt:
            campos["alimentacao"] = "trifasica" if int(mt.group(1)) >= 380 else "monofasica"
            conf["alimentacao"] = 1.0
            return
        if REFRIG_RX.match(tt):
            campos["refrigerante"], conf["refrigerante"] = tt.upper().replace("-", ""), 1.0
            return
        mb = BTU_RX.match(tt)
        if mb:
            campos["btu"], conf["btu"] = str(int(mb.group(1)) * 1000), 1.0
            return
        mm = MULTI_RX.match(tt)
        if mm:
            campos["unidades-max"], conf["unidades-max"] = mm.group(1), 1.0
            hint = hint or "unidade-exterior"
            return
        mf = FAIXA_RX.match(tt)
        if mf and not acessorios and float(_num(mf.group(1))) < float(_num(mf.group(2))):
            # "2.9-7.16" numa coluna de kW: o máximo é o valor, a faixa vai para mín/máx
            numeros.append((x0, _num(mf.group(2)), len(texto_tokens) - 1))
            intervalos.append((x0, _num(mf.group(1)), _num(mf.group(2))))
            return
        mi = INTERVALO_RX.match(tt)
        if mi:
            intervalos.append((x0, _num(mi.group(1)), _num(mi.group(2))))
            return
        mg = GAMA_REFS_RX.match(tt)
        if mg and refs:
            campos["compativel-com"], conf["compativel-com"] = mg.group(1), 1.0
            return
        if NUMERO_RX.match(tt) and not re.match(r"^\d{1,3}\.\d{3}$", tt):
            numeros.append((x0, _num(tt), len(texto_tokens) - 1))
            return
        up = normalizar(t).upper().replace(" ", "")
        # "(U.I.)" a seguir à tubagem é uma nota da coluna, não a categoria da linha.
        if up in CATEGORIA_HINT and not t.startswith("("):
            if hint is None:
                hint = CATEGORIA_HINT[up]
            return
        if t in ("-", "–") and refs and not colado:
            numeros.append((x0, None, len(texto_tokens) - 1))   # célula vazia: ocupa a posição
            return
        if t in ("-", "–", "x", "X", "✓") or up in CATEGORIA_SEM_HINT:
            return
        residual.append((len(texto_tokens) - 1, t))

    conjunto = pre.get("conjunto") or []
    if len(conjunto) >= 2:                  # "2x UI + 1x UE": as refs vêm da pré-leitura
        refs.extend(r for _q, r in conjunto)
    for x0, x1, t in tokens:
        classificar(x0, x1, t, False)
    for x0, x1, t in extra:
        classificar(x0, x1, t, True)

    if not refs:
        return None
    for chave in ("seer", "scop", "dimensoes-ui", "dimensoes-ue"):
        if chave in pre:
            campos[chave], conf[chave] = pre[chave], 1.0
    if "deposito-l" in pre and "deposito-l" not in campos:
        campos["deposito-l"], conf["deposito-l"] = pre["deposito-l"][1], 1.0

    # Classe energética: regex sobre o texto (o PDF cola lixo: "(po A++ / A+leg.)").
    texto = " ".join(texto_tokens)
    mc = CLASSE_PAR_RX.search(texto)
    if "classe-seer" in pre or "classe-scop" in pre:      # "SEER: 8.5 / A+++" + "SCOP: 4.6 / A++"
        campos["classe-energetica"] = f"{pre.get('classe-seer', '-')}/{pre.get('classe-scop', '-')}"
        conf["classe-energetica"] = 1.0
    elif mc:
        campos["classe-energetica"], conf["classe-energetica"] = f"{mc.group(1)}/{mc.group(2)}", 1.0
        residual[:] = [(x, t) for x, t in residual if not CLASSE_TOKEN_RX.match(t) and not (
            "/" in t and CLASSE_PAR_RX.search(t))]
    elif "frio-kw" in campos or "btu" in campos:
        # classe única ("A" nos portáteis) → só frio; só em linhas de equipamento
        for x, t in list(residual):
            if re.fullmatch(r"A\+{0,3}|[B-G]", t):
                campos["classe-energetica"], conf["classe-energetica"] = f"{t}/-", 0.6
                residual.remove((x, t))
                break

    if dims:  # a segunda é a embalagem: não interessa ao catálogo
        campos["dimensoes"], conf["dimensoes"] = dims[0], 1.0

    # Números: pela coluna do cabeçalho, senão por posição (frio, calor). Em
    # tabelas de acessórios os números são texto da descrição ("até 8 CV").
    livres = []
    for x, valor, seq in numeros:
        chave = None
        if valor is None:
            livres.append((x, None, seq))
            continue
        if not acessorios and "." not in valor and int(valor) >= 1000:
            # "9000 (2.63)" / "9000 (2900~11200)": BTU/h na coluna do kW. O de
            # arrefecimento é a spec `btu`; o de aquecimento não tem chave.
            perto = min(((abs(colunas[c] - x), c) for c in ("frio-kw", "calor-kw") if c in colunas),
                        default=(0.0, "frio-kw"))
            if perto[1] == "frio-kw" and "btu" not in campos:
                campos["btu"], conf["btu"] = valor, 0.8
            continue
        if colunas:
            cand = [(abs(colunas[c] - x), c) for c in COLUNAS_NUMERICAS if c in colunas]
            cand.sort()
            if cand and cand[0][0] <= DIST_COLUNA and cand[0][1] not in campos:
                chave = cand[0][1]
        if chave:
            campos[chave], conf[chave] = valor, 0.8
        else:
            livres.append((x, valor, seq))
    if not acessorios:
        decimais = [(x, v, seq) for x, v, seq in livres if v is None or "." in v]
        for chave, (x, v, seq) in zip(("frio-kw", "calor-kw"), decimais):
            if v is not None and chave not in campos:
                campos[chave], conf[chave] = v, 0.6
            livres = [l for l in livres if l[2] != seq]
    for _x, v, seq in livres:
        if v is not None:
            residual.append((seq, v.replace(".", ",")))

    # Intervalos (mín-máx) pertencem ao kW impresso imediatamente à esquerda.
    posicoes = {k: None for k in ("frio-kw", "calor-kw")}
    for x, v, _seq in numeros:
        if v is None:
            continue
        for k in posicoes:
            if campos.get(k) == v and posicoes[k] is None:
                posicoes[k] = x
    ordem = [k for k in ("frio-kw", "calor-kw") if k in campos]
    intervalos = [iv for iv in intervalos if float(iv[1]) < 1000]    # intervalos em BTU/h
    for i, (x, a, b) in enumerate(intervalos):
        chave = None
        cand = [(x - posicoes[k], k) for k in ordem if posicoes[k] is not None and 0 <= x - posicoes[k] <= 70]
        if cand:
            chave = min(cand)[1]
        elif i < len(ordem):
            chave = ordem[i]
        if chave:
            campos[f"{chave}-min"], campos[f"{chave}-max"] = a, b
            conf[f"{chave}-min"] = conf[f"{chave}-max"] = 0.8

    # Preço: o mais à direita; vários preços ficam registados para a revisão.
    pvp = None
    pvp_conf = None
    if precos:
        precos.sort()
        pvp, pvp_conf = precos[-1][1], precos[-1][2]
        conf["pvpCents"] = pvp_conf

    # Descrição: prefixo descritivo + texto residual (por ordem de leitura).
    descricao_partes = [" ".join(prefixo)] if prefixo else []
    if residual:
        descricao_partes.append(" ".join(t for _seq, t in sorted(residual)))
    descricao = frase(" ".join(p for p in descricao_partes if p).strip(" -–"))
    if descricao and (len(descricao.split()) >= 2 or prefixo):
        campos["descricao"], conf["descricao"] = descricao, 0.8
    if hint is None and prefixo and re.search(r"(?i)\b(painel|kit|sensor|filtro|cabo|controlador)\b", " ".join(prefixo)):
        hint = "acessorio"

    ref = "/".join(refs)
    if len(conjunto) >= 2:
        # "2X-UI+UE" (o formato que o catálogo já usa): a quantidade de UI vai
        # na ref e as capacidades impressas por UI ("3.52 x 2") passam a totais.
        ref = "+".join(f"{q}X-{r}" if q > 1 else r for q, r in conjunto)
        n = conjunto[0][0]
        if pre.get("multiplicador") == n and n > 1:
            for k in ("frio-kw", "calor-kw", "btu", "frio-kw-min", "frio-kw-max", "calor-kw-min", "calor-kw-max"):
                if k in campos:
                    campos[k] = _escalar(campos[k], n)
    if len(refs) > 1:
        hint = "conjunto"
    return {
        "ref": ref, "refs": refs if len(refs) > 1 else None, "ean": ean, "pagina": pagina,
        "pdfPaginas": [pagina], "y": ref_banda["y"], "texto": texto, "campos": campos,
        "confianca": conf, "componenteHint": hint, "pvpCents": pvp,
        "numPrecos": len(precos), "precos": [c for _x, c, _conf in precos], "marcadorRef": marcador,
        "precoImpresso": tortos[-1] if tortos and pvp is not None else None,
        "refsX": refs_x, "litrosX": pre["deposito-l"][0] if "deposito-l" in pre else None,
    }


# --- Compatibility matrix -----------------------------------------------------

def _matriz(bandas: list[dict], pagina: int) -> list[dict]:
    colunas: list[tuple[float, str]] = []
    linhas: list[dict] = []
    for banda in bandas:
        toks = _juntar_tokens(banda["palavras"])
        if not colunas:
            # cabeçalho: ≥ 2 rótulos de coluna (refs ou "2,5 kW")
            rotulos = []
            i = 0
            while i < len(toks):
                x0, x1, t = toks[i]
                if KW_LABEL_RX.match(t) and i + 1 < len(toks) and toks[i + 1][2].lower() == "kw":
                    rotulos.append(((x0 + toks[i + 1][1]) / 2, f"UI {_num(t)} kW"))
                    i += 2
                    continue
                if e_ref(_limpar_ref(t)):
                    rotulos.append(((x0 + x1) / 2, _limpar_ref(t)))
                i += 1
            if len(rotulos) >= 2:
                colunas = rotulos
            continue
        if not toks or not e_ref(_limpar_ref(toks[0][2])):
            continue
        ue = _limpar_ref(toks[0][2])
        compat: list[str] = []
        conjuntos: list[dict] = []
        campos: dict[str, str] = {}
        for x0, x1, t in toks[1:]:
            xm = (x0 + x1) / 2
            if re.fullmatch(r"\d", t) and xm < colunas[0][0] - 20:
                campos["unidades-max"] = t
                continue
            coluna = min(colunas, key=lambda c: abs(c[0] - xm))
            if abs(coluna[0] - xm) > 60:
                continue
            if t in ("x", "X", "✓", "•", "●"):
                if coluna[1] not in compat:
                    compat.append(coluna[1])
            elif PRECO_TOKEN_RX.match(t.replace(" ", "")):
                cents = parse_preco(t.replace("€", " €"))
                if coluna[1] not in compat:
                    compat.append(coluna[1])
                conjuntos.append({
                    "ref": f"{ue}/{coluna[1]}", "refs": [ue, coluna[1]], "ean": None,
                    "pagina": pagina, "pdfPaginas": [pagina], "y": banda["y"], "texto": f"{ue} × {coluna[1]}",
                    "campos": {}, "confianca": {"pvpCents": 1.0}, "componenteHint": "conjunto",
                    "pvpCents": cents, "numPrecos": 1,
                })
        linhas.append({
            "ref": ue, "refs": None, "ean": None, "pagina": pagina, "pdfPaginas": [pagina],
            "y": banda["y"], "texto": " ".join(t for _a, _b, t in toks), "campos": campos,
            "confianca": {k: 1.0 for k in campos}, "componenteHint": "unidade-exterior",
            "pvpCents": None, "numPrecos": 0, "compativelCom": compat, "soCompatibilidade": True,
        })
        linhas.extend(conjuntos)
    return linhas


# --- Model columns ------------------------------------------------------------
# Tabelas com um modelo por coluna (Midea: M-Thermal, ventiloconvectores, VRF,
# chillers): "Modelo" à esquerda com as refs na mesma linha, depois uma linha
# por spec ("Arrefecimento (kW)", "Caudal de ar (m³/h)", …) e "PVP".

DIST_LINHA_TRANSPOSTA = 7.0   # pt: bandas coladas formam uma linha da tabela
ROTULOS_TRANSPOSTA = (("modelo", "modelo"), ("pvp", "preco"), ("arrefecimento", "frio-kw"),
                      ("aquecimento", "calor-kw"), ("caudal", "caudal-m3h"), ("volume", "deposito-l"),
                      ("deposito", "deposito-l"))


def _refs_a_direita(banda: dict, x: float) -> list[str]:
    return [t for x0, _x1, t in banda["palavras"] if x0 > x and e_ref(_limpar_ref(t))]


def _e_transposta(regiao: list[dict]) -> bool:
    for b in regiao:
        x0, x1, t = b["palavras"][0]
        if chave_cabecalho(t) != "modelo":
            continue
        if any(_refs_a_direita(c, x1) for c in regiao if abs(c["y"] - b["y"]) <= 6):
            return True
    return False


def _valor_kw(texto: str) -> tuple[str | None, str | None]:
    """'25.2' → kW; '12000 (3.5)' → (kW, BTU/h); '2.65/2.23/1.68' (alta/média/
    baixa) → a primeira."""
    m = re.fullmatch(r"(\d{4,6})\s*\((\d+(?:[.,]\d+)?)\)", texto)
    if m:
        return _num(m.group(2)), m.group(1)
    m = re.fullmatch(r"(\d+(?:[.,]\d+)?)(?:/\d+(?:[.,]\d+)?)*", texto)
    return (_num(m.group(1)), None) if m else (None, None)


def _tabela_transposta(regiao: list[dict], pagina: int, acessorios: bool = False,
                       altura: float = 842.0) -> tuple[list[dict], list[str]]:
    """Linhas (uma por ref) e notas de uma região com tabelas de modelos em coluna."""
    logicas: list[list[dict]] = []
    for b in regiao:
        if b["y"] > altura - 30:          # rodapé ("TABELA DE PREÇOS … 23")
            continue
        if logicas and b["y"] - logicas[-1][-1]["y"] <= DIST_LINHA_TRANSPOSTA:
            logicas[-1].append(b)
        else:
            logicas.append([b])

    notas: list[str] = []
    blocos: list[dict] = []
    ultima_nota: float | None = None
    for grupo in logicas:
        palavras = sorted((p for b in grupo for p in b["palavras"]), key=lambda p: p[0])
        y = grupo[0]["y"]
        texto = " ".join(t for _a, _b, t in palavras)
        if _e_nota({"palavras": palavras}) or (ultima_nota is not None and y - ultima_nota <= 14
                                               and not any(_refs_a_direita(b, 0) for b in grupo)):
            if ultima_nota is not None and not _e_nota({"palavras": palavras}):
                notas[-1] += " " + texto
            else:
                notas.append(texto)
            ultima_nota = y
            continue
        ultima_nota = None
        primeira = chave_cabecalho(palavras[0][2])
        refs_x = [x0 for b in grupo for x0, _x1, t in b["palavras"] if x0 > palavras[0][1] and e_ref(_limpar_ref(t))]
        if primeira == "modelo" and refs_x:
            if not blocos or blocos[-1]["linhas"]:
                # Rótulos e valores separam-se a meio caminho entre o fim do rótulo
                # e a primeira ref (a coluna de valores começa às vezes antes da ref).
                fim_rotulo = max((x1 for x0, x1, t in palavras if x0 < min(refs_x)), default=min(refs_x))
                blocos.append({"limite": (fim_rotulo + min(refs_x)) / 2, "modelos": [], "linhas": []})
            limite = blocos[-1]["limite"]
            # Refs partidas em duas linhas ("MKT3-" / "V200G12-CL") juntam-se por coluna.
            colunas: list[list[tuple[float, float, str]]] = []
            for b in grupo:
                for x0, x1, t in b["palavras"]:
                    if x0 < limite or re.fullmatch(r"\([A-Z]+\)", t):
                        continue
                    xc = (x0 + x1) / 2
                    col = next((c for c in colunas if abs((c[0][0] + c[0][1]) / 2 - xc) <= 20), None)
                    if col is None:
                        colunas.append([(x0, x1, t)])
                    else:
                        col.append((x0, x1, t))
            modelo = []
            for col in sorted(colunas, key=lambda c: c[0][0]):
                ref = col[0][2]
                for _x0, _x1, t in col[1:]:
                    if ref.endswith("-"):
                        ref += t
                xc = sum((a + b) / 2 for a, b, _t in col) / len(col)
                if e_ref(_limpar_ref(ref)):
                    modelo.append((xc, ref))
            blocos[-1]["modelos"].append({"y": y, "refs": modelo})
            continue
        if not blocos:
            continue
        limite = blocos[-1]["limite"]
        rotulo = " ".join(t for x0, _x1, t in palavras if x0 < limite)
        valores = [(x0, x1, t) for x0, x1, t in palavras if x0 >= limite]
        if not valores:
            continue
        chave = next((k for w, k in ROTULOS_TRANSPOSTA if w in normalizar(rotulo).split()), None)
        blocos[-1]["linhas"].append({"chave": chave, "rotulo": rotulo, "valores": valores})

    linhas: list[dict] = []
    for bloco in blocos:
        if not bloco["modelos"]:
            continue
        colunas_x = [xc for xc, _r in bloco["modelos"][0]["refs"]]

        def celula(valores: list[tuple[float, float, str]], xc: float) -> str:
            perto = [t for x0, x1, t in valores
                     if min(colunas_x, key=lambda c: abs(c - (x0 + x1) / 2)) == min(colunas_x, key=lambda c: abs(c - xc))
                     and abs((x0 + x1) / 2 - xc) <= 45]
            return " ".join(perto)

        precos = [l for l in bloco["linhas"] if l["chave"] == "preco"]
        for i, modelo in enumerate(bloco["modelos"]):
            completa = len(modelo["refs"]) >= len(colunas_x)
            linha_preco = precos[i] if i < len(precos) else (precos[0] if len(bloco["modelos"]) == 1 and precos else None)
            for xc, ref_impressa in modelo["refs"]:
                ref = _limpar_ref(ref_impressa)
                campos: dict[str, str] = {}
                conf: dict[str, float] = {}
                descricao: list[str] = []
                for l in bloco["linhas"] if completa else []:
                    valor = celula(l["valores"], xc)
                    if not valor or l["chave"] == "preco":
                        continue
                    if l["chave"] in ("frio-kw", "calor-kw"):
                        kw, btu = _valor_kw(valor)
                        if kw:
                            campos[l["chave"]], conf[l["chave"]] = kw, 0.8
                        if btu and l["chave"] == "frio-kw":
                            campos["btu"], conf["btu"] = btu, 0.8
                    elif l["chave"] in ("caudal-m3h", "deposito-l") and re.match(r"^\d+(?:[.,]\d+)?", valor):
                        campos[l["chave"]] = _num(re.match(r"^\d+(?:[.,]\d+)?", valor).group(0))
                        conf[l["chave"]] = 0.8
                    elif l["chave"] is None:
                        descricao.append(f"{frase(l['rotulo'])}: {valor}")
                if descricao:
                    campos["descricao"], conf["descricao"] = "; ".join(descricao), 0.8
                pvp = None
                impresso = None
                if linha_preco:
                    cand = [(abs((x0 + x1) / 2 - xc), t) for x0, x1, t in linha_preco["valores"]
                            if _preco(t)[0] is not None]
                    if cand and min(cand)[0] <= 45:
                        pvp, bem = _preco(min(cand)[1])
                        conf["pvpCents"] = 1.0 if bem else 0.5
                        impresso = None if bem else min(cand)[1]
                linhas.append({
                    "ref": ref, "refs": None, "ean": None, "pagina": pagina, "pdfPaginas": [pagina],
                    "y": modelo["y"], "texto": ref_impressa, "campos": campos, "confianca": conf,
                    "componenteHint": None, "pvpCents": pvp, "numPrecos": 1 if pvp is not None else 0,
                    "precos": [pvp] if pvp is not None else [],
                    "marcadorRef": len(ref_impressa) - len(ref_impressa.rstrip("*")),
                    "precoImpresso": impresso,
                })
    return linhas, notas


# --- Page → rows --------------------------------------------------------------

def _faixas_sobrepoem(a: dict, b: dict) -> bool:
    ra, rb = a.get("regiao"), b.get("regiao")
    if not ra or not rb:
        return True
    return ra.get("x0", 0) < rb.get("x1", 10_000) and rb.get("x0", 0) < ra.get("x1", 10_000)


def _regioes(page: pymupdf.Page, seccoes: list[dict], numero: int) -> list[tuple[float, float, dict]]:
    """[(y_inicio, y_fim, secção)] pela posição dos títulos nesta página. A
    posição pode vir do mapa (`posicoes: {"<página>": y}`) quando o título se
    repete na página; secções com `regiao: {x0, x1}` (páginas em duas colunas)
    só terminam onde começa outra secção da mesma faixa."""
    h = page.rect.height
    posicionadas = []
    continuacao = None
    for s in seccoes:
        fixa = (s.get("posicoes") or {}).get(str(numero))
        y = float(fixa) if fixa is not None else posicao_titulo(page, s["titulo"])
        if y is not None:
            posicionadas.append((y, s))
        elif (numero - 1) in s["paginas"]:
            continuacao = continuacao or s
        elif len(seccoes) == 1:
            posicionadas.append((0.0, s))
        else:
            print(f"  ⚠ p{numero}: título '{s['titulo']}' não encontrado — linhas não atribuídas a "
                  f"'{s['id']}'", file=sys.stderr)
    posicionadas.sort(key=lambda p: p[0])
    regioes = []
    if continuacao is not None and (not posicionadas or posicionadas[0][0] > 0):
        regioes.append((0.0, posicionadas[0][0] if posicionadas else h, continuacao))
    for y, s in posicionadas:
        fim = min((y2 for y2, s2 in posicionadas if y2 > y and _faixas_sobrepoem(s, s2)), default=h)
        regioes.append((y, fim, s))
    return regioes


def _na_faixa(banda: dict, seccao: dict) -> dict | None:
    r = seccao.get("regiao")
    if not r:
        return banda
    palavras = [p for p in banda["palavras"] if r.get("x0", 0) <= p[0] < r.get("x1", 10_000)]
    return {"y": banda["y"], "palavras": palavras} if palavras else None


def _e_legenda(regiao: list[dict], i: int) -> bool:
    """Legenda de caixa de acessório (Midea: 'COMANDO POR CABO' e, por baixo, o
    cabeçalho 'Modelo | PVP'): maiúsculas seguidas de um cabeçalho antes de
    qualquer ref. Descrições em maiúsculas coladas à ref (Hisense) não são."""
    banda = regiao[i]
    letras = [c for _a, _b, t in banda["palavras"] for c in t if c.isalpha()]
    if len(letras) < 4 or sum(c.isupper() for c in letras) / len(letras) < 0.8 \
            or _tem_preco(banda) or _e_cabecalho(banda):
        return False
    for b in regiao[i + 1:]:
        if b["y"] - banda["y"] > 35:
            return False
        if _e_cabecalho(b):
            return True
        if _tem_ref(b):
            return False
    return False


def extrair_pagina(page: pymupdf.Page, seccoes: list[dict], numero: int) -> list[dict]:
    """Linhas de todas as secções presentes numa página."""
    bandas = bandas_da_pagina(page)
    linhas: list[dict] = []
    for y_ini, y_fim, seccao in _regioes(page, seccoes, numero):
        if seccao.get("tipo") == "ignorar":        # só delimita as regiões vizinhas
            continue
        regiao = [b for b in (_na_faixa(b, seccao) for b in bandas
                              if y_ini <= b["y"] < y_fim and not (y_ini > 0 and b["y"] == y_ini)) if b]
        # Ícones impressos logo acima do título ("WIFI" sobre "Consola de Chão").
        acima = [b for b in (_na_faixa(b, seccao) for b in bandas if y_ini - 8 <= b["y"] <= y_ini) if b]
        if seccao.get("tipo") == "compatibilidade":
            for l in _matriz(regiao, numero):
                l["seccao"] = seccao["id"]
                l["contexto"] = {}
                linhas.append(l)
            continue
        acessorios = seccao.get("familia") == "acessorios-e-controlo"
        colunas: dict[str, float] = {}
        contexto: dict[str, str] = {}
        notas: list[str] = []
        grupo: list[dict] = []
        pendentes: list[dict] = []          # bandas sem ref coladas (≤ 6 pt em cadeia) à próxima ref
        da_seccao: list[dict] = []
        antes_do_cabecalho: list[str] = [" ".join(t for _a, _b, t in b["palavras"]) for b in acima]
        # Rótulos de funcionalidades acima do cabeçalho ("HI-NANO") parecem refs:
        # só há linhas depois do cabeçalho, salvo em tabelas sem cabeçalho.
        aceitar = not any(_e_cabecalho(b) for b in regiao)
        ultima_nota: float | None = None
        legenda: tuple[float, str] | None = None

        def fechar() -> None:
            nonlocal grupo
            if grupo:
                l = _linha_de_bandas(grupo, colunas, numero, acessorios=acessorios)
                if l:
                    l["seccao"] = seccao["id"]
                    l["contexto"] = dict(contexto)
                    if legenda and acessorios:
                        desc = l["campos"].get("descricao")
                        l["campos"]["descricao"] = frase(legenda[1]) + (f" {desc}" if desc else "")
                        l["confianca"]["descricao"] = 0.8
                    # "UE + depósito" com um preço cada: produtos separados, não um conjunto.
                    if l["refs"] and len(l["refs"]) == len(l["precos"]) >= 2:
                        # Os litros ("100 L") ficam com a ref mais próxima (o depósito).
                        dono = None
                        if l.get("litrosX") is not None and len(l.get("refsX") or []) == len(l["refs"]):
                            dono = min(range(len(l["refs"])), key=lambda k: abs(l["refsX"][k] - l["litrosX"]))
                        for k, (r, cents) in enumerate(zip(l["refs"], l["precos"])):
                            campos = dict(l["campos"])
                            if dono is not None and k != dono:
                                campos.pop("deposito-l", None)
                            da_seccao.append({**l, "ref": r, "refs": None, "pvpCents": cents,
                                              "numPrecos": 1, "componenteHint": None, "campos": campos})
                    else:
                        da_seccao.append(l)
            grupo = []

        if _e_transposta(regiao):
            da_seccao, notas = _tabela_transposta(regiao, numero, acessorios, page.rect.height)
            for l in da_seccao:
                l["seccao"] = seccao["id"]
                l["contexto"] = {}
        else:
            for i, banda in enumerate(regiao):
                if _e_nota(banda) or (ultima_nota is not None and banda["y"] - ultima_nota <= 14
                                      and not e_ref(_limpar_ref(banda["palavras"][0][2]))
                                      and not _tem_preco(banda) and not _e_cabecalho(banda)):
                    fechar()
                    texto = " ".join(t for _a, _b, t in banda["palavras"])
                    if _e_nota(banda) or not notas:
                        notas.append(texto)
                    else:
                        notas[-1] += " " + texto
                    ultima_nota = banda["y"]
                    pendentes = []
                    continue
                ultima_nota = None
                # "+ 1x MOX…" (a UE do Twin) continua o conjunto de cima; o PDF às vezes
                # perde o "+" ou pendura-o na linha da UI ("+ 4x MTJ…" é linha nova).
                palavras_b = [t for _a, _b, t in banda["palavras"] if t != "+"]
                continua_conjunto = palavras_b[:1] == ["1x"] and bool(grupo)
                e_legenda = acessorios and _e_legenda(regiao, i)
                if aceitar and not e_legenda and _tem_ref(banda) and not _e_cabecalho(banda) and not continua_conjunto:
                    fechar()
                    grupo = [banda]
                    if pendentes and banda["y"] - pendentes[-1]["y"] <= DIST_COLAGEM:
                        grupo = pendentes + grupo
                    pendentes = []
                    continue
                proxima = regiao[i + 1] if i + 1 < len(regiao) else None
                da_seguinte = proxima is not None and proxima["y"] - banda["y"] <= DIST_COLAGEM \
                    and _tem_ref(proxima) and proxima["palavras"][0][2] not in ("+", "1x")
                if grupo and banda["y"] - grupo[-1]["y"] <= DIST_CONTINUACAO and not _e_cabecalho(banda) \
                        and not _e_nota(banda) and not _subcabecalho(banda, {}) and not e_legenda \
                        and not da_seguinte:
                    grupo.append(banda)
                    continue
                fechar()
                if _e_cabecalho(banda):
                    _colunas_do_cabecalho(banda, colunas)
                    aceitar = True
                    pendentes = []
                elif e_legenda:
                    texto = " ".join(t for _a, _b, t in banda["palavras"])
                    if legenda and banda["y"] - legenda[0] <= 15:
                        texto = f"{legenda[1]} {texto}"      # legenda em duas linhas ("… BREEZELESS E" / "(CB1)")
                    legenda = (banda["y"], texto)
                    pendentes = []
                elif _subcabecalho(banda, contexto):
                    pendentes = []
                else:
                    if not colunas:
                        antes_do_cabecalho.append(" ".join(t for _a, _b, t in banda["palavras"]))
                    if not (pendentes and banda["y"] - pendentes[-1]["y"] <= DIST_COLAGEM):
                        pendentes = []
                    pendentes.append(banda)
            fechar()

        wifi = None
        sob_consulta = False
        for n in notas:
            m = NOTA_WIFI_RX.search(n)
            if m:
                wifi = "opcional" if m.group(1).lower().startswith("opcion") else "sim"
            if SOB_CONSULTA_RX.search(n):
                sob_consulta = True
        icones = normalizar(" ".join(antes_do_cabecalho)).split()
        if wifi is None and "wifi" in icones:                # ícone "WIFI" / "WIFI (opcional)"
            wifi = "opcional" if "opcional" in icones else "sim"
        for l in da_seccao:
            if wifi and "wifi" not in l["campos"]:
                l["campos"]["wifi"], l["confianca"]["wifi"] = wifi, 0.8
            l["notas"] = notas
            l["precoSobConsulta"] = sob_consulta and l["pvpCents"] is None
        linhas.extend(da_seccao)
    return linhas


def extrair_seccao(doc: pymupdf.Document, mapa: dict, seccao_id: str, leitor=None) -> list[dict]:
    """Linhas de uma secção. `leitor(page, seccoes, numero)` (parte da marca)
    lê a página no lugar de `extrair_pagina` quando não devolve None."""
    seccoes = mapa["seccoes"]
    alvo = next((s for s in seccoes if s["id"] == seccao_id), None)
    if alvo is None:
        raise KeyError(f"secção '{seccao_id}' não existe no mapa")
    linhas: list[dict] = []
    for numero in alvo["paginas"]:
        # Secções `ignorar` com posição nesta página (matriz de combinações a meio
        # da página) só servem para terminar a região da secção de cima.
        na_pagina = [s for s in seccoes if numero in s["paginas"] and (
            s.get("tipo") != "ignorar" or str(numero) in (s.get("posicoes") or {}))]
        lidas = leitor(doc[numero - 1], na_pagina, numero) if leitor else None
        if lidas is None:
            lidas = extrair_pagina(doc[numero - 1], na_pagina, numero)
        for l in lidas:
            if l["seccao"] == seccao_id:
                linhas.append(l)
    return linhas


# --- CLI ----------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf", type=Path)
    ap.add_argument("--mapa", type=Path)
    ap.add_argument("--seccao", action="append", default=[])
    ap.add_argument("--todas", action="store_true")
    ap.add_argument("--out", type=Path, help="pasta de saída (default: a do PDF)")
    ap.add_argument("--marca", help="usa marcas/<marca>/extrair.py quando existe")
    args = ap.parse_args()

    mapa_path = args.mapa or args.pdf.with_name("mapa.json")
    mapa = ler_json(mapa_path)
    erros = validar_mapa(mapa)
    if erros:
        print(f"mapa inválido ({mapa_path}):")
        for e in erros:
            print(f"  ✗ {e}")
        sys.exit(1)
    if not args.seccao and not args.todas:
        ap.error("indica --seccao <id> (repetível) ou --todas")
    ids = [s["id"] for s in mapa["seccoes"] if s.get("tipo") != "ignorar"] if args.todas else args.seccao
    out_dir = args.out or args.pdf.parent
    doc = pymupdf.open(args.pdf)
    parte = parte_da_marca(args.marca, "extrair") if args.marca else None
    leitor = getattr(parte, "extrair_pagina", None)
    total = 0
    for sid in ids:
        linhas = extrair_seccao(doc, mapa, sid, leitor)
        escrever_json(out_dir / f"linhas-{sid}.json", {"seccao": sid, "linhas": linhas})
        sem_preco = sum(1 for l in linhas if l["pvpCents"] is None and not l.get("soCompatibilidade"))
        baixa = sum(1 for l in linhas for c in l["confianca"].values() if c < 0.8)
        print(f"  {sid:45} {len(linhas):4} linhas"
              + (f"  ⚠ {sem_preco} sem preço" if sem_preco else "")
              + (f"  · {baixa} campos de confiança < 0.8" if baixa else ""))
        total += len(linhas)
    print(f"{total} linhas em {len(ids)} secções → {out_dir}/linhas-*.json")


if __name__ == "__main__":
    main()

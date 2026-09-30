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
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

import pymupdf

from _comum import EAN_RX, e_ref, escrever_json, ler_json, parse_preco, slug
from mapa import normalizar, palavras_da_pagina, posicao_titulo, validar_mapa

DIST_COLAGEM = 6.0        # pt: banda de descrição colada antes da linha
DIST_CONTINUACAO = 9.0    # pt: banda sem ref colada depois da linha (preço, kW, descrição)
DIST_COLUNA = 45.0        # pt: distância máxima número ↔ centro da coluna

# --- Token shapes -------------------------------------------------------------

PRECO_TOKEN_RX = re.compile(r"^(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?€$")
DIM_RX = re.compile(r"^\(?\d+(?:\+\d+)*\)?[x×]\(?\d+(?:\+\d+)*\)?[x×]\(?\d+(?:\+\d+)*\)?$")
FRACAO_RX = re.compile(r"\d(?:-\d)?/\d{1,2}")
FRAC_TOKEN_RX = re.compile(r"^-?\(?[\d\-]*\d/\d{1,2}\)?[”\"'’]*-?$")
TENSAO_RX = re.compile(r"^(\d{3})V?-(\d{3})V/\d{2,3}Hz$")
REFRIG_RX = re.compile(r"^R-?(32|290|410A|407C|134A|454B|1234ZE)$", re.I)
BTU_RX = re.compile(r"^(\d{1,3})k$")
MULTI_RX = re.compile(r"^(\d)[x×]1$")
INTERVALO_RX = re.compile(r"^\((\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)\)$")
NUMERO_RX = re.compile(r"^\d+(?:[.,]\d+)?$")
CLASSE_PAR_RX = re.compile(r"(?<![A-Za-z0-9\-])(A\+{0,3}|[B-G])\s*/\s*(A\+{0,3}|[B-G])(?![A-Z0-9+])")
CLASSE_TOKEN_RX = re.compile(r"^\(?[a-z]*(A\+{0,3}|[B-G])[a-z]*\.?\)?$|^/$")
GAMA_REFS_RX = re.compile(r"^\(?([A-Z]{2,5}\d{1,3}~\d{1,3})\)?$")
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
}
COLUNAS = {  # header word → column key; first occurrence wins
    "arrefecimento": "frio-kw", "aquecimento": "calor-kw", "deposito": "deposito-l",
    "caudal": "caudal-m3h", "cv": "cv", "descricao": "descricao", "capacidade": "btu",
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
    return token.rstrip("*").strip()


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
    return any(PRECO_TOKEN_RX.match(t.replace(" ", "")) or t == "€" for _x0, _x1, t in banda["palavras"])


def _e_cabecalho(banda: dict) -> bool:
    palavras = [chave_cabecalho(t) for _x0, _x1, t in banda["palavras"]]
    palavras = [p for p in palavras if p]
    if not palavras:
        return False
    conhecidas = sum(1 for p in palavras if p in HEADER_WORDS or p.startswith("energetica"))
    return conhecidas / len(palavras) >= 0.5 and conhecidas >= 1


def _e_nota(banda: dict) -> bool:
    return banda["palavras"][0][2].startswith("*")


def _colunas_do_cabecalho(banda: dict, colunas: dict[str, float]) -> None:
    for x0, x1, t in banda["palavras"]:
        chave = COLUNAS.get(chave_cabecalho(t))
        if chave and chave not in colunas:
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
    t = re.sub(r"\(\d+(?:\+\d+)+\)", soma, texto)
    return t.replace("×", "x")


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
    tokens = _juntar_tokens(ref_banda["palavras"])
    coladas = [b for b in bandas if b is not ref_banda]
    extra = [tok for b in coladas for tok in _juntar_tokens(b["palavras"])]

    refs: list[str] = []
    marcador = 0
    prefixo: list[str] = []
    residual: list[tuple[float, str]] = []
    hint: str | None = None
    numeros: list[tuple[float, str, int]] = []
    intervalos: list[tuple[float, str, str]] = []
    precos: list[tuple[float, int, float]] = []   # (x, cents, confiança)
    dims: list[str] = []
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
            partes = [p for p in re.split(r"/(?=[A-Z])", limpo) if p]
            if len(partes) > 1 and all(e_ref(p) for p in partes):
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
        m = PRECO_TOKEN_RX.match(tt)
        if m:
            cents = parse_preco(tt.replace("€", " €"))
            if cents is not None:
                precos.append((x0, cents, 0.5 if colado else 1.0))
            return
        if DIM_RX.match(tt):
            dims.append(_dimensoes(tt))
            return
        if FRAC_TOKEN_RX.match(tt) or (tt.count("/") >= 1 and FRACAO_RX.search(tt) and re.search(r"[”\"'’]", tt)):
            fracs = FRACAO_RX.findall(tt)
            if fracs:
                campos["tubagem"], conf["tubagem"] = "-".join(fracs), 1.0
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

    for x0, x1, t in tokens:
        classificar(x0, x1, t, False)
    for x0, x1, t in extra:
        classificar(x0, x1, t, True)

    if not refs:
        return None

    # Classe energética: regex sobre o texto (o PDF cola lixo: "(po A++ / A+leg.)").
    texto = " ".join(texto_tokens)
    mc = CLASSE_PAR_RX.search(texto)
    if mc:
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
    if len(refs) > 1:
        hint = "conjunto"
    return {
        "ref": ref, "refs": refs if len(refs) > 1 else None, "ean": ean, "pagina": pagina,
        "pdfPaginas": [pagina], "y": ref_banda["y"], "texto": texto, "campos": campos,
        "confianca": conf, "componenteHint": hint, "pvpCents": pvp,
        "numPrecos": len(precos), "marcadorRef": marcador,
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


# --- Page → rows --------------------------------------------------------------

def _regioes(page: pymupdf.Page, seccoes: list[dict], numero: int) -> list[tuple[float, float, dict]]:
    """[(y_inicio, y_fim, secção)] pela posição dos títulos nesta página."""
    h = page.rect.height
    posicionadas = []
    continuacao = None
    for s in seccoes:
        y = posicao_titulo(page, s["titulo"])
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
    for i, (y, s) in enumerate(posicionadas):
        fim = posicionadas[i + 1][0] if i + 1 < len(posicionadas) else h
        regioes.append((y, fim, s))
    return regioes


def extrair_pagina(page: pymupdf.Page, seccoes: list[dict], numero: int) -> list[dict]:
    """Linhas de todas as secções presentes numa página."""
    bandas = bandas_da_pagina(page)
    linhas: list[dict] = []
    for y_ini, y_fim, seccao in _regioes(page, seccoes, numero):
        regiao = [b for b in bandas if y_ini <= b["y"] < y_fim and not (y_ini > 0 and b["y"] == y_ini)]
        if seccao.get("tipo") == "compatibilidade":
            for l in _matriz(regiao, numero):
                l["seccao"] = seccao["id"]
                l["contexto"] = {}
                linhas.append(l)
            continue
        colunas: dict[str, float] = {}
        contexto: dict[str, str] = {}
        notas: list[str] = []
        grupo: list[dict] = []
        pendente: dict | None = None
        da_seccao: list[dict] = []
        # Rótulos de funcionalidades acima do cabeçalho ("HI-NANO") parecem refs:
        # só há linhas depois do cabeçalho, salvo em tabelas sem cabeçalho.
        aceitar = not any(_e_cabecalho(b) for b in regiao)

        def fechar() -> None:
            nonlocal grupo
            if grupo:
                l = _linha_de_bandas(grupo, colunas, numero,
                                     acessorios=seccao.get("familia") == "acessorios-e-controlo")
                if l:
                    l["seccao"] = seccao["id"]
                    l["contexto"] = dict(contexto)
                    da_seccao.append(l)
            grupo = []

        for banda in regiao:
            if _e_nota(banda):
                fechar()
                notas.append(" ".join(t for _a, _b, t in banda["palavras"]))
                pendente = None
                continue
            if aceitar and _tem_ref(banda) and not _e_cabecalho(banda):
                fechar()
                grupo = [banda]
                if pendente is not None and banda["y"] - pendente["y"] <= DIST_COLAGEM:
                    grupo.insert(0, pendente)
                pendente = None
                continue
            if grupo and banda["y"] - grupo[-1]["y"] <= DIST_CONTINUACAO and not _e_cabecalho(banda) \
                    and not _e_nota(banda) and not _subcabecalho(banda, {}):
                grupo.append(banda)
                continue
            fechar()
            if _e_cabecalho(banda):
                _colunas_do_cabecalho(banda, colunas)
                aceitar = True
                pendente = None
            elif _subcabecalho(banda, contexto):
                pendente = None
            else:
                pendente = banda
        fechar()

        wifi = None
        sob_consulta = False
        for n in notas:
            m = NOTA_WIFI_RX.search(n)
            if m:
                wifi = "opcional" if m.group(1).lower().startswith("opcion") else "sim"
            if re.search(r"(?i)pre[çc]os?\s+sob(?:re)?\s+consulta", n):
                sob_consulta = True
        for l in da_seccao:
            if wifi and "wifi" not in l["campos"]:
                l["campos"]["wifi"], l["confianca"]["wifi"] = wifi, 0.8
            l["notas"] = notas
            l["precoSobConsulta"] = sob_consulta and l["pvpCents"] is None
        linhas.extend(da_seccao)
    return linhas


def extrair_seccao(doc: pymupdf.Document, mapa: dict, seccao_id: str) -> list[dict]:
    seccoes = mapa["seccoes"]
    alvo = next((s for s in seccoes if s["id"] == seccao_id), None)
    if alvo is None:
        raise KeyError(f"secção '{seccao_id}' não existe no mapa")
    linhas: list[dict] = []
    for numero in alvo["paginas"]:
        na_pagina = [s for s in seccoes if numero in s["paginas"] and s.get("tipo") != "ignorar"]
        for l in extrair_pagina(doc[numero - 1], na_pagina, numero):
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
    total = 0
    for sid in ids:
        linhas = extrair_seccao(doc, mapa, sid)
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

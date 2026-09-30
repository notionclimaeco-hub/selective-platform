"""Nipon 2025 (`NIPON_2025_.pdf`, ticket #45): leitura das tabelas.

Hook `extrair_pagina(page, seccoes, numero)` do `extrair.py --marca nipon`:
substitui o leitor genérico em todas as páginas. A Nipon imprime dois formatos:

- **Fichas** (um modelo por coluna): as colunas vêm da linha "Código …" com
  mais refs (`NI` + 7 dígitos); cada linha de códigos leva o preço da primeira
  linha "Preço S/IVA" abaixo dela. Vende-se a linha "Código conjunto" quando
  existe (UE, UI e grelha têm código mas não preço: ficam na descrição); as
  linhas "Código … - Branca / - Cinza antracite" dão a `cor`. As specs saem
  dos rótulos à esquerda (`_spec`); células impressas uma vez para várias
  colunas (alimentação, classe) valem para as colunas mais próximas.
- **Listas** "Código | Descrição | Preço": ref, a descrição à direita (e o
  modelo à esquerda: "NCPG/03 NI0195300"), o preço na mesma linha.

A Venice (p55) é uma lista por versão ("Versão V - 2 tubos": tamanho, código,
preço) com as specs por tamanho na ficha da p54.
"""
from __future__ import annotations

import re
from collections import defaultdict
from statistics import median

from extrair import _regioes
from mapa import normalizar, palavras_da_pagina

REF_RX = re.compile(r"^NI\d{7}$")
PRECO_RX = re.compile(r"^(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{2}))?€$")
NUM_RX = re.compile(r"-?\d+(?:[.,]\d+)?")
CLASSE_RX = re.compile(r"^A\+{0,3}$|^[B-G]$")
DIM_RX = re.compile(r"^(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)")
REFRIG_RX = re.compile(r"\bR-?(32|290|410A)\b")
UNIDADE_RX = re.compile(r"^(k?W|KW|W/W|kPa|Pa)$")
CORES = {"branca": "branco", "branco": "branco", "cinza": "cinzento", "preta": "preto", "preto": "preto"}
VALOR_RX = re.compile(r"^\d[\d.,x]*\d$")     # número ou dimensões completos
DIST_LINHA = 3.2        # pt: palavras com o centro a ≤ 3.2 pt da anterior ficam na mesma linha


# --- Palavras e linhas ----------------------------------------------------------

def _palavras(page, y_ini: float, y_fim: float, seccao: dict) -> list[tuple]:
    r = seccao.get("regiao") or {}
    out = []
    for w in palavras_da_pagina(page):
        x0, y0, x1, y1, t = w
        yc = (y0 + y1) / 2
        if not (y_ini <= yc < y_fim) or yc > page.rect.height - 25:        # rodapé com o nº da página
            continue
        if not (r.get("x0", 0) <= x0 < r.get("x1", 10_000)):
            continue
        if len(t) > 1 and (y1 - y0) > 1.6 * (x1 - x0):                    # texto na vertical
            continue
        out.append((x0, y0, x1, y1, t.replace("ﬁ", "fi").replace("ﬂ", "fl")))
    return _juntar_euro(out)


def _juntar_euro(palavras: list[tuple]) -> list[tuple]:
    """'260,00' + '€' → '260,00€'."""
    palavras = sorted(palavras, key=lambda w: (round((w[1] + w[3]) / 2), w[0]))
    out: list[tuple] = []
    for w in palavras:
        if w[4] == "€" and out and abs(out[-1][1] - w[1]) < 3 and 0 <= w[0] - out[-1][2] < 8:
            a = out.pop()
            out.append((a[0], a[1], w[2], a[3], a[4] + "€"))
        else:
            out.append(w)
    return out


def _linhas(palavras: list[tuple]) -> list[dict]:
    linhas: list[dict] = []
    for w in sorted(palavras, key=lambda w: ((w[1] + w[3]) / 2, w[0])):
        yc = (w[1] + w[3]) / 2
        if linhas and yc - linhas[-1]["fim"] <= DIST_LINHA:
            linhas[-1]["ws"].append(w)
            linhas[-1]["fim"] = yc
        else:
            linhas.append({"y": yc, "fim": yc, "ws": [w]})
    for l in linhas:
        l["ws"].sort(key=lambda w: w[0])
    return linhas


def _xc(w) -> float:
    return (w[0] + w[2]) / 2


def _preco(t: str) -> int | None:
    m = PRECO_RX.match(t)
    if not m:
        return None
    return int(m.group(1).replace(".", "")) * 100 + int(m.group(2) or 0)


def _refs(l: dict) -> list[tuple]:
    return [w for w in l["ws"] if REF_RX.match(w[4])]


def _precos(l: dict) -> list[tuple]:
    return [w for w in l["ws"] if _preco(w[4]) is not None]


def _num(texto: str) -> str | None:
    m = NUM_RX.search(texto)
    return m.group(0).replace(",", ".") if m else None


def _kw(valor: str, unidade: str | None) -> str | None:
    """'2.7' kW → '2.7'; '1.579' W (milhares) → '1.58'; '1700' W → '1.7'."""
    m = NUM_RX.search(valor)
    if not m:
        return None
    t = m.group(0)
    if unidade in ("W",):
        watts = float(t.replace(".", "").replace(",", ".")) if re.fullmatch(r"\d{1,2}\.\d{3}", t) \
            else float(t.replace(",", "."))
        return f"{watts / 1000:.2f}".rstrip("0").rstrip(".")
    return t.replace(",", ".")


def _maximo(valor: str) -> str | None:
    """Maior número de 'L/M/H' ('150/200/200' → 200); '1.265' = milhares."""
    nums = [float(n.replace(".", "") if re.fullmatch(r"\d{1,3}\.\d{3}", n) else n.replace(",", "."))
            for n in NUM_RX.findall(valor)]
    if not nums:
        return None
    m = max(nums)
    return str(int(m)) if m == int(m) else str(m)


def _dimensoes(valor: str) -> str | None:
    m = DIM_RX.match(valor.replace(" ", ""))
    return "x".join(g.replace(",", ".") for g in m.groups()) if m else None


def _alimentacao(valor: str) -> str | None:
    v = valor.replace(" ", "")
    if re.search(r"3Ph|/3/|3P\+N|400V?3|400V/3|3F", v, re.I) or re.match(r"^(380|400)", v):
        return "trifasica"
    if re.search(r"1Ph|/1/|230V?1|1F", v, re.I) or re.match(r"^2[23]0", v):
        return "monofasica"
    return None


def _linha(ref: str, seccao: dict, pagina: int, y: float, campos: dict, pvp: int | None,
           contexto: dict | None = None, precos: int = 1) -> dict:
    return {
        "ref": ref, "refs": None, "ean": None, "pagina": pagina, "pdfPaginas": [pagina], "y": y,
        "texto": ref, "campos": campos, "confianca": {k: 0.8 for k in campos},
        "componenteHint": None, "pvpCents": pvp, "numPrecos": 1 if pvp is not None else 0,
        "precos": [pvp] if pvp is not None else [], "marcadorRef": 0, "precoImpresso": None,
        "seccao": seccao["id"], "contexto": contexto or {}, "notas": [], "precoSobConsulta": False,
    }


# --- Fichas: specs por coluna ------------------------------------------------------

class _Tabela:
    """Colunas (centros x) e a partição rótulo | valores de cada linha."""

    def __init__(self, centros: list[float]):
        self.centros = sorted(centros)
        diffs = [b - a for a, b in zip(self.centros, self.centros[1:])]
        self.passo = median(diffs) if diffs else 70.0
        self.limite = self.centros[0] - 0.5 * self.passo

    def coluna(self, w) -> int | None:
        xc = _xc(w)
        i = min(range(len(self.centros)), key=lambda k: abs(self.centros[k] - xc))
        return i if abs(self.centros[i] - xc) <= 0.5 * self.passo else None

    def rotulo(self, l: dict) -> list[tuple]:
        return [w for w in l["ws"] if _xc(w) < self.limite]

    def celulas(self, l: dict) -> dict[int, str]:
        """{coluna: texto}. Palavras coladas (≤ 2.5 pt: um espaço) formam um valor
        ("220 - 240 / 50Hz"), salvo dois valores completos lado a lado (a p44
        cola "940x820x460" ao da coluna seguinte). Células impressas uma vez para várias colunas —
        valores largos (≥ 70 % do passo), fora do centro de qualquer coluna, ou
        uma linha com menos valores do que metade das colunas — enchem as colunas
        vazias com o valor partilhado mais próximo."""
        valores: list[list] = []
        for w in l["ws"]:
            if _xc(w) < self.limite or w[4] == "|":
                continue
            if valores and w[0] - valores[-1][2] <= 2.5 and not (
                    VALOR_RX.match(valores[-1][4].split()[-1]) and VALOR_RX.match(w[4])):
                a = valores[-1]
                valores[-1] = [a[0], a[1], w[2], a[3], f"{a[4]} {w[4]}"]
            else:
                valores.append(list(w))
        cels: dict[int, list[str]] = defaultdict(list)
        for w in valores:
            i = self.coluna(w)
            if i is not None:
                cels[i].append(w[4])
        partilhados = valores if len(valores) < len(self.centros) / 2 else [
            w for w in valores if w[2] - w[0] >= 0.7 * self.passo
            or min(abs(_xc(w) - c) for c in self.centros) > 0.35 * self.passo]
        if partilhados:
            for i, c in enumerate(self.centros):
                if i not in cels:
                    cels[i].append(min(partilhados, key=lambda w: abs(_xc(w) - c))[4])
        return {i: " ".join(ts) for i, ts in cels.items()}


def _classe(valor: str) -> str | None:
    m = re.match(r"(A\+{0,3}|[B-G])(?![A-Za-z0-9])", valor.strip())
    return m.group(1) if m else None


def _spec(c: str, unidade: str | None, valor: str, familia: str, lidas: dict, ordem: dict) -> dict:
    """Chaves do registo lidas de uma célula. `c` = rótulo normalizado sem
    espaços (a p30 imprime "Potênciatérmica"); `lidas` = o que a coluna já tem
    (a primeira linha que dá uma chave ganha); `ordem` conta os rótulos
    'Potência térmica' (1.º = arrefecimento, os seguintes = aquecimento)."""
    out: dict[str, str] = {}
    dim_chave = "_dim2" if "_dim" in lidas else "_dim"
    if familia == "ar-condicionado":
        if re.search(r"potencia(termica|nominal)", c):
            chave = "calor-kw" if "aquec" in c else "frio-kw" if "arref" in c else \
                ("frio-kw" if ordem.get("potencia", 0) == 1 else "calor-kw")
            out[chave] = _kw(valor, "kW")
        elif c.endswith("seer"):
            out["seer"] = _num(valor)
        elif c.endswith("scop"):
            out["scop"] = _num(valor)
        elif "classeenergetica" in c and _classe(valor):
            out["_classe-calor" if "calor-kw" in lidas else "_classe-frio"] = _classe(valor)
        elif c.startswith("numeromaximodeunidade"):
            out["unidades-max"] = _num(valor)
        elif "alimentacaoeletrica" in c and "cabo" not in c:
            out["alimentacao"] = _alimentacao(valor)
        elif "dimens" in c and "embalagem" not in c and "grelha" not in c:
            out[dim_chave] = _dimensoes(valor)
        elif "linhaliquido" in c:
            out["tubagem"] = re.sub(r"[”\"\s]", "", valor)          # como a Midea: 1/4-3/8
        elif "comprimentomax" in c and "precarga" not in c:
            out["_comprimento-total" if "total" in c else "_comprimento"] = _num(valor)
        elif "desnivelmax" in c:
            out["desnivel-max-m"] = _num(valor)
    elif familia == "bombas-de-calor":
        intervalo = re.search(r"\d\s*[-~]\s*\d", valor)         # Serenus: "14.0~7.1" (velocidades)
        if re.search(r"pot(encia)?\.?(de)?aquec", c) and "absorvida" not in c:
            out["calor-kw"] = _kw(valor, "kW")
        elif re.search(r"pot(encia)?\.?arref", c) and "absorvida" not in c:
            out["_frio18" if "18oc" in c or "18c" in c else "frio-kw"] = _kw(valor, "kW")
        elif re.search(r"(^|\d|\))cop", c) and "medio" not in c and not intervalo:
            out["cop"] = _num(valor)
        elif c.endswith("scop"):
            out["scop"] = _num(valor)
        elif ("classeenergetica" in c or "eficienciaenergetica" in c) and _classe(valor):
            out["classe-energetica"] = "-/" + _classe(valor)
        elif "alimentacao" in c and "cabo" not in c:
            out["alimentacao"] = _alimentacao(valor)
        elif c == "refrigerante":
            m = REFRIG_RX.search(valor)
            out["refrigerante"] = f"R{m.group(1)}" if m else None
        elif "volumeacumulador" in c:
            out["deposito-l"] = _num(valor)
        elif "dimens" in c and "embalagem" not in c:
            out[dim_chave] = _dimensoes(valor)
    elif familia == "aqs":
        if re.search(r"potenciatermicabombadecalor|potencianominal", c):
            out["calor-kw"] = _kw(valor, "W")
        elif re.match(r"^cop", c):
            out["cop"] = _num(valor)
        elif "classeenergetica" in c and _classe(valor):
            out["classe-energetica"] = "-/" + _classe(valor)
        elif "perfildeconsumo" in c and valor.split()[0] in ("S", "M", "L", "XL", "XXL", "3XL"):
            out["perfil-carga"] = valor.split()[0]
        elif c.startswith("alimentacao"):
            out["alimentacao"] = _alimentacao(valor)
        elif "refrigerante" in c and "carga" not in c:
            m = REFRIG_RX.search(valor)
            out["refrigerante"] = f"R{m.group(1)}" if m else None
        elif "dimens" in c and "embalagem" not in c:
            out["dimensoes"] = _dimensoes(valor)
        elif c.startswith("serpentinasolar"):
            out["serpentina-solar-m2"] = _num(valor)
    elif familia == "ventilacao":
        if c.startswith("fluxodear") or c.startswith("caudal"):
            out["caudal-m3h"] = _maximo(valor)
        elif c.startswith("eficiencianominal"):
            out["rendimento-pct"] = _num(valor)
        elif "potenciasonora" in c or "pressaosonora" in c:
            out["nivel-sonoro-db"] = _maximo(valor)
        elif re.search(r"potencia(eletrica)?nominal", c):
            out["consumo-w"] = _num(valor)
        elif c.startswith("pressaoestatica"):
            out["pressao-estatica-pa"] = _maximo(valor)
        elif c.startswith("dimens"):
            out["dimensoes"] = _dimensoes(valor)
    elif familia == "ventiloconvectores":
        partes = valor.split()
        maximo = partes[-1] if len(partes) == 3 else valor          # Supra: Mín. / Médio / Máx.
        if "arrefecimento" in c and "sensivel" not in c and c.startswith(("pot", "1pot", "apot")):
            out["frio-kw"] = _kw(maximo, unidade)
        elif "aquecimento" in c and c.startswith(("pot", "2pot", "bpot")) and "perdas" not in c:
            out["calor-kw"] = _kw(maximo, unidade)
        elif c.startswith("caudaldear") or c.startswith("fluxodear"):
            out["caudal-m3h"] = _maximo(valor)
        elif c.startswith("dimens") and "movel" not in c:
            out["dimensoes"] = _dimensoes(valor)
    return {k: v for k, v in out.items() if v and k not in lidas}


def _ler_specs(linhas: list[dict], tab: _Tabela, familia: str) -> list[dict]:
    """Campos por coluna a partir das linhas de specs (as linhas abaixo do
    cabeçalho dos modelos)."""
    por_coluna: list[dict] = [dict() for _ in tab.centros]
    ordem: dict[str, int] = defaultdict(int)
    for l in linhas:
        if _refs(l) or _precos(l):
            continue
        rot_ws = tab.rotulo(l)
        c = normalizar(" ".join(w[4] for w in rot_ws)).replace(" ", "")
        if not c:
            continue
        unidades = [w[4] for w in rot_ws if UNIDADE_RX.match(w[4])]
        unidade = {"KW": "kW"}.get(unidades[-1], unidades[-1]) if unidades else None
        if re.search(r"potencia(termica|nominal)", c):
            ordem["potencia"] += 1
        for i, valor in tab.celulas(l).items():
            if valor.strip() in ("", "-"):
                continue
            por_coluna[i].update(_spec(c, unidade, valor, familia, por_coluna[i], ordem))
    for campos in por_coluna:
        _fechar_campos(campos)
    return por_coluna


def _fechar_campos(c: dict) -> None:
    frio, calor = c.pop("_classe-frio", None), c.pop("_classe-calor", None)
    if frio or calor:
        c["classe-energetica"] = f"{frio or '-'}/{calor or '-'}"
    if "_frio18" in c:                              # piso radiante (35 °C ext / 18 °C água)
        c["frio-kw"] = c.pop("_frio18")
    total, por_ui = c.pop("_comprimento-total", None), c.pop("_comprimento", None)
    if total or por_ui:
        c["comprimento-max-m"] = total or por_ui


INICIO_SPECS_RX = re.compile(r"^\d?(arrefecimento|aquecimento)?(potencia|pot|numeromaximo|alimentacao|fluxodear|"
                             r"tensao|condicoes|velocidade)")


def _cabecalho(linhas: list[dict], tab: _Tabela, antes: float) -> tuple[float | None, dict[int, str]]:
    """(y, nomes dos modelos por coluna) do cabeçalho da ficha: a linha mais
    próxima acima da primeira linha de specs ("Potência…", "Número máximo…",
    "Fluxo de ar"…) com nomes em ≥ 75 % das colunas. Sem linha de specs (tabela
    de comandos), a mais próxima acima dos códigos. Linhas sem rótulo coladas
    por baixo continuam o nome ('M12T' / 'Gv4'); um nome impresso colado ao
    seguinte ('M06Gv4M08Gv4') reparte-se pelas colunas que cobre."""
    precisa = max(1, -(-3 * len(tab.centros) // 4))

    def colunas(l) -> set[int]:
        return {tab.coluna(w) for w in l["ws"] if _xc(w) >= tab.limite and re.search(r"[A-Za-z0-9]", w[4])} - {None}

    def rotulo(l) -> str:
        return normalizar(" ".join(w[4] for w in tab.rotulo(l))).replace(" ", "")

    candidatas = [l for l in linhas if l["y"] < antes and not _refs(l) and not _precos(l)]
    inicio = next((l["y"] for l in candidatas if INICIO_SPECS_RX.match(rotulo(l)) and colunas(l)), antes)
    cab = [l for l in candidatas if l["y"] < inicio and len(colunas(l)) >= precisa]
    if not cab:
        return None, {}
    l = cab[-1]
    nomes: dict[int, list[str]] = defaultdict(list)
    seguintes = [m for m in candidatas if 0 < m["y"] - l["y"] <= 12 and m["y"] < inicio and not tab.rotulo(m)]
    for m in [l] + seguintes:
        palavras: list[tuple] = []                  # "PRIMISD09" + "GA" = um nome
        for w in m["ws"]:
            if palavras and w[0] - palavras[-1][2] <= 3:
                a = palavras.pop()
                w = (a[0], a[1], w[2], a[3], f"{a[4]} {w[4]}")
            palavras.append(w)
        for w in palavras:
            if _xc(w) < tab.limite:
                continue
            cobertas = [i for i, c in enumerate(tab.centros) if w[0] - 5 <= c <= w[2] + 5]
            partes = re.split(r"(?<=\d)(?=[A-Z]\d)", w[4])
            if len(cobertas) > 1 and len(partes) == len(cobertas):
                for i, parte in zip(cobertas, partes):
                    nomes[i].append(parte)
                continue
            i = tab.coluna(w)
            if i is not None:
                nomes[i].append(w[4])
    return l["y"], {i: " ".join(ts).replace("*", "").strip() for i, ts in nomes.items()}


# --- Fichas: SKUs ------------------------------------------------------------------

def _btu(modelo: str) -> str | None:
    """Classe comercial impressa no modelo: 'PRIMISD09 GA' → 9000, 'M4-36DHW GA' → 36000."""
    m = re.search(r"(\d{2})\s*(?:DHW|G[AB]\d?\b)", modelo)
    return str(int(m.group(1)) * 1000) if m else None


def _litros(modelo: str) -> str | None:
    m = re.search(r"(?:^|[^\d])(\d{2,3})\s*(?:L\b|GA\b|$|\s)", modelo.replace("-", " "))
    return m.group(1) if m else None


def _ficha(linhas: list[dict], seccao: dict, pagina: int) -> list[dict]:
    codigos = [l for l in linhas if _refs(l) and not _precos(l)]
    base = max(codigos, key=lambda l: len(_refs(l)))
    tab = _Tabela([_xc(w) for w in _refs(base)])
    # Legendas de fotos com refs (p33: suportes por baixo das fotos) ficam à esquerda da tabela.
    codigos = [l for l in codigos if all(_xc(w) >= tab.limite for w in _refs(l))]
    familia = seccao["familia"]
    y_cab, modelos = _cabecalho(linhas, tab, codigos[0]["y"])
    specs = _ler_specs([l for l in linhas if y_cab is None or l["y"] > y_cab], tab, familia)

    def rotulo_de(l):
        ws = tab.rotulo(l)
        if not ws:                                  # rótulo na linha de cima ("Suporte parede" / códigos)
            acima = [m for m in linhas if 0 < l["y"] - m["y"] <= 8 and tab.rotulo(m) and not _refs(m)]
            ws = tab.rotulo(acima[-1]) if acima else []
        return " ".join(w[4] for w in ws)

    def por_coluna(l) -> dict[int, str]:
        return {tab.coluna(w): w[4] for w in _refs(l) if tab.coluna(w) is not None}

    rotulos = {id(l): normalizar(rotulo_de(l)) for l in codigos}
    tem_conjunto = any("conjunto" in r for r in rotulos.values())
    vendidas = [l for l in codigos if ("conjunto" in rotulos[id(l)]) or (
        not tem_conjunto and not re.search(r"grelha|filtro|u[ei]$", rotulos[id(l)].replace(" ", "")))]
    outros = [l for l in codigos if l not in vendidas]

    out: list[dict] = []
    vistos: dict[str, dict] = {}
    for l in vendidas:
        precos_abaixo = [p for p in linhas if p["y"] > l["y"] and _precos(p) and not _refs(p)]
        linha_preco = precos_abaixo[0] if precos_abaixo else None
        rot = rotulos[id(l)]
        cores = {**CORES, **(seccao.get("cores") or {})}
        cor = next((c for w, c in cores.items() if w in rot.split()), None)
        for i, ref in por_coluna(l).items():
            pvp = None
            if linha_preco:
                cand = [w for w in _precos(linha_preco) if tab.coluna(w) == i]
                pvp = _preco(cand[0][4]) if cand else None
            modelo = modelos.get(i, "")
            campos = {k: v for k, v in specs[i].items() if not k.startswith("_")}
            dims = [specs[i][k] for k in ("_dim", "_dim2") if k in specs[i]]
            if familia == "ar-condicionado":
                if modelo and _btu(modelo):
                    campos["btu"] = _btu(modelo)
                if "alimentacao" not in campos and re.search(r"GB3\b", modelo):
                    campos["alimentacao"] = "trifasica"
            if familia in ("aqs",) and modelo and _litros(modelo):
                campos["deposito-l"] = _litros(modelo)
            campos.update(_chaves_dimensoes(dims, seccao))
            extras = []
            for o in outros:
                r_o = por_coluna(o).get(i)
                if r_o:
                    extras.append(f"{_nome_codigo(rotulos[id(o)])} {r_o}")
            desc = []
            if familia == "acessorios-e-controlo":
                nome = normalizar(rotulo_de(l))
                nome = "Suporte de parede p/ comando" if "suporte" in nome else "Comando"
                desc.append(f"{nome} {modelo}".strip())
            elif modelo:
                desc.append(f"Modelo {modelo} da gama {seccao['gama']}")
            if extras:
                desc.append("Códigos: " + ", ".join(extras))
            if desc:
                campos["descricao"] = ". ".join(desc)
            if ref in vistos and vistos[ref]["pvpCents"] == pvp:     # suporte comum a vários comandos
                prev = vistos[ref]["campos"]
                if modelo and modelo not in prev.get("descricao", ""):
                    prev["descricao"] = f"{prev['descricao']}, {modelo}"
                continue
            linha = _linha(ref, seccao, pagina, l["y"], campos, pvp, {"cor": cor} if cor else {})
            vistos[ref] = linha
            out.append(linha)
    return out


def _chaves_dimensoes(dims: list[str], seccao: dict) -> dict:
    """AC e bombas de calor: a ficha imprime a UI antes da UE; monoblocos e UE
    só têm a exterior, UI só a interior."""
    if not dims or seccao["familia"] not in ("ar-condicionado", "bombas-de-calor"):
        return {}
    comp, sistema = seccao["componente"], seccao.get("sistema")
    if comp == "unidade-exterior" or sistema == "monobloco":
        return {"dimensoes-ue": dims[0]}
    if comp == "unidade-interior" or len(dims) == 1:
        return {"dimensoes-ui": dims[0]}
    return {"dimensoes-ui": dims[0], "dimensoes-ue": dims[1]}


def _nome_codigo(rot: str) -> str:
    c = rot.replace(" ", "")
    if c.endswith("ue"):
        return "unidade exterior"
    if c.endswith("ui"):
        return "unidade interior"
    if "grelha" in rot:
        return "grelha"
    if "filtro" in rot:
        return "filtro"
    return "código"


# --- Listas ------------------------------------------------------------------------

ABREVIATURAS = ((r"\bAlt\.\s*Efic\.", "Alta Eficiência"), (r"\bInteg\.", "Integrado"),
                (r"\bp/(?=\S)", "p/ "), (r"\b3vias\b", "3 vias"), (r"\bC02\b", "CO2"), (r"\bComado\b", "Comando"))


def _limpar(desc: str) -> str:
    """Abreviaturas da tabela por extenso (o título do grupo corta no primeiro
    '. ': "Circulador Integ. de Alt. Efic. p/250") e gralhas ("C02", "Comado")."""
    for rx, por in ABREVIATURAS:
        desc = re.sub(rx, por, desc)
    return re.sub(r"\s+", " ", desc).strip(" -")


def _lista(linhas: list[dict], seccao: dict, pagina: int) -> list[dict]:
    out = []
    for l in linhas:
        refs = _refs(l)
        precos = _precos(l)
        for r in refs:
            direita = [w for w in precos if w[0] > r[2]]
            p = min(direita, key=lambda w: w[0] - r[2]) if direita else None
            outras = [w[0] for w in refs if w[0] > r[2]]
            fim = min(([p[0]] if p else []) + outras + [10_000])
            ini = max([w[2] for w in refs + precos if w[2] <= r[0]] + [r[0] - 90])
            # À esquerda da ref só o modelo ("NCPG/03 NI0195300"), não texto de outra coluna.
            texto = [w[4] for w in l["ws"] if w is not r and w not in precos and ini <= w[0] < fim
                     and (w[0] > r[0] or re.search(r"\d", w[4]))]
            desc = _limpar(" ".join(t for t in texto if t not in ("•", "*")))
            sufixo = seccao.get("sufixo")
            if sufixo and normalizar(sufixo).split()[-1] not in normalizar(desc).replace(" ", ""):
                desc = f"{desc} {sufixo}".strip()
            campos = {"descricao": desc} if desc else {}
            out.append(_linha(r[4], seccao, pagina, l["y"], campos, _preco(p[4]) if p else None))
    return out


# --- Venice --------------------------------------------------------------------------

def _venice_specs(page) -> dict[str, dict]:
    """{tamanho: campos} da ficha da p54 (colunas pelo cabeçalho 'VENICE 13 23 …')."""
    linhas = _linhas(_juntar_euro([w for w in palavras_da_pagina(page)]))
    cab = next(l for l in linhas if l["ws"][0][4] == "VENICE" and len(l["ws"]) > 5)
    colunas = [w for w in cab["ws"][1:] if w[4].isdigit()]
    tab = _Tabela([_xc(w) for w in colunas])
    # Só a Venice base: as subtabelas "VENICE c/ Permutador de Calor" e
    # "VENICE-BRUSHLESS" por baixo são outras versões (sob consulta).
    fim = next((l["y"] for l in linhas if l["y"] > cab["y"] and l["ws"][0][4].startswith("VENICE")), 10_000)
    specs = _ler_specs([l for l in linhas if cab["y"] < l["y"] < fim], tab, "ventiloconvectores")
    return {w[4]: specs[i] for i, w in enumerate(colunas)}


def _venice(linhas: list[dict], seccao: dict, pagina: int, doc) -> list[dict]:
    specs = _venice_specs(doc[pagina - 2])
    cabecalhos = []                                   # "Versão V - 2 tubos Código Preço s/IVA"
    for l in linhas:
        for k, w in enumerate(l["ws"]):
            if w[4] == "Versão" and k + 1 < len(l["ws"]):
                fim = next((x[2] for x in l["ws"][k:] if x[4] == "s/IVA"), w[2] + 160)
                cabecalhos.append((l["y"], w[0], fim, l["ws"][k + 1][4]))
    out = []
    for l in linhas:
        for r in _refs(l):
            cab = max((c for c in cabecalhos if c[0] < l["y"] and c[1] - 5 <= r[0] <= c[2]),
                      key=lambda c: c[0], default=None)
            if cab is None:
                continue
            tamanho = next((w[4] for w in l["ws"] if w[4].isdigit() and 0 < r[0] - w[2] < 60), None)
            p = min((w for w in _precos(l) if w[0] > r[2] and w[0] - r[2] < 90),
                    key=lambda w: w[0] - r[2], default=None)
            campos = dict(specs.get(tamanho, {}))
            campos["descricao"] = f"Venice {cab[3]} tamanho {tamanho}, 2 tubos"
            out.append(_linha(r[4], seccao, pagina, l["y"], campos, _preco(p[4]) if p else None,
                              {"serie": cab[3]}))
    return out


# --- Página --------------------------------------------------------------------------

def extrair_pagina(page, seccoes: list[dict], numero: int) -> list[dict]:
    linhas_pagina: list[dict] = []
    for y_ini, y_fim, seccao in _regioes(page, seccoes, numero):
        if seccao.get("tipo") != "tabela":
            continue
        linhas = _linhas(_palavras(page, y_ini, y_fim, seccao))
        if seccao["id"] == "venice":
            linhas_pagina += _venice(linhas, seccao, numero, page.parent)
            continue
        ficha = any(_refs(l) and not _precos(l) for l in linhas) and any(
            _precos(l) and not _refs(l) for l in linhas)
        linhas_pagina += _ficha(linhas, seccao, numero) if ficha else _lista(linhas, seccao, numero)
    return linhas_pagina

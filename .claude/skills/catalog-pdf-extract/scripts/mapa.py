#!/usr/bin/env python3
"""1. Mapa do PDF: secções → páginas → classificação proposta.

    python3 mapa.py tabela.pdf [--marca hisense --ano 2026] [-o mapa.json]
    python3 mapa.py --validar mapa.json          # depois de editar à mão

Estratégias, por ordem: outline do PDF (Mitsubishi), página(s) de índice
(Daikin, Hisense, Nipon), cabeçalho de cada página (Midea). O agente corrige
o ficheiro antes de extrair; `extrair.py` recusa um mapa que não passe em
`validar_mapa` (todas as páginas cobertas, classificação em todas as secções
que não são `ignorar`).
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pymupdf

from _comum import escrever_json, ler_json, slug

FAMILIAS = {"ar-condicionado", "bombas-de-calor", "aqs", "ventilacao", "chillers",
            "ventiloconvectores", "cortinas-de-ar", "purificadores-de-ar",
            "acessorios-e-controlo", "outros"}
COMPONENTES = {"conjunto", "unidade-interior", "unidade-exterior", "deposito",
               "acessorio", "comando"}
TIPOS_SECCAO = {"tabela", "compatibilidade", "ignorar"}

CAMPOS_CLASSIFICACAO = ("familia", "segmento", "sistema", "tipoUnidade", "componente")


# --- Text helpers -------------------------------------------------------------

def palavras_da_pagina(page: pymupdf.Page) -> list[tuple[float, float, float, float, str]]:
    """(x0, y0, x1, y1, palavra) com hífenes suaves (U+00AD) normalizados."""
    out = []
    for x0, y0, x1, y1, w, *_ in page.get_text("words"):
        w = w.replace("\xad", "-").strip()
        if w:
            out.append((x0, y0, x1, y1, w))
    return out


def bandas_texto(page: pymupdf.Page) -> list[tuple[float, list[tuple[float, str]]]]:
    """[(y, [(x, palavra), …])] por banda de 3 pt."""
    bandas: dict[int, list[tuple[float, str]]] = defaultdict(list)
    for x0, y0, _x1, _y1, w in palavras_da_pagina(page):
        bandas[round(y0 / 3)].append((x0, w))
    return [(k * 3, sorted(v)) for k, v in sorted(bandas.items())]


def texto_banda(banda: list[tuple[float, str]]) -> str:
    return " ".join(w for _, w in banda)


def normalizar(texto: str) -> str:
    return re.sub(r"\s+", " ", slug(texto).replace("-", " ")).strip()


def limpar_titulo(titulo: str) -> str:
    t = re.sub(r"\s+", " ", titulo).strip(" .·-–—|\t")
    t = re.sub(r"\s*\(continuação\)\s*", "", t, flags=re.I)
    return t.strip()


# --- Strategies ---------------------------------------------------------------

def numero_rodape(page: pymupdf.Page) -> int | None:
    """Número de página impresso: token só com 1-3 dígitos nos 6 % finais."""
    h = page.rect.height
    candidatos = []
    for _x0, y0, _x1, _y1, w in palavras_da_pagina(page):
        if y0 > h * 0.94 and re.fullmatch(r"\d{1,3}", w):
            candidatos.append(int(w))
    return candidatos[0] if len(candidatos) == 1 else None


def desfasamento_paginas(doc: pymupdf.Document, a_partir_de: int) -> int:
    """pdf_index − número impresso, o mais frequente nas páginas com rodapé."""
    diffs = Counter()
    for i in range(a_partir_de, len(doc)):
        n = numero_rodape(doc[i])
        if n is not None and 0 <= (i + 1) - n <= 5:
            diffs[(i + 1) - n] += 1
    return diffs.most_common(1)[0][0] if diffs else 0


CORES_SUFIXO_RX = re.compile(r"(?i)\s+(branco|preto|prateado|cinzento|inox|vermelho|prata)$")
IGNORAR_RX = re.compile(r"(?i)\b(condi[çc][õo]es|garantia|[íi]ndice|contactos|notas)\b")


def _pecas_da_pagina(page: pymupdf.Page) -> list[tuple[float, float, float, list[str]]]:
    """(y, x_meio, x1, palavras) por pedaço de banda: uma banda parte-se onde há
    um salto horizontal > 25 pt (índices em duas colunas)."""
    bandas: dict[int, list[tuple[float, float, str]]] = defaultdict(list)
    for x0, y0, x1, _y1, w in palavras_da_pagina(page):
        bandas[round(y0 / 3)].append((x0, x1, w))
    pecas = []
    for k, palavras in sorted(bandas.items()):
        palavras.sort()
        atual: list[tuple[float, float, str]] = []
        for i, tok in enumerate(palavras):
            resto_e_numero = i == len(palavras) - 1 and re.fullmatch(r"\d{1,3}", tok[2])
            if atual and tok[0] - atual[-1][1] > 25 and not resto_e_numero:
                pecas.append((k * 3, (atual[0][0] + atual[-1][1]) / 2, atual[-1][1], [t[2] for t in atual]))
                atual = []
            atual.append(tok)
        if atual:
            pecas.append((k * 3, (atual[0][0] + atual[-1][1]) / 2, atual[-1][1], [t[2] for t in atual]))
    return pecas


def _colunas(pecas: list[tuple[float, float, float, list[str]]]) -> list[list[tuple[float, float, float, list[str]]]]:
    """Agrupa pedaços por coluna (salto > 80 pt entre os x médios ordenados)."""
    if not pecas:
        return []
    ordenados = sorted(pecas, key=lambda p: p[1])
    colunas: list[list] = [[ordenados[0]]]
    for peca in ordenados[1:]:
        if peca[1] - max(q[1] for q in colunas[-1]) > 80:
            colunas.append([peca])
        else:
            colunas[-1].append(peca)
    return [sorted(c, key=lambda p: p[0]) for c in colunas]


def entradas_indice(page: pymupdf.Page, n_paginas: int) -> list[tuple[str, int]]:
    """[(título, página impressa)] de uma página de índice. Lê coluna a coluna;
    um título sem número na sua linha espera pelo número na linha seguinte
    (só o número, ou a continuação do título em minúsculas)."""
    out = []
    for coluna in _colunas(_pecas_da_pagina(page)):
        pendente = ""
        y_anterior = None
        for y, _xm, _x1, palavras in coluna:
            if y_anterior is not None and y - y_anterior > 20:
                pendente = ""
            y_anterior = y
            tem_numero = bool(re.fullmatch(r"\d{1,3}", palavras[-1]))
            texto = limpar_titulo(" ".join(palavras[:-1] if tem_numero else palavras))
            if not tem_numero:
                if not texto or (texto.isupper() and len(texto.split()) <= 2):
                    pendente = ""
                elif re.fullmatch(r"[\d\s.,]+", texto):
                    continue
                else:
                    pendente = f"{pendente} {texto}".strip() if pendente else texto
                continue
            n = int(palavras[-1])
            if not texto:
                titulo = pendente
            elif pendente and texto[0].islower():
                titulo = f"{pendente} {texto}"
            else:
                titulo = texto
            pendente = ""
            if not titulo or re.fullmatch(r"[\d\s.,]+", titulo) or not (1 <= n <= n_paginas):
                continue
            out.append((titulo, n))
    return out


def paginas_de_indice(doc: pymupdf.Document) -> list[int]:
    """Índices (0-based) das páginas de índice: ÍNDICE no texto ou ≥ 8 entradas."""
    out = []
    for i in range(min(len(doc), 8)):
        page = doc[i]
        texto = page.get_text()
        entradas = entradas_indice(page, len(doc))
        if (re.search(r"(?i)\bíndice\b", texto) and len(entradas) >= 3) or len(entradas) >= 8:
            out.append(i)
    return out


def cabecalho_pagina(page: pymupdf.Page) -> str | None:
    """Linha de maior tamanho de letra nos 15 % superiores da página."""
    h = page.rect.height
    melhor: tuple[float, str] | None = None
    for bloco in page.get_text("dict")["blocks"]:
        for linha in bloco.get("lines", []):
            texto = "".join(s["text"] for s in linha["spans"]).strip()
            if not texto or linha["bbox"][1] > h * 0.15:
                continue
            tamanho = max(s["size"] for s in linha["spans"])
            if melhor is None or tamanho > melhor[0]:
                melhor = (tamanho, texto)
    return limpar_titulo(melhor[1]) if melhor and melhor[0] >= 9 else None


def contexto_pagina(page: pymupdf.Page) -> str:
    """Texto do topo da página (≤ 8 %): 'Gama Comercial', 'Gama VRF Unidades Exteriores'."""
    h = page.rect.height
    return " ".join(w for _x0, y0, _x1, _y1, w in palavras_da_pagina(page) if y0 < h * 0.08)


# --- Classification -----------------------------------------------------------

def propor_classificacao(titulo: str, contexto: str = "") -> dict:
    """Proposta de familia/segmento/sistema/tipoUnidade/componente por palavras-chave."""
    t = normalizar(titulo)
    c = normalizar(contexto)
    vazio = {k: None for k in CAMPOS_CLASSIFICACAO}

    if "compat" in t:
        return {**vazio, "familia": "ar-condicionado", "segmento": _segmento(c),
                "sistema": "multi-split" if "multi" in c or "multi" in t else None,
                "tipoUnidade": "exterior", "componente": "unidade-exterior",
                "tipo": "compatibilidade"}
    if re.search(r"\b(acessorio|acessorios|kit wifi|controlo|comando|derivador|derivadores|"
                 r"caixas de recuperacao|conexao uta)\b", t):
        comando = bool(re.search(r"\b(controlo|comando|kit wifi)\b", t))
        return {**vazio, "familia": "acessorios-e-controlo", "segmento": _segmento(c),
                "componente": "comando" if comando else "acessorio"}
    if "chiller" in t:
        return {**vazio, "familia": "chillers", "segmento": "comercial",
                "tipoUnidade": "chiller", "componente": "conjunto"}
    if re.search(r"\b(hi water|aqs|termoacumulador|deposito|depositos)\b", t):
        return {**vazio, "familia": "aqs", "segmento": "domestico",
                "tipoUnidade": "monobloco-aqs", "componente": "conjunto"}
    if re.search(r"\b(ventilacao|recuperador|recuperadores|ar novo|uta|vmc)\b", t):
        tipo = ("recuperador-de-calor" if "recuperador" in t
                else "uta" if ("uta" in t or "ar novo" in t) else "vmc")
        return {**vazio, "familia": "ventilacao", "segmento": _segmento(c) or "comercial",
                "tipoUnidade": tipo, "componente": "conjunto"}
    if "hydrobox" in t:
        return {**vazio, "familia": "bombas-de-calor", "segmento": "comercial",
                "sistema": "vrf", "tipoUnidade": "modulo-hidraulico",
                "componente": "unidade-interior"}
    if "monobloco" in t:
        return {**vazio, "familia": "bombas-de-calor", "segmento": "domestico",
                "sistema": "monobloco", "tipoUnidade": "exterior", "componente": "conjunto"}
    if "vrf" in t or "vrf" in c:
        exterior = "exterior" in t or "exteriores" in c
        return {**vazio, "familia": "ar-condicionado", "segmento": "comercial", "sistema": "vrf",
                "tipoUnidade": "exterior" if exterior else _tipo_unidade(t),
                "componente": "unidade-exterior" if exterior else "unidade-interior"}
    if re.search(r"\b(hi therma|aerotermia|hydro|integra|bomba de calor)\b", t) or "aerotermia" in c:
        return {**vazio, "familia": "bombas-de-calor", "segmento": "domestico",
                "sistema": "bibloco", "tipoUnidade": "exterior", "componente": "conjunto"}
    if "multi" in t:
        comp = ("unidade-exterior" if "exterior" in t
                else "unidade-interior" if "interior" in t else "conjunto")
        return {**vazio, "familia": "ar-condicionado", "segmento": _segmento(c) or "comercial",
                "sistema": "multi-split",
                "tipoUnidade": "exterior" if comp == "unidade-exterior" else (_tipo_unidade(t) or "mural"),
                "componente": comp}
    if re.search(r"\b1 ?x ?1\b", t) or "residencial" in c or "comercial" in c:
        return {**vazio, "familia": "ar-condicionado", "segmento": _segmento(c) or "domestico",
                "sistema": "mono-split", "tipoUnidade": _tipo_unidade(t) or "mural",
                "componente": "conjunto"}
    return vazio


def _segmento(c: str) -> str | None:
    if "residencial" in c or "domestic" in c:
        return "domestico"
    if "comercial" in c or "vrf" in c:
        return "comercial"
    if "industrial" in c:
        return "industrial"
    return None


def _tipo_unidade(t: str) -> str | None:
    if "mini cassete" in t:
        return "mini-cassete"
    if "cassete" in t:
        if "1 via" in t:
            return "cassete-1-via"
        if "2 vias" in t:
            return "cassete-2-vias"
        return "cassete-4-vias"
    if "conduta" in t:
        if "baixa" in t:
            return "conduta-baixa-pressao"
        if "alta" in t and "media" not in t:
            return "conduta-alta-pressao"
        if "media" in t:
            return "conduta-media-pressao"
        return "conduta"
    if "chao teto" in t:
        return "chao-teto"
    if "chao sem envolvente" in t:
        return "chao-sem-envolvente"
    if "consola" in t:
        return "consola"
    if "coluna" in t:
        return "coluna"
    if "portatil" in t:
        return "portatil"
    if "mural" in t:
        return "mural"
    if "exterior" in t:
        return "exterior"
    return None


# --- Map building -------------------------------------------------------------

def _seccao(id_: str, titulo: str, paginas: list[int], classificacao: dict | None,
            tipo: str = "tabela") -> dict:
    s = {"id": id_, "titulo": titulo, "paginas": paginas, "tipo": tipo}
    if tipo != "ignorar":
        cls = classificacao or {k: None for k in CAMPOS_CLASSIFICACAO}
        tipo_cls = cls.pop("tipo", None)
        if tipo_cls:
            s["tipo"] = tipo_cls
        s.update({k: cls.get(k) for k in CAMPOS_CLASSIFICACAO})
        s["gama"] = titulo
        s["semPreco"] = False
        s["avisos"] = []
    return s


def _ids_unicos(seccoes: list[dict]) -> None:
    vistos: Counter = Counter()
    for s in seccoes:
        base = s["id"]
        vistos[base] += 1
        if vistos[base] > 1:
            s["id"] = f"{base}-{vistos[base]}"


def _intervalos(entradas: list[tuple[str, int]], n_paginas: int) -> list[tuple[str, list[int]]]:
    """Cada entrada vai da sua página até à página anterior à próxima entrada
    com página maior. Entradas na mesma página partilham-na."""
    out = []
    for i, (titulo, pag) in enumerate(entradas):
        fim = n_paginas
        for _t, p in entradas[i + 1:]:
            if p > pag:
                fim = p - 1
                break
        out.append((titulo, list(range(pag, max(pag, fim) + 1))))
    return out


def _completar_ignoradas(seccoes: list[dict], n_paginas: int) -> None:
    cobertas = {p for s in seccoes for p in s["paginas"]}
    livres = [p for p in range(1, n_paginas + 1) if p not in cobertas]
    grupos: list[list[int]] = []
    for p in livres:
        if grupos and grupos[-1][-1] == p - 1:
            grupos[-1].append(p)
        else:
            grupos.append([p])
    for g in grupos:
        seccoes.append(_seccao(f"ignorar-p{g[0]}", f"Páginas {g[0]}-{g[-1]} sem tabela",
                               g, None, tipo="ignorar"))
    seccoes.sort(key=lambda s: (s["paginas"][0], 0 if s["tipo"] != "ignorar" else 1))


def localizar_titulo(page: pymupdf.Page, titulo: str) -> tuple[float, str] | None:
    """(y, texto impresso) da banda que imprime o título — ≥ 60 % das palavras
    numa banda curta ou em duas bandas consecutivas ('Recuperadores…' +
    'sem bateria DX') — ou None."""
    alvo = [w for w in normalizar(titulo).split() if len(w) >= 2]
    if not alvo:
        return None
    bandas = bandas_texto(page)
    candidatos: list[tuple[float, str]] = []
    for i, (y, banda) in enumerate(bandas):
        texto = texto_banda(banda)
        candidatos.append((y, texto))
        if i + 1 < len(bandas) and bandas[i + 1][0] - y <= 18:
            candidatos.append((y, f"{texto} {texto_banda(bandas[i + 1][1])}"))
    melhor: tuple[float, float, str] | None = None  # (score, y, texto)
    for y, texto in candidatos:
        palavras = normalizar(texto).split()
        if not palavras or len(palavras) > len(alvo) + 6:
            continue
        comuns = sum(1 for w in alvo if w in palavras)
        score = comuns / len(alvo) - 0.01 * (len(palavras) - comuns)
        if comuns / len(alvo) >= 0.6 and (melhor is None or score > melhor[0]):
            melhor = (score, y, texto)
    return (melhor[1], limpar_titulo(melhor[2])) if melhor else None


def posicao_titulo(page: pymupdf.Page, titulo: str) -> float | None:
    hit = localizar_titulo(page, titulo)
    return hit[0] if hit else None


def _preparar_entradas(entradas: list[tuple[str, int]]) -> list[tuple[str, int]]:
    """Funde subgamas de cor, tira cabeçalhos-pai em maiúsculas que partilham
    a página com outra entrada e remove duplicados."""
    limpas: list[tuple[str, int]] = []
    for titulo, pag in entradas:
        titulo = limpar_titulo(CORES_SUFIXO_RX.sub("", titulo))
        if (titulo, pag) not in limpas:
            limpas.append((titulo, pag))
    por_pagina = Counter(p for _t, p in limpas)
    return [(t, p) for t, p in limpas
            if not (t.isupper() and por_pagina[p] > 1)]


def _resolver_inicio(doc: pymupdf.Document, entradas: list[tuple[str, int]]) -> list[tuple[str, int, bool]]:
    """Confirma a página de cada título; se não está na página do índice,
    procura até à entrada seguinte com página maior. Entradas que o PDF imprime
    num só cabeçalho ('Hydro-Split' + 'Hydro-integra' → 'Hi-Therma II Hydro-Split
    e Hydro-Integra') fundem-se numa, com o título impresso.
    Devolve (título, página, encontrado)."""
    out: list[tuple[str, int, bool]] = []
    vistos: dict[tuple[int, float], int] = {}  # (página, y do título) → índice em out
    n = len(doc)
    for i, (titulo, pag) in enumerate(entradas):
        limite = next((p for _t, p in entradas[i + 1:] if p > pag), n + 1)
        hit = None
        for p in range(pag, min(limite, n + 1)):
            hit = localizar_titulo(doc[p - 1], titulo)
            if hit is not None:
                hit = (p, *hit)
                break
        if hit is None:
            out.append((titulo, pag, False))
            continue
        p, y, impresso = hit
        if (p, y) in vistos:
            j = vistos[(p, y)]
            out[j] = (impresso, p, True)
            continue
        vistos[(p, y)] = len(out)
        out.append((titulo, p, True))
    return out


def _seccoes_de(doc: pymupdf.Document, entradas: list[tuple[str, int]]) -> list[dict]:
    resolvidas = _resolver_inicio(doc, _preparar_entradas(entradas))
    resolvidas.sort(key=lambda e: e[1])
    encontrados = {(t, p): ok for t, p, ok in resolvidas}
    # "Energy Pro X Branco 12" + "Energy Pro X Preto 13" → uma secção em 12-13
    unicas: list[tuple[str, int, bool]] = []
    for t, p, ok in resolvidas:
        if unicas and unicas[-1][0] == t:
            continue
        unicas.append((t, p, ok))
    seccoes = []
    for titulo, paginas in _intervalos([(t, p) for t, p, _ok in unicas], len(doc)):
        page = doc[paginas[0] - 1]
        if IGNORAR_RX.search(titulo):
            seccoes.append(_seccao(slug(titulo), titulo, paginas, None, tipo="ignorar"))
            continue
        cls = propor_classificacao(titulo, contexto_pagina(page))
        s = _seccao(slug(titulo), titulo, paginas, cls)
        if not encontrados.get((titulo, paginas[0])):
            s["avisos"].append(
                f"título não encontrado na página {paginas[0]} — confirmar página/desfasamento")
        seccoes.append(s)
    _ids_unicos(seccoes)
    return seccoes


def gerar_mapa(doc: pymupdf.Document, ficheiro: str, marca: str | None = None,
               ano: int | None = None) -> dict:
    n = len(doc)
    mapa: dict = {"ficheiro": ficheiro, "marca": marca, "ano": ano, "numPaginas": n}

    toc = doc.get_toc()
    if toc:
        folhas = [(t, p) for i, (nivel, t, p) in enumerate(toc)
                  if not (i + 1 < len(toc) and toc[i + 1][0] > nivel)]
        mapa["estrategia"] = "outline"
        mapa["desfasamento"] = 0
        seccoes = _seccoes_de(doc, [(limpar_titulo(t), p) for t, p in folhas if 1 <= p <= n])
    else:
        idx = paginas_de_indice(doc)
        if idx:
            desfasamento = desfasamento_paginas(doc, idx[-1] + 1)
            entradas = []
            for i in idx:
                for titulo, impresso in entradas_indice(doc[i], n):
                    pdf = impresso + desfasamento
                    if idx[-1] + 1 < pdf <= n:
                        entradas.append((titulo, pdf))
            entradas.sort(key=lambda e: e[1])
            mapa["estrategia"] = "indice"
            mapa["desfasamento"] = desfasamento
            seccoes = _seccoes_de(doc, entradas)
        else:
            mapa["estrategia"] = "cabecalhos"
            mapa["desfasamento"] = 0
            seccoes = []
            for i in range(n):
                titulo = cabecalho_pagina(doc[i])
                if not titulo:
                    continue
                if seccoes and seccoes[-1]["titulo"] == titulo and seccoes[-1]["paginas"][-1] == i:
                    seccoes[-1]["paginas"].append(i + 1)
                    continue
                cls = propor_classificacao(titulo, contexto_pagina(doc[i]))
                seccoes.append(_seccao(slug(titulo), titulo, [i + 1], cls))
            _ids_unicos(seccoes)

    _completar_ignoradas(seccoes, n)
    mapa["seccoes"] = seccoes
    return mapa


# --- Validation ---------------------------------------------------------------

def validar_mapa(mapa: dict) -> list[str]:
    erros: list[str] = []
    n = int(mapa.get("numPaginas") or 0)
    seccoes = mapa.get("seccoes") or []
    ids = Counter(s.get("id") for s in seccoes)
    for id_, k in ids.items():
        if k > 1:
            erros.append(f"id de secção repetido: {id_}")
    cobertas: set[int] = set()
    for s in seccoes:
        sid = s.get("id") or "?"
        tipo = s.get("tipo", "tabela")
        if tipo not in TIPOS_SECCAO:
            erros.append(f"secção {sid}: tipo inválido '{tipo}'")
        paginas = s.get("paginas") or []
        if not paginas:
            erros.append(f"secção {sid}: sem páginas")
        for p in paginas:
            if not isinstance(p, int) or p < 1 or p > n:
                erros.append(f"secção {sid}: página {p} fora do PDF (1-{n})")
            cobertas.add(p)
        if tipo == "ignorar":
            continue
        if s.get("familia") not in FAMILIAS:
            erros.append(f"secção {sid}: familia em falta ou inválida ({s.get('familia')!r})")
        if s.get("componente") not in COMPONENTES:
            erros.append(f"secção {sid}: componente em falta ou inválido ({s.get('componente')!r})")
    for p in range(1, n + 1):
        if p not in cobertas:
            erros.append(f"página {p} não pertence a nenhuma secção (usa tipo 'ignorar' se não tem tabela)")
    return erros


# --- CLI ----------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf", nargs="?", type=Path)
    ap.add_argument("--marca")
    ap.add_argument("--ano", type=int)
    ap.add_argument("-o", "--out", type=Path)
    ap.add_argument("--validar", type=Path, help="só validar um mapa.json já editado")
    args = ap.parse_args()

    if args.validar:
        erros = validar_mapa(ler_json(args.validar))
        for e in erros:
            print(f"  ✗ {e}")
        print("mapa OK" if not erros else f"{len(erros)} erro(s)")
        sys.exit(1 if erros else 0)

    if not args.pdf:
        ap.error("indica o PDF ou --validar mapa.json")
    doc = pymupdf.open(args.pdf)
    mapa = gerar_mapa(doc, args.pdf.name, args.marca, args.ano)
    out = args.out or args.pdf.with_name("mapa.json")
    escrever_json(out, mapa)
    tabelas = [s for s in mapa["seccoes"] if s["tipo"] != "ignorar"]
    print(f"{args.pdf.name}: {mapa['numPaginas']} páginas, estratégia {mapa['estrategia']}, "
          f"{len(tabelas)} secções (+{len(mapa['seccoes']) - len(tabelas)} ignoradas) → {out}")
    for s in tabelas:
        pags = f"{s['paginas'][0]}" if len(s["paginas"]) == 1 else f"{s['paginas'][0]}-{s['paginas'][-1]}"
        cls = "/".join(str(s.get(k) or "?") for k in CAMPOS_CLASSIFICACAO)
        aviso = f"  ⚠ {'; '.join(s['avisos'])}" if s.get("avisos") else ""
        print(f"  p{pags:>6}  {s['id']:40} {cls}{aviso}")
    erros = validar_mapa(mapa)
    if erros:
        print(f"\n{len(erros)} campo(s) a corrigir à mão antes de extrair:")
        for e in erros:
            print(f"  ✗ {e}")


if __name__ == "__main__":
    main()

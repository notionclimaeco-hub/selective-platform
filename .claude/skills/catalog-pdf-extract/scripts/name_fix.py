#!/usr/bin/env python3
"""Reconstrói `nomeGrupo` / `gama` / `ref` a partir do PDF, em vez dos restos
que a primeira extração deixou.

O extractor tende a montar títulos como "<rótulo genérico> <cabeçalho da secção
do PDF> <ref de uma variante>", e isso aparece no site: os cartões e a página de
produto usam `nomeGrupo` e imprimem `gama` ao lado. Sintomas (exemplos reais da
tabela Daikin 2026):

  Ar Condicionado FCAG-B R-32 KDBHQ56B140      ← refrigerante + ref no título
  Ventilação Ducobox e acessórios 24VDC/20W    ← specs (V/W) no título
  3) Sensor de temperatura ambiente sem fios EKEWTSC-2   ← nota de pé de página
  4) compressor/Erro, Ventilador, Resistência aux., EKRP1C12  ← frase cortada
  Bomba de Calor Classes 4-6-8 65ºC ERGA04EV   ← grupo de 3 refs nomeado por 1

Usar como módulo a partir do `fix_warnings.py` da marca:

    stats = name_fix.fix_all(rows, pdf_path)   # refs → taxonomia → títulos → nomes

ou em pré-visualização (não escreve nada):

    python3 name_fix.py produtos.csv --pdf tabela.pdf
    python3 name_fix.py produtos.csv --pdf tabela.pdf --apply   # escreve o CSV

As tabelas `GAMA_FIX` e `TIPO_POR_PREFIXO` são específicas da nomenclatura
Daikin; ao usar noutra marca, revê-as antes (o resto das regras — notas de pé de
página, cabeçalhos de secção, refrigerante, refs no título — é genérico).
"""

from __future__ import annotations

import argparse
import re
from collections import Counter, defaultdict
from pathlib import Path

# --- o que nunca pode aparecer num título -----------------------------------
JUNK_RX = [
    re.compile(r"^\s*(?:\(?\d{1,2}\)\s*)+"),              # "3) ", "9) (10) "
    re.compile(r"\(\s*\d{1,2}\s*\)"),                     # "(4)" no meio
    re.compile(r"(?i)\bNOVIDADE\b\s*:?"),
    re.compile(r"(?i)\bNOVO\b(?=\s|$)"),
    re.compile(r"(?i)\bgama\b"),
    re.compile(r"(?i)\bopções\b"),
    re.compile(r"\bTABELA\b|\bPREÇOS\b"),
    re.compile(r"(?i)\bR-?\s?(?:32|290|410A|407C|134A|1234ZE)\b"),   # refrigerante
    re.compile(r"(?i)\bRead\s*y\b"),
    re.compile(r"\b\d+\s*[ºo°]\s*C\b"),                   # 65ºC
    re.compile(r"(?i)\b\d+\s*V(?:DC|AC)?\s*/\s*\d+\s*W\b"),  # 24VDC/20W
    re.compile(r"(?i)\b\d+\s*W\b"),                       # 20W
    re.compile(r"(?i)\bClasses?\s+\d[\d\-–/]*\b"),        # Classes 4-6-8
]
# Cosmético: só se aplica a títulos que já vão ser reescritos, para não mexer
# em parênteses que distinguem grupos curados ("… ECH2O (kit 2A)").
NOTE_RX = [
    re.compile(r"\([^)]*\)"),          # "(incluido no preço do conjunto)", "(10m)"
    re.compile(r"\([^)]*$"),           # parêntesis aberto e cortado pelo parser
]
# Caixa alta que o PDF usa em cabeçalhos de secção, não em nomes de produto.
UPPER_OK = {"UTA", "AQS", "VMC", "BUH", "ECH2O", "HPC", "VRV", "LED", "USB", "AQUA"}
# Palavras que por si só não identificam produto (rótulo de família/secção).
GENERIC_RX = (r"(?i)\b(ar condicionado|acess[óo]rios?|comandos?|controlo|"
              r"ventila[çc][ãa]o|ventilo-?convectores?|bomba de calor|"
              r"purificador de ar|split|multi|tecnologia|daikin|comercial|"
              r"equipamento|unidade|interior|exterior|de|do|da|e|para|com|ou)\b|[|/]")
CORES = {
    "branco": "branco", "brancos": "branco", "preto": "preto", "pretos": "preto",
    "prateado": "prateado", "prata": "prateado", "cinzento": "cinzento",
    "inox": "inox", "grafite": "grafite", "champagne": "champagne",
    "bege": "bege", "madeira": "madeira",
}
COR_NO_NOME = re.compile(r"(?i)\b(" + "|".join(CORES) + r")\b")
# Fragmento de frase cortado pelo parser ("Tecnologia de", "Kit de"). Só conta
# a palavra minúscula depois de um espaço — "FTXM-A" ou "EPBX-E" são códigos de
# série, não preposições.
TERMINA_MAL = re.compile(r"\s(de|do|da|dos|das|e|com|para|em|no|na|por|sem|"
                         r"que|ou|a|o|as|os)$")
# Tokens que são claramente uma referência de produto (2+ letras e um dígito).
REF_TOKEN_RX = re.compile(r"^[A-Z][A-Z0-9]*[A-Z][A-Z0-9./\-]*\d[A-Z0-9./\-]*$")
PRICE_RX = re.compile(r"€|^\d{1,3}(?:[.,]\d{3})*$")

# Rótulo de recurso quando não sobra nada descritivo.
FAM_LABEL = {
    ("ar-condicionado", "conjunto"): "Ar Condicionado",
    ("ar-condicionado", "unidade-interior"): "Unidade Interior",
    ("ar-condicionado", "unidade-exterior"): "Unidade Exterior",
    ("bombas-de-calor", "conjunto"): "Bomba de Calor",
    ("bombas-de-calor", "unidade-interior"): "Unidade Interior",
    ("bombas-de-calor", "unidade-exterior"): "Unidade Exterior",
    ("bombas-de-calor", "deposito"): "Depósito AQS",
    ("aqs", "conjunto"): "Bomba de Calor AQS",
    ("aqs", "deposito"): "Depósito AQS",
    ("ventilacao", "conjunto"): "Ventilação",
    ("ventiloconvectores", "conjunto"): "Ventiloconvector",
    ("ventiloconvectores", "unidade-interior"): "Ventiloconvector",
    ("chillers", "conjunto"): "Chiller",
    ("cortinas-de-ar", "conjunto"): "Cortina de Ar",
    ("purificadores-de-ar", "conjunto"): "Purificador de Ar",
    ("acessorios-e-controlo", "acessorio"): "Acessório",
    ("acessorios-e-controlo", "comando"): "Comando",
}
# Rótulos que não dizem nada sobre o produto — nestes vale a pena usar a gama.
ROTULO_VAGO = {"Acessório", "Equipamento", "Ar Condicionado", "Ventilação"}
# Prefixo de referência → tipo de unidade (nomenclatura Daikin).
TIPO_POR_PREFIXO = [
    (re.compile(r"^(?:FTX|CTX|FVX)"), "mural"),
    (re.compile(r"^(?:FDX|FDA|FBA|ADE|FDM|FMA)"), "conduta"),
    (re.compile(r"^(?:FFA|FFQ|FCA|FUA|FUQ)"), "cassete"),
    (re.compile(r"^(?:FVA|FVQ|FNA|FNQ)"), "consola"),
    (re.compile(r"^(?:FHA|FHQ)"), "chao-teto"),
    (re.compile(r"^(?:RX|RZ|MX|AZ[AQ]|ARX)"), "exterior"),
]
TIPO_LABEL = {
    "mural": "Mural", "conduta": "Conduta", "cassete": "Cassete",
    "consola": "Consola", "chao-teto": "Chão-Teto", "exterior": "Unidade Exterior",
    "cassete-4-vias": "Cassete 4 Vias", "cassete-1-via": "Cassete 1 Via",
    "conduta-baixa-pressao": "Conduta Baixa Pressão",
    "conduta-media-pressao": "Conduta Média Pressão",
    "coluna": "Coluna", "teto": "Teto", "uta": "UTA", "chiller": "Chiller",
    "integrada": "Unidade Integrada", "modulo-hidraulico": "Módulo Hidráulico",
    "rooftop": "Rooftop", "vmc": "VMC", "recuperador": "Recuperador de Calor",
}
# `gama` também é impressa no site (card + página) — limpar os cabeçalhos do PDF.
GAMA_FIX = {
    "NOVIDADE: gama Multi A8": "Multi A8",
    "GAMA MULTI - SENSIRA": "Sensira",
    "DEPÓSITOS DE ACUMULAÇÃO AQS": "Depósitos AQS",
    "VENTILAÇÃO": "Ventilação",
    "OPÇÕES - VENTILAÇÃO": "",
    "Opções - Split": "",
    "Comandos e acessórios": "",
    "Ventilo-convectores": "",
    "Ventiloconvector": "",
    "Acessório": "",
    "Purificador": "",
    "Válvula": "",
    "Tabuleiro": "",
    "Controlo Compatibilidade": "Controlo",
    "75ºC Read y": "",
    "Read y": "",
    "comercial Daikin.": "",
    "› Excelente eficiência sazonal": "",
    "contrafluxo": "Contrafluxo",
    "Ducobox e acessórios": "Ducobox",
}


def collapse(s: str) -> str:
    s = re.sub(r"[|/,;:]\s*$", "", s.strip())
    s = re.sub(r"\s{2,}", " ", s)
    return s.strip(" -–—|,;:.")


def sem_repetidos(s: str) -> str:
    """"HidroSplit HidroSplit" → "HidroSplit" (a descrição repete a secção)."""
    vistos: list[str] = []
    for w in s.split():
        if not vistos or w.lower() != vistos[-1].lower():
            vistos.append(w)
    fora: list[str] = []
    for w in vistos:
        if w.lower() in {x.lower() for x in fora}:
            continue
        fora.append(w)
    return collapse(" ".join(fora))


def strip_junk(s: str) -> str:
    for rx in JUNK_RX:
        s = rx.sub(" ", s)
    return collapse(s)


def drop_refs(s: str, refs: set[str]) -> str:
    out = []
    for tok in s.split():
        bare = tok.strip("(),;:").upper()
        if bare in refs or REF_TOKEN_RX.match(bare):
            continue
        out.append(tok)
    return collapse(" ".join(out))


def serie_do_slug(slug: str, refs: set[str]) -> str:
    """daikin-ctxf-f + {CTXF20F,…} → 'CTXF-F' (só quando bate com as refs)."""
    tail = slug[len("daikin-"):] if slug.startswith("daikin-") else slug
    if not tail:
        return ""
    # O slug leva sufixos que não são série ("-ui", "-ue", o lado da unidade):
    # ficar pelo prefixo mais longo que ainda bate com as refs do grupo.
    refs_letras = [re.sub(r"[^A-Z]", "", r.upper()) for r in refs]
    segmentos = tail.upper().split("-")
    melhor = ""
    for n in range(1, len(segmentos) + 1):
        cand = "-".join(segmentos[:n])
        letras = re.sub(r"[^A-Z]", "", cand)
        if len(letras) >= 3 and any(rl.startswith(letras) for rl in refs_letras):
            melhor = cand
    return melhor


def is_descritivo(s: str) -> bool:
    """Frase que serve de título: 2+ palavras, começa em maiúscula, sem lixo."""
    if not s or len(s) < 4:
        return False
    words = s.split()
    if len(words) > 9:
        return False
    if not s[0].isupper():
        return False               # fragmento de frase do PDF ("pelo que deverá…")
    if s.count(",") >= 2 or TERMINA_MAL.search(s):
        return False
    # Lista de compatibilidade ("FTXZ-N | RXZ-N") não é nome de produto.
    if all(w.upper() == w for w in words if w.isalnum() or "-" in w):
        return False
    # Cabeçalho de secção do PDF ("… MULTI | SENSIRA", "DEPÓSITOS DE ACUMULAÇÃO").
    for w in words:
        bare = w.strip("|,.;:()")
        if (len(bare) >= 4 and bare.isalpha() and bare.upper() == bare
                and bare.upper() not in UPPER_OK):
            return False
    # Rótulo genérico (com ou sem restos de cabeçalho) não conta como descrição:
    # "Acessório", "Acessório | Split", "Ar Condicionado Multi" → usar o fallback.
    sinal = [w for w in re.sub(GENERIC_RX, " ", s).split() if w.isalnum() or "-" in w]
    if not sinal:
        return False
    # Rótulo + lista de compatibilidade ("Acessório / ADEA-A"): o que sobra do
    # rótulo genérico são códigos de modelo, não uma descrição.
    if all(w.upper() == w for w in sinal):
        return False
    return True


def pdf_desc_index(pdf_path: Path) -> dict[str, str]:
    """ref → texto impresso à direita da ref na mesma linha do PDF."""
    import fitz

    doc = fitz.open(pdf_path)
    out: dict[str, Counter] = defaultdict(Counter)
    for page in doc:
        bands: dict[int, list[tuple[float, str]]] = defaultdict(list)
        for x0, y0, _x1, _y1, word, *_ in page.get_text("words"):
            bands[round(y0 / 3)].append((x0, word))
        for toks in bands.values():
            toks.sort()
            words = [w for _, w in toks]
            for i, w in enumerate(words):
                bare = w.strip("(),;:").upper()
                if not REF_TOKEN_RX.match(bare) or len(bare) < 5:
                    continue
                tail: list[str] = []
                for nxt in words[i + 1:]:
                    up = nxt.strip("(),;:").upper()
                    if PRICE_RX.search(nxt) or REF_TOKEN_RX.match(up):
                        break
                    tail.append(nxt)
                cand = strip_junk(" ".join(tail))
                if is_descritivo(cand):
                    out[bare][cand] += 1
    return {ref: c.most_common(1)[0][0] for ref, c in out.items()}


def precisa_correcao(nome: str, refs: set[str], n_skus: int) -> bool:
    if not nome:
        return True
    if nome != strip_junk(nome):
        return True                                  # lixo/specs no título
    toks = nome.split()
    if n_skus > 1 and toks and toks[-1].upper() in refs:
        return True                                  # grupo nomeado por 1 variante
    if not nome[0].isupper() or TERMINA_MAL.search(nome):
        return True
    if nome != sem_repetidos(nome):
        return True                                  # "Ventilação VENTILAÇÃO"
    # Título sem descrição e sem código de modelo ("Ventilo-convectores",
    # "Painel") não identifica nada — reconstruir.
    ultimo = toks[-1] if toks else ""
    tem_codigo = bool(re.search(r"\d", ultimo)) or (
        len(ultimo) >= 3 and ultimo.upper() == ultimo and ultimo[0].isalpha())
    if not is_descritivo(nome) and not tem_codigo:
        return True
    return False


def fix_group_names(rows: list[dict], pdf_path: Path | None = None) -> int:
    descs = pdf_desc_index(pdf_path) if pdf_path and Path(pdf_path).is_file() else {}

    # `gama` aparece no site ao lado do nome — limpar sempre.
    for r in rows:
        gama = (r.get("gama") or "").strip()
        if gama in GAMA_FIX:
            r["gama"] = GAMA_FIX[gama]
        elif gama:
            limpo = strip_junk(gama)
            r["gama"] = limpo if limpo else ""

    grupos: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        grupos[r["grupoModelo"]].append(r)

    corrigidos = 0
    for slug, items in grupos.items():
        base = items[0]
        nome_grupo = (base.get("nomeGrupo") or "").strip()
        refs = {i["ref"].upper() for i in items}
        if not precisa_correcao(nome_grupo, refs, len(items)):
            continue

        # 1) o que sobra do título atual depois de tirar refs, gama, lixo e notas
        head = strip_junk(nome_grupo)
        for rx in NOTE_RX:
            head = rx.sub(" ", head)
        head = drop_refs(collapse(head), refs)
        for pedaco in {(i.get("gama") or "") for i in items} | {base.get("gama") or ""}:
            if pedaco:
                head = collapse(head.replace(pedaco, " "))
        if not is_descritivo(head):
            # 2) descrição impressa ao lado da ref no PDF
            head = ""
            for ref in sorted(refs):
                cand = descs.get(ref, "")
                for rx in NOTE_RX:
                    cand = rx.sub(" ", cand)
                if is_descritivo(collapse(cand)):
                    head = collapse(cand)
                    break
        if not is_descritivo(head):
            # 3) a descrição da tabela ("HidroSplit R-32" → "HidroSplit")
            head = sem_repetidos(strip_junk(base.get("descricao") or ""))
        if not is_descritivo(head):
            # 4) rótulo do tipo de unidade (do CSV ou do prefixo da ref) e, só
            # quando esse rótulo é vago, a gama — que o site já mostra ao lado
            # do nome, pelo que repeti-la no título é redundante.
            tipo = base.get("tipoUnidade") or ""
            if not tipo:
                ref0 = sorted(refs)[0]
                tipo = next((t for rx, t in TIPO_POR_PREFIXO if rx.match(ref0)), "")
            rotulo = TIPO_LABEL.get(tipo) or FAM_LABEL.get(
                (base["familia"], base["componente"]), "Equipamento"
            )
            gama = base.get("gama") or ""
            head = (gama if rotulo in ROTULO_VAGO and is_descritivo(gama)
                    else rotulo)

        # Limpeza final do head, seja qual for a fonte: notas, travessões e cor
        # (a cor vive no atributo `cor`, nunca no título — convenção do schema).
        for rx in NOTE_RX:
            head = rx.sub(" ", head)
        head = sem_repetidos(collapse(re.split(r"\s[–—]\s|\s-\s", head)[0]))
        cor = COR_NO_NOME.search(head)
        if cor:
            head = collapse(COR_NO_NOME.sub(" ", head))
            valor = CORES[cor.group(0).lower()]
            for i in items:
                d = dict(p.split("=", 1) for p in (i["atributos"] or "").split(";")
                         if "=" in p)
                d.setdefault("cor", valor)
                i["atributos"] = ";".join(f"{k}={v}" for k, v in d.items())
        if not is_descritivo(head):
            head = FAM_LABEL.get((base["familia"], base["componente"]), "Acessório")

        # Código: série quando o grupo tem várias refs, modelo quando é único.
        if len(items) > 1:
            codigo = serie_do_slug(slug, refs)
        else:
            codigo = sorted(refs)[0]
        novo = compor(head, codigo)
        if not novo:
            continue
        if novo != nome_grupo:
            corrigidos += 1
            for i in items:
                i["nomeGrupo"] = novo[:80]

    corrigidos += desambiguar(grupos)
    return corrigidos


def desambiguar(grupos: dict[str, list[dict]]) -> int:
    """Dois grupos com o mesmo título são dois produtos indistinguíveis no
    catálogo. Acrescenta o código do modelo a quem colide."""
    por_titulo: dict[str, list[str]] = defaultdict(list)
    for slug, items in grupos.items():
        por_titulo[items[0]["nomeGrupo"]].append(slug)

    n = 0
    for titulo, slugs in por_titulo.items():
        if len(slugs) < 2:
            continue
        for slug in slugs:
            items = grupos[slug]
            refs = {i["ref"].upper() for i in items}
            codigo = (serie_do_slug(slug, refs) if len(items) > 1
                      else sorted(refs)[0])
            if not codigo:
                codigo = sem_digitos_comum(refs)
            if not codigo or codigo.upper() in titulo.upper():
                continue
            n += 1
            for i in items:
                i["nomeGrupo"] = compor(titulo, codigo)[:80]
    return n


def compor(head: str, codigo: str) -> str:
    """Junta título e código de série. O `|` separa o produto do qualificador
    ("Mural Stylish | Unidade Interior"), por isso o código pertence ao primeiro
    segmento — no fim ficaria colado ao qualificador e ilegível."""
    if not codigo or codigo.upper() in head.upper():
        return collapse(head)
    if "|" in head:
        cabeca, _, resto = head.partition("|")
        return collapse(f"{cabeca.strip()} {codigo} | {resto.strip()}")
    return collapse(f"{head} {codigo}")


def sem_digitos_comum(refs: set[str]) -> str:
    """Código de série implícito: a ref sem os dígitos de tamanho, quando todas
    as refs do grupo concordam ("SB.EKSH26P/2DB" → "SB.EKSHP/DB")."""
    formas = {re.sub(r"\d+", "", r.upper()) for r in refs}
    return formas.pop() if len(formas) == 1 else ""


# Substantivos que denunciam um acessório arquivado como equipamento
# (ex.: "Kit de tabuleiro de condensados" com familia=ar-condicionado).
ACESSORIO_NOUN = re.compile(
    r"(?i)^(kit|filtro|painel|sensor|comando|controlador|adaptador|placa|grelha|"
    r"tabuleiro|plenum|cablagem|suporte|tubagem|válvula|bomba de condensados|"
    r"resistência|caixa de distribuição|caixas de distribuição|termostato|"
    r"receptor|difusor|conduta flexível|isolamento|manómetro|purgador)\b"
)


def fix_accessory_taxonomy(rows: list[dict]) -> int:
    """Acessórios que ficaram em familia=ar-condicionado/componente=conjunto
    aparecem no catálogo como equipamento. Reclassifica os óbvios."""
    grupos: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        grupos[r["grupoModelo"]].append(r)

    n = 0
    for items in grupos.values():
        base = items[0]
        if base["componente"] != "conjunto":
            continue
        # equipamento a sério tem potências; acessório não
        tem_potencia = any(
            k in (i["atributos"] or "") for i in items
            for k in ("frio-kw=", "calor-kw=", "capacidade=", "btu=", "classe-energetica=")
        )
        substantivo = bool(ACESSORIO_NOUN.match(base.get("nomeGrupo") or ""))
        if tem_potencia or not (substantivo or base["familia"] == "ar-condicionado"):
            continue
        n += 1
        for i in items:
            i["familia"] = "acessorios-e-controlo"
            i["componente"] = "acessorio"
            i["tipoUnidade"] = ""
    return n


FOOTNOTE_REF = re.compile(r"\(\s*\d{1,2}\s*\)?$")     # "BRP069C81(4", "EKRP1HBA(1)"
COMBINED_PAREN = re.compile(r"\(([A-Z](?:/[A-Z])+)\)")  # "BRC1HHD(K/S/W)7"


def ref_canonico(ref: str) -> str:
    """A tabela imprime notas de pé de página dentro da própria referência
    ("BRP069C81(4") e agrupa cores entre parênteses ("BRC1HHD(K/S/W)7").

    Nota: refs com barra fora de parênteses NÃO são partidas — em muitas famílias
    o sufixo depois da barra é significativo (SB.EKSH26P/2DB vs /3DB, DCOM-LT/IO
    vs /MB), e colapsá-las funde SKUs distintos.
    """
    r = FOOTNOTE_REF.sub("", ref.strip()).strip()
    r = COMBINED_PAREN.sub(lambda m: m.group(1).split("/")[0], r)
    return r.strip()


# "Refs" que são de facto especificações apanhadas na coluna errada (pág. 104,
# Duco: os produtos reais têm refs numéricas 00004xxx e não foram extraídos).
REF_FANTASMA = re.compile(r"(?i)^\d*\s*V(?:AC|DC)\b|^\d+V(?:AC|DC)?-?$|^230VAC-$|^24VDC")


def fix_refs(rows: list[dict]) -> tuple[int, int]:
    """Normaliza refs e atributos, e remove SKUs duplicados ou fantasma."""
    fantasmas = [r for r in rows if REF_FANTASMA.match(r["ref"].strip())]
    for r in fantasmas:
        rows.remove(r)

    tocadas = 0
    for r in rows:
        novo = ref_canonico(r["ref"])
        if novo and novo != r["ref"]:
            r["ref"] = novo
            tocadas += 1
        # atributos herdaram o mesmo lixo (modelo=D-RA(1, tamanho=1HBA(1)
        pares = []
        for par in (r["atributos"] or "").split(";"):
            if "=" not in par:
                continue
            k, v = par.split("=", 1)
            v = FOOTNOTE_REF.sub("", v.strip()).strip()
            if k == "modelo":
                v = ref_canonico(v) or v
            if v:
                pares.append(f"{k}={v}")
        r["atributos"] = ";".join(pares)

    # Duplicados: a mesma ref listada em várias páginas/notas do PDF.
    por_ref: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        por_ref[r["ref"].upper()].append(r)
    remover: list[dict] = []
    for dups in por_ref.values():
        if len(dups) < 2:
            continue
        # fica a linha mais informativa (mais atributos, nome mais específico)
        dups.sort(key=lambda r: (len(r["atributos"]), len(r["nomeGrupo"] or "")),
                  reverse=True)
        remover.extend(dups[1:])
    for r in remover:
        rows.remove(r)
    return tocadas, len(remover) + len(fantasmas)


def rebuild_nomes(rows: list[dict]) -> None:
    """`nome` = nomeGrupo + capacidade (+ fase). A capacidade vive só no nome da
    variante; o nomeGrupo (título da página) nunca a leva."""
    grupos: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        grupos[r["grupoModelo"]].append(r)

    for items in grupos.values():
        for i in items:
            d = dict(p.split("=", 1) for p in (i["atributos"] or "").split(";")
                     if "=" in p)
            bits = [i["nomeGrupo"]]
            kw = d.get("frio-kw") or d.get("calor-kw") or d.get("capacidade")
            if kw and f"{kw} kW" not in i["nomeGrupo"]:
                bits.append(f"{kw} kW")
            if d.get("alimentacao") == "trifasica":
                bits.append("trifásico")
            elif d.get("alimentacao") == "monofasica":
                bits.append("monofásico")
            i["nome"] = " ".join(bits)


def fix_all(rows: list[dict], pdf_path: Path | None = None) -> dict[str, int]:
    """Passagem completa: refs → taxonomia → títulos → nomes de variante."""
    refs_ok, removidos = fix_refs(rows)
    reclass = fix_accessory_taxonomy(rows)
    titulos = fix_group_names(rows, pdf_path)
    reclass += fix_accessory_taxonomy(rows)
    rebuild_nomes(rows)
    return {"refs": refs_ok, "removidos": removidos,
            "reclassificados": reclass, "titulos": titulos}


def main() -> None:
    import csv

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("csv_path", type=Path)
    ap.add_argument("--pdf", type=Path, default=None,
                    help="tabela de preços, para ler descrições ao lado das refs")
    ap.add_argument("--apply", action="store_true",
                    help="escreve o CSV (por omissão só mostra o diff)")
    ap.add_argument("--limite", type=int, default=40)
    args = ap.parse_args()

    with args.csv_path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames or []
        rows = list(reader)

    antes = {r["grupoModelo"]: (r["nomeGrupo"], r["gama"]) for r in rows}
    refs_antes = [(r["ref"], r["grupoModelo"], r["pvpCents"]) for r in rows]
    stats = fix_all(rows, args.pdf)
    vivos = {r["ref"] for r in rows}

    print("--- refs alteradas/removidas ---")
    for ref, grupo, pvp in refs_antes:
        novo = ref_canonico(ref)
        if novo == ref and ref in vivos:
            continue
        estado = f"→ {novo}" if novo in vivos and novo != ref else "removida"
        print(f"   {ref:24} {grupo:26} {int(pvp) / 100:>9.2f} €  {estado}")

    depois = {r["grupoModelo"]: (r["nomeGrupo"], r["gama"]) for r in rows}
    mudou = [(g, antes[g], depois[g]) for g in antes
             if g in depois and antes[g] != depois[g]]
    print(f"\nrefs normalizadas: {stats['refs']} | SKUs removidos: "
          f"{stats['removidos']} | acessórios reclassificados: "
          f"{stats['reclassificados']} | títulos reescritos: {stats['titulos']}\n")
    for grupo, (a_n, a_g), (d_n, d_g) in mudou[:args.limite]:
        print(grupo)
        if a_n != d_n:
            print(f"   nome  ANTES : {a_n}")
            print(f"         DEPOIS: {d_n}")
        if a_g != d_g:
            print(f"   gama  {a_g!r} → {d_g!r}")

    if args.apply:
        with args.csv_path.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=header, quoting=csv.QUOTE_ALL,
                               lineterminator="\r\n")
            w.writeheader()
            w.writerows(rows)
        print(f"\n→ {args.csv_path} reescrito ({len(rows)} SKUs)")


if __name__ == "__main__":
    main()

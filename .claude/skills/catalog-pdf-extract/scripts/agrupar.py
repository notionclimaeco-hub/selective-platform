#!/usr/bin/env python3
"""3. Agrupar: linhas-*.json → <marca>-<ano>-staged.json (contrato ImportRunJson).

    python3 agrupar.py --mapa mapa.json --marca hisense --ano 2026 [--ficheiro tabela.pdf]

Decide o componente de cada linha (dica da extração ou default da secção; refs
"UI/UE" do conjunto classificam as unidades vendidas à parte), agrupa por
série (secção + componente + família de prefixo da ref), calcula o
`grupoModelo` determinístico ({marca}-{gama-slug}[-{componente}]), ordena os
atributos (eixos primeiro, specs depois, pela ordem do registo), funde refs
repetidas (páginas juntas, `cor` cai quando difere) e aplica a convenção de
nomes (`nomeGrupo` sem capacidade nem cor; `nome` = nomeGrupo + capacidade).
Os avisos de extração (sem preço, preço sob consulta, só na matriz) ficam em
`avisos`; a validação do registo é o passo seguinte (`validar.py`).
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter, OrderedDict, defaultdict
from pathlib import Path

from _comum import escrever_json, esqueleto, grupo_modelo, ler_json, prefixo_serie, slug

EIXOS = ("cor", "unidades-max", "pressao-estatica", "alimentacao", "cv")
ORDEM_SPECS = (
    "frio-kw", "calor-kw", "classe-energetica", "btu", "seer", "scop", "eer", "cop",
    "refrigerante", "wifi", "deposito-l", "caudal-m3h", "rendimento-pct", "nivel-sonoro-db",
    "temp-agua-max", "dimensoes-ui", "dimensoes-ue", "dimensoes", "tubagem",
    "comprimento-max-m", "desnivel-max-m", "frio-kw-min", "frio-kw-max", "calor-kw-min",
    "calor-kw-max", "peso-kg", "tipo", "compativel-com",
)
CAPACIDADE = ("frio-kw", "calor-kw", "btu", "deposito-l", "caudal-m3h", "cv")

TIPO_LABEL = {
    "mural": "Mural", "mini-cassete": "Mini Cassete", "cassete-1-via": "Cassete 1 Via",
    "cassete-2-vias": "Cassete 2 Vias", "cassete-4-vias": "Cassete 4 Vias", "cassete": "Cassete",
    "conduta-baixa-pressao": "Conduta Baixa Pressão", "conduta-media-pressao": "Conduta Média Pressão",
    "conduta-alta-pressao": "Conduta Alta Pressão", "conduta": "Conduta", "consola": "Consola",
    "chao-teto": "Chão-Teto", "chao-sem-envolvente": "Chão sem Envolvente", "coluna": "Coluna",
    "portatil": "Portátil", "exterior": "", "rooftop": "Rooftop", "modulo-hidraulico": "Módulo Hidráulico",
    "integrada": "Unidade Integrada", "monobloco-aqs": "Bomba de Calor AQS", "split-aqs": "Bomba de Calor AQS",
    "deposito": "Depósito", "vmc": "VMC", "recuperador-de-calor": "Recuperador de Calor",
    "extrator": "Extrator", "uta": "UTA", "chiller": "Chiller", "cortina-de-ar": "Cortina de Ar",
    "purificador": "Purificador de Ar",
}
FAM_LABEL = {
    "ar-condicionado": "Ar Condicionado", "bombas-de-calor": "Bomba de Calor", "aqs": "Bomba de Calor AQS",
    "ventilacao": "Ventilação", "ventiloconvectores": "Ventiloconvector", "chillers": "Chiller",
    "cortinas-de-ar": "Cortina de Ar", "purificadores-de-ar": "Purificador de Ar",
    "acessorios-e-controlo": "Acessório", "outros": "Equipamento",
}
COMPONENTE_LABEL = {"unidade-interior": "Unidade Interior", "unidade-exterior": "Unidade Exterior",
                    "deposito": "Depósito"}
COMANDO_RX = re.compile(r"(?i)\b(controlador|comando|termostato|termóstato|kit\s+wi-?fi|receptor|recetor)\b")
ACESSORIO_NOME_RX = re.compile(r"(?i)^(painel|kit|filtro|sensor|cabo|adaptador|bomba de condensados|"
                               r"tabuleiro|grelha|placa|suporte|válvula|valvula)\b")


# --- Helpers ------------------------------------------------------------------

def _seccao(mapa: dict, sid: str) -> dict:
    for s in mapa["seccoes"]:
        if s["id"] == sid:
            return s
    raise KeyError(f"secção '{sid}' não existe no mapa")


def _seccao_linha(mapa: dict, l: dict) -> dict:
    """Secção da linha com o `porRef` do mapa aplicado: numa tabela que mistura
    produtos ("UE + depósito", "UE + módulo hidráulico") o prefixo da ref dá
    familia/componente/tipoUnidade/gama próprios. Uma linha lida por uma parte
    da marca pode trazer a sua `classificacao` (Daikin: a mesma ref repete-se
    por muitas páginas e é classificada pela ref), que ganha à secção."""
    s = _seccao(mapa, l["seccao"])
    if l.get("classificacao"):
        return {**s, **l["classificacao"], "componenteFixo": True}
    for regra in s.get("porRef") or []:
        if l["ref"].upper().startswith(regra["prefixo"].upper()):
            fixo = {"componenteFixo": True} if "componente" in regra else {}
            return {**s, **{k: v for k, v in regra.items() if k != "prefixo"}, **fixo}
    return s


def _tem_capacidade(l: dict) -> bool:
    return any(k in l["campos"] for k in CAPACIDADE)


def _primeira_frase(texto: str, limite: int = 80) -> str:
    t = re.sub(r"\s*\([^)]*\)", "", texto)          # notas entre parênteses
    t = re.split(r"[.;]\s", t)[0]
    t = re.sub(r"\s+", " ", t).strip(" .,;:-–")
    if len(t) > limite:
        t = t[:limite].rsplit(" ", 1)[0]
    return t


def _gama_de(seccao: dict, componente: str, serie: str | None) -> str:
    gama = (seccao.get("gama") or seccao["titulo"]).strip()
    # "Multi-Inverter Exterior" + UE → "Multi-Inverter" (o componente já diz Exterior);
    # um conjunto UI+painel impresso numa tabela de UI perde o "Interior" também.
    if componente == "unidade-exterior" or (componente == "conjunto" and seccao.get("componente") == "unidade-exterior"):
        gama = re.sub(r"(?i)\s*\b(unidades?\s+)?exteriore?s?\b", "", gama).strip()
    if componente == "unidade-interior" or (componente == "conjunto" and seccao.get("componente") == "unidade-interior"):
        gama = re.sub(r"(?i)\s*\b(unidades?\s+)?interiore?s?\b", "", gama).strip()
    if serie and f"-{slug(serie)}-" not in f"-{slug(gama)}-":     # palavras inteiras: "V" ≠ "Venice"
        gama = f"{gama} {serie}"
    if seccao.get("sistema") == "vrf" and "vrf" not in gama.lower():
        gama = f"VRF {gama}"
    return re.sub(r"\s+", " ", gama).strip()


def _nome_grupo(seccao: dict, familia: str, componente: str, gama: str) -> str:
    tipo = seccao.get("tipoUnidade") or ""
    rotulo = seccao["rotulo"] if "rotulo" in seccao else TIPO_LABEL.get(tipo)
    if not rotulo and familia != "ar-condicionado" and "rotulo" not in seccao:
        rotulo = FAM_LABEL.get(familia, "")
    if rotulo is None:
        rotulo = ""
    primeira = slug(rotulo).split("-")[0] if rotulo else ""
    palavras_gama = slug(gama).split("-")
    repetido = bool(primeira) and any(w.startswith(primeira) or primeira.startswith(w) for w in palavras_gama if len(w) >= 4)
    base = gama if (not rotulo or repetido) else f"{rotulo} {gama}"
    comp = COMPONENTE_LABEL.get(componente)
    return f"{base} | {comp}" if comp else base


def _sufixo_capacidade(attrs: dict[str, str], familia: str = "") -> str:
    if familia == "aqs" and attrs.get("deposito-l"):    # AQS varia pelo depósito, não pelos kW
        return f"{attrs['deposito-l']} L"
    if familia == "bombas-de-calor" and attrs.get("calor-kw"):   # aerotermia vende-se pelo aquecimento
        return f"{attrs['calor-kw']} kW"
    if attrs.get("frio-kw"):
        return f"{attrs['frio-kw']} kW"
    if attrs.get("calor-kw"):
        return f"{attrs['calor-kw']} kW"
    if attrs.get("deposito-l"):
        return f"{attrs['deposito-l']} L"
    if attrs.get("caudal-m3h"):
        return f"{attrs['caudal-m3h']} m³/h"
    if attrs.get("cv"):
        return f"{attrs['cv']} CV"
    return ""


def _atributos_ordenados(campos: dict[str, str], contexto: dict[str, str], familia: str,
                         componente: str, sistema: str | None = None) -> OrderedDict:
    d: dict[str, str] = {}
    for k in EIXOS:
        v = contexto.get(k) or campos.get(k)
        if v:
            d[k] = v
    dims = campos.get("dimensoes")
    if dims:
        # O registo só tem dimensoes-ui/-ue em AC e bombas de calor (ventiloconvectores: dimensoes).
        if familia in ("ar-condicionado", "bombas-de-calor") and componente in (
                "conjunto", "unidade-interior", "unidade-exterior"):
            exterior = componente == "unidade-exterior" or sistema == "monobloco"   # monobloco = só UE
            d["dimensoes-ue" if exterior else "dimensoes-ui"] = dims
        else:
            d["dimensoes"] = dims
    for k in ORDEM_SPECS:
        if k in d or k == "dimensoes":
            continue
        v = campos.get(k)
        if v:
            d[k] = v
    for k, v in campos.items():  # chaves fora da ordem conhecida ficam no fim
        if k not in d and k not in ("descricao", "dimensoes") and v:
            d[k] = v
    return OrderedDict(d)


# --- Core ---------------------------------------------------------------------

def agrupar(linhas: list[dict], mapa: dict, marca: str, ano: int, ficheiro: str) -> dict:
    tabela = f"{marca}-{ano}"

    # 1. Matrizes de compatibilidade: fundir na UE da tabela de preços.
    compat: dict[str, dict] = {}
    base: list[dict] = []
    for l in linhas:
        if l.get("soCompatibilidade"):
            compat.setdefault(l["ref"], l)
        else:
            base.append(l)
    refs_base = {l["ref"] for l in base}
    seccao_da_familia = {(prefixo_serie(l["ref"]), l.get("componenteHint")): l["seccao"]
                         for l in base if l.get("componenteHint") == "unidade-exterior"}
    for ref, m in compat.items():
        if ref not in refs_base:
            m = {**m, "soCompatibilidade": False, "orfaDaMatriz": True}
            m["seccao"] = seccao_da_familia.get((prefixo_serie(ref), "unidade-exterior"), m["seccao"])
            base.append(m)
            refs_base.add(ref)

    # 2. Componente por linha. Refs do conjunto "UI/UE" classificam as unidades.
    ui_do_conjunto: set[str] = set()
    ue_do_conjunto: set[str] = set()
    acessorio_do_conjunto: set[str] = set()
    kw_por_ref: dict[str, dict[str, str]] = {}
    for l in base:
        if l.get("refs") and len(l["refs"]) == 2:
            s = _seccao_linha(mapa, l)
            kw = {k: v for k, v in l["campos"].items() if k in ("frio-kw", "calor-kw", "btu")}
            if s["componente"] == "conjunto":          # tabela 1×1: "UI / UE"
                ui_do_conjunto.add(l["refs"][0])
                ue_do_conjunto.add(l["refs"][1])
                for r in l["refs"]:
                    kw_por_ref.setdefault(r, kw)
            else:                                       # tabela de UI: "UI / painel"
                acessorio_do_conjunto.add(l["refs"][1])
                kw_por_ref.setdefault(l["refs"][0], kw)
    base.sort(key=lambda l: (l["pagina"], l["y"]))
    # Conjunto UI+painel sem specs herda os kW da linha da UI.
    campos_por_ref: dict[str, dict] = {}
    for l in base:                                       # a mesma UI pode estar noutra tabela sem kW
        if not l.get("refs") and (l["ref"] not in campos_por_ref or _tem_capacidade(l)):
            campos_por_ref[l["ref"]] = l["campos"]
    for l in base:
        if l.get("refs") and not _tem_capacidade(l):
            for k, v in campos_por_ref.get(l["refs"][0], {}).items():
                if k in ("frio-kw", "calor-kw", "btu", "classe-energetica"):
                    l["campos"].setdefault(k, v)
    # "AUW125U6RW8**" + nota "** Modelo trifásico" (em qualquer página) → alimentação.
    for l in base:
        if not l.get("marcadorRef") or "alimentacao" in l["campos"]:
            continue
        for n in l.get("notas", []):                     # só as notas da mesma tabela/página
            m = re.match(r"^(\*+)\s*(?:nota:?\s*)?modelos?\s+(?:na\s+vers[ãa]o\s+)?(trif|monof)", n, re.I)
            if m and len(m.group(1)) == l["marcadorRef"]:
                l["campos"]["alimentacao"] = "trifasica" if m.group(2).lower() == "trif" else "monofasica"
    alim_por_ref = {l["ref"]: l["campos"]["alimentacao"] for l in base
                    if not l.get("refs") and "alimentacao" in l["campos"]}
    for l in base:
        if l.get("refs") and "alimentacao" not in l["campos"]:
            for r in l["refs"]:
                if r in alim_por_ref:
                    l["campos"]["alimentacao"] = alim_por_ref[r]
                    break
    ultimo_kw: dict[str, dict[str, str]] = {}          # secção → kW da última linha com capacidade
    for l in base:
        s = _seccao_linha(mapa, l)
        for k, v in (s.get("atributos") or {}).items():  # specs da secção lidas de ícones (R32, 4 tubos)
            l["campos"].setdefault(k, v)
        familia = s["familia"]
        comp = l.get("componenteHint")
        if comp is None:
            if l["ref"] in ui_do_conjunto:
                comp = "unidade-interior"
            elif l["ref"] in ue_do_conjunto:
                comp = "unidade-exterior"
            elif l["ref"] in acessorio_do_conjunto:
                comp = "acessorio"
            elif familia != "acessorios-e-controlo" and not _tem_capacidade(l) and (
                    l.get("refs") is None) and not s.get("componenteFixo") and s["componente"] in (
                    "conjunto", "unidade-interior", "unidade-exterior"):
                comp = "acessorio"
            else:
                comp = s["componente"]
        elif comp == "unidade-exterior" and l["ref"] in acessorio_do_conjunto:
            comp = "acessorio"
        # Monoblocos e chillers imprimem "UE" na coluna Categoria, mas a unidade
        # exterior é o produto inteiro (não há UI): fica conjunto como a secção diz.
        if comp == "unidade-exterior" and s["componente"] == "conjunto" and (
                s.get("sistema") == "monobloco" or familia == "chillers"):
            comp = "conjunto"
        if familia == "acessorios-e-controlo" or comp in ("acessorio", "comando"):
            desc = l["campos"].get("descricao", "")
            litros = re.match(r"(?i)^dep[óo]sito\b.*?(\d{2,4})\s*L\b", desc)
            if litros:                                   # "Depósito de 200L" é um produto AQS
                familia, comp = "aqs", "deposito"
                l["campos"].setdefault("deposito-l", litros.group(1))
                l["campos"]["descricao"] = re.sub(r"\s*(?:de\s+)?\d{2,4}\s*L\b", "", desc).strip()
            else:
                if comp not in ("acessorio", "comando"):
                    comp = "acessorio"
                if COMANDO_RX.search(desc) or s["componente"] == "comando":
                    comp = "comando"
                familia = "acessorios-e-controlo"
                l["campos"].pop("wifi", None)                # nota "* WIFI opcional" é da UI, não do painel
        l["_componente"] = comp
        l["_familia"] = familia
        # UI/UE vendidas à parte herdam os kW do conjunto (a tabela só os imprime
        # no conjunto): pela ref do "UI / UE" ou pela linha com capacidade acima.
        if comp in ("unidade-interior", "unidade-exterior") and not _tem_capacidade(l) and s.get("herdarKw", True):
            herdados = kw_por_ref.get(l["ref"]) or ultimo_kw.get(l["seccao"], {})
            for k, v in herdados.items():
                l["campos"].setdefault(k, v)
        if _tem_capacidade(l) and familia != "acessorios-e-controlo":
            ultimo_kw[l["seccao"]] = {k: v for k, v in l["campos"].items()
                                      if k in ("frio-kw", "calor-kw", "btu", "alimentacao")}

    # 3. Fundir refs repetidas (páginas, cor cai quando difere).
    por_ref: OrderedDict[str, dict] = OrderedDict()
    for l in base:
        ref = l["ref"]
        if ref not in por_ref:
            por_ref[ref] = l
            continue
        a = por_ref[ref]
        a["pdfPaginas"] = sorted(set(a["pdfPaginas"]) | set(l["pdfPaginas"]))
        if a["pvpCents"] is None and l["pvpCents"] is not None:
            a["pvpCents"] = l["pvpCents"]
        elif l["pvpCents"] is not None and a["pvpCents"] != l["pvpCents"]:
            a.setdefault("_avisos", []).append(
                f"preços diferentes no PDF: {a['pvpCents']} (p{a['pagina']}) vs {l['pvpCents']} (p{l['pagina']})")
        if a["contexto"].get("cor") != l["contexto"].get("cor"):
            a["contexto"].pop("cor", None)
        for k, v in l["campos"].items():
            a["campos"].setdefault(k, v)
        if l.get("compativelCom"):
            a["compativelCom"] = l["compativelCom"]
        if not a.get("ean") and l.get("ean"):
            a["ean"] = l["ean"]

    for ref, m in compat.items():
        a = por_ref.get(ref)
        if a is None or a is m or a.get("orfaDaMatriz"):
            continue
        a["compativelCom"] = m.get("compativelCom") or a.get("compativelCom")
        a["pdfPaginas"] = sorted(set(a["pdfPaginas"]) | set(m["pdfPaginas"]))
        for k, v in m["campos"].items():
            a["campos"].setdefault(k, v)

    # 4. Grupos: secção + componente + família de prefixo (+ série do subcabeçalho).
    chaves_grupo: dict[str, tuple] = {}
    for ref, l in por_ref.items():
        s = _seccao_linha(mapa, l)
        if l["_familia"] == "acessorios-e-controlo" or l["_familia"] != s["familia"]:
            chaves_grupo[ref] = (l["seccao"], l["_componente"], "acc", esqueleto(ref))
        else:
            chaves_grupo[ref] = (l["seccao"], l["_componente"], "serie", l["contexto"].get("serie"))

    # Acessórios com o mesmo esqueleto só ficam juntos se algum atributo os distingue.
    membros: dict[tuple, list[str]] = defaultdict(list)
    for ref, chave in chaves_grupo.items():
        membros[chave].append(ref)
    for chave, refs in list(membros.items()):
        if chave[2] == "acc" and len(refs) > 1:
            attrs = {tuple(sorted(por_ref[r]["campos"].items() - {("descricao", por_ref[r]["campos"].get("descricao"))}))
                     for r in refs}
            if len(attrs) < len(refs):
                for r in refs:
                    chaves_grupo[r] = (chave[0], chave[1], "acc", r)
    tamanho_grupo = Counter(chaves_grupo.values())

    # 5. SKUs.
    seccoes_com_preco = {sid: any(l["pvpCents"] for l in por_ref.values() if l["seccao"] == sid)
                         for sid in {l["seccao"] for l in por_ref.values()}}
    skus: list[dict] = []
    grupos: dict[tuple, list[dict]] = defaultdict(list)
    for ref, l in por_ref.items():
        s = _seccao_linha(mapa, l)
        comp = l["_componente"]
        familia = l["_familia"]
        chave = chaves_grupo[ref]
        avisos = list(l.get("_avisos", []))
        desc = l["campos"].get("descricao", "")

        if familia == "acessorios-e-controlo":
            gama = None
            codigo = ref if tamanho_grupo[chave] == 1 else esqueleto(ref).replace("#", "")
            nome_grupo = _primeira_frase(desc) if desc else ""
            if not nome_grupo or not re.search(r"[A-Za-z]{3}", nome_grupo):
                painel = "cassete" in (s.get("tipoUnidade") or "") and s["familia"] != "acessorios-e-controlo"
                titulo = (s.get("gama") or s["titulo"]).strip()
                if s["familia"] == "acessorios-e-controlo" and not re.match(r"(?i)^acess", titulo):
                    nome_grupo = f"{titulo} {codigo}"           # "Kit de conexão UTA HZX-BEJ"
                else:
                    nome_grupo = f"{'Painel' if painel else FAM_LABEL['acessorios-e-controlo']} {codigo}"
            elif ACESSORIO_NOME_RX.match(nome_grupo) and len(nome_grupo.split()) <= 2:
                nome_grupo = f"{nome_grupo} {codigo}"
            grupo = grupo_modelo(marca, None, comp, ref=codigo)
            tipo_unidade = None
            sistema = s.get("sistema") if s["familia"] == familia else None
        elif chave[2] == "acc":                        # produto reclassificado (ex.: depósito AQS)
            gama = _primeira_frase(desc) or ref
            nome_grupo = gama
            if slug(gama) == comp:                       # "Depósito" → série pela ref (HDHWT)
                gama = None
                nome_grupo = f"{nome_grupo} {prefixo_serie(ref)}"
            grupo = grupo_modelo(marca, gama if tamanho_grupo[chave] > 1 else None, comp,
                                 ref=(prefixo_serie(ref) if gama is None else esqueleto(ref).replace("#", ""))
                                 if tamanho_grupo[chave] > 1 else ref)
            tipo_unidade = "deposito" if comp == "deposito" else None
            sistema = None
        else:
            gama = _gama_de(s, comp, chave[3])
            nome_grupo = _nome_grupo(s, familia, comp, gama)
            grupo = grupo_modelo(marca, gama, comp)
            tipo_unidade = s.get("tipoUnidade") if comp != "unidade-exterior" or familia != "ar-condicionado" else "exterior"
            if comp == "unidade-exterior" and familia == "ar-condicionado":
                tipo_unidade = "exterior"
            sistema = s.get("sistema")

        attrs = _atributos_ordenados(l["campos"], l["contexto"], familia, comp, sistema)

        pvp = l["pvpCents"]
        if pvp is None:
            pvp = 0
            if l.get("orfaDaMatriz"):
                avisos.append("ref só aparece na matriz de compatibilidade, sem linha de preço")
            elif l.get("precoSobConsulta") or s.get("semPreco") or not seccoes_com_preco.get(l["seccao"]):
                avisos.append("preço sob consulta (a tabela não imprime preço)")
            else:
                avisos.append("sem preço na linha do PDF")
        if l.get("precoImpresso"):
            avisos.append(f"preço mal formatado no PDF ('{l['precoImpresso']}'), lido como "
                          f"{pvp / 100:.2f} € — confirmar")
        if l.get("numPrecos", 0) > 1:
            avisos.append(f"{l['numPrecos']} preços na mesma linha do PDF; ficou o da direita")

        sku = {
            "ref": ref, "nome": nome_grupo, "nomeGrupo": nome_grupo, "marca": marca, "familia": familia,
            "segmento": s.get("segmento"), "sistema": sistema, "tipoUnidade": tipo_unidade,
            "componente": comp, "gama": gama, "atributos": [{"chave": k, "valor": v} for k, v in attrs.items()],
            "descricao": desc if (familia == "acessorios-e-controlo" or len(desc.split()) >= 3) else None,
            "pvpCents": pvp, "ivaIncluido": False, "tabelaOrigem": tabela, "grupoModelo": grupo,
            "pdfPaginas": l["pdfPaginas"], "compativelCom": l.get("compativelCom") or None, "avisos": avisos,
        }
        if l.get("ean") and re.fullmatch(r"\d{13}", l["ean"]):
            sku["ean"] = l["ean"]
        skus.append(sku)
        grupos[grupo].append(sku)

    # 6. Nomes das variantes e desambiguação de títulos.
    for grupo, membros_g in grupos.items():
        varia_fase = len({dict((a["chave"], a["valor"]) for a in m["atributos"]).get("alimentacao") for m in membros_g}) > 1
        varia_capacidade = len({_sufixo_capacidade({a["chave"]: a["valor"] for a in m["atributos"]}, m["familia"])
                                for m in membros_g}) > 1
        for m in membros_g:
            attrs = {a["chave"]: a["valor"] for a in m["atributos"]}
            bits = [m["nomeGrupo"]]
            if m["familia"] != "acessorios-e-controlo" or varia_capacidade:
                suf = _sufixo_capacidade(attrs, m["familia"])
                if suf:
                    bits.append(suf)
                if attrs.get("unidades-max"):
                    bits.append(f"(até {attrs['unidades-max']} UI)")
                if varia_fase and attrs.get("alimentacao"):
                    bits.append("trifásico" if attrs["alimentacao"] == "trifasica" else "monofásico")
            m["nome"] = " ".join(bits)
    # Grupo de acessórios com descrições diferentes: título comum (prefixo de
    # palavras) ou "Acessório <código>".
    for grupo, membros_g in grupos.items():
        if membros_g[0]["familia"] != "acessorios-e-controlo" or len({m["nomeGrupo"] for m in membros_g}) == 1:
            continue
        palavras = [m["nomeGrupo"].split() for m in membros_g]
        comum: list[str] = []
        for i in range(min(len(p) for p in palavras)):
            if len({p[i].lower() for p in palavras}) == 1:
                comum.append(palavras[0][i])
            else:
                break
        codigo = esqueleto(membros_g[0]["ref"]).replace("#", "")
        titulo = " ".join(comum).strip(" ,;:-") if len(comum) >= 2 else f"Acessório {codigo}"
        for m in membros_g:
            m["nome"] = m["nome"].replace(m["nomeGrupo"], titulo, 1)
            m["nomeGrupo"] = titulo
    por_titulo: dict[str, list[str]] = defaultdict(list)
    for grupo, membros_g in grupos.items():
        por_titulo[membros_g[0]["nomeGrupo"]].append(grupo)
    for titulo, gs in por_titulo.items():
        if len(gs) < 2:
            continue
        for g in gs:
            membros_g = grupos[g]
            codigo = membros_g[0]["ref"] if len(membros_g) == 1 else esqueleto(membros_g[0]["ref"]).replace("#", "")
            novo = f"{titulo} {codigo}" if codigo.upper() not in titulo.upper() else titulo
            for m in membros_g:
                m["nome"] = m["nome"].replace(m["nomeGrupo"], novo, 1)
                m["nomeGrupo"] = novo

    for sku in skus:
        for k in ("segmento", "sistema", "tipoUnidade", "gama", "descricao", "compativelCom"):
            if sku.get(k) in (None, ""):
                sku.pop(k, None)
    return {"marca": marca, "ano": ano, "tabelaOrigem": tabela, "ficheiro": ficheiro, "skus": skus}


# --- CLI ----------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mapa", type=Path, default=Path("mapa.json"))
    ap.add_argument("--marca", required=True)
    ap.add_argument("--ano", type=int, required=True)
    ap.add_argument("--ficheiro", help="nome do PDF (default: o do mapa)")
    ap.add_argument("--linhas", type=Path, help="pasta com linhas-*.json (default: a do mapa)")
    ap.add_argument("-o", "--out", type=Path)
    args = ap.parse_args()

    mapa = ler_json(args.mapa)
    pasta = args.linhas or args.mapa.parent
    linhas: list[dict] = []
    ficheiros = sorted(pasta.glob("linhas-*.json"))
    if not ficheiros:
        print(f"sem linhas-*.json em {pasta} — corre extrair.py primeiro", file=sys.stderr)
        sys.exit(1)
    for f in ficheiros:
        linhas.extend(ler_json(f)["linhas"])
    run = agrupar(linhas, mapa, args.marca, args.ano, args.ficheiro or mapa.get("ficheiro") or "")
    out = args.out or pasta / f"{args.marca}-{args.ano}-staged.json"
    escrever_json(out, run)

    grupos = Counter(s["grupoModelo"] for s in run["skus"])
    por_familia = Counter(s["familia"] for s in run["skus"])
    com_avisos = sum(1 for s in run["skus"] if s["avisos"])
    print(f"{len(run['skus'])} SKUs em {len(grupos)} grupos → {out}")
    for fam, n in sorted(por_familia.items()):
        print(f"  {fam:24} {n:4} SKUs  {sum(1 for g, k in grupos.items() if any(s['grupoModelo'] == g and s['familia'] == fam for s in run['skus'])):3} grupos")
    print(f"  {com_avisos} SKUs com avisos de extração; grupos de 1: "
          f"{sum(1 for n in grupos.values() if n == 1)}")


if __name__ == "__main__":
    main()

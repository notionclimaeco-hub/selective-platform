"""Daikin 2026 (ticket #47): correções entre `agrupar.py` e `validar.py`.

Hook `corrigir(run, doc)` do `cadeia.py`. Cada correção diz porquê; as que
mudam o que o PDF imprime deixam aviso no SKU.
"""
from __future__ import annotations

import re

ORDEM_KW = ("frio-kw", "calor-kw")


def _attrs(sku: dict) -> dict[str, str]:
    return {a["chave"]: a["valor"] for a in sku["atributos"]}


def _kw_dos_kits(run: dict) -> None:
    """UI vendidas com painel e/ou comando (p26 "SB.FFA25A_WFW", p45 "SB.FCAG35_P"):
    a tabela dos kits não imprime kW, mas a UI do kit (FFA25A9, FCAG35B) tem-nos
    na tabela Sky Air. O kit herda-os, com aviso."""
    uis = {s["ref"]: s for s in run["skus"]
           if s["componente"] == "unidade-interior" and not s["ref"].startswith("SB.")
           and "frio-kw" in _attrs(s)}
    for s in run["skus"]:
        m = re.match(r"^SB\.([A-Z]+\d+)[A-Z]?_(?:S?W?FW|P|W)$", s["ref"])
        if not m or s["componente"] != "unidade-interior" or "frio-kw" in _attrs(s):
            continue
        base = m.group(1)
        ui = next((uis[r] for r in sorted(uis) if re.match(rf"^{base}[A-Z]\d?$", r)), None)
        if ui is None:
            continue
        a = _attrs(ui)
        novos = [{"chave": k, "valor": a[k]} for k in ORDEM_KW if k in a]
        s["atributos"] = novos + [x for x in s["atributos"] if x["chave"] not in ORDEM_KW]
        s["nome"] = f"{s['nomeGrupo']} {a['frio-kw']} kW"
        s["avisos"].append(f"kW lidos da UI {ui['ref']} (p{ui['pdfPaginas'][0]}): a tabela do kit não os imprime")


def _palavras(doc, pagina: int) -> list[tuple]:
    return [(x0, (y0 + y1) / 2, x1, t) for x0, y0, x1, y1, t, *_ in doc[pagina - 1].get_text("words")]


def _sku(ref: str, nome: str, pvp: int, pagina: int, **kw) -> dict:
    return {"ref": ref, "nome": nome, "nomeGrupo": nome, "marca": "daikin", "atributos": [],
            "pvpCents": pvp, "ivaIncluido": False, "tabelaOrigem": "daikin-2026", "pdfPaginas": [pagina],
            "avisos": [], **kw}


def _linha_com_preco(doc, pagina: int, rx: str) -> tuple[int, float] | None:
    """(preço, y) da primeira linha da página com texto que casa com `rx` e um preço."""
    ws = _palavras(doc, pagina)
    for x0, y, x1, t in ws:
        if re.search(rx, t):
            linha = sorted((w for w in ws if abs(w[1] - y) <= 3), key=lambda w: w[0])
            texto = "".join(w[3] for w in linha if re.fullmatch(r"[\d.,]+|€", w[3]))
            m = re.search(r"(\d{1,3}(?:\.\d{3})*)(?:,(\d{2}))?€", texto)
            if m:
                return int(m.group(1).replace(".", "")) * 100 + int(m.group(2) or 0), y
    return None


def _produtos_sem_ref_impressa(run: dict, doc) -> None:
    """Produtos que a tabela vende sem uma linha "ref | preço" que o leitor apanhe:
    - Air Sense Pro + (p99): a ref impressa é o nome ("AirSense Pro +"), como no
      catálogo anterior.
    - R-Cycle (p145): ficha de uma coluna com o preço por cima da linha "N.º de código"."""
    refs = {s["ref"] for s in run["skus"]}
    achado = _linha_com_preco(doc, 99, r"^AirSense$")
    if achado and "AirSense Pro +" not in refs:
        run["skus"].append(_sku("AirSense Pro +", "Sensor de Qualidade do Ar Interior Air Sense Pro +", achado[0], 99,
                                familia="acessorios-e-controlo", componente="acessorio", segmento="comercial",
                                grupoModelo="daikin-airsense-pro-acessorio",
                                descricao="Sensor Daikin para medir e analisar o ambiente interior (12 sensores, "
                                          "15 parâmetros, ligação Wi-Fi e NB-IoT)"))
    achado = _linha_com_preco(doc, 145, r"^S/IVA$")
    r_cycle = next((s for s in run["skus"] if s["ref"] == "RRDQ220V1"), None)
    if achado and r_cycle is not None and not r_cycle["pvpCents"]:
        r_cycle["pvpCents"] = achado[0]
        r_cycle["avisos"] = [a for a in r_cycle["avisos"] if "sob consulta" not in a and "sem preço" not in a]


def _por_ordem(sku: dict, novos: dict) -> None:
    atuais = {a["chave"] for a in sku["atributos"]}
    sku["atributos"] += [{"chave": k, "valor": v} for k, v in novos.items() if k not in atuais]


def _caudal_vam(run: dict) -> None:
    """Conjuntos VAM-J8 com comando e sensor CO2 (SB.VAM350_FW_CO2): a ficha só tem as
    specs da unidade (VAM350J8); o conjunto herda o caudal dela."""
    unidades = {s["ref"]: s for s in run["skus"] if re.match(r"^VAM\d+J8$", s["ref"])}
    for s in run["skus"]:
        m = re.match(r"^SB\.VAM(\d+)_FW_CO2$", s["ref"])
        u = unidades.get(f"VAM{m.group(1)}J8") if m else None
        if u is None:
            continue
        a = _attrs(u)
        if "caudal-m3h" in a:
            _por_ordem(s, {"caudal-m3h": a["caudal-m3h"]})
            s["nome"] = f"{s['nomeGrupo']} {a['caudal-m3h']} m³/h"


def _caudal_uta(run: dict, doc) -> None:
    """UTA Compact (p114, p116, p118): o caudal de cada tamanho vem na tabela de
    características por cima dos preços ("Tamanho 1 2 3 …" / "ALB02*B …" e a linha
    "Caudal de ar m3/h")."""
    for pagina in (114, 116, 118):
        ws = _palavras(doc, pagina)
        # A linha "Caudal de ar m3/h 600 1100 …" (não o "Caudal de ar de 200 a 6000" do texto).
        cab = next(((x0, y) for x0, y, x1, t in ws if t == "Caudal" and x0 < 60 and sum(
            1 for w in ws if abs(w[1] - y) <= 3 and w[0] > 200 and re.fullmatch(r"[\d.]+", w[3])) >= 3), None)
        if cab is None:
            continue
        valores = [(x0 + x1) / 2 for x0, y, x1, t in ws if abs(y - cab[1]) <= 3 and x0 > 200]
        linha = {round((x0 + x1) / 2): t for x0, y, x1, t in ws if abs(y - cab[1]) <= 3 and x0 > 200}
        tamanhos = {}
        for x0, y, x1, t in ws:
            m = re.fullmatch(r"(?:A[RTL]B)?0?(\d)\*?[A-Z]*", t)
            if 0 < cab[1] - y <= 22 and x0 > 200 and m:
                tamanhos[(x0 + x1) / 2] = m.group(1)
        caudal = {}
        for xc in valores:
            if not tamanhos:
                break
            t = tamanhos[min(tamanhos, key=lambda c: abs(c - xc))]
            caudal[t] = linha[round(xc)].replace(".", "")
        for s in run["skus"]:
            a = _attrs(s)
            if pagina in s["pdfPaginas"] and s["familia"] == "ventilacao" and a.get("tamanho") in caudal:
                _por_ordem(s, {"caudal-m3h": caudal[a["tamanho"]]})
                lado = "direita" if a.get("orientacao") == "direita" else "esquerda"
                s["nome"] = f"{s['nomeGrupo']} {caudal[a['tamanho']]} m³/h ({lado})"


CORES = {"branco": "branco", "branca": "branco", "preto": "preto", "preta": "preto",
         "cinzento": "cinzento", "cinza": "cinzento", "prateado": "prateado"}
# Comandos com a cor só no sufixo da ref ("BRC1H52W7/S7/K7 … (K=preto/S=Cinzento)").
COR_SUFIXO = ((re.compile(r"^BRC1H52([WKS])7$"), {"W": "branco", "K": "preto", "S": "cinzento"}),
              (re.compile(r"^BRC1KPD51([WK])$"), {"W": "branco", "K": "preto"}),
              (re.compile(r"^BRC1HHD([WSK])7$"), {"W": "branco", "S": "prateado", "K": "preto"}))
COR_RX = re.compile(r"(?i)\s*\b(branc[oa]|pret[oa]|cinzento|cinza|prateado)\b")


def _cores_dos_acessorios(run: dict) -> None:
    """Acessórios que só diferem na cor (painéis BYCQ140EW/EB, comandos BRC7FA532F/FB,
    Madoka BRC1H52W7/K7/S7): a cor sai do nome para o atributo `cor` e as variantes
    com o mesmo título ficam num grupo."""
    por_titulo: dict[tuple, str] = {}
    for s in run["skus"]:
        if s["familia"] != "acessorios-e-controlo":
            continue
        cor = None
        for rx, mapa in COR_SUFIXO:
            m = rx.match(s["ref"])
            if m:
                cor = mapa[m.group(1)]
        m = COR_RX.search(s["nomeGrupo"])
        if cor is None and m:
            cor = CORES[m.group(1).lower()]
        if cor is None:
            continue
        titulo = COR_RX.sub("", s["nomeGrupo"])
        titulo = re.sub(r"\s+" + re.escape(s["ref"]) + r"$", "", titulo)      # código de desambiguação
        titulo = re.sub(r"\s*\([^)]*\)\s*$", "", titulo).strip(" -,")
        _por_ordem(s, {"cor": cor})
        chave = (titulo, s["componente"])
        grupo = por_titulo.setdefault(chave, s["grupoModelo"])
        s["grupoModelo"], s["nomeGrupo"] = grupo, titulo
        s["nome"] = titulo                                  # a cor é a coluna da tabela


def _nomes_limpos(run: dict) -> None:
    """Travessões das descrições impressas ("Bateria DX – direita") no título: hífen.
    Um grupo partilha o segmento (o mesmo comando aparece em páginas domésticas e
    comerciais): fica o do primeiro SKU."""
    segmento: dict[str, str | None] = {}
    for s in run["skus"]:
        for k in ("nomeGrupo", "nome"):
            s[k] = re.sub(r"\s*[–—]\s*", " - ", s[k])
        g = segmento.setdefault(s["grupoModelo"], s.get("segmento"))
        if s.get("segmento") != g:
            if g is None:
                s.pop("segmento", None)
            else:
                s["segmento"] = g


# Acessórios vendidos por tamanho e impressos em blocos com uma só descrição (a descrição
# fica partida pelas linhas do bloco): uma página de produto por série, com o tamanho.
#   (ref, chave da série, título de recurso, atributo do tamanho)
SERIES_ACESSORIOS = (
    (re.compile(r"^EKEXVA(\d+)$"), lambda m: "EKEXVA", "Kit de válvula de expansão para UTA EKEXVA", "tamanho"),
    (re.compile(r"^ECOLLECTRM([VX])(\d+)A$"), lambda m: f"ECOLLECTRM{m.group(1)}",
     None, "tamanho"),
    (re.compile(r"^EKM(\d\d)([A-Z0-9]+)$"), lambda m: f"EKM-{m.group(2)}", None, "tamanho"),
    (re.compile(r"^EIWRX(\d+)RV\d+AB$"), lambda m: "EIWRX", "Caixa para coletor de piso radiante", "tamanho"),
)
NOMES_COLETOR = {"ECOLLECTRMV": "Coletor de distribuição RMV",
                 "ECOLLECTRMX": "Coletor de distribuição RMX"}


def _primeira_frase(texto: str) -> str:
    t = re.split(r"(?<=[a-zà-ú0-9)])[.;:]\s", texto or "")[0].strip(" .")
    return t[:80].rsplit(" ", 1)[0] if len(t) > 80 else t


def _series_de_acessorios(run: dict) -> None:
    grupos: dict[str, list[tuple[dict, str]]] = {}
    for s in run["skus"]:
        if s["familia"] != "acessorios-e-controlo":
            continue
        for rx, chave, titulo, attr in SERIES_ACESSORIOS:
            m = rx.match(s["ref"])
            if m:
                tamanho = next(g for g in m.groups() if g and g.isdigit())
                grupos.setdefault(chave(m), []).append((s, str(int(tamanho))))
                break
    for chave, membros in grupos.items():
        if len(membros) < 2:
            continue
        titulo = NOMES_COLETOR.get(chave) or next((t for rx, k, t, a in SERIES_ACESSORIOS
                                                   if t and chave.startswith(k(rx.match(membros[0][0]["ref"])))), None)
        if titulo is None:                       # a descrição do bloco que começa por maiúscula
            frases = [_primeira_frase(s.get("descricao", "")) for s, _t in membros]
            boas = [f for f in frases if re.match(r"^[A-ZÁÉÓÚ]", f) and len(f.split()) >= 2]
            titulo = max(boas, key=len) if boas else f"Acessório {chave}"
        grupo = "daikin-" + re.sub(r"[^a-z0-9]+", "-", chave.lower()).strip("-") + "-acessorio"
        for s, tamanho in membros:
            s["grupoModelo"], s["nomeGrupo"], s["nome"] = grupo, titulo, f"{titulo} {tamanho}"
            s["atributos"] = [a for a in s["atributos"] if a["chave"] != "tamanho"] + [
                {"chave": "tamanho", "valor": tamanho}]


def corrigir(run: dict, doc) -> None:
    _kw_dos_kits(run)
    _produtos_sem_ref_impressa(run, doc)
    _caudal_vam(run)
    _caudal_uta(run, doc)
    _cores_dos_acessorios(run)
    _series_de_acessorios(run)
    _nomes_limpos(run)

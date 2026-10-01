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
        m = re.match(r"^SB\.([A-Z]+\d+)[A-Z]?_(?:W?FW|P|W)$", s["ref"])
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
        cab = next(((x0, y) for x0, y, x1, t in ws if t == "Caudal" and x0 < 60), None)
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


def corrigir(run: dict, doc) -> None:
    _kw_dos_kits(run)
    _produtos_sem_ref_impressa(run, doc)
    _caudal_vam(run)
    _caudal_uta(run, doc)

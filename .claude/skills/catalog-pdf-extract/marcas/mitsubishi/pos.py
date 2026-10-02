"""Mitsubishi Electric 2026: pós-processamento entre `agrupar.py` e `validar.py`.

- Nomes: `nomeGrupo` = nome da série em `series.py` ("Mural MSZ-LN Kirigamine
  Style", + " | Unidade Interior/Exterior" nas unidades avulsas); o agrupar só
  conhece a gama curta, que fica para o grupoModelo (slugs do catálogo antigo).
- Refs impressas com e sem o sufixo de mercado "-E" (MAC-334IF na p209,
  MAC-334IF-E na p83) são o mesmo produto: fica a ref com "-E".
- Compatibilidade das UE multi-split e Twin: as séries de UI das matrizes de
  preços da mesma gama (p26 MXZ, p30 PXZ, p34 PUMY-SM, p36 PUMY-P/SP, p81 Mr.
  Slim). As tabelas de combinações (p40-48) dizem as somas de capacidades
  aceites, não refs: ficam fora.
- Eixos que a tabela só imprime na ref: insuflação do s-MEXT (OVER/UNDER),
  ligações do VL-CZPVU (-R-E/-L-E); comprimento das cortinas GK (dimensões).
- Chaves fora do registo da família caem (caudal nas fichas de AC, unidades
  máx. nas branch boxes, dimensões nas cortinas).
"""
from __future__ import annotations

import re

from _comum import carregar_registo, parte_da_marca

series = parte_da_marca("mitsubishi", "series")

COMPONENTE_LABEL = {"unidade-interior": "Unidade Interior", "unidade-exterior": "Unidade Exterior"}

# UE → páginas da matriz de UI compatíveis (e séries a excluir/forçar).
COMPAT_UE = {
    "mxz": ([26], {"MSZ-HR"}), "mxz-ha": ([26], None), "pxz": ([30], set()), "pumy-sm": ([34], set()),
    "pumy-sp": ([36], set()), "pumy-p": ([36], set()), "puz-m": ([81], set()), "puz-zm": ([81], set()),
}
SO_HR = {"MSZ-HR"}                      # 'MSZ-HR##VFK Só para MXZ-HA' (p26)


def _attrs(sku: dict) -> dict[str, str]:
    return {a["chave"]: a["valor"] for a in sku["atributos"]}


def _set_attrs(sku: dict, d: dict[str, str], primeiro: tuple[str, ...] = ()) -> None:
    ordem = [k for k in primeiro if k in d] + [k for k in d if k not in primeiro]
    sku["atributos"] = [{"chave": k, "valor": d[k]} for k in ordem if d[k] not in (None, "")]


def _seccao(sku: dict) -> dict:
    return series.seccao(series.seccao_de(sku["ref"], sku["componente"], 0))


def _fundir_sufixo_e(run: dict) -> None:
    refs = {s["ref"]: s for s in run["skus"]}
    fora = set()
    for s in run["skus"]:
        com_e = refs.get(f"{s['ref']}-E")
        if com_e is None:
            continue
        com_e["pdfPaginas"] = sorted(set(com_e["pdfPaginas"]) | set(s["pdfPaginas"]))
        if com_e["pvpCents"] != s["pvpCents"]:
            com_e["avisos"].append(f"preços diferentes no PDF: {s['ref']} {s['pvpCents']} vs {com_e['pvpCents']}")
        fora.add(s["ref"])
    run["skus"] = [s for s in run["skus"] if s["ref"] not in fora]


def _nomes(run: dict) -> None:
    for s in run["skus"]:
        if s["familia"] == "acessorios-e-controlo":
            continue
        sec = _seccao(s)
        if not sec.get("nome"):
            continue
        novo = sec["nome"]
        if s["componente"] in COMPONENTE_LABEL:
            novo = f"{novo} | {COMPONENTE_LABEL[s['componente']]}"
        s["nome"] = novo + s["nome"][len(s["nomeGrupo"]):] if s["nome"].startswith(s["nomeGrupo"]) else novo
        s["nomeGrupo"] = novo
        for k, v in (sec.get("fixos") or {}).items():
            d = _attrs(s)
            d[k] = v
            _set_attrs(s, d)


def _compatibilidade(run: dict) -> None:
    ui_por_pagina: dict[int, set[str]] = {}
    for s in run["skus"]:
        if s["componente"] in ("unidade-interior",) and s["familia"] == "ar-condicionado":
            for p in s["pdfPaginas"]:
                ui_por_pagina.setdefault(p, set()).add(s["gama"])
    for s in run["skus"]:
        sid = series.seccao_de(s["ref"], s["componente"], 0)
        if sid not in COMPAT_UE or s["componente"] != "unidade-exterior":
            continue
        paginas, excluir = COMPAT_UE[sid]
        gamas = set().union(*(ui_por_pagina.get(p, set()) for p in paginas))
        gamas = gamas & SO_HR if excluir is None else gamas - excluir
        lista = sorted(gamas)
        if not lista:
            continue
        s["compativelCom"] = lista
        d = _attrs(s)
        d["compativel-com"] = ", ".join(lista)
        _set_attrs(s, d)


def _eixos_da_ref(run: dict) -> None:
    for s in run["skus"]:
        d = _attrs(s)
        m = re.search(r"\b(OVER|UNDER)/", s["ref"])
        if m:
            d["insuflacao"] = "superior" if m.group(1) == "OVER" else "inferior"
        m = re.match(r"^VL-\d+CZPVU-([RL])-E$", s["ref"])
        if m:
            d["orientacao"] = "direita" if m.group(1) == "R" else "esquerda"
        if s["familia"] == "cortinas-de-ar" and d.get("dimensoes"):
            d["comprimento-mm"] = d["dimensoes"].split("x")[1]       # AxLxP: a largura é o comprimento
        _set_attrs(s, d, primeiro=("insuflacao", "orientacao", "versao", "ligacoes"))


UE_FASE_RX = re.compile(r"^(?:\dx ?)?(?:MXZ|PXZ|PUMY|PUZ|SUZ|PUHZ|MUZ|MUY)-[A-Z]*\d+(V|Y)")


def _alimentacao_da_ref(run: dict) -> None:
    """Nas UE da Mitsubishi a letra a seguir à capacidade é a alimentação: V = 230 V
    monofásica, Y = 400 V trifásica (PUMY-P112VKM / PUMY-P112YKM). A ficha imprime
    'Monofásica | Trifásica' uma vez para várias colunas."""
    for s in run["skus"]:
        ue = s["ref"].split("/")[-1] if s["componente"] == "conjunto" else s["ref"]
        m = UE_FASE_RX.match(ue)
        if not m or s["componente"] not in ("conjunto", "unidade-exterior"):
            continue
        d = _attrs(s)
        d["alimentacao"] = "monofasica" if m.group(1) == "V" else "trifasica"
        _set_attrs(s, d)


# Comandos com a cor no nome: um produto, a cor como eixo (p49, p83, p206).
COMANDOS_COR = {"PAR-CT01MAA-S": "branco", "PAR-CT01MAA-SB": "branco", "PAR-CT01MAA-PB": "preto"}
NOME_CT01 = "Controlador remoto com painel táctil"


def _comandos_por_cor(run: dict) -> None:
    for s in run["skus"]:
        cor = COMANDOS_COR.get(s["ref"])
        if cor is None:
            continue
        d = _attrs(s)
        d["cor"] = cor
        _set_attrs(s, d, primeiro=("cor",))
        s["grupoModelo"] = "mitsubishi-par-ct01maa-comando"
        s["nomeGrupo"] = NOME_CT01
        bt = "sem Bluetooth" if s["ref"].endswith("-S") else "com Bluetooth"
        d["tipo"] = bt
        _set_attrs(s, d, primeiro=("cor", "tipo"))
        s["nome"] = f"{NOME_CT01} ({bt})"
        s["descricao"] = re.sub(r"(?i)\s*\b(branco|preto)\b", "", s.get("descricao") or NOME_CT01).strip()


def _deposito_da_descricao(run: dict) -> None:
    """EST-20-V1 (p30): 'Depósito 200lts c/ controlo integrado …'."""
    for s in run["skus"]:
        d = _attrs(s)
        if s["componente"] != "deposito" or d.get("deposito-l"):
            continue
        m = re.search(r"(?i)(\d{2,4})\s*(?:l|lt|lts|litros)\b", s.get("descricao") or "")
        if m:
            d["deposito-l"] = m.group(1)
            _set_attrs(s, d, primeiro=("deposito-l",))


# Gralhas do PDF corrigidas com aviso: (ref, chave, valor impresso, valor lido).
GRALHAS = [
    ("a-LIFE2 HP 2T DLIO 1002", "calor-kw", "807", "8.07"),     # p114 imprime '807' na coluna de kW
]


# Refs com gralha: (ref impressa, ref certa, porquê). A p69 imprime a UE Classic
# Inverter 200/250 como 'PUZ-M200YDA'; a p81 vende-a avulsa como PUZ-M200YKA
# (o sufixo DA é o da Power Inverter monofásica).
REFS = [
    ("PEA-M200LA/PUZ-M200YDA", "PEA-M200LA/PUZ-M200YKA", "p69 imprime PUZ-M200YDA; a UE é a PUZ-M200YKA da p81"),
    ("PEA-M250LA/PUZ-M250YDA", "PEA-M250LA/PUZ-M250YKA", "p69 imprime PUZ-M250YDA; a UE é a PUZ-M250YKA da p81"),
]


def _refs(run: dict) -> None:
    for s in run["skus"]:
        for impressa, certa, porque in REFS:
            if s["ref"] == impressa:
                s["ref"] = certa
                s["avisos"].append(f"ref corrigida: {porque}")


def _gralhas(run: dict) -> None:
    for s in run["skus"]:
        for prefixo, chave, impresso, valor in GRALHAS:
            if not s["ref"].startswith(prefixo):
                continue
            d = _attrs(s)
            if d.get(chave) in (None, impresso):
                d[chave] = valor
                _set_attrs(s, d)
                s["avisos"].append(f"{chave}: o PDF imprime '{impresso}' (p{s['pdfPaginas'][0]}), lido como {valor}")


def _chaves_do_registo(run: dict) -> None:
    registo = carregar_registo()["categorias"]
    for s in run["skus"]:
        conhecidas = {c["chave"] for c in registo[s["familia"]]["chaves"]}
        d = {k: v for k, v in _attrs(s).items() if k in conhecidas}
        _set_attrs(s, d)


def corrigir(run: dict, doc) -> None:
    _fundir_sufixo_e(run)
    _nomes(run)
    _compatibilidade(run)
    _eixos_da_ref(run)
    _alimentacao_da_ref(run)
    _comandos_por_cor(run)
    _deposito_da_descricao(run)
    _refs(run)
    _gralhas(run)
    _chaves_do_registo(run)

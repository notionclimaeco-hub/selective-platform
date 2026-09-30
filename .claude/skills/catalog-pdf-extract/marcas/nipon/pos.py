"""Nipon 2025 (ticket #45): pós-processamento do staged JSON.

Hook `corrigir(run, doc)` do `cadeia.py`: corre depois de `agrupar.py` e antes
de `validar.py`. Cada correção lê o PDF ou justifica-se no comentário; as que
mudam o que o PDF imprime deixam um aviso no SKU para o revisor confirmar.
"""
import re

from _comum import grupo_modelo
from mapa import palavras_da_pagina


def corrigir(run: dict, doc) -> None:
    skus = run["skus"]
    nomes_de_acessorios(skus)
    classes_multi_ue(skus)
    compatibilidade_multi(skus, doc)
    avisar_h_power_0270(skus)


def attrs(s):
    return {a["chave"]: a["valor"] for a in s["atributos"]}


def gravar(s, d):
    s["atributos"] = [{"chave": k, "valor": v} for k, v in d.items()]


# 1. Acessórios cujo nome está impresso longe da linha de preço: legendas das
# caixas da p33 (comandos com fios), caixas da p34 (controlo de porta,
# derivações, cabo da sonda do depósito) e as legendas da p56 que chamam
# "Comando" ao CIVO e ao CMG. A tabela só imprime o modelo, código e preço.
NOMES = {
    "NI0195100": ("Comando remoto NRGA/F1", "comando", None),
    "NI0195002": ("Comando remoto NRGA/F7", "comando", None),
    "NI0195106": ("Comando remoto NRGA/F8", "comando", None),
    "NI0195004": ("Comando remoto NRGA/1F", "comando", "branco"),     # NRGA/1F W: Primis Duo branca
    "NI0195006": ("Comando remoto NRGA/1F", "comando", "preto"),      # NRGA/1F B: Primis Duo escura
    "NI0195110": ("Comando com fio NPGA/19 p/ conduta multi-split MD GA", "comando", None),
    "NI0195122": ("Comando com fio e Wi-Fi NPGA/24 p/ gama comercial", "comando", None),
    "NI0195112": ("Comando com fio e Wi-Fi NPGA/44 p/ multi-split", "comando", None),
    "NI0195116": ("Comando NPGA/45 multi-split com AQS p/ depósito S200L GA", "comando", None),
    "NI0195152": ("Comando programável NPGA/76", "comando", None),
    "NI0195300": ("Módulo controlo de porta NCPG/03 p/ gama comercial", "acessorio", None),
    "NI0195310": ("Controlo de porta NCPG/10 p/ unidades murais", "acessorio", None),
    "NI0195425": ("Derivação Syncro NDGA/25 (2 a 4 unidades interiores)", "acessorio", None),
    "NI0195426": ("Derivação Syncro NDGA/26 (2 a 4 unidades interiores)", "acessorio", None),
    "NI0195427": ("Derivação Syncro NDGA/27 (3 unidades interiores)", "acessorio", None),
    "NI0195250": ("Cabos de extensão das sondas de temperatura AQS p/ depósito S200L GA (2×25 m)",
                  "acessorio", None),
    "NI2039062": ("Comando CIVO p/ Venice", "comando", None),
    "NI2039066": ("Comando digital CMG p/ Venice", "comando", None),
}


def nomes_de_acessorios(skus):
    for s in skus:
        if s["ref"] not in NOMES:
            continue
        nome, comp, cor = NOMES[s["ref"]]
        s["nome"] = s["nomeGrupo"] = s["descricao"] = nome
        s["componente"] = comp
        s["grupoModelo"] = grupo_modelo(s["marca"], None, comp, ref=s["ref"])
        if cor:                                     # NRGA/1F branco e preto: um produto, duas cores
            gravar(s, {"cor": cor, **attrs(s)})
            s["grupoModelo"] = grupo_modelo(s["marca"], None, comp, ref=nome.split()[-1])


# 2. p18-19: as UE multi-split imprimem a classe energética como desenho (a
# linha "Classe energética" não tem texto nas colunas): arrefecimento A++ e
# aquecimento A+ em todas as colunas das duas tabelas.
def classes_multi_ue(skus):
    for s in skus:
        if s.get("sistema") == "multi-split" and s["componente"] == "unidade-exterior":
            a = attrs(s)
            a.setdefault("classe-energetica", "A++/A+")
            ordem = ("unidades-max", "alimentacao", "frio-kw", "calor-kw", "classe-energetica")
            gravar(s, {**{k: a[k] for k in ordem if k in a}, **a})


# 3. Compatibilidade das UE multi-split, das tabelas de combinações (p25-26):
# cada bloco (M2-18, M3-24, M4-28, M4-36, M5-42 e o bloco AC+AQS partilhado
# pelas M4-36DHW/M5-42DHW) lista as combinações por classe de UI (9, 12, 18,
# 20, 24 = kBTU no nome do modelo). A UE aceita as UI multi-split dessas
# classes; as AC+AQS aceitam também o depósito S200L GA. A p26 imprime "21"
# em duas combinações da M5-42: não há UI dessa classe, fica de fora.
BLOCOS = (  # (página, título, y a partir do qual o bloco começa na página, modelos)
    (25, "M2-18", 490, ["M2-18 GB"]),
    (25, "M3-24", 490, ["M3-24 GB"]),
    (25, "M4-28", 490, ["M4-28 GB"]),
    (25, "M4-36", 490, ["M4-36 GB"]),
    (26, "M5-42", 0, ["M5-42 GB"]),
    (26, "M4-36DHW", 0, ["M4-36DHW GA", "M5-42DHW GA"]),
)
DEPOSITO = "NI0130120"


def blocos_matriz(doc):
    """{modelo da UE: classes de UI} lido das tabelas de combinações."""
    out = {}
    for pagina in (25, 26):
        palavras = palavras_da_pagina(doc[pagina - 1])
        titulos = []
        for p, titulo, y_min, modelos in BLOCOS:
            if p != pagina:
                continue
            y = min(w[1] for w in palavras if w[1] >= y_min and w[4].startswith(titulo)
                    and (titulo.endswith("DHW") or "DHW" not in w[4]))
            titulos.append((y, modelos))
        titulos.sort()
        for i, (y, modelos) in enumerate(titulos):
            fim = titulos[i + 1][0] if i + 1 < len(titulos) else 815          # 815: sem o rodapé
            classes = set()
            for w in palavras:
                if y < w[1] < fim and re.fullmatch(r"\d{1,2}(\+\d{1,2})*", w[4]):
                    classes |= {int(n) for n in w[4].split("+")}
            for m in modelos:
                out[m] = classes
    return out


def compatibilidade_multi(skus, doc):
    uis = [s for s in skus if s.get("sistema") == "multi-split" and s["componente"] == "unidade-interior"]
    ues = {re.sub(r"^Modelo (.+?) da gama .*$", r"\1", s.get("descricao", "")): s
           for s in skus if s.get("sistema") == "multi-split" and s["componente"] == "unidade-exterior"}
    for modelo, classes in blocos_matriz(doc).items():
        s = ues.get(modelo)
        if s is None:
            raise SystemExit(f"UE da matriz sem linha de preço: {modelo}")
        refs = sorted(u["ref"] for u in uis if int(attrs(u).get("btu", 0)) // 1000 in classes)
        if "DHW" in modelo:
            refs.append(DEPOSITO)
        s["compativelCom"] = refs
        s["pdfPaginas"] = sorted(set(s["pdfPaginas"]) | {25, 26})
    sem = [m for m in ues if m not in blocos_matriz(doc)]
    if sem:
        raise SystemExit(f"UE multi-split sem tabela de combinações: {sem}")


# 4. H-Power (p46): a coluna 0270 (30 470 €) imprime a ref da 0140 (NI0516014).
# A 0270 fica de fora até a Nipon indicar a ref; a NI0516014 fica com a 0140
# (primeira coluna, 20 660 €, como no catálogo anterior).
def avisar_h_power_0270(skus):
    for s in skus:
        if s["ref"] == "NI0516014":
            s["avisos"] = [a for a in s["avisos"] if not a.startswith("preços diferentes no PDF")]
            s["avisos"].append("p46: a coluna H-Power 0270 (30 470 €) imprime esta mesma ref; a 0270 fica de "
                               "fora até a Nipon indicar a ref certa")

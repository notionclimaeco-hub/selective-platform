"""Midea 2026 (ticket #44): pós-processamento do staged JSON.

Hook `corrigir(run, doc)` do `cadeia.py`: corre depois de `agrupar.py` e antes
de `validar.py`. Cada correção lê o PDF ou justifica-se no comentário; as que
mudam o que o PDF imprime deixam um aviso no SKU para o revisor confirmar.
"""
import re

from _comum import grupo_modelo
from mapa import palavras_da_pagina


def corrigir(run: dict, doc) -> None:
    skus = run["skus"]
    corrigir_refs(skus)
    trocar_colunas_piscina(skus)
    corrigir_vrf_560(skus)
    acrescentar_sem_ref(skus, doc)
    nomes_de_acessorios(skus)
    compatibilidade_multi(skus, doc)
    avisar_cassete_2_vias(skus)


def attrs(s):
    return {a["chave"]: a["valor"] for a in s["atributos"]}


def gravar(s, d):
    s["atributos"] = [{"chave": k, "valor": v} for k, v in d.items()]


def por_ref(skus, ref):
    return next(s for s in skus if s["ref"] == ref)


def renomear(s, sufixo):
    s["nome"] = f"{s['nomeGrupo']} {sufixo}".strip()


# 1. Refs com gralha no PDF.
# p10 imprime "M40E-28hfn8-q"/"M40B-36hfn8-q" (zero); a matriz da p13 e o resto da
# série (M2OH, M3OG, M5OE) usam a letra O. p8 imprime "MOX63OU" (letra O) na UE
# que a p7 imprime "MOX630U-48HFN8-R(GA)".
GRALHAS = {
    "M40E-28HFN8-Q": ("M4OE-28HFN8-Q", "p10 imprime M40E (zero); a matriz p13 imprime M4OE"),
    "M40B-36HFN8-Q": ("M4OB-36HFN8-Q", "p10 imprime M40B (zero); a matriz p13 imprime M4OB"),
    "4X-MTJ-12HWFNX(GA)+MOX63OU-48HFN8-R(GA)": (
        "4X-MTJ-12HWFNX(GA)+MOX630U-48HFN8-R(GA)", "p8 imprime MOX63OU; a p7 imprime a UE como MOX630U"),
}


def corrigir_refs(skus):
    for s in skus:
        if s["ref"] in GRALHAS:
            nova, porque = GRALHAS[s["ref"]]
            s["avisos"].append(f"ref corrigida de {s['ref']} para {nova}: {porque}")
            s["ref"] = nova


# 2. Bombas de calor para piscina (p15): a tabela chama "Arrefecimento" à coluna
# que é o aquecimento (MSC-70 → 7.16 kW, o código do modelo é o kW de
# aquecimento ×10) e "Aquecimento" à de arrefecimento. Trocam-se; faixas fora
# (o registo de bombas de calor não tem mín/máx).
def trocar_colunas_piscina(skus):
    for s in skus:
        if s["grupoModelo"] != "midea-bomba-de-calor-para-piscina":
            continue
        a = attrs(s)
        frio, calor = a.get("calor-kw"), a.get("frio-kw")
        faixas = f"{a.get('frio-kw-min')}–{a.get('frio-kw-max')} / {a.get('calor-kw-min')}–{a.get('calor-kw-max')} kW"
        novo = {"calor-kw": calor, "frio-kw": frio}
        novo.update({k: v for k, v in a.items() if k not in novo and not k.endswith(("-min", "-max"))})
        gravar(s, novo)
        s["descricao"] = f"Capacidade impressa na tabela: {faixas}."
        renomear(s, f"{calor} kW")
        s["avisos"].append("PDF troca as colunas Arrefecimento/Aquecimento (o modelo MSC-70 aquece 7.16 kW): "
                           "calor-kw é a 1.ª coluna — confirmar")


# 3. VRF (p23): a UE 560 imprime 8.0 kW (Easyfit) e 50.0 kW (V8) de frio; o código
# de capacidade é kW×10 em todas as outras (252→25.2 … 615→61.5) e o aquecimento
# impresso (63.0) é o da 560 da V8S (56.0/63.0).
def corrigir_vrf_560(skus):
    for ref in ("MVi-560WV2RN1(A)", "MV8i-560WV2RN1E"):
        s = por_ref(skus, ref)
        a = attrs(s)
        s["avisos"].append(f"frio-kw impresso {a['frio-kw']} corrigido para 56.0 (código 560 = 56.0 kW, como a V8S)")
        a["frio-kw"] = "56.0"
        gravar(s, a)
        renomear(s, "56.0 kW")


# 4. Produtos com preço mas sem ref impressa: mantêm a ref do catálogo anterior.
SEM_REF = [
    ("KIT-VALVULAS-3VIAS-2TUBOS", "Kit Válvulas 3 Vias 2 Tubos", 20, "KIT VÁLVULAS 3 VIAS 2 TUBOS", 297,
     "Kit de válvulas de 3 vias para ventiloconvectores de 2 tubos."),
    ("KIT-VALVULAS-3VIAS-4TUBOS", "Kit Válvulas 3 Vias 4 Tubos", 20, "KIT VÁLVULAS 3 VIAS 4 TUBOS", 297,
     "Kit de válvulas de 3 vias para ventiloconvectores de 4 tubos."),
    ("PLACA-MULTIFUNCOES", "Placa Multifunções", 14, "PLACA MULTIFUNÇÕES", 297,
     "Placa multifunções compatível com a gama mural."),
]


def preco_abaixo(doc, pagina, legenda, x_min):
    """Preço impresso por baixo da legenda (caixa da coluna com x ≥ x_min)."""
    palavras = [w for w in palavras_da_pagina(doc[pagina - 1]) if w[0] >= x_min]
    alvo = legenda.split()
    for i, w in enumerate(palavras):
        if [p[4] for p in palavras[i:i + len(alvo)]] == alvo:
            y = w[1]
            for _x0, y0, _x1, _y1, t in palavras:
                m = re.fullmatch(r"(\d{1,3}(?:\.\d{3})*),(\d{2})€", t)
                if m and 0 < y0 - y <= 60:
                    return int(m.group(1).replace(".", "")) * 100 + int(m.group(2))
    raise SystemExit(f"p{pagina}: preço de '{legenda}' não encontrado")


def acrescentar_sem_ref(skus, doc):
    for ref, nome, pagina, legenda, x_min, desc in SEM_REF:
        skus.append({
            "ref": ref, "nome": nome, "nomeGrupo": nome, "marca": "midea", "familia": "acessorios-e-controlo",
            "componente": "acessorio", "atributos": [], "descricao": desc,
            "pvpCents": preco_abaixo(doc, pagina, legenda, x_min), "ivaIncluido": False,
            "tabelaOrigem": "midea-2026", "grupoModelo": grupo_modelo("midea", None, "acessorio", ref=ref),
            "pdfPaginas": [pagina], "avisos": ["o PDF não imprime ref: mantida a ref do catálogo anterior"],
        })


# 5. Nomes de acessórios: a legenda vem em maiúsculas e `frase()` baixa as gamas.
NOMES = [(r"(?i)\bbreezeless ([es])\b", lambda m: f"Breezeless {m.group(1).upper()}"),
         (r"(?i)\bpenroseair\b", "Penroseair"), (r"(?i)\bsolstice\b", "Solstice"),
         (r"(?i)\barc?tic fox\b", "Arctic Fox"), (r"\(xt\)", "(XT)"), (r"\(ez\)", "(EZ)"),
         (r"(?i)\bwifi\b", "WiFi")]


def nomes_de_acessorios(skus):
    for s in skus:
        if s["familia"] != "acessorios-e-controlo":
            continue
        for campo in ("nome", "nomeGrupo", "descricao"):
            if s.get(campo):
                for rx, novo in NOMES:
                    s[campo] = re.sub(rx, novo, s[campo])
    # Comandos centralizados: o nome é a ref inteira (o "(A)" caía com os parênteses).
    for ref in ("CCM-180A/BWS(A)", "CCM-270B/WS(A)"):
        s = por_ref(skus, ref)
        s["nome"] = s["nomeGrupo"] = f"Comando {ref}"
        s["descricao"] = f"Comando centralizado {ref}."
    por_ref(skus, "CCM-270B/WS(A)")["avisos"].append(
        "a legenda da caixa diz CCM-270B/BWS(B); a linha de preço diz CCM-270B/WS(A)")
    # Kit UTA (p23): sem descrição além da capacidade → nome pelo título da tabela.
    for s in skus:
        if s["ref"].startswith("AHUKZ-"):
            s["nome"] = s["nomeGrupo"] = f"Kit UTA {s['ref']}"
            s["descricao"] = f"Kit de ligação de UTA ao VRF. {s.get('descricao', '')}".strip()


# 6. Compatibilidade das UE multi-split pelas matrizes de combinações (p9, p12-13):
# as combinações são classes de capacidade das UI (7, 9, 12, 18, 24 kBTU/h); a UE
# aceita as UI multi-split dessas classes. A CirQHP ganha também `unidades-max`.
CLASSES = (7, 9, 12, 18, 24)


def blocos_matriz(doc):
    """{ref UE: (classes, máx. de unidades)} lido das páginas de combinações."""
    out = {}
    for pagina, cabecalho, y_min in ((9, False, 467), (12, True, 641), (13, True, 0)):
        palavras = [w for w in palavras_da_pagina(doc[pagina - 1]) if w[1] > y_min]   # matriz a meio da página
        refs = sorted((w[1], w[4]) for w in palavras if re.fullmatch(r"M\dO[A-Z]-\d\dHFN8-Q", w[4]))

        def corte(y1, y2):                     # p9: os blocos separam-se no maior vão entre linhas
            ys = sorted({w[1] for w in palavras if y1 < w[1] < y2})
            vaos = [(b - a, (a + b) / 2) for a, b in zip(ys, ys[1:])]
            return max(vaos)[1] if vaos else (y1 + y2) / 2

        for i, (y, ref) in enumerate(refs):
            if cabecalho:                      # p12-13: barra com a ref por cima do bloco
                ini, fim = y, refs[i + 1][0] if i + 1 < len(refs) else 10_000
            else:                              # p9: ref ao meio do bloco
                ini = corte(refs[i - 1][0], y) if i else 0
                fim = corte(y, refs[i + 1][0]) if i + 1 < len(refs) else 10_000
            bloco = sorted((w for w in palavras if ini <= w[1] < min(fim, 810)),   # 810: sem o rodapé
                           key=lambda w: (round(w[1] / 3), w[0]))
            classes, maximo = set(), 0
            for j, w in enumerate(bloco):
                seguinte = bloco[j + 1][4] if j + 1 < len(bloco) else ""
                if re.fullmatch(r"\d", w[4]) and re.match(r"(?i)^(un\.?|unidades?)$", seguinte):
                    maximo = max(maximo, int(w[4]))
                elif re.fullmatch(r"\d{1,2}(\+\d{1,2})*", w[4]):
                    classes |= {int(n) for n in w[4].split("+")}
            prev = out.get(ref, (set(), 0))
            out[ref] = (prev[0] | (classes & set(CLASSES)), max(prev[1], maximo))
    return out


def compatibilidade_multi(skus, doc):
    uis = [s for s in skus if s.get("sistema") == "multi-split" and s["componente"] == "unidade-interior"]

    def classe(s):
        btu = float(attrs(s).get("btu", 0))
        return min(CLASSES, key=lambda c: abs(c * 1000 - btu)) if btu else None

    for ref, (classes, maximo) in blocos_matriz(doc).items():
        s = next((x for x in skus if x["ref"] == ref), None)
        if s is None:
            raise SystemExit(f"UE da matriz sem linha de preço: {ref}")
        s["compativelCom"] = sorted(u["ref"] for u in uis if classe(u) in classes)
        a = attrs(s)
        if maximo and "unidades-max" not in a:
            gravar(s, {"unidades-max": str(maximo), **a})
            renomear(s, f"(até {maximo} UI)")


# 7. p24 imprime na "Cassete 2 Vias" as mesmas refs da "Cassete 1 Via" (MIH##Q1N18):
# as UI de 2 vias não têm ref própria no PDF e ficam de fora.
def avisar_cassete_2_vias(skus):
    for s in skus:
        if re.fullmatch(r"MIH\d+Q1N18", s["ref"]):
            s["avisos"].append("a tabela Cassete 2 Vias (p24) repete estas refs: as UI de 2 vias ficam de fora "
                               "até a SGT indicar as refs")

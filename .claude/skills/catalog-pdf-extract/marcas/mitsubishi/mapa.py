"""Mitsubishi Electric 2026 (`MITSUBISHI Tabela  de Preços 2026.pdf`, 223 páginas, ticket #46): mapa.

Hook `gerar(doc, ficheiro, marca, ano)` do `cadeia.py`: substitui o mapa
automático. O outline do PDF só tem os capítulos (Gama Doméstica p6-49, Mr.
Slim p50-83, …) e a mesma série aparece em várias páginas (conjunto, UI avulsa
nas matrizes multi-split, compatibilidades), por isso as secções são as séries
de `series.py` e as páginas de cada uma são as que o leitor (`extrair.py`)
encontra com refs dessa série. Páginas sem quadros com preço ficam `ignorar`,
agrupadas por capítulo do outline.
"""
from __future__ import annotations

from _comum import parte_da_marca

series = parte_da_marca("mitsubishi", "series")
leitor = parte_da_marca("mitsubishi", "extrair")


def gerar(doc, ficheiro: str, marca: str, ano: int) -> dict:
    paginas: dict[str, set[int]] = {}
    for numero in sorted(leitor.PAGINAS):
        for l in leitor.ler_pagina(doc[numero - 1], numero):
            paginas.setdefault(l["seccao"], set()).add(numero)

    seccoes = []
    for s in series.SECCOES:
        if s["id"] not in paginas:
            continue
        seccoes.append({
            "id": s["id"], "titulo": s["titulo"], "paginas": sorted(paginas[s["id"]]), "tipo": "tabela",
            "familia": s["familia"], "segmento": s["segmento"], "sistema": s["sistema"],
            "tipoUnidade": s["tipoUnidade"], "componente": s["componente"], "gama": s["gama"],
            "rotulo": "", "herdarKw": False, "nomeGrupo": s["nome"], "avisos": [],
        })

    com_preco = set().union(*paginas.values())
    capitulos = [(titulo, inicio) for _nivel, titulo, inicio in doc.get_toc()]
    for k, (titulo, inicio) in enumerate(capitulos):
        fim = capitulos[k + 1][1] - 1 if k + 1 < len(capitulos) else doc.page_count
        sem = [p for p in range(inicio, fim + 1) if p not in com_preco]
        if sem:
            seccoes.append({"id": f"sem-precos-{titulo.split('_')[0].lower()}", "titulo": f"{titulo} (sem preços)",
                            "paginas": sem,
                            "tipo": "ignorar", "avisos": []})
    return {"ficheiro": ficheiro, "marca": marca, "ano": ano, "numPaginas": doc.page_count,
            "estrategia": "series", "seccoes": seccoes}

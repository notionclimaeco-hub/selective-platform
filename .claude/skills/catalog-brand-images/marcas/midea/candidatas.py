#!/usr/bin/env python3
"""Midea 2026 (#44/#49): candidatas de foto por grupo → product-scaffold/imagens/midea/candidatas.json.

    node scripts/imagens/crawl-midea-curl.mjs          # sgtmidea.com → product-scaffold/crawl-raw/midea/
    python3 .claude/skills/catalog-pdf-extract/scripts/pdf_images.py <csv> --only <grupo> [--include-ue]
    python3 .claude/skills/catalog-brand-images/marcas/midea/candidatas.py
    node scripts/imagens/procurar-ref.mjs --brand midea  # grupos que ficaram sem nada

Cada grupo aponta para as páginas da SGT (distribuidor exclusivo) vistas à mão
nas folhas de contacto; `aviso` onde a foto não é o produto exato (série irmã,
foto da UI num conjunto Twin, miniatura do PDF pequena).
"""
import html
import json
from pathlib import Path

RAIZ = next(p for p in Path(__file__).resolve().parents if (p / "package.json").is_file() and (p / "convex").is_dir())
CRAWL = RAIZ / "product-scaffold/crawl-raw"
PASTA = RAIZ / "product-scaffold/imagens/midea"

TWIN = "foto da UI da série; o conjunto Twin não tem foto própria"
IRMA = "série irmã / modelo anterior na SGT — confirmar"
PDF = "miniatura do PDF (sem página na SGT)"

# grupo → [(página SGT ou "pdf:<grupo>", ficheiros, aviso)]
SITE = {
    "midea-mural-breezeless-s": [("breezeless", ["05", "02", "03", "01"], None)],
    "midea-mural-penroseair-xt": [("penroseair", ["02", "03", "01"], None)],
    "midea-mural-solstice-ez": [("solstice", ["01", "02", "03"], None)],
    "midea-mural-breezeless-e-cb1": [("breezeless-e", ["01", "03"], None)],
    "midea-consola-de-chao": [("consola-de-chao", ["02", "01", "03"], None)],
    "midea-teto-chao": [("tecto-chao", ["01", "02", "03"], None)],
    "midea-cassete-1-via": [("unidades-interiores-tipo-cassete-1-via", ["01"], IRMA), ("pdf:midea-cassete-1-via", ["01"], PDF)],
    "midea-cassete-compacta": [("cassete-compacta", ["01", "02", "03"], None)],
    "midea-cassete-4-vias-super-slim": [("cassete-de-4-vias-super-slim", ["01", "02"], None)],
    "midea-conduta": [("conduta", ["01-sem-selo", "01", "02", "03"], None)],
    "midea-conduta-tipo-split": [("pdf:midea-conduta-tipo-split", ["01"], PDF)],
    "midea-armario-vertical": [("armario-vertical", ["01", "02", "03"], None)],
    "midea-cassete-twin-duplo": [("cassete-compacta", ["01", "02"], TWIN), ("cassete-de-4-vias-super-slim", ["01"], TWIN)],
    "midea-conduta-twin-duplo": [("conduta", ["01-sem-selo", "01", "03"], TWIN)],
    "midea-teto-chao-twin-duplo": [("tecto-chao", ["01", "02"], TWIN)],
    "midea-cassete-compacta-twin-triplo": [("cassete-compacta", ["01", "02"], TWIN)],
    "midea-conduta-twin-triplo": [("conduta", ["01-sem-selo", "01", "03"], TWIN)],
    "midea-cassete-compacta-twin-quadruplo": [("cassete-compacta", ["01", "02"], TWIN)],
    "midea-conduta-twin-quadruplo": [("conduta", ["01-sem-selo", "01", "03"], TWIN)],
    "midea-cirqhp-unidade-exterior": [("multi-split-cirqhp", ["04", "01"], None)],
    "midea-cirqhp-deposito": [("multi-split-cirqhp", ["01"], "foto do sistema (UE + depósito + UI); sem foto só do depósito")],
    "midea-multi-split-unidade-exterior": [("multi-split-free-match", ["04", "05", "01"], None)],
    "midea-mural-breezeless-s-multi-split-unidade-interior": [("breezeless", ["05", "02"], None)],
    "midea-mural-penroseair-xt-multi-split-unidade-interior": [("penroseair", ["02"], None)],
    "midea-mural-solstice-ez-multi-split-unidade-interior": [("solstice", ["01", "02", "03"], None)],
    "midea-mural-breezeless-e-cb1-multi-split-unidade-interior": [("breezeless-e", ["01"], None)],
    "midea-consola-de-chao-multi-split-unidade-interior": [("consola-de-chao", ["02", "01"], None)],
    "midea-teto-chao-multi-split-unidade-interior": [("tecto-chao", ["01", "02"], None)],
    "midea-cassete-1-via-multi-split-unidade-interior": [("unidades-interiores-tipo-cassete-1-via", ["01"], IRMA)],
    "midea-cassete-compacta-e-4-vias-multi-split-unidade-interior": [
        ("cassete-compacta", ["01"], None), ("cassete-de-4-vias-super-slim", ["01"], None)],
    "midea-conduta-multi-split-unidade-interior": [("conduta", ["01-sem-selo", "01"], None)],
    # comandos com ficheiro nomeado pela ref na SGT
    "midea-kjr-120m-x6w-bgef-comando": [("sistemas-de-controlo-gama-comercial", ["01"], None)],
    "midea-kjr-120g2-tfbg-e-02-comando": [("sistemas-de-controlo-gama-comercial", ["02"], None)],
    "midea-kjr-120x2-tfbg-e-comando": [("sistemas-de-controlo-gama-comercial", ["03"], None)],
    "midea-kjr-29b-bk-e-comando": [("sistemas-de-controlo-gama-comercial", ["04"], None)],
    "midea-ccm-180a-bws-a-comando": [("sistemas-de-controlo-gama-comercial", ["05"], None)],
    "midea-ccm-270b-ws-a-comando": [("sistemas-de-controlo-gama-comercial", ["06"], None)],
    "midea-rg10a-b2s-bgef-comando": [("sistemas-de-controlo", ["02"], None)],
    "midea-rg10x1-g2hs-bgef-comando": [("sistemas-de-controlo", ["03"], None)],
    # AQS e aerotermia
    "midea-combo": [("bombas-de-calor", ["01"], None)],
    "midea-split-r454c-unidade-exterior": [("pdf:midea-split-r454c-unidade-exterior", ["01"], PDF + "; foto da UE com o depósito")],
    "midea-split-r454c-deposito": [("pdf:midea-split-r454c-deposito", ["01"], PDF + "; foto da UE com o depósito")],
    "midea-h-pack": [("pdf:midea-h-pack", ["01"], PDF)],
    "midea-porta-split": [("pdf:midea-porta-split", ["01"], PDF)],
    "midea-m-thermal-arctic": [("m-thermal", ["01", "02"], None)],
    "midea-m-thermal-mars": [("m-thermal-serie-mars-monobloco", ["01"], None)],
    "midea-m-thermal-mars-large": [("pdf:midea-m-thermal-mars-large", ["01"], PDF)],
    "midea-m-thermal-power": [("pdf:midea-m-thermal-power", ["01"], PDF), ("m-thermal", ["01"], IRMA)],
    "midea-m-thermal-hygge-unidade-exterior": [("pdf:midea-m-thermal-hygge-unidade-exterior", ["01"], PDF)],
    "midea-m-thermal-hygge-unidade-interior": [("pdf:midea-m-thermal-hygge-unidade-interior", ["02"], PDF)],
    "midea-m-thermal-hygge-com-deposito-unidade-interior": [
        ("pdf:midea-m-thermal-hygge-com-deposito-unidade-interior", ["02"], PDF + "; imagem pequena")],
    # ventiloconvectores
    "midea-ventiloconvector-cassete-1-via": [("cassete-1-via", ["01"], None)],
    "midea-ventiloconvector-cassete-compacta-dc-2-tubos": [("cassete-compacta-3", ["01"], None)],
    "midea-ventiloconvector-cassete-compacta-dc-4-tubos": [("cassete-compacta-3", ["01"], None)],
    "midea-ventiloconvector-cassete-4-vias-dc-2-tubos": [("cassetes-4-vias", ["01"], None)],
    "midea-ventiloconvector-cassete-4-vias-dc-4-tubos": [("cassetes-4-vias", ["01"], None)],
    "midea-ventiloconvector-mural": [("mural-2", ["01"], None)],
    # A página "Tecto/Chão" dos ventiloconvectores mostra a versão com envolvente
    # (01, 03) e a encastrada (02); o PDF não diz qual é H2 e qual é H3.
    "midea-ventiloconvector-chao-teto-dc-2-tubos-h2": [("tecto-chao-2", ["01", "03", "02"], "H2/H3: confirmar se é a versão com ou sem envolvente")],
    "midea-ventiloconvector-chao-teto-dc-2-tubos-h3": [("tecto-chao-2", ["02", "01", "03"], "H2/H3: confirmar se é a versão com ou sem envolvente")],
    "midea-ventiloconvector-chao-teto-dc-4-tubos": [("tecto-chao-2", ["01", "03", "02"], None)],
    "midea-ventiloconvector-conduta-dc-2-tubos": [("conduta-2", ["01"], None)],
    "midea-ventiloconvector-conduta-dc-4-tubos": [("conduta-2", ["01"], None)],
    # chillers e ventilação
    "midea-chiller-aqua-thermal-super": [("aqua-thermal-super", ["01"], None)],
    "midea-chiller-aqua-thermal-max": [("chillers-aqua-thermal", ["01", "02"], IRMA + " (página Aqua Thermal MC-SU)")],
    "midea-hrv": [("hrv-unidades-de-ventilacao-de-fluxos-cruzados", ["01", "02"], None)],
    # VRF
    "midea-mini-vrf-atom-t-unidade-exterior": [("mini-vrf-atom-t", ["03", "05"], None)],
    "midea-mini-vrf-v8m-unidade-exterior": [("mini-vrf-v8m", ["01"], None)],
    "midea-mini-vrf-easyfit-unidade-exterior": [("mini-vrf-serie-c-e-easyfit", ["02", "03", "04", "01"], None)],
    "midea-vrf-v8s-unidade-exterior": [("vrf-v8s", ["01"], None)],
    "midea-vrf-v8-unidade-exterior": [("vrf-v8", ["01", "02", "03"], None)],
    "midea-vrf-v6r-recuperacao-de-calor-unidade-exterior": [("vrf-v6r", ["01", "02"], None)],
    "midea-vrf-mural-unidade-interior": [("mural", ["01"], None)],
    "midea-vrf-chao-com-envolvente-unidade-interior": [("chao-com-e-sem-envolvente", ["03", "04", "01"], None)],
    "midea-vrf-chao-sem-envolvente-unidade-interior": [("chao-com-e-sem-envolvente", ["02", "01"], None)],
    "midea-vrf-teto-chao-unidade-interior": [("unidades-interiores-tipo-tecto-chao", ["01"], None)],
    "midea-vrf-cassete-1-via-unidade-interior": [("unidades-interiores-tipo-cassete-1-via", ["01"], None)],
    "midea-vrf-cassete-compacta-unidade-interior": [("cassete-compacta-2", ["01"], None)],
    "midea-vrf-cassete-4-vias-unidade-interior": [("unidades-interiores-tipo-cassete-4-vias", ["01"], None)],
    "midea-vrf-conduta-media-pressao-unidade-interior": [("unidades-interiores-tipo-conduta-media-pressao-estatica", ["01"], None)],
    "midea-vrf-conduta-alta-pressao-unidade-interior": [("unidades-interiores-tipo-conduta-alta-pressao-estatica", ["01", "02", "03"], None)],
    "midea-vrf-unidade-de-tratamento-de-ar-novo-unidade-interior": [("unidade-tratamento-de-ar-novo", ["01"], None)],
}


def editar_fotos() -> None:
    """A foto da conduta na SGT tem o selo "NOVO" por cima (o recorte deixa-o a
    meio): corta-se a faixa do selo, que não toca no produto."""
    from PIL import Image
    origem = CRAWL / "midea/conduta/01.jpg"
    destino = CRAWL / "midea/conduta/01-sem-selo.png"
    if origem.is_file() and not destino.is_file():
        Image.open(origem).convert("RGB").crop((0, 190, 600, 480)).save(destino)


def main() -> None:
    editar_fotos()
    manifest = json.loads((CRAWL / "manifest.json").read_text())
    url_da_pagina = {p["pageSlug"]: html.unescape(p["pageUrl"]) for p in manifest["pages"] if p["marca"] == "midea"}
    alvos = {g["grupoModelo"] for g in json.loads((PASTA / "alvos.json").read_text())["grupos"]}
    saida: dict[str, list[dict]] = {}
    for grupo, fontes in SITE.items():
        if grupo not in alvos:
            raise SystemExit(f"grupo fora da run: {grupo}")
        lista = []
        for pagina, numeros, aviso in fontes:
            for n in numeros:
                if pagina.startswith("pdf:"):
                    g = pagina[4:]
                    f = next((RAIZ / "product-scaffold/pdf-images/midea" / g).glob(f"{n}.*"))
                    e = {"ficheiro": str(f.relative_to(PASTA, walk_up=True)), "fonte": "pdf", "origemUrl": "pdf:midea-2026"}
                else:
                    f = next((CRAWL / "midea" / pagina).glob(f"{n}.*"))
                    e = {"ficheiro": str(f.relative_to(PASTA, walk_up=True)), "fonte": "site",
                         "origemUrl": url_da_pagina[pagina]}
                if aviso:
                    e["aviso"] = aviso
                lista.append(e)
        saida[grupo] = lista
    antigo = json.loads((PASTA / "candidatas.json").read_text()) if (PASTA / "candidatas.json").is_file() else {}
    for grupo, lista in antigo.items():  # mantém o procurar-ref.mjs (web) e as fotos do catálogo anterior (upload)
        if grupo not in saida:
            saida[grupo] = lista
        else:
            saida[grupo] += [e for e in lista if e["fonte"] in ("web", "upload") and e not in saida[grupo]]
    (PASTA / "candidatas.json").write_text(json.dumps(saida, ensure_ascii=False, indent=2) + "\n")
    print(f"candidatas.json: {len(saida)} grupos, {sum(len(v) for v in saida.values())} fotos")


if __name__ == "__main__":
    main()

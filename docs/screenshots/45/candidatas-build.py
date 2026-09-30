"""Nipon 2025 (#45): candidatas = packshots de niponcomfort.com (crawl) + fotos do catálogo atual por ref."""
import json, hashlib, collections
from pathlib import Path
B = Path("product-scaffold/imagens/nipon")
CR = "../../crawl-raw/nipon"
alvos = json.load(open(B / "alvos.json"))
grupos = {g["grupoModelo"]: g for g in alvos["grupos"]}
run = json.load(open("product-scaffold/pdf-extract/nipon/nipon-2025-staged.json"))
manifest = json.load(open("product-scaffold/crawl-raw/manifest.json"))
url_de = {}
for e in (manifest if isinstance(manifest, list) else manifest.get("imagens", manifest.get("images", []))):
    f = e.get("file") or e.get("ficheiro") or e.get("path")
    if f: url_de[Path(f).name if False else f] = e.get("pageUrl") or e.get("page") or e.get("origemUrl")
def pagina(slug):
    for f, u in url_de.items():
        if f"/nipon/{slug}/" in f and u: return u
    return f"https://www.niponcomfort.com/pt/produtos/{slug}"

SITE = {  # grupo → [(pasta, ficheiro, aviso)]
 "nipon-primis-duo": [("primis-duo-mono-split", "01.png", None)],
 "nipon-vita": [("vita-mono-split", "01.png", None)],
 "nipon-topsmart": [("topsmart-mono-split", "01.png", None)],
 "nipon-multi-split-unidade-exterior": [("unidades-exteriores-multi-split", "01.png", None)],
 "nipon-multi-split-ac-aqs-unidade-exterior": [("unidade-exterior-ac-aqs", "01.png", None)],
 "nipon-multi-split-ac-aqs-deposito": [("deposito-de-aqs", "01.png", None)],
 "nipon-vita-multi-split-unidade-interior": [("vita-multi-split", "01.png", None)],
 "nipon-primis-duo-multi-split-unidade-interior": [("primis-duo-mono-split", "01.png", "foto da página mono-split (a UI é a mesma; inclui a UE)")],
 "nipon-cassete-8-vias-multi-split-unidade-interior": [("cassete-multi-split", "01.png", None)],
 "nipon-cassete-1-via-multi-split-unidade-interior": [("cassete-1via-multi-split", "01.png", None)],
 "nipon-topsmart-multi-split-unidade-interior": [("topsmart-multi-split", "01.png", None)],
 "nipon-chao-teto-multi-split-unidade-interior": [("consola-multi-split", "01.png", None)],
 "nipon-conduta-baixa-pressao-multi-split-unidade-interior": [("conduta-multi-split", "01.png", "página conduta multi-split do site (não distingue baixa/alta pressão)")],
 "nipon-conduta-alta-pressao-multi-split-unidade-interior": [("conduta-multi-split", "01.png", "página conduta multi-split do site (não distingue baixa/alta pressão)")],
 "nipon-cassete-8-vias-xb": [("cassete-mono-split", "01.png", None)],
 "nipon-chao-teto-xc": [("consola-mono-split", "01.png", None), ("consola-mono-split", "02.png", None)],
 "nipon-conduta-xd": [("conduta-mono-split", "01.png", None), ("conduta-mono-split", "02.png", None)],
 "nipon-magnum": [("armario-mono-split-magnum", "01.png", None)],
 "nipon-evaslim-75": [("vmc-evaslim-75", "01.png", None)],
 "nipon-evabox-95": [("vmc-evabox-95", "01.png", None)],
 "nipon-innovus": [("bomba-de-calor-aqs-innovus", "01.png", None)],
 "nipon-flexus": [("bomba-de-calor-aqs-inox-flexus", f"0{i}.png", None) for i in range(1, 5)],
 "nipon-spirit-m": [("bomba-de-monobloco", "01.png", None)],
 "nipon-spirit-s": [("bomba-split", "01.png", "site mostra a UE preta; a tabela (p44) mostra-a branca")],
 "nipon-spirit-sa": [("bomba-split-sa", "01.png", "site mostra a UE preta; a tabela (p45) mostra-a branca")],
 "nipon-h-power": [("bomba-de-alta-eficiencia", "01.png", None)],
 "nipon-serenus": [("bomba-de-calor-para-piscina", "01.png", None), ("bomba-de-calor-para-piscina", "03.png", None)],
 "nipon-supra-reverse": [("ventiloconvetor-supra-reverse", f"0{i}.png", None) for i in (1, 2)] + [("ventiloconvetor-supra-reverse", "04.jpg", None)],
 "nipon-supra-slim": [("ventiloconvetor-supra-slim", f"0{i}.png", None) for i in (1, 2)],
 "nipon-milan": [("ventiloconvetor-mural", "01.png", None)],
 "nipon-hawaii": [("ventiloconvetor-cassete", "01.png", None)],
}
for v in ("v", "vf"):
    SITE[f"nipon-venice-{v}"] = [("ventiloconvetor-consola", "01.png", None)]
for v in ("vn", "hn"):
    SITE[f"nipon-venice-{v}"] = [("ventiloconvetor-conduta", "01.png", "página 'ventiloconvetor conduta' do site: versão sem móvel, confirmar")]

out = collections.defaultdict(list)
for g, fotos in SITE.items():
    assert g in grupos, g
    for pasta, f, aviso in fotos:
        e = {"ficheiro": f"{CR}/{pasta}/{f}", "fonte": "site", "origemUrl": pagina(pasta)}
        if aviso: e["aviso"] = aviso
        out[g].append(e)

# Fotos do catálogo atual: por ref; cor quando todas as refs que a usam têm a mesma cor.
indice = json.load(open(B / "catalogo" / "indice.json"))
por_hash = collections.defaultdict(lambda: {"refs": set()})
cor_de = {s["ref"]: next((a["valor"] for a in s["atributos"] if a["chave"] == "cor"), None) for s in run["skus"]}
grupo_de = {s["ref"]: s["grupoModelo"] for s in run["skus"]}
for ref, fs in indice.items():
    for x in fs:
        h = hashlib.sha256((B / x["f"]).read_bytes()).hexdigest()
        k = (grupo_de[ref], h)
        por_hash[k]["refs"].add(ref); por_hash[k]["f"] = x["f"]
for (g, h), d in por_hash.items():
    cores = {cor_de[r] for r in d["refs"]}
    e = {"ficheiro": d["f"], "fonte": "upload", "origemUrl": "catalogo:" + ",".join(sorted(d["refs"])),
         "aviso": "foto do catálogo anterior (origem não registada)"}
    if len(cores) == 1 and None not in cores and cores <= set(grupos[g].get("cores") or []):
        e["cor"] = cores.pop()
    out[g].append(e)
json.dump(dict(out), open(B / "candidatas.json", "w"), indent=1, ensure_ascii=False)
sem = [g for g in grupos if g not in out]
print(len(out), "grupos com candidatas;", sum(len(v) for v in out.values()), "entradas; sem:", len(sem))
print([g for g in sem if not grupos[g].get("acessorio")])

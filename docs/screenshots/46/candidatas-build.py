"""Mitsubishi 2026 (#46/#51): candidatas = packshots de mitsubishielectric.pt (crawl-mitsubishi-curl)
+ imagens grandes do PDF + fotos do catálogo atual por ref (já recortadas, origem não registada)."""
import json, hashlib, collections, re
from pathlib import Path

B = Path("product-scaffold/imagens/mitsubishi")
CR = "../../crawl-raw/mitsubishi"
PDF = "../../pdf-images/mitsubishi"
alvos = json.load(open(B / "alvos.json"))
grupos = {g["grupoModelo"]: g for g in alvos["grupos"]}
run = json.load(open("product-scaffold/pdf-extract/mitsubishi/mitsubishi-2026-staged.json"))
SITE_URL = "https://mitsubishielectric.pt/"

G = "UE genérica da gama (página multisplit do site)"
FC = "foto da página geral de ventiloconvectores do site (não identifica o modelo)"
HB = "hydrobox da página Ecodan by City Multi (mesma carcaça mural; confirmar o modelo)"
DUO = "Hydrobox Duo da página Ecodan by City Multi (mesma carcaça; confirmar o modelo)"


def s(pasta, f, aviso=None, cor=None):
    return (pasta, f, aviso, cor)


UI = {  # foto da UI, por gama (usada no conjunto e na UI avulsa)
    "msz-ln": [s("msz-ln", "08.png", cor="branco"), s("msz-ln", "06.png", cor="vermelho"), s("msz-ln", "07.png", cor="preto"),
               s("msz-ln", "02.png")],
    "msz-ef": [s("msz-ef", "07.png", cor="branco"), s("msz-ef", "06.png", cor="preto"), s("msz-ef", "08.png", cor="prateado"),
               s("msz-ef", "02.png")],
    "msz-ay": [s("msz-ay", "01.png"), s("msz-ay", "05.png"), s("gama-domestica-mural", "03.png")],
    "msz-ap": [s("msz-ap", "01.jpg"), s("msz-ap", "04.png")],
    "msz-hr": [s("msz-hr", "01.png"), s("msz-hr", "04.png")],
    "mfz-kt": [s("mfz-kt", "01.png"), s("gama-domestica-consola-chao", "01.png")],
    "sfz-m": [s("sfz-m", "04.jpg"), s("gama-domestica-consola-chao", "02.png")],
    "sez-m": [s("sez-m", "06.png"), s("gama-domestica-conduta", "01.png"), s("gama-comercial-conduta", "01.png")],
    "mlz-kp": [s("mlz-kp", "01.png"), s("mlz-kp", "07.png"), s("gama-domestica-cassete", "01.png")],
    "slz-m": [s("slz-m", "08.png"), s("slz-m", "02.png"), s("gama-comercial-cassete", "02.png")],
    "msy-tp": [s("msy-tp", "02.png")],
    "pla-m": [s("pla-m", "06.png"), s("gama-comercial-cassete", "03.png")],
    "pead-m": [s("pead-m", "01.png"), s("gama-comercial-conduta", "02.png")],
    "pka-m": [s("pka-m", "02.png"), s("gama-comercial-mural", "01.png")],
    "pca-m": [s("pca-m", "01.png"), s("pca-m", "10.png")],
    "pca-ha": [s("pca-ha", "01.png"), s("pca-ha", "07.png")],
    "psa-m": [s("psa-m", "06.png"), s("gama-comercial-chao-vertical", "01.png")],
}
UE_PUZ = [s("gama-domestica-multisplit", "04.png", G)]
SITE = {
    "mitsubishi-msz-ln": UI["msz-ln"], "mitsubishi-msz-ln-unidade-interior": UI["msz-ln"],
    "mitsubishi-msz-ef": UI["msz-ef"], "mitsubishi-msz-ef-unidade-interior": UI["msz-ef"],
    "mitsubishi-msz-ay": UI["msz-ay"], "mitsubishi-msz-ay-unidade-interior": UI["msz-ay"],
    "mitsubishi-msz-ap": UI["msz-ap"], "mitsubishi-msz-ap-unidade-interior": UI["msz-ap"],
    "mitsubishi-msz-hr": UI["msz-hr"], "mitsubishi-msz-hr-unidade-interior": UI["msz-hr"],
    "mitsubishi-mfz-kt": UI["mfz-kt"], "mitsubishi-mfz-kt-unidade-interior": UI["mfz-kt"],
    "mitsubishi-sfz-m": UI["sfz-m"], "mitsubishi-sfz-m-unidade-interior": UI["sfz-m"],
    "mitsubishi-sez-m": UI["sez-m"], "mitsubishi-sez-m-unidade-interior": UI["sez-m"],
    "mitsubishi-mlz-kp": UI["mlz-kp"], "mitsubishi-mlz-kp-unidade-interior": UI["mlz-kp"],
    "mitsubishi-slz-m": UI["slz-m"], "mitsubishi-slz-m-unidade-interior": UI["slz-m"],
    "mitsubishi-msy-tp": UI["msy-tp"],
    "mitsubishi-plsz-m": UI["pla-m"] + UE_PUZ, "mitsubishi-plz-zm": UI["pla-m"] + UE_PUZ,
    "mitsubishi-pla-m-unidade-interior": UI["pla-m"],
    "mitsubishi-pesz-m": UI["pead-m"] + [s("pea-m", "04.png", "PEA-M (só os conjuntos 200/250)")] + UE_PUZ,
    "mitsubishi-pez-zm": UI["pead-m"] + [s("pea-m", "04.png", "PEA-M (só os conjuntos 200/250)")] + UE_PUZ,
    "mitsubishi-pead-m-unidade-interior": UI["pead-m"],
    "mitsubishi-pksz-m": UI["pka-m"] + UE_PUZ, "mitsubishi-pkz-zm": UI["pka-m"] + UE_PUZ,
    "mitsubishi-pka-m-unidade-interior": UI["pka-m"],
    "mitsubishi-pcsz-m": UI["pca-m"] + UE_PUZ, "mitsubishi-pcz-zm": UI["pca-m"] + UE_PUZ,
    "mitsubishi-pca-m-unidade-interior": UI["pca-m"] + [s("pca-ha", "01.png", "PCA-M71HA (inox) apenas")],
    "mitsubishi-pciz-m": UI["pca-ha"] + UE_PUZ,
    "mitsubishi-pssz-m": UI["psa-m"] + UE_PUZ, "mitsubishi-psz-zm": UI["psa-m"] + UE_PUZ,
    "mitsubishi-psa-m-unidade-interior": UI["psa-m"],
    "mitsubishi-puz-zm-unidade-exterior": UE_PUZ, "mitsubishi-puz-m-unidade-exterior": UE_PUZ,
    "mitsubishi-mxz-unidade-exterior": [s("mxz-vf", "01.png"), s("mxz-vf", "06.png"),
                                         s("gama-domestica-multisplit", "01.png"), s("gama-domestica-multisplit", "03.png")],
    "mitsubishi-mxz-ha-unidade-exterior": [s("mxz-ha", "01.png"), s("mxz-ha", "04.png")],
    "mitsubishi-pxz-unidade-exterior": [s("pxz", "08.png"), s("pxz", "09.png"), s("pxz", "04.jpg"), s("pxz", "05.jpg")],
    "mitsubishi-pumy-sm-unidade-exterior": [s("pumy", "04.png", "três UE PUMY na mesma foto")],
    "mitsubishi-pumy-sp-unidade-exterior": [s("pumy", "04.png", "três UE PUMY na mesma foto")],
    "mitsubishi-pumy-p-unidade-exterior": [s("pumy", "04.png", "três UE PUMY na mesma foto")],
    "mitsubishi-ecodan-puz-wz-unidade-exterior": [s("ecodan-open-source", "01.png", "UE com o controlador FTC7 ao lado")],
    "mitsubishi-ecodan-hydrosplit-unidade-interior": [s("ecodan-hydrosplit", "09.jpg")],
    "mitsubishi-ecodan-hydrosplit-duo-unidade-interior": [s("ecodan-hydrosplit", "10.jpg"), s("ecodan-hydrosplit", "07.jpg")],
    "mitsubishi-ecodan-hydrobox-ersc-unidade-interior": [s("ecodan-by-city-multi", "08.jpg")],
    "mitsubishi-ecodan-hydrobox-duo-erst-c-unidade-interior": [s("ecodan-by-city-multi", "09.jpg")],
    "mitsubishi-ecodan-hydrobox-ersd-unidade-interior": [s("ecodan-by-city-multi", "08.jpg", HB)],
    "mitsubishi-ecodan-hydrobox-ersf-unidade-interior": [s("ecodan-by-city-multi", "08.jpg", HB)],
    "mitsubishi-ecodan-hydrobox-erse-unidade-interior": [s("ecodan-by-city-multi", "08.jpg", HB)],
    "mitsubishi-ecodan-hydrobox-duo-erst-d-unidade-interior": [s("ecodan-by-city-multi", "09.jpg", DUO)],
    "mitsubishi-ecodan-hydrobox-duo-erst-f-unidade-interior": [s("ecodan-by-city-multi", "09.jpg", DUO)],
    "mitsubishi-mehp-ib": [s("monobloco-mehp-ib", "05.jpg"), s("monobloco-mehp-ib", "06.jpg"), s("monobloco-mehp-ib", "07.jpg"),
                           s("monobloco-mehp-ib", "01.png")],
    "mitsubishi-ecodan-cahv": [s("ecodan-power", "09.jpg", "página Ecodan Power: confirmar qual das duas é a CAHV")],
    "mitsubishi-ecodan-qahv": [s("ecodan-power", "10.jpg", "página Ecodan Power: confirmar qual das duas é a QAHV")],
    "mitsubishi-vl-80eu5": [s("lossnay-domestica", "02.png")],
    "mitsubishi-vl": [s("lossnay-vl-vertical", "01.png")],
    "mitsubishi-lgh-rvx3": [s("serie-lossnay", "01.png"), s("recuperadores-entalpicos-lossnay", "02.png")],
    "mitsubishi-lgh-rvxt3": [s("recuperadores-entalpicos-lossnay", "02.png", "foto da série LGH (não da RVXT3 de 500 mm)")],
    "mitsubishi-lgh-rvs": [s("recuperadores-entalpicos-lossnay", "02.png", "foto da série LGH (não da RVS)")],
    "mitsubishi-gk": [s("cortinas-de-ar", "01.png")],
    "mitsubishi-jt-sb": [s("jet-towel-slim", "03.png", cor="branco"), s("jet-towel-slim", "04.png", cor="preto"),
                         s("jet-towel-slim", "05.png", cor="prateado"), s("jet-towel-slim", "01.png")],
    "mitsubishi-jt-s": [s("jet-towel-smart", "02.png", cor="branco"), s("jet-towel-smart", "03.png", cor="prateado"),
                        s("jet-towel-smart", "01.png")],
    # Ventiloconvectores: a página geral mostra as famílias sem nomear o modelo.
    **{g: [s("ventiloconvectores", f, FC) for f in fs] for g, fs in {
        "mitsubishi-i-life2-slim-dlmv": ["12.jpg", "13.jpg"], "mitsubishi-i-life2-slim-dlrv": ["12.jpg", "13.jpg"],
        "mitsubishi-i-life2-slim-dliu": ["09.jpg"],
        "mitsubishi-a-life3-dlmv": ["01.jpg", "06.jpg", "07.jpg"], "mitsubishi-i-life3-dlmv": ["01.jpg", "06.jpg", "07.jpg"],
        "mitsubishi-a-life3-dliv": ["08.jpg"], "mitsubishi-i-life3-dliv": ["08.jpg"],
        "mitsubishi-a-life3-dlio": ["14.jpg"], "mitsubishi-i-life3-dlio": ["14.jpg"],
        "mitsubishi-a-life2-hp-dlio": ["14.jpg"], "mitsubishi-i-life2-hp-dlio": ["14.jpg"],
        "mitsubishi-a-hwd": ["15.jpg"], "mitsubishi-i-hwd": ["15.jpg"],
        "mitsubishi-a-cxw": ["10.jpg", "16.jpg"], "mitsubishi-i-cxw": ["10.jpg", "16.jpg"],
        "mitsubishi-i-mxw": ["11.jpg", "17.jpg"]}.items()},
    # Comandos e interfaces com página própria.
    "mitsubishi-pac-yt52cra-comando": [s("pac-yt52cra", "01.png")],
    "mitsubishi-par-41maa-comando": [s("par-40maa", "01.png", "página do PAR-40MAA (modelo anterior, mesmo aspeto)")],
    "mitsubishi-par-ct01maa-comando": [s("par-ct01maa", "02.png", cor="branco"), s("par-ct01maa", "01.png", cor="preto")],
    "mitsubishi-par-sl97a-e-comando": [s("par-sl97a-e", "01.png")],
    "mitsubishi-par-fl32ma-comando": [s("par-fl-32ma", "01.png")],
    "mitsubishi-par-u02meda-comando": [s("par-u02meda", "01.png")],
    "mitsubishi-mac-334if-e-acessorio": [s("mac-334if", "01.png")],
    "mitsubishi-ae-c400e-comando": [s("ae-200e", "01.png", "página do AE-200E (modelo anterior)")],
    "mitsubishi-ew-c50e-comando": [s("ew-50e", "01.png", "página do EW-50E (modelo anterior)")],
    "mitsubishi-at-50b-comando": [s("at-50b", "01.png")],
    "mitsubishi-pac-sj95ma-e-acessorio": [s("pac-sj95sj-96ma", "01.png")],
    "mitsubishi-pac-yg60mca-comando": [s("pac-yg-60-63-66-mca", "01.png")],
    "mitsubishi-pac-yg63mca-comando": [s("pac-yg-60-63-66-mca", "01.png")],
    "mitsubishi-pac-yg66dca-comando": [s("pac-yg-60-63-66-mca", "01.png")],
    "mitsubishi-pac-if013b-e-acessorio": [s("interface-para-uta-dx", "01.png")],
}
PDF_GRANDES = {
    **{g: [("_grandes/p160-3892.png", "UTA com a UE (imagem da p160)"), ("_grandes/p162-3908.png", "UTA aberta (imagem da p160)")]
       for g in grupos if g.startswith("mitsubishi-s-airme-")},
    "mitsubishi-s-mext": [("_grandes/p181-4070.png", "imagem pequena da p181"), ("_grandes/p181-4068.png", "UE da p181")],
}

manifest = json.load(open("product-scaffold/crawl-raw/manifest.json"))
pagina_de = {}
for e in manifest["images"]:
    if e.get("marca") == "mitsubishi":
        pagina_de[Path(e["file"]).parent.name] = e.get("pageUrl") or e.get("page")

out = collections.defaultdict(list)
for g, fotos in SITE.items():
    assert g in grupos, g
    cores = set(grupos[g].get("cores") or [])
    for pasta, f, aviso, cor in fotos:
        cands = sorted((Path("product-scaffold/crawl-raw/mitsubishi") / pasta).glob(Path(f).stem + ".*"))
        assert cands, (pasta, f)
        f = cands[0].name                         # a extensão é a que o crawler gravou
        e = {"ficheiro": f"{CR}/{pasta}/{f}", "fonte": "site", "origemUrl": pagina_de.get(pasta) or SITE_URL + pasta}
        if aviso: e["aviso"] = aviso
        if cor and cor in cores: e["cor"] = cor
        out[g].append(e)
for g, fotos in PDF_GRANDES.items():
    for f, aviso in fotos:
        m = re.match(r"_grandes/p(\d+)-", f)
        out[g].append({"ficheiro": f"{PDF}/{f}", "fonte": "pdf", "origemUrl": f"pdf:{m.group(1)}", "aviso": aviso})
# miniaturas do pdf_images.py (UE Ecodan, PUMY, CAHV/QAHV)
for d in Path("product-scaffold/pdf-images/mitsubishi").iterdir():
    if d.is_dir() and d.name in grupos:
        for f in sorted(d.iterdir()):
            out[d.name].append({"ficheiro": f"{PDF}/{d.name}/{f.name}", "fonte": "pdf", "origemUrl": "pdf",
                                "aviso": "miniatura do PDF"})

# Catálogo atual: por ref (o conjunto antigo tinha a ref da UI).
indice = json.load(open(B / "catalogo" / "indice.json"))
cor_de = {s["ref"]: next((a["valor"] for a in s["atributos"] if a["chave"] == "cor"), None) for s in run["skus"]}
grupo_de = {s["ref"]: s["grupoModelo"] for s in run["skus"]}
conjunto_de_ui = collections.defaultdict(list)
for s_ in run["skus"]:
    if s_["componente"] == "conjunto" and "/" in s_["ref"]:
        conjunto_de_ui[s_["ref"].split("/")[0]].append(s_["ref"])
old = {o["ref"]: o for o in json.load(open(".context/mitsubishi/produtos-antigos.json"))}
por_hash = collections.defaultdict(lambda: {"refs": set()})
for ref, fs in indice.items():
    alvos_ref = []
    o = old.get(ref, {})
    if o.get("componente") == "conjunto" and ref in conjunto_de_ui:
        alvos_ref = conjunto_de_ui[ref]
    elif ref in grupo_de:
        alvos_ref = [ref]
    elif ref.endswith("-3F") and ref[:-3] in conjunto_de_ui:
        alvos_ref = conjunto_de_ui[ref[:-3]]
    for novo in alvos_ref:
        for x in fs:
            h = hashlib.sha256((B / x["f"]).read_bytes()).hexdigest()
            k = (grupo_de[novo], h)
            por_hash[k]["refs"].add(novo)
            por_hash[k]["f"] = x["f"]
for (g, h), d in por_hash.items():
    cores = {cor_de[r] for r in d["refs"]}
    e = {"ficheiro": d["f"], "fonte": "upload", "origemUrl": "catalogo:" + ",".join(sorted(d["refs"]))[:300],
         "aviso": "foto do catálogo anterior (origem não registada)"}
    if len(cores) == 1 and None not in cores and cores <= set(grupos[g].get("cores") or []):
        e["cor"] = cores.pop()
    out[g].append(e)

json.dump(out, open(B / "candidatas.json", "w"), indent=1, ensure_ascii=False)
eq = [g for g, v in grupos.items() if not v.get("acessorio")]
print(f"{len(out)} grupos com candidatas; equipamento sem nada: {[g for g in eq if g not in out]}")
print("acessórios com candidatas:", sum(1 for g in out if grupos[g].get("acessorio")), "de",
      sum(1 for v in grupos.values() if v.get("acessorio")))

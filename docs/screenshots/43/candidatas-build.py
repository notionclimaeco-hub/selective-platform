#!/usr/bin/env python3
"""Hand-picked packshots per group → product-scaffold/imagens/hisense/<grupo>/NN.ext + candidatas.json.

Sources: R = product-scaffold/crawl-raw/hisense/<pageSlug>/NN (hisense.pt via crawl.mjs,
hisensehvac.com via crawl-hisense-hvac-curl.mjs, Megaclima via crawl-megaclima-curl.mjs).
origemUrl comes from the crawl manifests. Re-runnable: wipes the group folders it writes.
"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "product-scaffold/crawl-raw/hisense"
OUT = ROOT / "product-scaffold/imagens/hisense"

# pageSlug → (fonte, pageUrl)
paginas = {}
for mf in ("manifest.json", "manifest-hisense-hvac.json", "manifest-hisense-es.json"):
    m = json.loads((ROOT / "product-scaffold/crawl-raw" / mf).read_text())
    for i in m["images"]:
        if i.get("marca") != "hisense":
            continue
        fonte = "megaclima" if i.get("source") == "megaclima" else "site"
        paginas[i["pageSlug"]] = (fonte, i["pageUrl"])
# Found by searching the ref (dealer listing / brand brochure hosted by a distributor).
paginas["web-centrifuga"] = ("web", "https://premios.aunadistribucion.com/uploads/productos/descargas/115003_brochure-i-seriesdraft.pdf")
paginas["web-hdhwt"] = ("web", "https://vissklimatam.lv/hisense-hvac-karsta-udens-boileris-200l/")


def P(slug, *nums, cor=None):
    """Files NN of a crawled page folder."""
    out = []
    for n in nums:
        cands = sorted((RAW / slug).glob(f"{n:02d}.*"))
        if not cands:
            raise SystemExit(f"missing {slug}/{n:02d}")
        out.append((cands[0], slug, cor))
    return out


# --- hisense.pt page folders
AIR_MASTER_PRETO = P("es-hisense-air-master-qk25wm0bg", 1, 2, 3, 4, cor="preto") + P("hvac-u8-air-master-series", 1, 4, 6, cor="preto")
AIR_MASTER_BRANCO = P("es-hisense-air-master-qk25wm0ag", 1, 2, 3, 4, cor="branco") + P("es-hisense-air-master-qk50fm0ag", 1, cor="branco") + P("hvac-u8-air-master-series", 8, 10, 13, cor="branco")
ENERGY_PRO_X_BRANCO = P("es-energy-pro-x-qh25xv0a", 1) + P("energy-pro-x-qh35xv4a-monosplit-35kw-smart-eye-wifi", 1, 2) + P("hvac-u7-energy-pro-x-series", 9, 10, 13)
ENERGY_PRO_X_PRETO = P("es-energy-pro-x-qh25xv0b", 1, cor="preto") + P("hvac-u7-energy-pro-x-series", 1, 2, 4, 7, cor="preto")
UNI_PURE_BRANCO = P("es-uni-pure-hb25xu0a", 1, cor="branco") + P("es-uni-pure-hb70kw0a", 1, cor="branco") + P("uni-pure-hb35xu0a-monosplit-35kw-wifi", 1, 2, 3, cor="branco") + P("hvac-u6-uni-series", 8, 10, cor="branco")
UNI_PURE_PRETO = P("es-uni-pure-hb25xu0b", 1, cor="preto") + P("hvac-u6-uni-series", 1, 3, 5, cor="preto")
MAX_COMFORT = P("es-max-comfort-hisense-hc25yc00", 1) + P("es-max-comfort-hisense-hc70fw00", 1) + P("max-comfort-hc25yc0ug-monosplit-25kw-wifi", 1, 2)
PERLA = P("es-brissa-ca25yr03", 1, 2, 3, 4) + P("es-brissa-ca70bt1a-2", 1, 2) + P("ar-condicionado-perla-ca25yr1a", 1, 2, 5, 6, 8, 9) + P("hisense-mural-perla", 1)
COMFORT = P("es-comfort-dj25ve0b", 1) + P("ar-condicionado-comfort-dj25ve0b", 1, 2, 3, 4, 7, 8, 9, 10) + P("hisense-mural-comfort-1", 1)
UE_RESID = P("ar-condicionado-comfort-dj25ve0b", 11) + P("cassete", 4) + P("hisense-exterior-2amw42u4rgc-3", 1)
MULTI_UE = P("es-multi-amw2-14u4rgc", 1, 2, 3) + P("es-multi-amw3-21u4rjc", 1, 2, 3) + P("es-multi-amw4-27u4rjc", 1, 2, 3) + P("es-multi-2x1-2amw52u4rxc", 1, 2) + \
    P("multisplit-2amw42u4rra", 1) + P("multisplit-2ma912tg1", 3) + P("multisplit-3amw62u4rfa", 1) + \
    P("multisplit-4amw105u4raa", 1) + P("multisplit-5amw125u4rta", 1) + P("cassete", 4, 5, 6, 30) + \
    P("hvac-freematch", 1, 2, 3) + P("hisense-exterior-2amw42u4rgc-3", 1)
UE_COMERCIAL_S = P("es-exterior-auw26u4rs8", 1, 2) + P("es-exterior-auw35u4rs8", 1) + P("es-exterior-auw52u4rj8", 1) + P("es-exterior-auw52u4rs7", 1, 2) + \
    P("es-exterior-auw71u4rk8", 1) + P("cassete", 4) + P("hisense-exterior-2amw42u4rgc-3", 1)          # AUW26–71 (ADT/ACT/AKT pairs)
UE_COMERCIAL_M = P("es-exterior-auw71u4rk8", 1) + P("es-exterior-auw71u4rj7", 1) + P("es-exterior-auw90u4rf4", 1) + P("es-auw105u6rn8", 1, 2) + P("cassete", 5, 6)   # AUW71–105
UE_COMERCIAL_L = P("es-auw105u6rn8", 1, 2) + P("es-exterior-auw125u6rn8", 1, 2) + P("es-exterior-auw140u6rn8", 1) + P("es-exterior-auw125u4rt5", 1, 2) + \
    P("es-exterior-auw175u6rp4", 1, 2) + P("cassete", 6)                                              # AUW105–175
CONDUTA_BAIXA = P("es-adt26ux4rsbl8", 1) + P("es-adt52ux4rjcl8", 1) + P("cassete", 9, 19) + P("hvac-ceiling-ducted-dc-low-height", 2, 3) + P("hisense-conduta-baixa", 1)
CONDUTA_MEDIA = P("es-aud71ux4rkfm8", 1, 2, 3) + P("es-conducto-aud-36ux4reh8", 1, 2) + P("cassete", 10, 19, 20) + P("hisense-conduta-media", 1)
CONDUTA_ALTA = P("es-conducto-aud-75ux4rph8", 1, 2) + P("es-conducto-aud105ux4radh5", 1) + P("cassete", 11, 21, 20) + P("hisense-conduta-alta-1", 1)
MINI_CASSETE = P("es-cassette-act-09ur4rcc8", 1) + P("es-cassette-act-24ur4rjc8", 1, 2, 3) + P("cassete", 7) + P("cassette-act35ur4rsca4", 1) + P("hvac-mini-4-way-cassette", 1, 2, 3) + P("hisense-cassete", 1)
CASSETE = P("es-cassette-auc-36ur4rkc8", 1, 2, 3) + P("es-cassette-auc125ur6rthb4", 1, 2, 3) + P("cassette-auc90ur4rfgb4", 1, 2, 3) + P("cassette-auc105ur4rgb4", 1, 2) + P("cassette-auc125ur4rhb4", 1, 2) + \
    P("cassete", 8, 17, 18) + P("hvac-4-way-cassette", 1, 2, 3) + P("hisense-cassete-comercial", 1)
CHAO_TETO = P("es-auv-36ur4rc8", 1, 2) + P("es-avt-24ur4rb8", 1, 2) + P("es-suelo-techo-auv71ur4rfa4", 1, 2, 3) + P("chao-teto-auv105ur4rab4", 1, 2) + P("chao-teto-auv105ur4rb4", 1) + P("chao-teto-auv125ur4rc4", 1) + \
    P("chao-teto-auv140ur6rpc4", 1) + P("cassete", 12, 15, 23) + P("hvac-ceiling-suspended", 1, 3, 5) + P("hisense-consola-chao-tecto", 1)
CONSOLA = P("es-consola-akt-09ur4rk8", 1) + P("consola-akt26ur4rk4", 1, 2, 3, 4) + P("multi-consola-akt26ur4rk4", 1, 2, 3) + P("cassete", 22) + P("hisense-consola-chao", 1)
COLUNA = P("es-columna-de-aire-auf140ur6rtmpa", 1) + P("cassete", 25) + P("hvac-floor-standing", 1, 2, 3, 4, 5) + P("hisense-armario", 1)
PORTATIL = P("es-portatil-apc09qc", 1, 2, 3, 4) + P("es-portatil-aph12qc", 1, 2, 3, 4) + P("portatil-apc09", 1, 2, 3, 4) + P("portatil-apc12", 1) + P("portatil-aph09", 1, 2, 3)

HT_UE = P("hvac-hi-therma-split", 2, 3)
HT_SPLIT_UI = P("hvac-hi-therma-split", 4)
HT_INTEGRA_UI = P("hvac-hi-therma-integra", 1, 2, 3, 4)
HT_MONO = P("hvac-hi-therma-monobloc", 1, 2, 3, 4)
HT2_M = P("hvac-hi-therma-ii-mono-solution", 1, 2)
HT2_HYDRO = P("hvac-hi-therma-ii-hydro-solution", 1, 2)
CHILLER = P("hvac-air-cooled-scroll-chiller-heat-pump-hi-mod-v-series", 1, 2) + P("hvac-dc-air-cooled-scroll-chiller-heat-pump-hi-mod-ve1-series", 1, 2, 3)
HRV = P("hvac-heat-recovery-ventilator", 1, 2)

grupos = {
    "hisense-air-master": AIR_MASTER_PRETO + AIR_MASTER_BRANCO + UE_RESID,
    "hisense-air-master-unidade-interior": AIR_MASTER_PRETO + AIR_MASTER_BRANCO,
    "hisense-air-master-unidade-exterior": UE_RESID,
    "hisense-energy-pro-x": ENERGY_PRO_X_BRANCO + UE_RESID,
    "hisense-energy-pro-x-unidade-interior": ENERGY_PRO_X_BRANCO,
    "hisense-energy-pro-x-unidade-exterior": UE_RESID,
    "hisense-uni-pure": UNI_PURE_BRANCO + UNI_PURE_PRETO + UE_RESID,
    "hisense-uni-pure-unidade-interior": UNI_PURE_BRANCO + UNI_PURE_PRETO,
    "hisense-uni-pure-unidade-exterior": [(f, s, "branco") for f, s, _ in UE_RESID],
    "hisense-max-comfort": MAX_COMFORT + UE_RESID,
    "hisense-max-comfort-unidade-interior": MAX_COMFORT,
    "hisense-max-comfort-unidade-exterior": UE_RESID,
    "hisense-perla": PERLA + UE_RESID,
    "hisense-perla-unidade-interior": PERLA,
    "hisense-perla-unidade-exterior": UE_RESID,
    "hisense-portatil": PORTATIL,
    "hisense-multi-inverter-unidade-exterior": MULTI_UE,
    "hisense-multi-inverter-conduta-unidade-interior": CONDUTA_BAIXA + P("cassete", 10),
    "hisense-multi-inverter-cassete": MINI_CASSETE,
    "hisense-multi-inverter-cassete-unidade-interior": MINI_CASSETE,
    "hisense-multi-inverter-chao-teto-unidade-interior": CHAO_TETO,
    "hisense-multi-inverter-consola-unidade-interior": CONSOLA,
    "hisense-multi-inverter-energy-pro-x-unidade-interior": ENERGY_PRO_X_PRETO,
    "hisense-multi-inverter-uni-pure-unidade-interior": UNI_PURE_PRETO,
    "hisense-multi-inverter-premium-comfort-unidade-interior": COMFORT,
    "hisense-conduta-1x1-baixa-pressao-turbo-inverter": CONDUTA_BAIXA + UE_COMERCIAL_S,
    "hisense-conduta-1x1-baixa-pressao-turbo-inverter-unidade-exterior": UE_COMERCIAL_S,
    "hisense-conduta-1x1-baixa-pressao-super-inverter": CONDUTA_BAIXA + UE_COMERCIAL_S,
    "hisense-conduta-1x1-baixa-pressao-super-inverter-unidade-exterior": UE_COMERCIAL_S,
    "hisense-conduta-1x1-media-pressao-turbo-inverter": CONDUTA_MEDIA + UE_COMERCIAL_M,
    "hisense-conduta-1x1-media-pressao-turbo-inverter-unidade-interior": CONDUTA_MEDIA,
    "hisense-conduta-1x1-media-pressao-turbo-inverter-unidade-exterior": UE_COMERCIAL_M,
    "hisense-conduta-1x1-media-pressao-super-inverter": CONDUTA_MEDIA + UE_COMERCIAL_M,
    "hisense-conduta-1x1-alta-pressao-turbo-inverter": CONDUTA_ALTA + UE_COMERCIAL_L,
    "hisense-conduta-1x1-alta-pressao-turbo-inverter-unidade-interior": CONDUTA_ALTA,
    "hisense-conduta-1x1-alta-pressao-turbo-inverter-unidade-exterior": UE_COMERCIAL_L,
    "hisense-mini-cassete-1x1-turbo-inverter": MINI_CASSETE + UE_COMERCIAL_S,
    "hisense-mini-cassete-1x1-turbo-inverter-unidade-interior": MINI_CASSETE,
    "hisense-mini-cassete-1x1-super-inverter": MINI_CASSETE + UE_COMERCIAL_S,
    "hisense-cassete-1x1-turbo-inverter": CASSETE + UE_COMERCIAL_L,
    "hisense-cassete-1x1-turbo-inverter-unidade-interior": CASSETE,
    "hisense-cassete-1x1-super-inverter": CASSETE + UE_COMERCIAL_L,
    "hisense-cassete-1x1-super-inverter-unidade-exterior": UE_COMERCIAL_L,
    "hisense-chao-teto-1x1-turbo-inverter": CHAO_TETO + UE_COMERCIAL_M,
    "hisense-chao-teto-1x1-turbo-inverter-unidade-interior": CHAO_TETO,
    "hisense-chao-teto-1x1-super-inverter": CHAO_TETO + UE_COMERCIAL_M,
    "hisense-consola-1x1-turbo-inverter": CONSOLA + UE_COMERCIAL_S,
    "hisense-consola-1x1-super-inverter": CONSOLA + UE_COMERCIAL_S,
    "hisense-coluna-1x1": COLUNA + UE_COMERCIAL_L,
    "hisense-coluna-1x1-unidade-interior": COLUNA,
    "hisense-coluna-1x1-unidade-exterior": UE_COMERCIAL_L,
    # VRF outdoor
    "hisense-mini-vrf-r32-h5-unidade-exterior": P("hvac-hi-smart-h5-series", 1, 2, 3, 4, 5, 6),
    "hisense-mini-vrf-serie-l-c-unidade-exterior": P("hvac-hi-smart-l-series", 1, 2) + P("hvac-hi-smart-c-series", 1, 2),
    "hisense-mini-vrf-hi-smart-a-unidade-exterior": P("hvac-hi-smart-a-series", 1, 2, 3, 4),
    "hisense-vrf-multifuncoes-ii-r32-unidade-exterior": P("es-multifuncion-afw-34fjdh1", 1, 5, 6, 7) + P("hvac-multi-function-ii-series", 1, 2, 3, 4),
    "hisense-vrf-serie-s-unidade-exterior": P("hvac-hi-flexi-s-series", 1, 2, 3, 4, 5),
    "hisense-vrf-s-especial-anticorrosao-unidade-exterior": P("hvac-hi-flexi-s-series", 1, 2, 3, 4, 5),
    "hisense-vrf-s5-bomba-de-calor-unidade-exterior": P("hvac-hi-flexi-s5-series", 1, 3, 4, 5, 6, 7),
    "hisense-vrf-serie-w-unidade-exterior": P("hvac-hi-flexi-w5-series", 1, 2, 3),
    # VRF indoor
    "hisense-vrf-conduta-de-baixa-pressao-unidade-interior": P("hvac-ceiling-ducted-dc-low-height", 2, 3) + P("hvac-ceiling-ducted-dc-low-height-r410a", 1, 2, 3, 4),
    "hisense-vrf-conduta-de-media-alta-pressao-unidade-interior": P("hvac-ceiling-ducted-dc-high-static-pressure", 2) + P("hvac-ceiling-ducted-high-low-static-pressure", 2),
    "hisense-vrf-cassete-de-4-vias-unidade-interior": P("hvac-4-way-cassette", 1, 2, 3),
    "hisense-vrf-mini-cassete-de-4-vias-unidade-interior": P("hvac-mini-4-way-cassette", 1, 2, 3),
    "hisense-vrf-cassete-de-1-via-unidade-interior": P("hvac-1-way-cassette", 1, 2, 3, 4),
    "hisense-vrf-cassete-de-2-vias-unidade-interior": P("hvac-2-way-cassette", 1, 2),
    "hisense-vrf-mural-unidade-interior": P("hvac-wall-mounted", 1, 2),
    "hisense-vrf-consola-unidade-interior": P("hvac-console", 3, 4, 5, 6),
    "hisense-vrf-chao-teto-unidade-interior": P("hvac-ceiling-and-floor", 2) + P("hvac-ceiling-suspended", 1, 3),
    "hisense-vrf-chao-sem-envolvente-unidade-interior": P("hvac-floor-concealed", 1, 2),
    "hisense-vrf-coluna-unidade-interior": P("hvac-floor-standing", 1, 2, 3, 4, 5),
    "hisense-vrf-hydrobox-para-serie-s-unidade-interior": P("hvac-multi-function-ii-series", 5),
    "hisense-vrf-hydrobox-para-serie-multifuncoes-unidade-interior": P("es-multifuncion-afm-160hjdh", 1, 5) + P("es-multifuncion-afs-160hjdh-23", 1, 5) + P("hvac-multi-function-ii-series", 5),
    "hisense-vrf-100-ar-novo-unidade-interior": P("hvac-all-fresh-air", 1, 2, 3),
    # Aerotermia / chillers / ventilação
    "hisense-hi-therma-r32-split-unidade-exterior": HT_UE,
    "hisense-hi-therma-r32-split-unidade-interior": HT_SPLIT_UI,
    "hisense-hi-therma-r32-integra-unidade-exterior": HT_UE,
    "hisense-hi-therma-r32-integra-unidade-interior": HT_INTEGRA_UI,
    "hisense-hi-therma-r32-monobloco": HT_MONO,
    "hisense-hi-therma-ii-m": HT2_M,
    "hisense-hi-therma-ii-hydro-unidade-exterior": HT2_HYDRO + HT2_M,
    "hisense-hi-therma-ii-hydro-unidade-interior": HT2_HYDRO,
    "hisense-chiller": CHILLER,
    "hisense-hi-water": P("es-hisense-heat-pump-ah-80nh4geb00", 1, 14, 15) + P("es-hisense-heat-pump-ah-200u4gab00", 1, 14, 15, 16),
    "hisense-hdhwt-deposito": P("web-hdhwt", 1),
    "hisense-hi-smart-i-vrf-centrifugo-unidade-exterior": P("web-centrifuga", 1, 2),
    "hisense-fluxos-cruzados": HRV,
    "hisense-fluxos-cruzados-com-bateria-dx": HRV,
}

manifest = {}
for grupo, itens in grupos.items():
    d = OUT / grupo
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True)
    lista = []
    for n, (src, slug, cor) in enumerate(itens, 1):
        dst = d / f"{n:02d}{src.suffix.lower()}"
        shutil.copy2(src, dst)
        fonte, url = paginas[slug]
        e = {"ficheiro": f"{grupo}/{dst.name}", "fonte": fonte, "origemUrl": url}
        if cor:
            e["cor"] = cor
        lista.append(e)
    manifest[grupo] = lista

# Last resort: the thumbnail the price table prints next to the rows (p32, white twin-fan unit).
manifest["hisense-vrf-multifuncoes-unidade-exterior"] = [
    {"ficheiro": "../../pdf-images/hisense/hisense-vrf-multifuncoes-unidade-exterior/02.png", "fonte": "pdf", "origemUrl": "pdf:32"}]

existing = OUT / "candidatas.json"
if existing.exists():   # keep entries of groups handled elsewhere (pdf/web fallbacks)
    old = json.loads(existing.read_text())
    for g, lista in old.items():
        if g not in manifest:
            manifest[g] = lista
existing.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(len(grupos), "grupos,", sum(len(v) for v in grupos.values()), "candidatas →", existing)

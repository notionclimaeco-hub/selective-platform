// Heuristic match of crawl-raw images to catalog targets + review.html.
//
// Usage:
//   node scripts/imagens/match.mjs
//
// Reads product-scaffold/targets.json + product-scaffold/crawl-raw/manifest.json
// Writes product-scaffold/mapping.json + product-scaffold/review.html
//
// Manual overrides in product-scaffold/manual/<slug>/ take priority at process time;
// this script only proposes crawled matches. Edit mapping.json afterwards
// (or re-run after adjusting heuristics) before processing.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const TARGETS = path.join(ROOT, "product-scaffold/targets.json")
const MANIFEST = path.join(ROOT, "product-scaffold/crawl-raw/manifest.json")
const MANUAL = path.join(ROOT, "product-scaffold/manual")
const PDF_IMAGES = path.join(ROOT, "product-scaffold/pdf-images")
const MAPPING_OUT = path.join(ROOT, "product-scaffold/mapping.json")
const REVIEW_OUT = path.join(ROOT, "product-scaffold/review.html")

function norm(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function tokens(s) {
  return norm(s)
    .split(/\s+/)
    .filter((t) => t.length >= 3)
}

/**
 * Whether this catalog target wants an indoor or outdoor packshot.
 * `conjunto` stays neutral (indoor cover is fine). Accessories that merely
 * mention "exterior" in the name stay neutral so they don't steal UE photos.
 */
function targetUnitSide(target) {
  const familia = String(target.familia || "").toLowerCase()
  if (familia === "acessorios-e-controlo") return "neutral"

  const comp = String(target.componente || "").toLowerCase()
  if (comp === "unidade-exterior") return "exterior"
  if (comp === "unidade-interior") return "interior"
  if (comp === "conjunto") return "neutral"

  const blob = `${target.slug} ${target.nome}`.toLowerCase()
  // Slug/nome heuristics for brands that split UI/UE into separate groups.
  if (
    /(^|-)ue$|unidade exterior|unidad exterior|\bmulti[- ]?exterior\b|exteriores multi/.test(
      blob,
    )
  ) {
    return "exterior"
  }
  if (/(^|-)ui$|unidade interior|unidad interior/.test(blob)) {
    return "interior"
  }
  return "neutral"
}

/**
 * Classify a crawled image as indoor / outdoor / unknown from filename, alt,
 * page slug. Brand sites often put both unit types on one product page —
 * outdoor files usually say "exterior" / "unidad-exterior" / AUW|AMW codes.
 */
function imageUnitSide(image) {
  const srcName = path.basename(image.src || "", path.extname(image.src || ""))
  const fileName = path.basename(image.file || "", path.extname(image.file || ""))
  const blob = `${image.pageSlug || ""} ${image.alt || ""} ${srcName} ${fileName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (
    /unidad[_\s-]*exterior|unidade[_\s-]*exterior|unidades[_\s-]*exteriores|\boutdoor\b|_exterior_|\bexterior\b/.test(
      blob,
    )
  ) {
    return "exterior"
  }
  // Multi outdoor chassis pages / Megaclima exterior packshots / AUW outdoor codes.
  // Mitsubishi PT multi UE pages (pxz, pumy, mxz-*) rarely say "exterior" in
  // filenames — the page itself is the outdoor unit.
  if (
    /multisplit-|hisense-exterior|\/exterior|_exterior\b|\bauw\d|\bamw\d|(^|[\s/])(pxz|pumy|mxz-ha|mxz-vf)([\s-]|$)|mitsubishi-exterior-multi/.test(
      blob,
    )
  ) {
    return "exterior"
  }
  // Nipon heat-pump outdoor units: dedicated pages rarely say "exterior" in
  // the filename (Spirit S/SA, H-Power, monobloco chassis).
  if (
    /bomba-split|bomba-de-monobloco|bomba-de-alta|spirit[_-\s]|h-power|h_power/.test(
      blob,
    ) &&
    !/interior|deposito|aqs|piscina|vmc|ventiloconvet/.test(blob)
  ) {
    return "exterior"
  }
  if (
    /unidad[_\s-]*interior|unidade[_\s-]*interior|\bindoor\b|_mural_|mural_/.test(
      blob,
    )
  ) {
    return "interior"
  }
  // Common indoor chassis prefixes (Hisense / commercial).
  if (/\baud\d|\bauc\d|\bact\d|\bakt\d|\bauf\d|\bavd\d/.test(blob)) {
    return "interior"
  }
  return "unknown"
}

function sideAdjust(targetSide, imageSide) {
  if (targetSide === "neutral") {
    // Prefer indoor covers for kits; soft-penalize pure outdoor shots.
    if (imageSide === "exterior") return -15
    if (imageSide === "interior") return 10
    return 0
  }
  if (targetSide === "exterior") {
    if (imageSide === "exterior") return 55
    if (imageSide === "interior") return -90
    return -25 // unknown on indoor-heavy galleries
  }
  // interior
  if (imageSide === "interior") return 20
  if (imageSide === "exterior") return -55
  return 0
}

/** Best image score on a page for this target (unit-side aware). */
function pageScore(target, imgs) {
  const targetSide = targetUnitSide(target)
  let best = -1
  for (const img of imgs) {
    const base = score(target, img)
    if (base < 0) continue
    // Side bonuses must not create matches from zero — require a real
    // alias/token/ref hit first (otherwise Hi-Therma steals Comfort outdoor).
    if (base < 20) continue
    const sc = base + sideAdjust(targetSide, imageUnitSide(img))
    if (sc > best) best = sc
  }
  return best
}

/**
 * Pick files from the matched page. For UE targets, keep only outdoor-classified
 * images when any exist — never fall back to indoor packshots on that page.
 */
function selectFiles(imgs, targetSide) {
  const sorted = imgs.slice().sort((a, b) => a.file.localeCompare(b.file))
  if (targetSide === "exterior") {
    const outdoor = sorted.filter((i) => imageUnitSide(i) === "exterior")
    return (outdoor.length ? outdoor : []).map((i) => i.file)
  }
  if (targetSide === "interior") {
    const indoor = sorted.filter((i) => imageUnitSide(i) !== "exterior")
    return (indoor.length ? indoor : sorted).map((i) => i.file)
  }
  // Conjunto / neutral: drop outdoor-only extras when indoor shots exist.
  const indoor = sorted.filter((i) => imageUnitSide(i) !== "exterior")
  return (indoor.length ? indoor : sorted).map((i) => i.file)
}

/** Colour suffixes Daikin / Mitsubishi use on per-colour product pages. */
const COLOR_PAGE_SUFFIX = /-(a[wsb]|c[wsb]|b[wsb])\d*$/i

/**
 * Sibling colour pages of a crawl pageSlug (ftxj-ab → ftxj-aw/as/ab).
 * Returns [pageSlug] unchanged when it isn't a colour page.
 */
function colorSiblingSlugs(pageSlug, byPage, marca) {
  if (!COLOR_PAGE_SUFFIX.test(pageSlug)) return [pageSlug]
  const prefix = pageSlug.replace(COLOR_PAGE_SUFFIX, "")
  const out = []
  for (const key of byPage.keys()) {
    if (!key.startsWith(`${marca}::`)) continue
    const slug = key.slice(marca.length + 2)
    if (slug === pageSlug || (slug.startsWith(`${prefix}-`) && COLOR_PAGE_SUFFIX.test(slug))) {
      out.push(slug)
    }
  }
  return out.length ? out.sort() : [pageSlug]
}

/**
 * Drop packshots that clearly belong to another series when the matched page
 * is a brand landing page mixing several products (Emura HTML also ships Stylish).
 */
function isForeignSeries(img, target) {
  const head = seriesHead(target.slug, true)[0]
  if (!head) return false
  const foreign = {
    ftxj: /\bftxa\b/i,
    ftxa: /\b(?:ftxj|ftxm)\b/i,
    ctxa: /\b(?:ftxj|ftxm)\b/i,
  }
  const re = foreign[head]
  if (!re) return false
  const blob = `${img.file || ""} ${img.src || ""} ${img.alt || ""}`
  return re.test(blob)
}

/**
 * Collect files for a target: prefer every declared alias page (so multi-colour
 * series keep all colours), else the best page plus its colour siblings.
 */
function collectFiles(target, byPage, bestKey, unitSide) {
  const marca = target.marca
  const aliases = ALIASES[target.slug] ?? []
  const pageSlugs = []
  if (aliases.length) {
    for (const a of aliases) {
      if (byPage.has(`${marca}::${a}`)) pageSlugs.push(a)
    }
  }
  if (pageSlugs.length === 0 && bestKey) {
    const bestSlug = bestKey.split("::")[1]
    pageSlugs.push(...colorSiblingSlugs(bestSlug, byPage, marca))
  }
  const seen = new Set()
  const files = []
  for (const slug of pageSlugs) {
    const imgs = (byPage.get(`${marca}::${slug}`) || []).filter(
      (img) => !isForeignSeries(img, target),
    )
    for (const f of selectFiles(imgs, unitSide)) {
      if (seen.has(f)) continue
      seen.add(f)
      files.push(f)
    }
  }
  return files
}

// Explicit slug → crawl pageSlug aliases (Nipon site naming ≠ catalog slugs).
const ALIASES = {
  // Mitsubishi Electric — series pages + commercial proxies for Mr.Slim ZM/SZ.
  // Official PT + Megaclima secondary (mitsubishi-* pageSlugs).
  "mitsubishi-msz-ap": [
    "msz-ap",
    "gama-domestica-mural",
    "mitsubishi-mural-ap-msz-ap-1a",
    "mitsubishi-mural-msz-ap",
  ],
  "mitsubishi-msz-ap-ui": [
    "msz-ap",
    "mitsubishi-mural-ap-msz-ap-1a",
  ],
  "mitsubishi-msz-ay": ["msz-ay", "mitsubishi-mural-msz-ay-1a-1"],
  "mitsubishi-msz-ay-ui": ["msz-ay", "mitsubishi-mural-msz-ay-1a-1"],
  "mitsubishi-msz-ef": [
    "msz-ef",
    "mitsubishi-mural-kirigamine-msz-ef-zen-branco-1a",
    "mitsubishi-mural-kirigamine-msz-ef-zen-silver-1a",
    "mitsubishi-mural-kirigamine-msz-ef-zen-black-1a",
  ],
  "mitsubishi-msz-ef-ui": [
    "msz-ef",
    "mitsubishi-mural-kirigamine-msz-ef-zen-branco-1a",
  ],
  "mitsubishi-msz-hr": ["msz-hr", "mitsubishi-mural-hr-1a"],
  "mitsubishi-msz-ln": [
    "msz-ln",
    "mitsubishi-mural-kirigamine-msz-ln-style-branco-1a",
    "mitsubishi-mural-kirigamine-msz-ln-style-perola-1a",
    "mitsubishi-mural-kirigamine-msz-ln-style-ruby-1a",
    "mitsubishi-mural-kirigamine-msz-ln-style-black-1a",
  ],
  "mitsubishi-mfz-kt": ["mfz-kt", "mitsubishi-consola-chao-mfz-kt-1"],
  "mitsubishi-mlz-kp": ["mlz-kp", "mitsubishi-cassete-1-via-mlz-kp-1a"],
  "mitsubishi-mlz-kp-ui": ["mlz-kp", "mitsubishi-cassete-1-via-mlz-kp-1a"],
  "mitsubishi-m": ["mlz-kp", "mitsubishi-cassete-1-via-mlz-kp-1a", "msy-tp"],
  "mitsubishi-sez-m": ["sez-m", "mitsubishi-conduta-baixa-pressao-sez-mda-1"],
  "mitsubishi-sez-m-ui": ["sez-m", "mitsubishi-conduta-baixa-pressao-sez-mda-1"],
  "mitsubishi-sfz-m": ["sfz-m", "mitsubishi-conduta-sfz-mva-1"],
  "mitsubishi-s": ["sfz-m", "mfz-kt", "mitsubishi-conduta-sfz-mva-1"],
  "mitsubishi-mxz": [
    "mxz-ha",
    "mxz-vf",
    "mitsubishi-exterior-multi-mxz-2f33-2f53-3a",
    "mitsubishi-exterior-multi-mxz-2ha40-3h50vf-3a",
  ],
  "mitsubishi-pumy-sp112-140vkm-ykm": ["pumy"],
  "mitsubishi-pumy-s-m112-200vkm-ykm": ["pumy"],
  "mitsubishi-pxz-4x1-5x1": ["pxz"],
  "mitsubishi-pead-m": ["pead-m", "mitsubishi-conduta-baixo-perfil-pead-m-1-1"],
  "mitsubishi-pead-m-ui": [
    "pead-m",
    "mitsubishi-conduta-baixo-perfil-pead-m-1-1",
    "mitsubishi-conduta-baixo-perfil-pead-m50ja-1-3",
  ],
  "mitsubishi-pla-m": ["pla-m", "mitsubishi-cassete-4vias-mr-slim-pla-m-1"],
  "mitsubishi-pla-m-ui": ["pla-m", "mitsubishi-cassete-4vias-mr-slim-pla-m-1"],
  "mitsubishi-pca-m": ["pca-m", "pca-ha", "mitsubishi-horizontal-teto-pca-mka-1"],
  "mitsubishi-pca-m-ui": ["pca-m", "mitsubishi-horizontal-teto-pca-mka-1"],
  "mitsubishi-slz-m": ["slz-m", "mitsubishi-cassete-slz-1a"],
  // Mr.Slim ZM/SZ have no dedicated pages → commercial equivalents
  "mitsubishi-pez-zm": ["pea-m", "pead-m", "mitsubishi-conduta-alto-perfil-pea-rp-1"],
  "mitsubishi-pesz-m": ["pea-m", "pead-m", "mitsubishi-conduta-baixo-perfil-pead-m-1-1"],
  "mitsubishi-plz-zm": ["pla-m", "mitsubishi-cassete-4vias-mr-slim-pla-m-1"],
  "mitsubishi-plsz-m": ["pla-m", "mitsubishi-cassete-4vias-mr-slim-pla-m-1"],
  "mitsubishi-pcz-zm": ["pca-m", "mitsubishi-horizontal-teto-pca-mka-1"],
  "mitsubishi-pcsz-m": ["pca-m", "mitsubishi-horizontal-teto-pca-mka-1"],
  "mitsubishi-psz-zm": ["psa-m", "mitsubishi-armario-psz-mka-1"],
  "mitsubishi-pssz-m": ["psa-m", "mitsubishi-armario-psz-mka-1"],
  "mitsubishi-pkz-zm": [
    "pka-m",
    "mitsubishi-mural-comercial-pka-mk-al-1",
    "msy-tp",
  ],
  "mitsubishi-pksz-m": [
    "pka-m",
    "mitsubishi-mural-comercial-pka-mk-al-1",
    "msy-tp",
  ],
  "mitsubishi-pciz-m": ["pca-m", "mitsubishi-consola-teto-inox-pca-rp-1"],
  // Ecodan / heat pumps
  "mitsubishi-mehp-ib": ["monobloco-mehp-ib"],
  "mitsubishi-puz-swm": ["ecodan-split", "ecodan-hydrosplit"],
  "mitsubishi-puz-wz": ["ecodan-split", "ecodan-power"],
  "mitsubishi-suz-swm": ["ecodan-hydrosplit", "ecodan-split"],
  "mitsubishi-erst": ["ecodan-hydrosplit", "ecodan-split"],
  "mitsubishi-erpt": ["ecodan-open-source", "ecodan-split"],
  "mitsubishi-erpx-vm": ["ecodan-hydrosplit", "ecodan-split"],
  "mitsubishi-ersd-vm": ["ecodan-hydrosplit", "ecodan-split"],
  "mitsubishi-erse-ym": ["ecodan-hydrosplit", "ecodan-split"],
  "mitsubishi-ersf-vm": ["ecodan-hydrosplit", "ecodan-split"],
  "mitsubishi-eac-mt": ["ecodan-power", "ecodan-split"],
  // Lossnay
  "mitsubishi-lgh": ["serie-lossnay", "lossnay-domestica"],
  "mitsubishi-pz": ["serie-lossnay"],
  "mitsubishi-pz-rf": ["serie-lossnay"],
  "mitsubishi-pz-rfm": ["serie-lossnay"],
  "mitsubishi-pz-rfp": ["serie-lossnay"],
  "mitsubishi-pz-rfh": ["serie-lossnay"],
  "mitsubishi-pz-acessorios": ["serie-lossnay"],
  "mitsubishi-pz-s": ["serie-lossnay"],
  "mitsubishi-p": ["serie-lossnay"],
  "mitsubishi-p-f": ["serie-lossnay"],
  "mitsubishi-p-sf": ["serie-lossnay"],
  "mitsubishi-p-mf": ["serie-lossnay"],
  "mitsubishi-p-pf": ["serie-lossnay"],
  "mitsubishi-p-pfh": ["serie-lossnay"],
  "mitsubishi-p-nf": ["serie-lossnay"],
  "mitsubishi-p-sb": ["serie-lossnay"],
  "mitsubishi-p-acessorios": ["serie-lossnay"],
  "mitsubishi-vl": ["lossnay-vl-vertical", "lossnay-domestica"],
  // Chillers: série-e page has almost no product photos on the PT site.
  "mitsubishi-mech-is": ["chiller-serie-e"],
  "mitsubishi-mehp-is": ["chiller-serie-e"],
  "mitsubishi-jt-sb": ["jet-towel-slim"],
  "mitsubishi-jt-s": ["jet-towel-smart"],
  "mitsubishi-a-life": ["ventiloconvectores"],
  "mitsubishi-a-life3-dlmv": ["ventiloconvectores"],
  "mitsubishi-a-life3-dlio": ["ventiloconvectores"],
  "mitsubishi-a-life3-dliv": ["ventiloconvectores"],
  "mitsubishi-a-life2-hp-dlio": ["ventiloconvectores"],
  "mitsubishi-i-life": ["ventiloconvectores"],
  "mitsubishi-i-life2-slim-dlmv": ["ventiloconvectores"],
  "mitsubishi-i-life2-slim-dlrv": ["ventiloconvectores"],
  "mitsubishi-i-life2-slim-dliu": ["ventiloconvectores"],
  "mitsubishi-i-life2-hp-dlio": ["ventiloconvectores"],
  "mitsubishi-i-life3-dlmv": ["ventiloconvectores"],
  "mitsubishi-i-life3-dlio": ["ventiloconvectores"],
  "mitsubishi-i-life3-dliv": ["ventiloconvectores"],
  "mitsubishi-a-hwd": ["ventiloconvectores"],
  "mitsubishi-i-hwd": ["ventiloconvectores"],
  "mitsubishi-a-cxw": ["ventiloconvectores"],
  "mitsubishi-i-cxw": ["ventiloconvectores"],
  "mitsubishi-i-mxw": ["ventiloconvectores"],
  "mitsubishi-s-airme-mf-c": ["ventiloconvectores"],
  "mitsubishi-s-airme-mf-i": ["ventiloconvectores"],
  "mitsubishi-s-airme-mf-b": ["ventiloconvectores"],
  "mitsubishi-s-airme-hr-p-c": ["ventiloconvectores"],
  "mitsubishi-s-airme-hr-p-i": ["ventiloconvectores"],
  "mitsubishi-s-airme-hr-p-b": ["ventiloconvectores"],
  "mitsubishi-s-airme-hr-e-c": ["ventiloconvectores"],
  "mitsubishi-s-airme-hr-e-i": ["ventiloconvectores"],
  "mitsubishi-s-airme-hr-e-b": ["ventiloconvectores"],
  "mitsubishi-gk": ["cortinas-de-ar"],
  "mitsubishi-msy-tp": [
    "msy-tp",
    "mitsubishi-mural-comercial-servidores-msy-tpvf-1",
  ],
  "nipon-magnum": ["armario-mono-split-magnum"],
  "nipon-cassete-xb": ["cassete-mono-split", "cassete-multi-split"],
  "nipon-conduta-xd": ["conduta-mono-split", "conduta-multi-split"],
  "nipon-consola-xc": ["consola-mono-split", "consola-multi-split"],
  "nipon-topsmart": ["topsmart-mono-split", "topsmart-multi-split"],
  "nipon-primis-duo": ["primis-duo-mono-split"],
  "nipon-primis-duo-branco": ["primis-duo-mono-split"],
  "nipon-primis-duo-cinza-antracite": ["primis-duo-mono-split"],
  "nipon-vita": ["vita-mono-split", "vita-multi-split"],
  "nipon-flexus": ["bomba-de-calor-aqs-inox-flexus"],
  "nipon-innovus": ["bomba-de-calor-aqs-innovus"],
  "nipon-serenus": ["bomba-de-calor-para-piscina"],
  "nipon-spirit-m": [
    "bomba-de-calor-ar-agua-monobloco-spirit-mg",
    "bomba-de-monobloco",
  ],
  "nipon-spirit-s": ["bomba-split"],
  "nipon-spirit-sa": ["bomba-split-sa"],
  "nipon-h-power": ["bomba-de-alta-eficiencia"],
  "nipon-i-nex": ["bomba-de-calor-ar-agua-monobloco-i-nex"],
  "nipon-aquanovus": ["bomba-de-calor-split-aqs-aquanovus"],
  "nipon-multi-split-ue": ["unidades-exteriores-multi-split"],
  "nipon-multi-split-dhw": ["unidade-exterior-ac-aqs"],
  "nipon-multi-ui-primis": ["primis-duo-multi-split", "primis-duo-mono-split"],
  "nipon-multi-ui-primis-branco": ["primis-duo-multi-split", "primis-duo-mono-split"],
  "nipon-multi-ui-primis-preto": ["primis-duo-multi-split", "primis-duo-mono-split"],
  "nipon-multi-ui-vita": ["vita-multi-split", "vita-mono-split"],
  "nipon-multi-ui-topsmart": ["topsmart-multi-split", "topsmart-mono-split"],
  "nipon-multi-ui-cassete-mb": ["cassete-multi-split", "cassete-mono-split"],
  "nipon-multi-ui-cassete-mv": ["cassete-1via-multi-split"],
  "nipon-multi-ui-conduta-md": ["conduta-multi-split", "conduta-mono-split"],
  "nipon-multi-ui-conduta-mdh": [
    "conduta-alta-pressao-estatica",
    "conduta-multi-split",
    "conduta-mono-split",
  ],
  "nipon-multi-ui-consola-mc": ["consola-multi-split", "consola-mono-split"],
  "nipon-supra": ["ventiloconvetor-supra-slim", "ventiloconvetor-supra-reverse"],
  "nipon-supra-slim": ["ventiloconvetor-supra-slim"],
  "nipon-supra-reverse": ["ventiloconvetor-supra-reverse"],
  "nipon-milan": ["ventiloconvetor-mural"],
  // Site: cassete page = Hawaii; consola page = Venice.
  "nipon-hawaii": ["ventiloconvetor-cassete"],
  "nipon-venice-h": ["ventiloconvetor-consola"],
  "nipon-venice-hf": ["ventiloconvetor-consola"],
  "nipon-venice-hn": ["ventiloconvetor-consola"],
  "nipon-venice-v": ["ventiloconvetor-consola"],
  "nipon-venice-vf": ["ventiloconvetor-consola"],
  "nipon-venice-vn": ["ventiloconvetor-consola"],
  "nipon-evabox-95": ["vmc-evabox-95"],
  "nipon-evaslim-75": ["vmc-evaslim-75"],
  // Standalone depósito that has a dedicated page.
  NI0130120: ["deposito-de-aqs"],

  // Hisense (hisense.pt) — consumer/pro pages use older or sibling model codes;
  // map families to the closest representative product page we crawled.
  // Midea (sgtmidea.com) — CSV family slugs → WooCommerce product page slugs.
  "midea-mural-solstice-ez": ["solstice", "midea-mural-xtreme-save-1"],
  "midea-mural-breezeless-e-cb1": ["breezeless-e", "midea-mural-breezeless-e-1a"],
  "midea-mural-breezeless-s": ["breezeless", "midea-mural-breezeless-1"],
  "midea-mural-penroseair-xt": ["penroseair", "midea-mural-penrose-air-1a"],
  "midea-consola-de-chao": ["consola-de-chao", "chao-com-e-sem-envolvente"],
  "midea-cassete-compacta": [
    "cassete-compacta",
    "midea-cassete-60-breezeless-1",
  ],
  "midea-cassete-compacta-cassete-4-vias": ["cassete-compacta", "cassete-compacta-2"],
  "midea-cassete-4-vias-super-slim": [
    "cassete-de-4-vias-super-slim",
    "midea-cassete-90-breezeless-1",
  ],
  "midea-cassete-1-via": ["cassete-1-via"],
  "midea-conduta": ["conduta", "midea-conduta-baixo-perfil-mtiu-1"],
  "midea-conduta-tipo-split": ["conduta"],
  "midea-teto-chao": ["tecto-chao", "midea-consola-chao-tceto-mueu-1"],
  "midea-armario-vertical": ["armario-vertical", "midea-armario-mfgd-1"],
  "midea-porta-split": ["lite", "midea-mural-lite-1a"],
  "midea-multi-split-unidades-exteriores": [
    "multi-split-free-match",
    "midea-exterior-14-18hfn8-3a",
  ],
  "midea-multi-split-cirqhp-aqs-com-recuperacao-de-calor": ["multi-split-cirqhp"],
  "midea-cirqhp-ue": ["multi-split-cirqhp"],
  "midea-cirqhp-deposito": ["multi-split-cirqhp"],
  "midea-sistema-twin-duplo": ["cassete-compacta", "multi-split-free-match"],
  "midea-sistema-twin-triplo": ["cassete-compacta", "multi-split-free-match"],
  "midea-sistema-twin-quadruplo": ["cassete-compacta", "multi-split-free-match"],
  "midea-m-thermal-serie-arctic-monobloco": ["m-thermal-serie-arctic"],
  "midea-m-thermal-serie-mars": ["m-thermal-serie-mars-monobloco", "m-thermal"],
  "midea-m-thermal-serie-mars-large": ["m-thermal-serie-mars-monobloco", "m-thermal"],
  "midea-m-thermal-power-monobloco": ["m-thermal"],
  "midea-m-thermal-serie-hygge-tipo-split": ["m-thermal"],
  "midea-m-thermal-hygge-ue": ["m-thermal"],
  "midea-m-thermal-hygge-hidronico": ["m-thermal"],
  "midea-bombas-de-calor-combo": ["combo"],
  "midea-bombas-de-calor-tipo-split-r454c": ["bomba-de-calor-tipo-split"],
  "midea-aqs-split-ue": ["bomba-de-calor-tipo-split", "bombas-de-calor"],
  "midea-aqs-split-deposito": ["bomba-de-calor-swan", "bombas-de-calor"],
  "midea-bombas-de-calor-aqs-com-ligacao-solar": ["bomba-de-calor-swan", "bombas-de-calor"],
  "midea-bombas-de-calor-para-piscina": ["bombas-de-calor"],
  "midea-chiller-aqua-thermal-super": ["aqua-thermal-super", "chillers-aqua-thermal"],
  "midea-recuperadores-de-calor": [
    "hrv-unidades-de-ventilacao-de-fluxos-cruzados",
  ],
  "midea-mural": ["mural-2", "mural"],
  // Multi UI — reuse mono series packshots
  "midea-multi-ui-solstice-ez": ["solstice"],
  "midea-multi-ui-breezeless-e": ["breezeless-e"],
  "midea-multi-ui-breezeless-s": ["breezeless"],
  "midea-multi-ui-penroseair-xt": ["penroseair"],
  "midea-multi-ui-consola": ["consola-de-chao"],
  "midea-multi-ui-cassete-compacta": ["cassete-compacta"],
  "midea-multi-ui-cassete-1-via": ["cassete-1-via"],
  // Fan-coils
  "midea-fc-mural": ["mural-2", "mural"],
  "midea-fc-cassete-4-vias-dc-2-tubos": ["cassetes-4-vias"],
  "midea-fc-cassete-4-vias-dc-4-tubos": ["cassetes-4-vias"],
  "midea-fc-cassete-compacta-dc-2-tubos": ["cassete-compacta-3"],
  "midea-fc-cassete-compacta-dc-4-tubos": ["cassete-compacta-3"],
  "midea-fc-cassete-1-via": ["cassete-1-via"],
  "midea-fc-conduta-dc-2-tubos": ["conduta-2"],
  "midea-fc-conduta-dc-4-tubos": ["conduta-2"],
  "midea-fc-teto-chao-dc-2-tubos": ["tecto-chao"],
  "midea-fc-teto-chao-dc-4-tubos": ["tecto-chao"],
  "midea-cassete-4-vias-dc-2-tubos": ["cassetes-4-vias"],
  "midea-cassete-4-vias-dc-4-tubos": ["cassetes-4-vias"],
  "midea-cassete-compacta-dc-2-tubos": ["cassete-compacta-3"],
  "midea-cassete-compacta-dc-4-tubos": ["cassete-compacta-3"],
  "midea-conduta-dc-2-tubos": ["conduta-2"],
  "midea-conduta-dc-4-tubos": ["conduta-2"],
  "midea-teto-chao-dc-2-tubos": ["tecto-chao"],
  "midea-teto-chao-dc-4-tubos": ["tecto-chao"],
  "midea-comandos-e-acessorios": [
    "sistemas-de-controlo",
    "sistemas-de-controlo-gama-comercial",
    "controlador-centralizado",
    "controlo-remoto",
  ],
  "midea-h-pack": ["lite"],

  // Daikin — product.html/<SERIES> + residential marketing pages (daikin.pt)
  "daikin-fcag-b-r-32": ["fcag-b"],
  "daikin-ffa-a9-r-32": ["ffa-a9", "ffa-a"],
  "daikin-fba-a9-adea-a-r-32": ["fba-a", "adea-a"],
  "daikin-fdxm-f9-r-32": ["fdxm-f9", "teto-falso-html"],
  "daikin-fdxm-f9-rxm-r-r-32": ["fdxm-f9", "rxm-r"],
  "daikin-fha-a9-r-32": ["fha-a"],
  "daikin-fda125a-r-32": ["fda-a"],
  "daikin-ftxa-cw-cs-cb-rxa-a8-b-b9-r-32": [
    "ftxa-cw",
    "stylish-html",
    "rxa-a",
    "daikin-mural-stylish-white",
    "daikin-mural-stylish-silver",
    "daikin-mural-stylish-black",
  ],
  "daikin-ftxf-f-rxf-f-d9-r-32": [
    "ftxf-f",
    "sensira-html",
    "daikin-mural-sensira",
  ],
  // Emura FTXJ — one grupoModelo with cor=branco/prateado/preto. Prefer the
  // brand page (packshots of all 3 colours) then the per-colour product pages.
  "daikin-ftxj": [
    "daikin-emura-html",
    "ftxj-aw",
    "ftxj-as",
    "ftxj-ab",
    "daikin-mural-emura",
  ],
  "daikin-ftxj-ui": [
    "daikin-emura-html",
    "ftxj-aw",
    "ftxj-as",
    "ftxj-ab",
    "daikin-mural-emura",
  ],
  "daikin-ftxj-aw-as-ab-rxj-a-r-32": [
    "daikin-emura-html",
    "ftxj-aw",
    "ftxj-as",
    "ftxj-ab",
    "daikin-mural-emura",
  ],
  // Stylish FTXA — classic colours (BW/BS/BB) + Seiren designer greys (DG/DY/DP…).
  "daikin-ftxa": [
    "stylish-html",
    "stylish-seiren",
    "ftxa-cw",
    "daikin-mural-stylish-white",
  ],
  "daikin-ftxa-ui": [
    "stylish-html",
    "stylish-seiren",
    "ftxa-cw",
    "daikin-mural-stylish-white",
  ],
  // CTXA = Stylish multi indoor (same shell / colours as FTXA).
  "daikin-ctxa-ui": [
    "stylish-html",
    "stylish-seiren",
    "ftxa-cw",
    "daikin-mural-stylish-white",
  ],
  "daikin-ftxm-a-r-32": [
    "ftxm-a",
    "unidade-mural-perfera-html",
    "daikin-mural-perfera",
  ],
  "daikin-ftxm-a-rxm-a-r-32": [
    "ftxm-a",
    "rxm-a",
    "unidade-mural-perfera-html",
    "daikin-mural-perfera",
  ],
  "daikin-ftxp-n-9-rxp-n-9-r-32": [
    "ftxp-n",
    "comfora-html",
    "daikin-mural-comfora",
  ],
  "daikin-ftxz-n-rxz-n-r-32": ["ftxz-n", "ururu-sarara-html"],
  "daikin-fva-a-r-32": ["fva-a"],
  "daikin-fvxm-b-rxm-r-9-r-32": [
    "fvxm-b",
    "unidade-de-chao-perfera-html",
    "rxm-r",
    "daikin-consola-perfera",
  ],
  "daikin-nom-kw-seer": [
    "stylish-html",
    "ftxa-cw",
    "daikin-mural-stylish-white",
  ], // Stylish dump in CSV
  "daikin-gama-multi-sensira": [
    "multi-split-html",
    "sensira-html",
    "ftxf-f",
    "daikin-mural-sensira",
  ],
  "daikin-novidade-gama-multi-a8": ["multi-split-html"],
  "daikin-multi-agua-quente": ["multi-plus-split-html"],
  "daikin-eletrostatico-remove-oxidativamente-as": [
    "mc30y-html",
    "mc55w",
    "mc55w-html",
    "mc80z",
    "mc80z-html",
    "mck55w",
    "mck55w-html",
    "mck555a",
    "mck70z-html",
  ],
  "daikin-ducobox-e-acessorios": [
    "ducobox-energy-comfort-html",
    "ducobox-energy-premium-html",
    "ducobox-energy-sky-html",
  ],
  "daikin-era-av-ay-ayf": ["era-av"],
  "daikin-ewaa-dv3p-dw1p": ["ewaa-dv3p"],
  "daikin-rooftops": ["uatya-bbay1"],
  "daikin-rooftops-opcoes": ["uatya-bbay1"],
  "daikin-daikin-altherma-hpc": ["heat-pump-convector-html"],
  "daikin-ventilo-convectores": ["heat-pump-convector-html"],
  "daikin-daikin-altherma-3-cw": [
    "daikin-altherma-3-m-html",
    "daikin-altherma-3-r-f-html",
  ],
  "daikin-daikin-altherma-st": ["daikin-altherma-m-hw-html"],
  "daikin-hidrosplit-r-290-hidrosplit-r-32": [
    "daikin-altherma-3-r-f-html",
    "daikin-altherma-3-r-w-html",
    "daikin-altherma-4-h-f-html",
  ],
  "daikin-smart-heat-pumps": [
    "daikin-altherma-4-h-f-html",
    "daikin-altherma-4-h-w-html",
  ],
  "daikin-sg": ["daikin-altherma-4-h-w-html", "daikin-altherma-3-m-html"],
  "daikin-classes-4-6-8": ["daikin-altherma-3-m-html"],
  "daikin-classes-4-6-8-65oc": [
    "daikin-altherma-3-r-f-html",
    "daikin-altherma-3-m-html",
  ],
  "daikin-classes-4-6-7-70oc": [
    "daikin-altherma-3-h-ht-f-html",
    "daikin-altherma-4-h-f-html",
  ],
  "daikin-classes-9-11-14-16": ["daikin-altherma-3-r-w-html"],
  "daikin-classes-11-14-16-60oc": [
    "daikin-altherma-3-r-f-html",
    "daikin-altherma-3-h-ht-f-html",
  ],
  "daikin-classes-14-16-18": ["daikin-altherma-3-r-w-html"],
  "daikin-classes-14-16-18-70oc": [
    "daikin-altherma-3-h-ht-f-html",
    "daikin-altherma-4-h-f-html",
  ],
  "daikin-classes-6-8-10-12-14-75oc": [
    "daikin-altherma-4-h-f-html",
    "daikin-altherma-4-h-w-html",
  ],
  "daikin-75oc-read-y": [
    "daikin-altherma-4-h-f-html",
    "daikin-altherma-m-hw-html",
  ],

  // Hisense v2 grupoModelo slugs (hisense.pt + Megaclima secondary).
  "hisense-perla": ["ar-condicionado-perla-ca25yr1a", "hisense-mural-perla"],
  "hisense-perla-ui": ["ar-condicionado-perla-ca25yr1a", "hisense-mural-perla"],
  // Mural UE: hisense.pt series pages only ship indoor galleries. Prefer pages
  // that actually contain an outdoor packshot (Comfort UNIDAD EXTERIOR + multi).
  "hisense-perla-ue": [
    "ar-condicionado-comfort-dj25ve0b",
    "multisplit-2amw42u4rra",
    "hisense-exterior-2amw42u4rgc-3",
  ],
  "hisense-energy-pro-x": [
    "energy-pro-x-qh35xv4a-monosplit-35kw-smart-eye-wifi",
    "hisense-mural-energy-pro-1",
    "ar-condicionado-energy-pro-qe25xv00",
    "ar-condicionado-energy-pro-tq25xe0c",
  ],
  "hisense-energy-pro-x-ui": [
    "energy-pro-x-qh35xv4a-monosplit-35kw-smart-eye-wifi",
    "hisense-mural-energy-pro-1",
  ],
  "hisense-energy-pro-x-ue": [
    "ar-condicionado-comfort-dj25ve0b",
    "multisplit-2amw42u4rra",
    "hisense-exterior-2amw42u4rgc-3",
  ],
  "hisense-max-comfort": ["max-comfort-hc25yc0ug-monosplit-25kw-wifi"],
  "hisense-max-comfort-ui": ["max-comfort-hc25yc0ug-monosplit-25kw-wifi"],
  "hisense-max-comfort-ue": [
    "ar-condicionado-comfort-dj25ve0b",
    "multisplit-2amw42u4rra",
    "hisense-exterior-2amw42u4rgc-3",
  ],
  "hisense-uni-pure": ["uni-pure-hb35xu0a-monosplit-35kw-wifi"],
  "hisense-uni-pure-ui": ["uni-pure-hb35xu0a-monosplit-35kw-wifi"],
  "hisense-uni-pure-ue": [
    "ar-condicionado-comfort-dj25ve0b",
    "multisplit-2amw42u4rra",
    "hisense-exterior-2amw42u4rgc-3",
  ],
  "hisense-multi-uni-pure-mural-ui": ["uni-pure-hb35xu0a-monosplit-35kw-wifi"],
  // Air Master / Fresh Master are the closest mural packshots on Megaclima.
  "hisense-air-master": ["hisense-mural-fresh-master"],
  "hisense-air-master-ui": ["hisense-mural-fresh-master"],
  "hisense-air-master-ue": [
    "ar-condicionado-comfort-dj25ve0b",
    "multisplit-2amw42u4rra",
    "hisense-exterior-2amw42u4rgc-3",
  ],
  "hisense-portatil": ["portatil-apc09", "portatil-apc12", "portatil-aph09", "portatil"],
  "hisense-cassete-1x1-turbo-inverter": [
    "cassette-auc105ur4rgb4",
    "cassette-auc125ur4rhb4",
    "cassette-auc90ur4rfgb4",
    "hisense-cassete",
    "hisense-cassete-comercial",
    "cassete",
  ],
  "hisense-cassete-1x1-super-inverter": [
    "cassette-auc105ur4rgb4",
    "hisense-cassete",
    "cassete",
  ],
  "hisense-mini-cassete-1x1-turbo-inverter": [
    "cassette-act35ur4rsca4",
    "hisense-cassete",
    "cassete",
  ],
  "hisense-mini-cassete-1x1-super-inverter": [
    "cassette-act35ur4rsca4",
    "hisense-cassete",
    "cassete",
  ],
  "hisense-consola-1x1-turbo-inverter": [
    "consola-akt26ur4rk4",
    "hisense-consola-chao",
  ],
  "hisense-consola-1x1-super-inverter": [
    "consola-akt26ur4rk4",
    "hisense-consola-chao",
  ],
  "hisense-chao-teto-1x1-turbo-inverter": [
    "chao-teto-auv105ur4rab4",
    "chao-teto-auv105ur4rb4",
    "chao-teto-auv125ur4rc4",
    "chao-teto-auv140ur6rpc4",
    "hisense-consola-chao-tecto",
  ],
  "hisense-chao-teto-1x1-super-inverter": [
    "chao-teto-auv105ur4rab4",
    "hisense-consola-chao-tecto",
  ],
  "hisense-coluna-1x1": ["hisense-armario", "coluna-de-ar-auf140ur4rmpa"],
  "hisense-auf140ur4rmpa8": ["hisense-armario"],
  // Coluna/conduta UE (AUW*): use multi outdoor packshots, not indoor duct/armario.
  "hisense-auw140u6rq7": [
    "multisplit-5amw125u4rta",
    "multisplit-4amw105u4raa",
    "hisense-exterior-2amw42u4rgc-3",
    "cassete",
  ],
  "hisense-conduta-1x1-baixa-pressao-turbo-inverter": ["hisense-conduta-baixa"],
  "hisense-conduta-1x1-baixa-pressao-super-inverter": ["hisense-conduta-baixa"],
  "hisense-conduta-1x1-media-pressao-turbo-inverter": ["hisense-conduta-media"],
  "hisense-conduta-1x1-media-pressao-super-inverter": ["hisense-conduta-media"],
  "hisense-conduta-1x1-alta-pressao-turbo-inverter": ["hisense-conduta-alta-1"],
  // Conduta group UI/UE (grupoModelo), not individual AUD*/AUW* refs.
  "hisense-conduta-1x1-baixa-pressao-turbo-inverter-unidade-exterior": [
    "multisplit-2amw42u4rra",
    "hisense-exterior-2amw42u4rgc-3",
    "cassete",
  ],
  "hisense-conduta-1x1-baixa-pressao-super-inverter-unidade-exterior": [
    "multisplit-2amw42u4rra",
    "multisplit-3amw62u4rfa",
    "hisense-exterior-2amw42u4rgc-3",
    "cassete",
  ],
  "hisense-conduta-1x1-media-pressao-turbo-inverter-unidade-interior": [
    "hisense-conduta-media",
  ],
  "hisense-conduta-1x1-media-pressao-turbo-inverter-unidade-exterior": [
    "multisplit-3amw62u4rfa",
    "hisense-exterior-2amw42u4rgc-3",
    "cassete",
  ],
  "hisense-conduta-1x1-media-pressao-super-inverter-unidade-exterior": [
    "multisplit-3amw62u4rfa",
    "multisplit-4amw105u4raa",
    "hisense-exterior-2amw42u4rgc-3",
    "cassete",
  ],
  "hisense-conduta-1x1-alta-pressao-turbo-inverter-unidade-interior": [
    "hisense-conduta-alta-1",
  ],
  "hisense-conduta-1x1-alta-pressao-turbo-inverter-unidade-exterior": [
    "multisplit-4amw105u4raa",
    "multisplit-5amw125u4rta",
    "cassete",
  ],
  // Conduta UI (AUD*) keeps indoor duct packshots; UE (AUW*) → outdoor.
  "hisense-auw26u4rs8": [
    "multisplit-2amw42u4rra",
    "hisense-exterior-2amw42u4rgc-3",
    "cassete",
  ],
  "hisense-auw35u4rs8": [
    "multisplit-2amw42u4rra",
    "hisense-exterior-2amw42u4rgc-3",
    "cassete",
  ],
  "hisense-auw52u4rj8": [
    "multisplit-2amw42u4rra",
    "multisplit-3amw62u4rfa",
    "hisense-exterior-2amw42u4rgc-3",
    "cassete",
  ],
  "hisense-auw52u4rs7": [
    "multisplit-2amw42u4rra",
    "multisplit-3amw62u4rfa",
    "hisense-exterior-2amw42u4rgc-3",
    "cassete",
  ],
  "hisense-auw71u4rj7": [
    "multisplit-3amw62u4rfa",
    "hisense-exterior-2amw42u4rgc-3",
    "cassete",
  ],
  "hisense-auw60u4rk8": [
    "multisplit-3amw62u4rfa",
    "hisense-exterior-2amw42u4rgc-3",
    "cassete",
  ],
  "hisense-auw71u4rk8": [
    "multisplit-3amw62u4rfa",
    "hisense-exterior-2amw42u4rgc-3",
    "cassete",
  ],
  "hisense-auw60u4rj7": [
    "multisplit-3amw62u4rfa",
    "hisense-exterior-2amw42u4rgc-3",
    "cassete",
  ],
  "hisense-auw90u4rf4": [
    "multisplit-3amw62u4rfa",
    "multisplit-4amw105u4raa",
    "cassete",
  ],
  "hisense-auw105u4rk7": [
    "multisplit-4amw105u4raa",
    "multisplit-5amw125u4rta",
    "cassete",
  ],
  "hisense-aud60ux4rfm8": ["hisense-conduta-media"],
  "hisense-aud71ux4rfm8": ["hisense-conduta-media"],
  "hisense-aud90ux4rdh5": ["hisense-conduta-media"],
  "hisense-aud105ux4reh8": ["hisense-conduta-media", "hisense-conduta-alta-1"],
  "hisense-auw105u4rw8": [
    "multisplit-4amw105u4raa",
    "multisplit-5amw125u4rta",
    "cassete",
  ],
  "hisense-auw105u6rw8": [
    "multisplit-4amw105u4raa",
    "multisplit-5amw125u4rta",
    "cassete",
  ],
  "hisense-auw125u4rw8": ["multisplit-5amw125u4rta", "cassete"],
  "hisense-auw125u6rw8": ["multisplit-5amw125u4rta", "cassete"],
  "hisense-auw140u4rw8": ["multisplit-5amw125u4rta", "cassete"],
  "hisense-auw140u6rw8": ["multisplit-5amw125u4rta", "cassete"],
  "hisense-auw175u6rw8": ["multisplit-5amw125u4rta", "cassete"],
  "hisense-auw200u6rz8": ["multisplit-5amw125u4rta", "cassete"],
  "hisense-auw250u6rz8": ["multisplit-5amw125u4rta", "cassete"],
  "hisense-aud125ux4reh8": ["hisense-conduta-alta-1"],
  "hisense-aud140ux4reh8": ["hisense-conduta-alta-1"],
  "hisense-aud175ux4reh8": ["hisense-conduta-alta-1"],
  "hisense-aud200ux4rph8": ["hisense-conduta-alta-1"],
  "hisense-aud250ux4rph8": ["hisense-conduta-alta-1"],
  "hisense-auc140ur4rkc8": [
    "cassette-auc105ur4rgb4",
    "hisense-cassete",
    "cassete",
  ],
  "hisense-auc175ur4rkc8": [
    "cassette-auc105ur4rgb4",
    "hisense-cassete",
    "cassete",
  ],
  "hisense-multi-inverter-exterior": [
    "multisplit-2amw42u4rra",
    "multisplit-3amw62u4rfa",
    "multisplit-4amw105u4raa",
    "multisplit-5amw125u4rta",
    "multisplit-2ma912tg1",
    "hisense-exterior-2amw42u4rgc-3",
  ],
  "hisense-multi-inverter-consola-ui": [
    "multi-consola-akt26ur4rk4",
    "consola-akt26ur4rk4",
    "hisense-consola-chao",
  ],
  "hisense-multi-inverter-cassete-ui": [
    "cassette-act35ur4rsca4",
    "hisense-cassete",
    "cassete",
  ],
  "hisense-multi-inverter-cassete-conjunto": [
    "cassette-act35ur4rsca4",
    "hisense-cassete",
    "cassete",
  ],
  "hisense-multi-inverter-chao-teto-ui": [
    "chao-teto-auv105ur4rab4",
    "hisense-consola-chao-tecto",
  ],
  "hisense-multi-inverter-conduta-ui": [
    "hisense-conduta-baixa",
    "hisense-conduta-media",
    "hisense-conduta-alta-1",
  ],
}

/**
 * Series head of a slug: the leading model-code segments, e.g.
 * `daikin-fcag-b-alpha` → ["fcag","b"], `fcag-b` → ["fcag","b"].
 * Used to match catalog groups against crawl pages named after the series
 * when no explicit alias exists (aliases are per-extraction and go stale).
 */
function seriesHead(slug, dropMarca = false) {
  const segs = String(slug || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  if (dropMarca && segs.length > 1) segs.shift()
  return segs
}

/** Alias-free series match: same model-code head on both sides. */
function seriesScore(target, image) {
  const t = seriesHead(target.slug, true)
  const p = seriesHead(image.pageSlug)
  const head = t[0]
  // Model codes only — Daikin/Mitsubishi heads are 3-6 chars (FHA, FCAG, MSZ).
  if (!head || !p[0] || head !== p[0]) return 0
  if (head.length < 3 || head.length > 6) return 0
  let s = 45
  if (t[1] && p[1] && t[1] === p[1]) s += 20
  return s
}

/** Score how well a crawled page matches a catalog target. */
function score(target, image) {
  if (target.marca !== image.marca) return -1

  let s = 0
  const aliases = ALIASES[target.slug] ?? []
  const aliasIdx = aliases.indexOf(image.pageSlug)
  if (aliases.length === 0) s += seriesScore(target, image)
  if (aliasIdx !== -1) {
    // Prefer earlier aliases when several outdoor pages tie (e.g. size-matched
    // multisplit before a generic cassete outdoor collage).
    s += 100 + Math.max(0, 20 - aliasIdx * 3)
  }

  // Include file basename / remote URL so secondary sources (Megaclima
  // packshots named daikin_mural_sensira_1c.png) can match by series.
  const fileBase = path.basename(image.file || image.src || "", path.extname(image.file || image.src || ""))
  const page = norm(
    `${image.pageSlug} ${image.pageTitle} ${image.alt} ${fileBase}`,
  )
  const slug = norm(target.slug.replace(/^[a-z]+-/, "")) // drop marca- prefix
  const gama = norm(target.gama || "")
  const nome = norm(target.nome)

  if (image.pageSlug && slug && image.pageSlug.includes(slug.replace(/\s+/g, "-"))) {
    s += 50
  }
  if (gama && page.includes(gama)) s += 40
  if (slug && page.includes(slug)) s += 30

  for (const t of tokens(nome)) {
    if (page.includes(t)) s += 4
  }
  for (const t of tokens(gama)) {
    if (page.includes(t)) s += 6
  }

  // Match manufacturer model codes from refs against the page slug / filename
  // (e.g. AKT26UR4RK8 → akt26 in consola-akt26ur4rk4).
  const slugLower = `${image.pageSlug || ""} ${fileBase}`.toLowerCase()
  for (const ref of target.refs ?? [target.ref]) {
    const codes = String(ref)
      .split("/")
      .map((c) => c.replace(/[^A-Za-z0-9]/g, "").toLowerCase())
      .filter((c) => c.length >= 6)
    for (const code of codes) {
      if (slugLower.includes(code)) s += 80
      else if (slugLower.includes(code.slice(0, 8))) s += 50
      else if (slugLower.includes(code.slice(0, 5))) s += 25
    }
  }

  // Slight preference for official-site crawls over secondary distributors
  // when scores are otherwise tied (match picks the first max).
  if (image.source === "megaclima" || image.source === "disterm") s -= 5

  return s
}

async function manualSlugs() {
  if (!existsSync(MANUAL)) return new Set()
  const dirs = await readdir(MANUAL, { withFileTypes: true })
  return new Set(dirs.filter((d) => d.isDirectory()).map((d) => d.name))
}

/**
 * Last-resort source: packshots ripped from the brand's own price PDF by
 * `pdf_images.py` (product-scaffold/pdf-images/<marca>/<slug>/NN.png).
 * Only used for groups the crawl left without a single photo.
 */
async function pdfFallbackFiles(marca, slug) {
  const dir = path.join(PDF_IMAGES, marca, slug)
  if (!existsSync(dir)) return []
  const files = await readdir(dir)
  return files
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort()
    .map((f) => path.relative(ROOT, path.join(dir, f)))
}

async function main() {
  if (!existsSync(TARGETS)) {
    throw new Error("Falta product-scaffold/targets.json — corre targets.mjs primeiro.")
  }
  if (!existsSync(MANIFEST)) {
    throw new Error("Falta product-scaffold/crawl-raw/manifest.json — corre crawl.mjs primeiro.")
  }

  const targets = JSON.parse(await readFile(TARGETS, "utf8"))
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"))
  const images = manifest.images ?? []
  const manuals = await manualSlugs()

  // Group crawled images by pageSlug within marca.
  const byPage = new Map()
  for (const img of images) {
    const key = `${img.marca}::${img.pageSlug}`
    if (!byPage.has(key)) byPage.set(key, [])
    byPage.get(key).push(img)
  }

  const mapping = []
  const unmatched = []

  for (const target of targets) {
    const unitSide = targetUnitSide(target)
    // Score every page for this marca; pick the best (unit-side aware).
    let bestKey = null
    let bestScore = 0
    for (const [key, imgs] of byPage) {
      if (!key.startsWith(`${target.marca}::`)) continue
      const sc = pageScore(target, imgs)
      // UE targets: skip pages that yield no outdoor-classified files after filter.
      if (unitSide === "exterior") {
        const outdoorFiles = selectFiles(imgs, unitSide)
        if (outdoorFiles.length === 0) continue
      }
      if (sc > bestScore) {
        bestScore = sc
        bestKey = key
      }
    }

    // Accessories / commands almost never have dedicated packshots — require
    // an alias-level hit (score ≥ 100) so they don't steal product photos.
    // Equipment families need a modest match (score ≥ 20).
    const isAcessorio =
      target.familia === "acessorios-e-controlo" ||
      target.aplicarAoGrupo === false
    const threshold = isAcessorio ? 100 : 20
    if (bestKey && bestScore >= threshold) {
      const files = collectFiles(target, byPage, bestKey, unitSide)
      const pageSlug =
        (ALIASES[target.slug] || []).find((a) => byPage.has(`${target.marca}::${a}`)) ||
        bestKey.split("::")[1]
      if (files.length === 0) {
        unmatched.push({
          slug: target.slug,
          marca: target.marca,
          ref: target.ref,
          nome: target.nome,
          gama: target.gama ?? null,
          aplicarAoGrupo: target.aplicarAoGrupo,
          score: bestScore,
          files: [],
          manual: manuals.has(target.slug),
        })
        mapping.push({
          slug: target.slug,
          marca: target.marca,
          ref: target.ref,
          nome: target.nome,
          gama: target.gama ?? null,
          componente: target.componente ?? null,
          unitSide,
          aplicarAoGrupo: target.aplicarAoGrupo,
          score: bestScore,
          pageSlug: null,
          files: [],
          manual: manuals.has(target.slug),
        })
        continue
      }
      mapping.push({
        slug: target.slug,
        marca: target.marca,
        ref: target.ref,
        nome: target.nome,
        gama: target.gama ?? null,
        componente: target.componente ?? null,
        unitSide,
        aplicarAoGrupo: target.aplicarAoGrupo,
        score: bestScore,
        pageSlug,
        files,
        manual: manuals.has(target.slug),
      })
    } else {
      unmatched.push({
        slug: target.slug,
        marca: target.marca,
        ref: target.ref,
        nome: target.nome,
        gama: target.gama ?? null,
        aplicarAoGrupo: target.aplicarAoGrupo,
        score: bestScore,
        files: [],
        manual: manuals.has(target.slug),
      })
      mapping.push({
        slug: target.slug,
        marca: target.marca,
        ref: target.ref,
        nome: target.nome,
        gama: target.gama ?? null,
        componente: target.componente ?? null,
        unitSide,
        aplicarAoGrupo: target.aplicarAoGrupo,
        score: bestScore,
        pageSlug: null,
        files: [],
        manual: manuals.has(target.slug),
      })
    }
  }

  // Fallback: groups the crawl couldn't cover fall back to the price-PDF rips.
  let pdfFallback = 0
  for (const entry of mapping) {
    if (entry.files.length > 0 || entry.manual) continue
    const files = await pdfFallbackFiles(entry.marca, entry.slug)
    if (files.length === 0) continue
    entry.files = files
    entry.pageSlug = "pdf"
    entry.fonte = "pdf"
    pdfFallback++
    const u = unmatched.find((x) => x.slug === entry.slug)
    if (u) u.fonte = "pdf"
  }

  await mkdir(path.dirname(MAPPING_OUT), { recursive: true })
  await writeFile(MAPPING_OUT, JSON.stringify(mapping, null, 2))

  const matched = mapping.filter((m) => m.files.length > 0 || m.manual)
  console.log(
    `Matched ${matched.length}/${mapping.length} targets (${unmatched.length} unmatched).`,
  )
  if (pdfFallback > 0) {
    console.log(`  ↳ ${pdfFallback} via fallback do PDF (product-scaffold/pdf-images)`)
  }

  // Build review contact sheet.
  const rows = mapping
    .map((m) => {
      const thumbs =
        m.files.length > 0
          ? m.files
              .map(
                (f) =>
                  `<img src="../${f}" alt="" loading="lazy" style="height:120px;width:120px;object-fit:contain;background:#f4f4f4;border:1px solid #ddd;border-radius:8px;margin:2px" />`,
              )
              .join("")
          : m.manual
            ? `<em>manual override in product-scaffold/manual/${m.slug}/</em>`
            : `<span style="color:#b00">SEM MATCH</span>`
      return `<tr>
        <td style="padding:10px;border-bottom:1px solid #eee;vertical-align:top;width:280px">
          <strong>${escapeHtml(m.nome)}</strong><br/>
          <code>${escapeHtml(m.slug)}</code><br/>
          <small>${escapeHtml(m.marca)}${m.gama ? " · " + escapeHtml(m.gama) : ""}${m.unitSide && m.unitSide !== "neutral" ? " · " + escapeHtml(m.unitSide) : ""} · score ${m.score}${m.pageSlug ? " · page " + escapeHtml(m.pageSlug) : ""}</small>
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee">${thumbs}</td>
      </tr>`
    })
    .join("\n")

  const html = `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Revisão de imagens — Selective</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #1a1a1a; }
    h1 { font-size: 1.4rem; }
    .stats { color: #555; margin-bottom: 1.5rem; }
    table { border-collapse: collapse; width: 100%; }
  </style>
</head>
<body>
  <h1>Revisão de imagens do catálogo</h1>
  <p class="stats">${matched.length} com proposta · ${unmatched.length} sem match · ${mapping.length} targets no total</p>
  <p>Abre este ficheiro no browser. Diz ao agente quais linhas corrigir antes de correr <code>process.mjs</code> / <code>upload.mjs</code>.</p>
  <table>
    <thead><tr><th align="left">Target</th><th align="left">Imagens propostas</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  ${
    unmatched.length
      ? `<h2>Sem match</h2><ul>${unmatched
          .map(
            (u) =>
              `<li><code>${escapeHtml(u.slug)}</code> — ${escapeHtml(u.nome)}</li>`,
          )
          .join("")}</ul>`
      : ""
  }
</body>
</html>`

  await writeFile(REVIEW_OUT, html)
  console.log(`Wrote ${path.relative(ROOT, MAPPING_OUT)}`)
  console.log(`Wrote ${path.relative(ROOT, REVIEW_OUT)}`)
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

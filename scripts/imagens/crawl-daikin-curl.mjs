// Crawl Daikin PT product packshots via curl.
//
// Sources:
//   1) Professional catalog: /pt_pt/products/product.html/<SERIES>.html
//   2) Residential marketing pages under product-categories/
//
// Usage:
//   node scripts/imagens/crawl-daikin-curl.mjs
//   node scripts/imagens/crawl-daikin-curl.mjs --csv /path/to/daikin.csv

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync, renameSync, unlinkSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const OUT_DIR = path.join(ROOT, "product-scaffold/crawl-raw")
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json")
const MARCA = "daikin"
const UA =
  "SelectiveImagePipeline/1.0 (+https://selectedistribui.pt; catalog images for official distribution)"
const DELAY_MS = 200
const BASE = "https://www.daikin.pt"

const RESIDENTIAL_SEEDS = [
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-conditioners/stylish.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-conditioners/daikin-emura.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-conditioners/unidade-mural-perfera.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-conditioners/unidade-de-chão-perfera.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-conditioners/unidade-de-ch%C3%A3o-perfera.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-conditioners/sensira.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-conditioners/comfora.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-conditioners/ururu-sarara.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-conditioners/multi-split.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-conditioners/multi-plus-split.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-conditioners/teto-falso.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-purifiers/mc30y.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-purifiers/mc55w.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-purifiers/mc80z.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-purifiers/mck55w.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/air-purifiers/mck70z.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/ventilation-systems/ducobox-energy-comfort.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/ventilation-systems/ducobox-energy-premium.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/ventilation-systems/ducobox-energy-sky.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/emitters/heat-pump-convector.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/heat-pumps/air-to-water-heat-pumps/daikin-altherma-3-m.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/heat-pumps/air-to-water-heat-pumps/daikin-altherma-3-r-f.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/heat-pumps/air-to-water-heat-pumps/daikin-altherma-3-r-w.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/heat-pumps/air-to-water-heat-pumps/daikin-altherma-3-h-ht-f.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/heat-pumps/air-to-water-heat-pumps/daikin-altherma-3-h-ht-w.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/heat-pumps/air-to-water-heat-pumps/daikin-altherma-4-h-f.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/heat-pumps/air-to-water-heat-pumps/daikin-altherma-4-h-w.html",
  "https://www.daikin.pt/pt_pt/particular/products-and-advice/product-categories/heat-pumps/domestic-hot-water-heat-pumps/daikin-altherma-m-hw.html",
]

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function curlText(url) {
  const res = spawnSync(
    "curl",
    ["-sL", "--max-time", "45", "-A", UA, "-w", "\n%{http_code}", url],
    { encoding: "utf8", maxBuffer: 25 * 1024 * 1024 },
  )
  if (res.status !== 0) throw new Error(res.stderr || `curl exit ${res.status}`)
  const out = res.stdout || ""
  const nl = out.lastIndexOf("\n")
  const code = out.slice(nl + 1).trim()
  const body = out.slice(0, nl)
  return { code, body }
}

function curlDownload(url, destPath) {
  const res = spawnSync(
    "curl",
    [
      "-sL",
      "--max-time",
      "60",
      "-A",
      UA,
      "-o",
      destPath,
      "-w",
      "%{http_code}|%{content_type}",
      url,
    ],
    { encoding: "utf8" },
  )
  if (res.status !== 0) throw new Error(res.stderr || `curl exit ${res.status}`)
  const [code, contentType] = (res.stdout || "").split("|")
  if (code !== "200") throw new Error(`HTTP ${code}`)
  return contentType || ""
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return m ? m[1].replace(/\s*[|\-–].*$/, "").trim() : ""
}

function absUrl(src) {
  if (!src) return null
  let s = String(src).replace(/\\\//g, "/").replace(/&amp;/g, "&").trim()
  // Strip trailing JSON/HTML debris pasted onto the URL.
  s = s.replace(/[\\"'].*$/, "").split("?")[0]
  if (s.startsWith("http")) return s
  if (s.startsWith("//")) return `https:${s}`
  if (s.startsWith("/")) return `https://my.daikin.eu${s}`
  // Relative DAM paths embedded in AEM JSON (no leading slash).
  if (s.startsWith("content/dam/")) return `https://my.daikin.eu/${s}`
  return null
}

/** Packshots / product photos only — skip pictograms and icons. */
function extractPackshotUrls(html) {
  const found = []
  const seen = new Set()
  const push = (raw, { allowProductDam = false } = {}) => {
    const src = absUrl(raw)
    if (!src) return
    if (!/\.(jpe?g|png|webp)$/i.test(src) && !/renditions\/cq5dam/i.test(src))
      return
    if (/pictogram|Pictograms|icon|logo|favicon|sprite|thumbnail\.319|swatches\//i.test(src))
      return
    const isPackshot =
      /packshot|Packshot|\/images\/packshots\//i.test(src) ||
      /Pictures\/[^"' ]*Packshots/i.test(src) ||
      /stylish-seiren/i.test(src)
    const isB2cPhoto =
      /content\/dam\/b2c\/shared\/images\/(?:packshots|products|installation-images)\//i.test(
        src,
      )
    const isMdmPicture =
      allowProductDam && /content\/dam\/MDM\/Pictures\//i.test(src)
    if (!isPackshot && !isB2cPhoto && !isMdmPicture) return
    if (seen.has(src)) return
    seen.add(src)
    found.push(src)
  }

  const og = html.match(
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
  )
  if (og) push(og[1], { allowProductDam: true })

  let m
  const re =
    /(?:src|data-src)=["']([^"']+(?:Packshot|packshot|packshots|stylish-seiren)[^"']*)["']/gi
  while ((m = re.exec(html))) push(m[1])

  const re2 =
    /https:\/\/my\.daikin\.eu\/content\/dam\/[^"' ]+(?:Packshot|packshot|packshots|stylish-seiren)[^"' ]+/gi
  while ((m = re2.exec(html))) push(m[0])

  const re3 =
    /https:\/\/my\.daikin\.eu\/content\/dam\/b2c\/shared\/images\/(?:packshots|products|installation-images)\/[^"' ]+\.(?:jpe?g|png|webp)/gi
  while ((m = re3.exec(html))) push(m[0])

  // AEM JSON embeds relative DAM paths (often with \/ escapes) — catch colour
  // packshots that never appear as <img src> (Stylish Seiren DG/DY/DP…).
  const re4 =
    /(?:content\\?\/dam\\?\/b2c\\?\/shared\\?\/images\\?\/(?:packshots|installation-images)\\?\/[^"'\\\s<>]+\.(?:jpe?g|png|webp))/gi
  while ((m = re4.exec(html))) push(m[0])

  return found
}

function seriesCandidatesFromGama(gama) {
  const g = (gama || "").toUpperCase()
  const out = new Set()
  // FTXA-CW/CS/CB | RXA-A8/B/B9 → take left-side series primarily
  const left = g.split("|")[0].split("+")[0]
  const parts = left.split(/[\/,]/).map((s) => s.trim())
  for (let p of parts) {
    p = p.replace(/\s+R-?\d+.*$/i, "").trim()
    p = p.replace(/\(9\)/g, "").replace(/\(\d+\)/g, "")
    p = p.replace(/\s+/g, "")
    if (!/^[A-Z]{2,}[A-Z0-9-]*[A-Z0-9]$/.test(p)) continue
    if (p.length < 4 || p.length > 24) continue
    if (
      [
        "NOVO",
        "CLASSES",
        "MULTI",
        "GAMA",
        "SPLIT",
        "SENSIRA",
        "READ",
        "HEAT",
        "PUMPS",
        "SMART",
        "CHILLER",
        "ONECTA",
        "CYCLE",
        "DUCOBOX",
        "HIDROSPLIT",
        "ASTROPURE",
        "MULTIZONAS",
        "COMPATIBILIDADE",
        "COMANDOS",
        "CONTRAFLUXO",
        "TECNOLOGIA",
        "ROOFTOPS",
        "VENTILO-CONVECTORES",
        "AQUEC",
        "COLETIVO",
        "QUENTE",
        "EXCELENTE",
        "SAZONAL",
        "OXIDATIVAMENTE",
        "REMOVE",
      ].includes(p)
    )
      continue
    out.add(p)
    // Variants: FBA-A9 → FBA-A ; FTXA-CW → FTXA ; EWAT-B-SS → EWAT-B
    const base = p.replace(/-[A-Z]{1,3}$/, "")
    if (base !== p && base.length >= 4) out.add(base)
    const noDigit = p.replace(/\d+$/, "")
    if (noDigit !== p && noDigit.length >= 4) out.add(noDigit)
  }
  return [...out]
}

async function loadSeriesFromCsv(csvPath) {
  const text = await readFile(csvPath, "utf8")
  const lines = text.split(/\r?\n/)
  const header = lines[0].split(",").map((h) => h.replace(/^"|"$/g, ""))
  const gi = header.indexOf("gama")
  const ri = header.indexOf("ref")
  const series = new Set()
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    // rough CSV: use regex for quoted fields — gama is field index
    const cols = []
    let cur = ""
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') inQ = !inQ
      else if (c === "," && !inQ) {
        cols.push(cur)
        cur = ""
      } else cur += c
    }
    cols.push(cur)
    const gama = (cols[gi] || "").replace(/^"|"$/g, "")
    const ref = (cols[ri] || "").replace(/^"|"$/g, "")
    for (const s of seriesCandidatesFromGama(gama)) series.add(s)
    // refs like FTXA20CS → try FTXA
    const m = ref.toUpperCase().match(/^([A-Z]{3,6})/)
    if (m && m[1].length >= 4) series.add(m[1])
  }
  // High-value extras / marketing-name bridges
  for (const s of [
    "FTXA-AW",
    "FTXA-BT",
    "FTXJ-AW",
    "FTXJ-AS",
    "FTXJ-AB",
    "FTXM-A",
    "FTXF-F",
    "FVXM-B",
    "FTXZ-N",
    "FCAG-B",
    "FFA-A9",
    "FBA-A9",
    "FBA-A",
    "FDXM-F9",
    "FVA-A",
    "FHA-A9",
    "FHA-A",
    "FDA125A",
    "FDA-A",
    "ADEA-A",
    "RXM-A",
    "RXM-R",
    "RXA-A",
    "MC30Y",
    "MC55W",
    "MC80Z",
    "MCK55W",
    "MCK70Z",
    "MCK555A",
    "EWAA-DV3P",
    "EWAT-B",
    "EWYT-B",
    "EWYE-CZP",
    "EWAT016CZP",
    "ERA-AV",
    "UATYA-BBAY1",
  ]) {
    series.add(s)
  }
  return [...series].sort()
}

async function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return { images: [], pages: [] }
  return JSON.parse(await readFile(MANIFEST_PATH, "utf8"))
}

async function saveManifest(manifest) {
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

async function crawlPage(pageUrl, pageSlug, manifest, knownSrc) {
  console.log(`page: ${pageSlug}`)
  let html
  let title = ""
  try {
    const { code, body } = curlText(pageUrl)
    if (code !== "200") {
      console.warn(`  HTTP ${code}`)
      return 0
    }
    html = body
    title = extractTitle(html)
    if (/^\s*404\b/i.test(title) || /page not found/i.test(title)) {
      console.warn(`  404 title`)
      return 0
    }
  } catch (err) {
    console.warn(`  falhou: ${err instanceof Error ? err.message : err}`)
    return 0
  }

  const urls = extractPackshotUrls(html)
  let n = 0
  for (const src of urls) {
    if (knownSrc.has(src)) {
      n += 1
      continue
    }
    n += 1
    const tmp = path.join(
      OUT_DIR,
      MARCA,
      pageSlug,
      `${String(n).padStart(2, "0")}.bin`,
    )
    await mkdir(path.dirname(tmp), { recursive: true })
    try {
      const ct = curlDownload(src, tmp)
      let ext = "jpg"
      if (ct.includes("png")) ext = "png"
      else if (ct.includes("webp")) ext = "webp"
      else if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg"
      else {
        const m = src.match(/\.(png|jpe?g|webp)/i)
        if (m) ext = m[1].toLowerCase().replace("jpeg", "jpg")
      }
      const finalPath = tmp.replace(/\.bin$/, `.${ext}`)
      if (finalPath !== tmp) renameSync(tmp, finalPath)
      const buf = await readFile(finalPath)
      if (buf.length < 5000) {
        unlinkSync(finalPath)
        console.warn(`  skip small ${src}`)
        continue
      }
      const rel = path.relative(ROOT, finalPath).split(path.sep).join("/")
      manifest.images.push({
        file: rel,
        marca: MARCA,
        pageUrl,
        pageSlug,
        pageTitle: title,
        alt: "",
        src,
        width: 0,
        height: 0,
        bytes: buf.length,
        sha256: createHash("sha256").update(buf).digest("hex"),
      })
      knownSrc.add(src)
      console.log(`  ✓ ${rel}`)
    } catch (err) {
      console.warn(
        `  download falhou: ${err instanceof Error ? err.message : err}`,
      )
      try {
        if (existsSync(tmp)) unlinkSync(tmp)
      } catch {
        /* ignore */
      }
    }
    await sleep(80)
  }

  manifest.pages.push({
    marca: MARCA,
    pageUrl,
    pageSlug,
    pageTitle: title,
    imageCount: n,
    crawledAt: new Date().toISOString(),
  })
  await saveManifest(manifest)
  return n
}

async function main() {
  const csvPath =
    arg("csv") ||
    path.join(
      process.env.HOME || "",
      "Downloads/daikin-2026-products.csv",
    )

  const series = existsSync(csvPath)
    ? await loadSeriesFromCsv(csvPath)
    : [
        "FCAG-B",
        "FFA-A9",
        "FBA-A9",
        "FDXM-F9",
        "FTXM-A",
        "FTXF-F",
        "FVXM-B",
        "FTXZ-N",
        "MC55W",
      ]

  console.log(`Series candidates: ${series.length}`)

  const pages = []
  for (const s of series) {
    pages.push({
      url: `${BASE}/pt_pt/products/product.html/${encodeURIComponent(s)}.html`,
      slug: slugify(s),
    })
  }
  for (const url of RESIDENTIAL_SEEDS) {
    const parts = new URL(url).pathname.replace(/\/+$/, "").split("/")
    pages.push({
      url,
      slug: slugify(decodeURIComponent(parts[parts.length - 1] || "page")),
    })
  }

  // de-dupe by slug
  const bySlug = new Map()
  for (const p of pages) {
    if (!bySlug.has(p.slug)) bySlug.set(p.slug, p)
  }
  const unique = [...bySlug.values()]
  console.log(`Pages to crawl: ${unique.length}`)

  const manifest = await loadManifest()
  manifest.images = manifest.images.filter((i) => i.marca !== MARCA)
  manifest.pages = manifest.pages.filter((p) => p.marca !== MARCA)
  const knownSrc = new Set(manifest.images.map((i) => i.src))

  let okPages = 0
  let okImages = 0
  for (const p of unique) {
    const before = manifest.images.length
    const n = await crawlPage(p.url, p.slug, manifest, knownSrc)
    if (n > 0) okPages += 1
    okImages += manifest.images.length - before
    await sleep(DELAY_MS)
  }

  await saveManifest(manifest)
  console.log(
    `\nConcluído. ${okImages} imagens novas em ${okPages}/${unique.length} páginas.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

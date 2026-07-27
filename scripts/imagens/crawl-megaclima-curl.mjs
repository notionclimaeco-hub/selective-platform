// Secondary image source: https://www.megaclima.pt/
// Multi-brand PT price lists with packshots named like
//   daikin_mural_sensira_1c.png / mitsubishi_mural_msz_ap_1c.png
//
// Walks category hubs → brand `precario-*` pages for our catalog brands,
// then stores EACH packshot as its own crawl page under the product marca
// (so match.mjs can score it like an official-site page).
//
// Usage:
//   node scripts/imagens/crawl-megaclima-curl.mjs
//   node scripts/imagens/crawl-megaclima-curl.mjs --brand daikin
//
// Output:
//   product-scaffold/crawl-raw/<marca>/<page-slug>/01.png
//   (also tagged source: "megaclima" in the shared manifest)

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync, renameSync, unlinkSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const OUT_DIR = path.join(ROOT, "product-scaffold/crawl-raw")
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json")
const SOURCE = "megaclima"
const BASE = "https://www.megaclima.pt"
const UA =
  "SelectiveImagePipeline/1.0 (+https://selectedistribui.pt; catalog images for official distribution)"
const DELAY_MS = 300

// Category hubs that link to brand price lists (`precario-*?brand=…`).
const HUBS = [
  "https://www.megaclima.pt/ar-condicionado-lisboa/domestico/",
  "https://www.megaclima.pt/ar-condicionado-lisboa/comercial/",
  "https://www.megaclima.pt/ar-condicionado-portugal-continental-ilhas/domestico/",
  "https://www.megaclima.pt/ar-condicionado-portugal-continental-ilhas/ar-condicionado-outras-regioes-comercial/",
  "https://www.megaclima.pt/ventilacao/domestico/",
  "https://www.megaclima.pt/ventilacao/industrial/",
  "https://www.megaclima.pt/ventilacao/acessorios/",
  "https://www.megaclima.pt/cortina-de-ar/ar-standard/",
  "https://www.megaclima.pt/cortina-de-ar/ar-quente-resistencia/",
  "https://www.megaclima.pt/cortina-de-ar/ar-quente-baterias/",
]

// Megaclima brand= query values → our catalog marca slugs.
const BRAND_MAP = {
  "daikin-ar-condicionado": "daikin",
  "daikin-cortina-de-ar": "daikin",
  "mitsubishi-ar-condicionado": "mitsubishi",
  "mitsubishi-cortina-de-ar": "mitsubishi",
  "hisense-ar-condicionado": "hisense",
  "midea-ar-condicionado": "midea",
  "nipon-ar-condicionado": "nipon",
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function curlText(url) {
  const res = spawnSync(
    "curl",
    ["-sL", "--max-time", "45", "-A", UA, url],
    { encoding: "utf8", maxBuffer: 25 * 1024 * 1024 },
  )
  if (res.status !== 0) throw new Error(res.stderr || `curl exit ${res.status}`)
  return res.stdout
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

function absUrl(href) {
  if (!href) return null
  try {
    return new URL(href.replace(/&amp;/g, "&"), BASE).toString()
  } catch {
    return null
  }
}

/** Discover brand price-list pages from a hub. */
function extractPrecarioUrls(html, onlyMarca) {
  const out = new Map() // url → marca
  const re = /href="([^"]*precario[^"]*)"/gi
  let m
  while ((m = re.exec(html))) {
    const url = absUrl(m[1])
    if (!url || !url.includes("brand=")) continue
    let brandParam = ""
    try {
      brandParam = new URL(url).searchParams.get("brand") || ""
    } catch {
      continue
    }
    const marca = BRAND_MAP[brandParam]
    if (!marca) continue
    if (onlyMarca && marca !== onlyMarca) continue
    out.set(url, marca)
  }
  return out
}

/**
 * Packshot URLs on a precario page. Prefer product PNGs under /uploads/,
 * skip logos/icons/thumbs/gifs/chrome.
 */
function extractPackshotUrls(html) {
  const found = []
  const seen = new Set()
  const re =
    /(?:src|data-src)=["']([^"']*\/wp-content\/uploads\/[^"']+\.(?:png|jpe?g|webp))["']/gi
  let m
  while ((m = re.exec(html))) {
    const src = absUrl(m[1].split("?")[0])
    if (!src || seen.has(src)) continue
    const base = src.split("/").pop()?.toLowerCase() ?? ""
    if (
      /logo|icon|favicon|thumb_|_thumb|certific|bastidor|apresentacao|app_final|premio|sub_cat|cookie|banner|resized/i.test(
        base,
      )
    ) {
      continue
    }
    // Product packshots are usually named <brand>_<tipo>_<serie>_….png
    if (
      !/^(daikin|mitsubishi|hisense|midea|nipon|airwell|panasonic|samsung|lg|toshiba|fujitsu|haier)_/i.test(
        base,
      )
    ) {
      continue
    }
    seen.add(src)
    found.push(src)
  }
  return found
}

/**
 * Derive a matchable pageSlug from a Megaclima packshot filename.
 *   daikin_mural_sensira_1c.png → daikin-mural-sensira
 *   mitsubishi_mural_msz_ap_1c.png → mitsubishi-mural-msz-ap
 */
function pageSlugFromSrc(src, marca) {
  const base = (src.split("/").pop() || "pack")
    .replace(/\.(png|jpe?g|webp)$/i, "")
    .toLowerCase()
    .replace(/_(?:1c|2c|3c|full|v\d+)(?:-\d+)?$/g, "")
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
  // Prefer keeping the brand prefix in the slug so ALIASES can target it
  // without colliding with official-site slugs (e.g. comfora-html).
  if (base.startsWith(`${marca}-`)) return base
  return `${marca}-${base}`
}

async function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return { images: [], pages: [] }
  return JSON.parse(await readFile(MANIFEST_PATH, "utf8"))
}

async function saveManifest(manifest) {
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

async function main() {
  const onlyMarca = arg("brand")
  console.log(
    `Megaclima secondary crawl${onlyMarca ? ` (brand=${onlyMarca})` : ""}`,
  )

  const precario = new Map()
  for (const hub of HUBS) {
    console.log(`hub: ${hub}`)
    try {
      const html = curlText(hub)
      const found = extractPrecarioUrls(html, onlyMarca)
      for (const [url, marca] of found) precario.set(url, marca)
      console.log(`  → ${found.size} precario links (${precario.size} total)`)
    } catch (err) {
      console.warn(`  falhou: ${err instanceof Error ? err.message : err}`)
    }
    await sleep(DELAY_MS)
  }

  const pages = [...precario.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  console.log(`\nTotal precario pages: ${pages.length}`)

  const manifest = await loadManifest()
  // Drop previous megaclima-sourced entries (idempotent re-crawl). Keep
  // official-site images for the same marcas.
  const keepImage = (i) => i.source !== SOURCE
  const keepPage = (p) => p.source !== SOURCE
  manifest.images = (manifest.images ?? []).filter(keepImage)
  manifest.pages = (manifest.pages ?? []).filter(keepPage)
  const knownSrc = new Set(manifest.images.map((i) => i.src))

  let okPages = 0
  let okImages = 0

  for (const [pageUrl, marca] of pages) {
    console.log(`page: ${marca} ← ${pageUrl}`)
    let html
    try {
      html = curlText(pageUrl)
    } catch (err) {
      console.warn(`  falhou: ${err instanceof Error ? err.message : err}`)
      await sleep(DELAY_MS)
      continue
    }

    const urls = extractPackshotUrls(html)
    if (urls.length === 0) {
      console.log("  (sem packshots)")
      await sleep(DELAY_MS)
      continue
    }

    for (const src of urls) {
      if (knownSrc.has(src)) continue
      const pageSlug = pageSlugFromSrc(src, marca)
      const tmp = path.join(
        OUT_DIR,
        marca,
        pageSlug,
        "01.bin",
      )
      await mkdir(path.dirname(tmp), { recursive: true })
      try {
        const ct = curlDownload(src, tmp)
        let ext = "bin"
        if (ct.includes("png")) ext = "png"
        else if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg"
        else if (ct.includes("webp")) ext = "webp"
        else {
          const m = src.match(/\.(png|jpe?g|webp)$/i)
          if (m) ext = m[1].toLowerCase().replace("jpeg", "jpg")
        }
        const finalPath = tmp.replace(/\.bin$/, `.${ext}`)
        if (finalPath !== tmp) renameSync(tmp, finalPath)
        const buf = await readFile(finalPath)
        const rel = path.relative(ROOT, finalPath).split(path.sep).join("/")
        manifest.images.push({
          file: rel,
          marca,
          source: SOURCE,
          pageUrl,
          pageSlug,
          pageTitle: `Megaclima · ${pageSlug}`,
          alt: pageSlug,
          src,
          width: 0,
          height: 0,
          bytes: buf.length,
          sha256: createHash("sha256").update(buf).digest("hex"),
        })
        manifest.pages.push({
          marca,
          source: SOURCE,
          pageUrl,
          pageSlug,
          pageTitle: `Megaclima · ${pageSlug}`,
          imageCount: 1,
          crawledAt: new Date().toISOString(),
        })
        knownSrc.add(src)
        okImages += 1
        okPages += 1
        console.log(`  ✓ ${rel}`)
      } catch (err) {
        console.warn(
          `  download falhou ${src}: ${err instanceof Error ? err.message : err}`,
        )
        try {
          if (existsSync(tmp)) unlinkSync(tmp)
        } catch {
          /* ignore */
        }
      }
      await sleep(80)
    }

    await saveManifest(manifest)
    await sleep(DELAY_MS)
  }

  await saveManifest(manifest)
  console.log(
    `\nConcluído. ${okImages} imagens Megaclima em ${okPages} páginas virtuais.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

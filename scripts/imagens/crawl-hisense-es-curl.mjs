// Official Hisense Iberia site (Spain): https://www.hisense.es/
// Same WordPress template as hisense.pt but with the full commercial catalogue
// under the current refs (turbo-inverter / super-inverter series, dedicated
// outdoor-unit pages, Multifunción II, Hi-Water heat pumps). Product galleries
// are the `<img class="change">` strip plus `og:image`.
//
// Usage:
//   node scripts/imagens/crawl-hisense-es-curl.mjs
//   node scripts/imagens/crawl-hisense-es-curl.mjs --only heat-pump   # URL substring
//
// Output:
//   product-scaffold/crawl-raw/hisense/es-<page-slug>/NN.png
//   product-scaffold/crawl-raw/manifest-hisense-es.json

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync, renameSync, unlinkSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const OUT_DIR = path.join(ROOT, "product-scaffold/crawl-raw")
const MANIFEST_PATH = path.join(OUT_DIR, "manifest-hisense-es.json")
const MARCA = "hisense"
const SOURCE = "hisense-es"
const BASE = "https://www.hisense.es"
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
const DELAY_MS = 350

// URL families that are climate products.
const FAMILIES = [
  "/aire-acondicionado-comercial/",
  "/aire-acondicionado-domestico/split/",
  "/aire-acondicionado-domestico/multis/",
  "/aire-acondicionado-domestico/portatil/",
]

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function curlText(url) {
  const res = spawnSync("curl", ["-sL", "--max-time", "45", "-A", UA, url], {
    encoding: "utf8",
    maxBuffer: 25 * 1024 * 1024,
  })
  if (res.status !== 0) throw new Error(res.stderr || `curl exit ${res.status}`)
  return res.stdout
}

function curlDownload(url, destPath) {
  const res = spawnSync(
    "curl",
    ["-sL", "--max-time", "60", "-A", UA, "-o", destPath, "-w", "%{http_code}|%{content_type}", url],
    { encoding: "utf8" },
  )
  if (res.status !== 0) throw new Error(res.stderr || `curl exit ${res.status}`)
  const [code, contentType] = (res.stdout || "").split("|")
  if (code !== "200") throw new Error(`HTTP ${code}`)
  return contentType || ""
}

/** Product URLs from the WP sitemap, limited to the climate families. */
function listProductUrls() {
  const index = curlText(`${BASE}/wp-sitemap.xml`)
  const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => /posts-(post|page)-/.test(u))
  const urls = new Set()
  for (const m of maps) {
    for (const [, u] of curlText(m).matchAll(/<loc>([^<]+)<\/loc>/g)) {
      if (FAMILIES.some((f) => u.includes(f))) urls.add(u)
    }
  }
  return [...urls].sort()
}

/** Gallery images: og:image + `class="change"` strip; size suffix stripped. */
function extractGallery(html) {
  const urls = []
  const og = html.match(/property="og:image" content="([^"]+)"/)
  if (og) urls.push(og[1])
  for (const m of html.matchAll(/<img[^>]+class="[^"]*\bchange\b[^"]*"[^>]*>/g)) {
    const src = m[0].match(/(?:data-src|src)="([^"]+)"/)
    if (src) urls.push(src[1])
  }
  const clean = urls
    .map((u) => u.replace(/-\d{2,4}x\d{2,4}(\.[a-z]+)$/i, "$1"))
    .filter((u) => /\/wp-content\/uploads\//.test(u) && !/\.svg$/i.test(u))
  return [...new Set(clean)]
}

function pageTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/)
  return m ? m[1].replace(/\s+/g, " ").trim() : ""
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
  const only = arg("only")
  let urls = listProductUrls()
  if (only) urls = urls.filter((u) => u.includes(only))
  console.log(`${urls.length} páginas de produto em hisense.es`)
  const manifest = await loadManifest()
  const done = new Set(manifest.pages.map((p) => p.pageUrl))
  let okImages = 0

  for (const pageUrl of urls) {
    if (done.has(pageUrl) && !process.argv.includes("--force")) continue
    const pageSlug = "es-" + pageUrl.replace(/\/$/, "").split("/").pop().replace(/^aire-acondicionado-/, "")
    let html
    try {
      html = curlText(pageUrl)
    } catch (err) {
      console.warn(`falhou ${pageUrl}: ${err instanceof Error ? err.message : err}`)
      continue
    }
    const gallery = extractGallery(html)
    const title = pageTitle(html)
    console.log(`page: ${pageSlug} (${gallery.length}) ← ${title}`)
    let n = 0
    for (const src of gallery) {
      n += 1
      const tmp = path.join(OUT_DIR, MARCA, pageSlug, `${String(n).padStart(2, "0")}.bin`)
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
          file: rel, marca: MARCA, source: SOURCE, pageUrl, pageSlug, pageTitle: title, alt: title, src,
          width: 0, height: 0, bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex"),
        })
        okImages += 1
      } catch (err) {
        console.warn(`  download falhou ${src}: ${err instanceof Error ? err.message : err}`)
        try {
          if (existsSync(tmp)) unlinkSync(tmp)
        } catch {
          /* ignore */
        }
      }
      await sleep(60)
    }
    manifest.pages.push({ marca: MARCA, source: SOURCE, pageUrl, pageSlug, pageTitle: title, imageCount: gallery.length, crawledAt: new Date().toISOString() })
    await saveManifest(manifest)
    await sleep(DELAY_MS)
  }
  await saveManifest(manifest)
  console.log(`\nConcluído. ${okImages} imagens → ${path.relative(ROOT, MANIFEST_PATH)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

// Official Hisense HVAC site (pro ranges): https://www.hisensehvac.com/
// hisense.pt only lists residential/commercial splits; VRF, Hi-Therma (ATW),
// DHW, chillers and heat-recovery ventilators live here. Each category node
// lists series cards → `/details/index.aspx?nodeid=N`, and each detail page
// has a `.scrolBox` gallery of packshots (the `.banTop` hero is lifestyle).
//
// Usage:
//   node scripts/imagens/crawl-hisense-hvac-curl.mjs            # all nodes
//   node scripts/imagens/crawl-hisense-hvac-curl.mjs --only 1180 # one category
//
// Output:
//   product-scaffold/crawl-raw/hisense/hvac-<series-slug>/NN.png
//   product-scaffold/crawl-raw/manifest-hisense-hvac.json (own manifest: the
//   Playwright crawl may be writing the shared one at the same time)

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync, renameSync, unlinkSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const OUT_DIR = path.join(ROOT, "product-scaffold/crawl-raw")
const MANIFEST_PATH = path.join(OUT_DIR, "manifest-hisense-hvac.json")
const MARCA = "hisense"
const SOURCE = "hisensehvac"
const BASE = "https://www.hisensehvac.com"
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SelectiveImagePipeline/1.0"
const DELAY_MS = 400

// Category nodes: Ductless split, Ducted split, Heat pump (ATW/DHW), Chiller, VRF, Others.
const CATEGORY_NODES = [1168, 1178, 1180, 1272, 1357, 1363]

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

function slug(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Series cards on a category page: [{ section, name, nodeid, thumb }]. */
function extractSeries(html) {
  const out = []
  const boxRe = /<div class="lisBox" id="([^"]*)">([\s\S]*?)<\/ul><\/div>/g
  let box
  while ((box = boxRe.exec(html))) {
    const section = box[1].trim()
    const liRe =
      /<li>\s*<div class="img"><img src="([^"]+)"\s*\/?><\/div>\s*<p>([\s\S]*?)<\/p>\s*<a href="\/details\/index\.aspx\?nodeid=(\d+)"/g
    let li
    while ((li = liRe.exec(box[2]))) {
      const name = li[2].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
      out.push({ section, name, nodeid: li[3], thumb: li[1] })
    }
  }
  return out
}

/** Gallery packshots of a detail page (the `.scrolBox` strip). */
function extractGallery(html) {
  const m = html.match(/<div class="scrolBox">([\s\S]*?)<\/div>/)
  if (!m) return []
  const urls = []
  const re = /<img src="([^"]+)"/g
  let im
  while ((im = re.exec(m[1]))) {
    if (/\/upload\//.test(im[1])) urls.push(new URL(im[1], BASE).toString())
  }
  return [...new Set(urls)]
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
  const nodes = only ? [Number(only)] : CATEGORY_NODES
  const manifest = await loadManifest()
  const knownSrc = new Set(manifest.images.map((i) => i.src))
  let okImages = 0
  let okPages = 0

  for (const node of nodes) {
    const catUrl = `${BASE}/products/index.aspx?nodeid=${node}`
    console.log(`category: ${catUrl}`)
    let series
    try {
      series = extractSeries(curlText(catUrl))
    } catch (err) {
      console.warn(`  falhou: ${err instanceof Error ? err.message : err}`)
      continue
    }
    console.log(`  → ${series.length} séries`)
    await sleep(DELAY_MS)

    for (const s of series) {
      const pageUrl = `${BASE}/details/index.aspx?nodeid=${s.nodeid}`
      const pageSlug = `hvac-${slug(s.name)}`
      const pageTitle = `${s.section} · ${s.name}`
      console.log(`  page: ${pageTitle} ← ${pageUrl}`)
      let urls
      try {
        urls = extractGallery(curlText(pageUrl))
      } catch (err) {
        console.warn(`    falhou: ${err instanceof Error ? err.message : err}`)
        await sleep(DELAY_MS)
        continue
      }
      // The card thumbnail is the canonical packshot; keep it first.
      urls = [new URL(s.thumb, BASE).toString(), ...urls.filter((u) => !u.endsWith(s.thumb))]
      let n = 0
      for (const src of urls) {
        if (knownSrc.has(src)) continue
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
            file: rel,
            marca: MARCA,
            source: SOURCE,
            pageUrl,
            pageSlug,
            pageTitle,
            alt: s.name,
            src,
            width: 0,
            height: 0,
            bytes: buf.length,
            sha256: createHash("sha256").update(buf).digest("hex"),
          })
          knownSrc.add(src)
          okImages += 1
          console.log(`    ✓ ${rel}`)
        } catch (err) {
          console.warn(`    download falhou ${src}: ${err instanceof Error ? err.message : err}`)
          try {
            if (existsSync(tmp)) unlinkSync(tmp)
          } catch {
            /* ignore */
          }
        }
        await sleep(80)
      }
      manifest.pages = manifest.pages.filter((p) => p.pageUrl !== pageUrl)
      manifest.pages.push({
        marca: MARCA,
        source: SOURCE,
        pageUrl,
        pageSlug,
        pageTitle,
        imageCount: urls.length,
        crawledAt: new Date().toISOString(),
      })
      okPages += 1
      await saveManifest(manifest)
      await sleep(DELAY_MS)
    }
  }

  await saveManifest(manifest)
  console.log(`\nConcluído. ${okImages} imagens em ${okPages} páginas → ${path.relative(ROOT, MANIFEST_PATH)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

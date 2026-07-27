// Fast Mitsubishi image crawler via curl (Node TLS can't verify their leaf cert).
//
// Usage:
//   node scripts/imagens/crawl-mitsubishi-curl.mjs

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const OUT_DIR = path.join(ROOT, "product-scaffold/crawl-raw")
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json")
const CONFIG_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "crawl.config.json",
)

const UA =
  "SelectiveImagePipeline/1.0 (+https://selectedistribui.pt; catalog images for official distribution)"
const DELAY_MS = 250

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function slugFromUrl(url) {
  const u = new URL(url)
  const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean)
  return (parts[parts.length - 1] || "index")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function curlText(url) {
  const res = spawnSync(
    "curl",
    ["-sL", "--max-time", "45", "-A", UA, url],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  )
  if (res.status !== 0) {
    throw new Error(res.stderr || `curl exit ${res.status}`)
  }
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
  if (res.status !== 0) {
    throw new Error(res.stderr || `curl exit ${res.status}`)
  }
  const [code, contentType] = (res.stdout || "").split("|")
  if (code !== "200") throw new Error(`HTTP ${code}`)
  return contentType || ""
}

function normalizeImageUrl(src, base) {
  let abs
  try {
    abs = new URL(src, base).toString()
  } catch {
    return null
  }
  try {
    const u = new URL(abs)
    const m = u.pathname.match(/^(.+\.(?:png|jpe?g|webp|gif))(?:\/[^/]+)?$/i)
    if (!m) return null
    u.pathname = m[1]
    u.search = ""
    u.hash = ""
    return u.toString()
  } catch {
    return null
  }
}

function looksLikeProductImage(src, cfg) {
  if (!src) return false
  const lower = src.toLowerCase()
  if (!/\.(png|jpe?g|webp|gif)$/i.test(lower)) return false
  if (!lower.includes("/documents/")) return false
  for (const excl of cfg.imageUrlExcludes ?? []) {
    if (lower.includes(excl.toLowerCase())) return false
  }
  return true
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return m ? m[1].trim() : ""
}

function extractImageUrls(html, pageUrl, cfg) {
  const found = new Set()
  const re =
    /(?:src|data-src|good-src|content)\s*=\s*["']([^"']*\/documents\/[^"']+)["']/gi
  let m
  while ((m = re.exec(html))) {
    const norm = normalizeImageUrl(m[1], pageUrl)
    if (norm && looksLikeProductImage(norm, cfg)) found.add(norm)
  }
  const re2 =
    /["'](\/documents\/[^"']+\.(?:png|jpe?g|webp|gif)(?:\/[^"']*)?)["']/gi
  while ((m = re2.exec(html))) {
    const norm = normalizeImageUrl(m[1], pageUrl)
    if (norm && looksLikeProductImage(norm, cfg)) found.add(norm)
  }
  return [...found]
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
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"))
  const brandCfg = config.brands.mitsubishi
  if (!brandCfg) throw new Error("mitsubishi missing from crawl.config.json")

  const pattern = new RegExp(brandCfg.productLinkPattern)
  const productUrls = new Set()

  for (const seed of brandCfg.seeds) {
    if (pattern.test(seed)) productUrls.add(seed.replace(/\/+$/, ""))
  }

  for (const seed of brandCfg.seeds) {
    console.log(`seed: ${seed}`)
    try {
      const html = curlText(seed)
      const hrefRe = /href\s*=\s*["']([^"']+)["']/gi
      let m
      while ((m = hrefRe.exec(html))) {
        try {
          const abs = new URL(m[1], seed)
          abs.hash = ""
          const clean = abs.origin + abs.pathname.replace(/\/+$/, "")
          if (pattern.test(clean)) productUrls.add(clean)
        } catch {
          /* ignore */
        }
      }
      console.log(`  ok (${productUrls.size} product urls so far)`)
    } catch (err) {
      console.warn(`  falhou: ${err instanceof Error ? err.message : err}`)
    }
    await sleep(DELAY_MS)
  }

  const pages = [...productUrls].sort()
  console.log(`\nTotal product pages: ${pages.length}`)

  const manifest = await loadManifest()
  manifest.images = manifest.images.filter((i) => i.marca !== "mitsubishi")
  manifest.pages = manifest.pages.filter((p) => p.marca !== "mitsubishi")
  const knownSrc = new Set(manifest.images.map((i) => i.src))

  let okPages = 0
  let okImages = 0

  for (const pageUrl of pages) {
    const pageSlug = slugFromUrl(pageUrl)
    console.log(`page: ${pageSlug}`)
    let html
    let title = ""
    try {
      html = curlText(pageUrl)
      title = extractTitle(html)
    } catch (err) {
      console.warn(`  falhou: ${err instanceof Error ? err.message : err}`)
      await sleep(DELAY_MS)
      continue
    }

    const urls = extractImageUrls(html, pageUrl, brandCfg)
    let n = 0
    for (const src of urls) {
      if (knownSrc.has(src)) continue
      n += 1
      const tmp = path.join(
        OUT_DIR,
        "mitsubishi",
        pageSlug,
        `${String(n).padStart(2, "0")}.bin`,
      )
      await mkdir(path.dirname(tmp), { recursive: true })
      try {
        const ct = curlDownload(src, tmp)
        let ext = "bin"
        if (ct.includes("png")) ext = "png"
        else if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg"
        else if (ct.includes("webp")) ext = "webp"
        else {
          const m = src.match(/\.(png|jpe?g|webp|gif)$/i)
          if (m) ext = m[1].toLowerCase().replace("jpeg", "jpg")
        }
        const finalPath = tmp.replace(/\.bin$/, `.${ext}`)
        if (finalPath !== tmp) {
          const { renameSync } = await import("node:fs")
          renameSync(tmp, finalPath)
        }
        const buf = await readFile(finalPath)
        const rel = path.relative(ROOT, finalPath).split(path.sep).join("/")
        manifest.images.push({
          file: rel,
          marca: "mitsubishi",
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
        okImages += 1
        console.log(`  ✓ ${rel}`)
      } catch (err) {
        console.warn(
          `  download falhou ${src}: ${err instanceof Error ? err.message : err}`,
        )
        try {
          const { unlinkSync } = await import("node:fs")
          if (existsSync(tmp)) unlinkSync(tmp)
        } catch {
          /* ignore */
        }
      }
      await sleep(80)
    }

    manifest.pages.push({
      marca: "mitsubishi",
      pageUrl,
      pageSlug,
      pageTitle: title,
      imageCount: n,
      crawledAt: new Date().toISOString(),
    })
    if (n > 0) okPages += 1
    await saveManifest(manifest)
    await sleep(DELAY_MS)
  }

  await saveManifest(manifest)
  console.log(
    `\nConcluído. ${okImages} imagens em ${okPages}/${pages.length} páginas.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

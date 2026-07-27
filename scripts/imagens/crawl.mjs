// Crawl official brand websites for product photos.
//
// Usage:
//   node scripts/imagens/crawl.mjs
//   node scripts/imagens/crawl.mjs --brand nipon
//
// Output:
//   product-scaffold/crawl-raw/<marca>/<page-slug>/<n>.<ext>
//   product-scaffold/crawl-raw/manifest.json

import { chromium } from "playwright"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const OUT_DIR = path.join(ROOT, "product-scaffold/crawl-raw")
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json")
const CONFIG_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "crawl.config.json",
)

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function slugFromUrl(url) {
  try {
    const u = new URL(url)
    const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean)
    return (parts[parts.length - 1] || "index")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
  } catch {
    return "unknown"
  }
}

function extFromContentType(ct, url) {
  const type = (ct || "").split(";")[0].trim().toLowerCase()
  if (type === "image/png") return "png"
  if (type === "image/jpeg" || type === "image/jpg") return "jpg"
  if (type === "image/webp") return "webp"
  if (type === "image/gif") return "gif"
  const m = url.match(/\.(png|jpe?g|webp|gif)(?:\?|$)/i)
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "bin"
}

// Liferay (Mitsubishi) appends /<uuid>?t=… after the real file extension.
// Strip that so fetch hits the downloadable asset path.
function normalizeImageUrl(src) {
  if (!src) return src
  try {
    const u = new URL(src)
    const m = u.pathname.match(
      /^(.+\.(?:png|jpe?g|webp|gif))(?:\/[^/]+)?$/i,
    )
    if (m) {
      u.pathname = m[1]
      u.search = ""
      u.hash = ""
      return u.toString()
    }
  } catch {
    /* keep original */
  }
  return src.split("?")[0]
}

function looksLikeProductImage(src, cfg) {
  if (!src || src.startsWith("data:")) return false
  const normalized = normalizeImageUrl(src)
  const lower = normalized.toLowerCase()
  // Skip Liferay friendly URLs without a file extension (e.g. /documents/d/guest/…).
  if (!/\.(png|jpe?g|webp|gif)$/i.test(lower)) return false
  for (const excl of cfg.imageUrlExcludes ?? []) {
    if (lower.includes(excl.toLowerCase())) return false
  }
  const includes = cfg.imageUrlIncludes ?? []
  if (includes.length > 0) {
    return includes.some((inc) => lower.includes(inc.toLowerCase()))
  }
  return true
}

async function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return { images: [], pages: [] }
  return JSON.parse(await readFile(MANIFEST_PATH, "utf8"))
}

async function saveManifest(manifest) {
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

async function dismissCookies(page) {
  for (const name of [/Aceitar/i, /Concordo/i, /Accept/i, /Fechar/i]) {
    try {
      await page.getByRole("button", { name }).click({ timeout: 1500 })
      return
    } catch {
      /* try next */
    }
  }
}

async function collectProductLinks(page, seedUrl, brandCfg) {
  await page.goto(seedUrl, { waitUntil: "domcontentloaded", timeout: 60000 })
  await dismissCookies(page)
  await sleep(500)
  const pattern = new RegExp(brandCfg.productLinkPattern)
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.href))
  const out = []
  for (const href of hrefs) {
    if (!pattern.test(href)) continue
    // Skip pure category seeds (exactly 2 path segments after /produtos/)
    try {
      const u = new URL(href)
      if (u.hash) continue
      out.push(u.origin + u.pathname.replace(/\/+$/, ""))
    } catch {
      /* ignore */
    }
  }
  return [...new Set(out)]
}

async function collectImagesOnPage(page, pageUrl, brandCfg, globalCfg) {
  // domcontentloaded: Hisense keeps long-polling analytics that never reach
  // networkidle, which would hang the crawl.
  await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 })
  await dismissCookies(page)
  await sleep(800)
  const title = await page.title()
  // Prefer high-res gallery sources (Hisense uses good-src on thumbnails)
  // and fall back to the rendered src.
  const imgs = await page.$$eval("img", (nodes) =>
    nodes.map((img) => ({
      src:
        img.getAttribute("good-src") ||
        img.getAttribute("data-src") ||
        img.currentSrc ||
        img.src ||
        "",
      alt: img.alt || "",
      width: img.naturalWidth || 0,
      height: img.naturalHeight || 0,
    })),
  )
  // Also pick up Open Graph cover when the gallery is lazy/empty.
  const ogImage = await page
    .$eval('meta[property="og:image"]', (el) => el.content || "")
    .catch(() => "")
  if (ogImage) {
    imgs.unshift({ src: ogImage, alt: title, width: 0, height: 0 })
  }
  const candidates = []
  const seen = new Set()
  for (const img of imgs) {
    if (!looksLikeProductImage(img.src, brandCfg)) continue
    if (
      img.width > 0 &&
      (img.width < globalCfg.minWidth || img.height < globalCfg.minHeight)
    ) {
      continue
    }
    // Prefer higher-res variants when the site serves /pic/WxH/ (download
    // falls back to the original if the upsized URL 404s).
    let src = normalizeImageUrl(img.src)
    let srcFallback = null
    if (/\/pic\/\d+x\d+\//.test(src)) {
      srcFallback = src
      src = src.replace(/\/pic\/\d+x\d+\//, "/pic/1500x1500/")
    }
    // Drop WordPress size suffixes so we fetch the original asset.
    if (/-\d+x\d+\.(jpe?g|png|webp)$/i.test(src)) {
      srcFallback = src
      src = src.replace(/-\d+x\d+(\.(jpe?g|png|webp))$/i, "$1")
    }
    if (seen.has(src) || (srcFallback && seen.has(srcFallback))) continue
    seen.add(src)
    if (srcFallback) seen.add(srcFallback)
    candidates.push({
      src,
      srcFallback,
      alt: img.alt,
      width: img.width,
      height: img.height,
    })
  }
  return { title, candidates }
}

async function downloadImage(src, destPath, userAgent) {
  const res = await fetch(src, {
    headers: { "User-Agent": userAgent, Accept: "image/*" },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const ext = extFromContentType(res.headers.get("content-type"), src)
  const finalPath = destPath.replace(/\.bin$/, `.${ext}`)
  await mkdir(path.dirname(finalPath), { recursive: true })
  await writeFile(finalPath, buf)
  return {
    file: finalPath,
    bytes: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex"),
    contentType: res.headers.get("content-type"),
  }
}

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"))
  const onlyBrand = arg("brand")
  const brands = Object.entries(config.brands).filter(
    ([name]) => !onlyBrand || name === onlyBrand,
  )
  if (brands.length === 0) {
    throw new Error(`Marca desconhecida: ${onlyBrand}`)
  }

  await mkdir(OUT_DIR, { recursive: true })
  const manifest = await loadManifest()
  const knownSrc = new Set(manifest.images.map((i) => i.src))
  const knownPages = new Set(manifest.pages.map((p) => p.pageUrl))

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: config.userAgent,
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  try {
    for (const [marca, brandCfg] of brands) {
      console.log(`\n== ${marca} ==`)
      const productUrls = new Set()
      for (const seed of brandCfg.seeds) {
        console.log(`  seed: ${seed}`)
        try {
          const links = await collectProductLinks(page, seed, brandCfg)
          for (const l of links) productUrls.add(l)
          console.log(`    → ${links.length} product links`)
        } catch (err) {
          console.warn(
            `    seed falhou: ${err instanceof Error ? err.message : err}`,
          )
        }
        await sleep(config.delayMs)
      }

      // Also allow seeding product pages directly in seeds that already match.
      for (const seed of brandCfg.seeds) {
        if (new RegExp(brandCfg.productLinkPattern).test(seed)) {
          productUrls.add(seed.replace(/\/+$/, ""))
        }
      }

      console.log(`  total product pages: ${productUrls.size}`)

      for (const pageUrl of [...productUrls].sort()) {
        if (knownPages.has(pageUrl) && !process.argv.includes("--force")) {
          console.log(`  skip (já visitada): ${pageUrl}`)
          continue
        }

        console.log(`  page: ${pageUrl}`)
        let title = ""
        let candidates = []
        try {
          ;({ title, candidates } = await collectImagesOnPage(
            page,
            pageUrl,
            brandCfg,
            config,
          ))
        } catch (err) {
          console.warn(
            `    falhou: ${err instanceof Error ? err.message : err}`,
          )
          await sleep(config.delayMs)
          continue
        }

        const pageSlug = slugFromUrl(pageUrl)
        let n = 0
        for (const cand of candidates) {
          if (knownSrc.has(cand.src) && !process.argv.includes("--force")) {
            continue
          }
          n += 1
          const dest = path.join(
            OUT_DIR,
            marca,
            pageSlug,
            `${String(n).padStart(2, "0")}.bin`,
          )
          try {
            let saved
            let usedSrc = cand.src
            try {
              saved = await downloadImage(cand.src, dest, config.userAgent)
            } catch (err) {
              if (!cand.srcFallback) throw err
              usedSrc = cand.srcFallback
              saved = await downloadImage(
                cand.srcFallback,
                dest,
                config.userAgent,
              )
            }
            const rel = path.relative(ROOT, saved.file).split(path.sep).join("/")
            const entry = {
              file: rel,
              marca,
              pageUrl,
              pageSlug,
              pageTitle: title,
              alt: cand.alt,
              src: usedSrc,
              width: cand.width,
              height: cand.height,
              bytes: saved.bytes,
              sha256: saved.sha256,
            }
            manifest.images.push(entry)
            knownSrc.add(cand.src)
            if (cand.srcFallback) knownSrc.add(cand.srcFallback)
            console.log(`    ✓ ${rel} (${cand.width}x${cand.height})`)
          } catch (err) {
            console.warn(
              `    download falhou ${cand.src}: ${err instanceof Error ? err.message : err}`,
            )
          }
          await sleep(Math.min(400, config.delayMs))
        }

        manifest.pages = manifest.pages.filter((p) => p.pageUrl !== pageUrl)
        manifest.pages.push({
          marca,
          pageUrl,
          pageSlug,
          pageTitle: title,
          imageCount: candidates.length,
          crawledAt: new Date().toISOString(),
        })
        knownPages.add(pageUrl)
        await saveManifest(manifest)
        await sleep(config.delayMs)
      }
    }
  } finally {
    await browser.close()
  }

  await saveManifest(manifest)
  console.log(
    `\nConcluído. ${manifest.images.length} imagens · ${manifest.pages.length} páginas.`,
  )
  console.log(`Manifest: ${path.relative(ROOT, MANIFEST_PATH)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

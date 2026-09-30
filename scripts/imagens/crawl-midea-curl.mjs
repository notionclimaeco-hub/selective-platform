// Crawl product gallery images from https://www.sgtmidea.com/ (WooCommerce).
// Uses curl + gallery-block extraction so related-product thumbs are ignored.
//
// Usage:
//   node scripts/imagens/crawl-midea-curl.mjs

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync, renameSync, unlinkSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const OUT_DIR = path.join(ROOT, "product-scaffold/crawl-raw")
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json")
const MARCA = "midea"
const UA =
  "SelectiveImagePipeline/1.0 (+https://selectedistribui.pt; catalog images for official distribution)"
const DELAY_MS = 250

const SEEDS = [
  "https://www.sgtmidea.com/categoria-produto/split/",
  "https://www.sgtmidea.com/categoria-produto/gama-domestica/",
  "https://www.sgtmidea.com/categoria-produto/gama-comercial/",
  "https://www.sgtmidea.com/categoria-produto/m-thermal/",
  "https://www.sgtmidea.com/categoria-produto/bombas-de-calor/",
  "https://www.sgtmidea.com/categoria-produto/chillers/",
  "https://www.sgtmidea.com/categoria-produto/ventiloconvectores/",
  "https://www.sgtmidea.com/categoria-produto/gama-industrial-vfr-2/",
  "https://www.sgtmidea.com/categoria-produto/gama-industrial-vfr-2/mini-vrf/",
  "https://www.sgtmidea.com/categoria-produto/gama-industrial-vfr-2/unidades-exteriores/",
  "https://www.sgtmidea.com/categoria-produto/gama-industrial-vfr-2/unidades-interiores/",
]

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function slugFromUrl(url) {
  const u = new URL(url)
  const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean)
  return decodeURIComponent(parts[parts.length - 1] || "index")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
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

function stripWpSize(url) {
  return url.replace(/-\d+x\d+(\.(?:png|jpe?g|webp))$/i, "$1").split("?")[0]
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return m ? m[1].replace(/\s*[|\-–].*$/, "").trim() : ""
}

function extractProductUrls(html) {
  const out = new Set()
  const re = /href="(https:\/\/www\.sgtmidea\.com\/produto\/[^"#]+)"/gi
  let m
  while ((m = re.exec(html))) {
    out.add(m[1].replace(/\/+$/, "") + "/")
  }
  return [...out]
}

/** Prefer WooCommerce gallery + og:image; skip related-product chrome. */
function extractGalleryUrls(html) {
  const found = []
  const seen = new Set()

  const push = (raw) => {
    if (!raw || !raw.includes("/wp-content/uploads/")) return
    if (/favicon|mail-footer|logo|icon-page|sprite|avatar/i.test(raw)) return
    // Banner strip shared across pages
    if (/\/uploads\/2021\/01\/11(?:-\d+x\d+)?\.png/i.test(raw)) return
    const src = stripWpSize(raw)
    if (!/\.(png|jpe?g|webp)$/i.test(src)) return
    if (seen.has(src)) return
    seen.add(src)
    found.push(src)
  }

  const og = html.match(
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
  )
  if (og) push(og[1])

  const gallery = html.match(
    /woocommerce-product-gallery[\s\S]{0,12000}?<\/div>\s*<\/div>/i,
  )
  if (gallery) {
    const re =
      /(?:src|data-src|data-large_image|data-srcset)=["']([^"']+)["']/gi
    let m
    while ((m = re.exec(gallery[0]))) {
      // data-srcset may list many; take first URL token
      const first = m[1].split(",")[0].trim().split(/\s+/)[0]
      push(first)
    }
  }

  // Fallback: any MIDEA@FT_* product_ originals on the page
  if (found.length === 0) {
    const re =
      /https:\/\/www\.sgtmidea\.com\/wp-content\/uploads\/[^"' ]+product[^"' ]*\.(?:png|jpe?g|webp)/gi
    let m
    while ((m = re.exec(html))) push(m[0])
  }

  return found
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
  const productUrls = new Set()
  for (const seed of SEEDS) {
    console.log(`seed: ${seed}`)
    try {
      const html = curlText(seed)
      const links = extractProductUrls(html)
      for (const l of links) productUrls.add(l)
      console.log(`  → ${links.length} product links (${productUrls.size} total)`)
    } catch (err) {
      console.warn(`  falhou: ${err instanceof Error ? err.message : err}`)
    }
    await sleep(DELAY_MS)
  }

  const pages = [...productUrls].sort()
  console.log(`\nTotal product pages: ${pages.length}`)

  const manifest = await loadManifest()
  manifest.images = manifest.images.filter((i) => i.marca !== MARCA)
  manifest.pages = manifest.pages.filter((p) => p.marca !== MARCA)
  const knownSrc = new Set(manifest.images.map((i) => i.src))

  let okPages = 0
  let okImages = 0

  // "tecto-chão" (acento combinado no URL) e "tecto-chao" são páginas diferentes
  // (AC e ventiloconvector) com o mesmo slug: a segunda leva sufixo.
  const slugsUsados = new Set()
  for (const pageUrl of pages) {
    let pageSlug = slugFromUrl(pageUrl)
    for (let n = 2; slugsUsados.has(pageSlug); n++) pageSlug = `${slugFromUrl(pageUrl)}-${n}`
    slugsUsados.add(pageSlug)
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

    const urls = extractGalleryUrls(html)
    let n = 0
    for (const src of urls) {
      if (knownSrc.has(src)) continue
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

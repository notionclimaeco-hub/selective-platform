// Normalize mapped crawl images into standardized 1200×1200 transparent PNGs.
//
// Pipeline per image:
//   1. Background removal via rembg (local AI model, cached by file hash)
//   2. Trim transparent borders
//   3. Center on a square transparent canvas with margin
//
// Usage:
//   node scripts/imagens/process.mjs
//   node scripts/imagens/process.mjs --force
//   node scripts/imagens/process.mjs --only nipon-vita
//   node scripts/imagens/process.mjs --skip-rembg   (keep original background)
//
// Reads product-scaffold/mapping.json, writes product-scaffold/produtos/<marca>/<slug>/01.png …
// Also writes product-scaffold/preview-processados.html for visual review.

import sharp from "sharp"
import { mkdir, readFile, writeFile, readdir, copyFile, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const MAPPING = path.join(ROOT, "product-scaffold/mapping.json")
const OUT_ROOT = path.join(ROOT, "product-scaffold/produtos")
const MANUAL_ROOT = path.join(ROOT, "product-scaffold/manual")
const REMBG_CACHE = path.join(ROOT, "product-scaffold/.rembg-cache")
const PREVIEW = path.join(ROOT, "product-scaffold/preview-processados.html")
const SIZE = 1200
const MARGIN = 0.08 // padding around the trimmed content

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
}

async function listManualFiles(slug) {
  const dir = path.join(MANUAL_ROOT, slug)
  if (!existsSync(dir)) return []
  const files = await readdir(dir)
  return files
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort()
    .map((f) => path.join(dir, f))
}

async function fileHash(abs) {
  const buf = await readFile(abs)
  return createHash("sha256").update(buf).digest("hex").slice(0, 16)
}

// Run rembg once over all uncached sources (batch = model loads a single time).
async function ensureCutouts(sources) {
  await mkdir(REMBG_CACHE, { recursive: true })
  const bySrc = new Map()
  const pending = []

  for (const src of sources) {
    const hash = await fileHash(src)
    const cached = path.join(REMBG_CACHE, `${hash}.png`)
    bySrc.set(src, cached)
    if (!existsSync(cached)) pending.push({ src, hash })
  }

  if (pending.length === 0) return bySrc

  const workIn = path.join(tmpdir(), `rembg-in-${Date.now()}`)
  const workOut = path.join(tmpdir(), `rembg-out-${Date.now()}`)
  await mkdir(workIn, { recursive: true })
  await mkdir(workOut, { recursive: true })

  // rembg p preserves base filenames, so name inputs by hash.
  for (const { src, hash } of pending) {
    const png = await sharp(src).rotate().png().toBuffer()
    await writeFile(path.join(workIn, `${hash}.png`), png)
  }

  console.log(`A remover fundo de ${pending.length} imagens (rembg)…`)
  const res = spawnSync(
    "uvx",
    ["--python", "3.11", "--from", "rembg[cpu,cli]", "rembg", "p", workIn, workOut],
    { stdio: "inherit" },
  )
  if (res.status !== 0) {
    throw new Error("rembg falhou — verifica que o uv está instalado (https://docs.astral.sh/uv/)")
  }

  for (const { hash } of pending) {
    const out = path.join(workOut, `${hash}.png`)
    if (!existsSync(out)) throw new Error(`rembg não produziu output para ${hash}`)
    await copyFile(out, path.join(REMBG_CACHE, `${hash}.png`))
  }

  await rm(workIn, { recursive: true, force: true })
  await rm(workOut, { recursive: true, force: true })
  return bySrc
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

async function processOne(srcAbs, destAbs) {
  // Trim borders (transparent after rembg); fall back if trim degenerates.
  let trimmed
  try {
    trimmed = await sharp(srcAbs)
      .trim({ threshold: 12 })
      .toBuffer({ resolveWithObject: true })
  } catch {
    trimmed = await sharp(srcAbs).toBuffer({ resolveWithObject: true })
  }
  if (trimmed.info.width < 8 || trimmed.info.height < 8) {
    trimmed = await sharp(srcAbs).toBuffer({ resolveWithObject: true })
  }

  const inner = Math.round(SIZE * (1 - 2 * MARGIN))
  const resized = await sharp(trimmed.data)
    .resize(inner, inner, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer()

  const canvas = await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: TRANSPARENT },
  })
    .composite([{ input: resized, gravity: "centre" }])
    .png()
    .toBuffer()

  await mkdir(path.dirname(destAbs), { recursive: true })
  await writeFile(destAbs, canvas)
}

async function writePreview(entries) {
  const cards = entries
    .map((e) => {
      const imgs = e.dests
        .map(
          (d) =>
            `<img src="${path.relative(path.dirname(PREVIEW), d)}" loading="lazy" alt="" />`,
        )
        .join("")
      return `<section><h2>${e.marca} · ${e.slug}</h2><div class="row">${imgs}</div></section>`
    })
    .join("\n")

  const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8" />
<title>Preview — imagens processadas</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; background: #f4f7f4; color: #1c2b21; }
  h1 { font-size: 1.4rem; }
  section { margin-bottom: 2rem; }
  h2 { font-size: 0.95rem; font-weight: 600; margin: 0 0 .5rem; }
  .row { display: flex; gap: 1rem; flex-wrap: wrap; }
  img { width: 240px; height: 240px; border-radius: 16px;
        background: linear-gradient(135deg, #eef5ef 0%, #dcebe0 100%);
        border: 1px solid #d4e2d8; object-fit: contain; }
</style></head><body>
<h1>Imagens processadas (fundo removido, centradas, 1200×1200)</h1>
<p>Fundo do cartão simula o gradiente do site. ${entries.length} produtos.</p>
${cards}
</body></html>`
  await writeFile(PREVIEW, html)
}

async function main() {
  if (!existsSync(MAPPING)) {
    throw new Error(`Falta ${path.relative(ROOT, MAPPING)}. Corre o matching primeiro.`)
  }
  const mapping = JSON.parse(await readFile(MAPPING, "utf8"))
  const only = arg("only")
  const force = hasFlag("force")
  const skipRembg = hasFlag("skip-rembg")

  // Resolve sources per entry.
  const jobs = []
  for (const entry of mapping) {
    if (only && entry.slug !== only) continue
    const manual = await listManualFiles(entry.slug)
    const sources =
      manual.length > 0
        ? manual
        : (entry.files ?? []).map((f) =>
            path.isAbsolute(f) ? f : path.join(ROOT, f),
          )
    jobs.push({ entry, sources: sources.filter((s) => existsSync(s)) })
  }

  const allSources = jobs.flatMap((j) => j.sources)
  const cutouts = skipRembg ? null : await ensureCutouts(allSources)

  let ok = 0
  let skipped = 0
  let missing = 0
  const previewEntries = []

  for (const { entry, sources } of jobs) {
    if (sources.length === 0) {
      console.log(`  — ${entry.slug}: sem imagens`)
      missing++
      continue
    }

    const destDir = path.join(OUT_ROOT, entry.marca, entry.slug)
    const dests = []
    for (let i = 0; i < sources.length; i++) {
      const src = cutouts ? cutouts.get(sources[i]) : sources[i]
      const dest = path.join(destDir, `${String(i + 1).padStart(2, "0")}.png`)
      dests.push(dest)
      if (!force && existsSync(dest)) {
        skipped++
        continue
      }
      try {
        await processOne(src, dest)
        console.log(`  ✓ ${path.relative(ROOT, dest)}`)
        ok++
      } catch (err) {
        console.warn(
          `  ✗ ${entry.slug} #${i + 1}: ${err instanceof Error ? err.message : err}`,
        )
      }
    }
    previewEntries.push({ marca: entry.marca, slug: entry.slug, dests })
  }

  await writePreview(previewEntries)
  console.log(
    `\nConcluído. processados=${ok} ignorados=${skipped} falhas/em falta=${missing}`,
  )
  console.log(`Preview: ${path.relative(ROOT, PREVIEW)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

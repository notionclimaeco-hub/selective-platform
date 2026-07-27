// Normalize mapped crawl images into standardized 1200×1200 transparent PNGs.
//
// Pipeline per image:
//   1. Background removal via rembg for ALL sources (cached by file hash)
//      unless --skip-rembg
//   2. Pick cutout vs original from image-choice.json (default: cutout)
//   3. Trim + center on a square transparent canvas
//
// Usage:
//   node scripts/imagens/process.mjs --brand hisense
//   node scripts/imagens/process.mjs --brand hisense --choice-from product-scaffold/image-choice.json
//   node scripts/imagens/process.mjs --brand hisense --skip-rembg
//   node scripts/imagens/process.mjs --force --only nipon-vita
//
// Reads product-scaffold/mapping.json, writes product-scaffold/produtos/<marca>/<slug>/01.png …
// Also writes product-scaffold/preview-processados.html for visual review.

import sharp from "sharp"
import { mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  ensureCutouts,
  resolveRepoPath,
  toRepoRelative,
} from "./lib/rembg.mjs"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const MAPPING = path.join(ROOT, "product-scaffold/mapping.json")
const OUT_ROOT = path.join(ROOT, "product-scaffold/produtos")
const MANUAL_ROOT = path.join(ROOT, "product-scaffold/manual")
const DEFAULT_CHOICE = path.join(ROOT, "product-scaffold/image-choice.json")
const PREVIEW = path.join(ROOT, "product-scaffold/preview-processados.html")
const SIZE = 1200
const MARGIN = 0.08

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

/** @returns {Promise<Record<string, "cutout" | "original" | "exclude">>} */
async function loadChoices(choicePath) {
  if (!choicePath || !existsSync(resolveRepoPath(choicePath))) return {}
  const data = JSON.parse(await readFile(resolveRepoPath(choicePath), "utf8"))
  if (data.choices && typeof data.choices === "object") return data.choices
  const out = {}
  for (const item of data.items ?? []) {
    if (
      item.file &&
      (item.use === "cutout" || item.use === "original" || item.use === "exclude")
    ) {
      out[item.file] = item.use
    }
  }
  return out
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

async function processOne(srcAbs, destAbs) {
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
        background:
          linear-gradient(45deg, #dce5df 25%, transparent 25%),
          linear-gradient(-45deg, #dce5df 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #dce5df 75%),
          linear-gradient(-45deg, transparent 75%, #dce5df 75%);
        background-size: 16px 16px;
        background-position: 0 0, 0 8px, 8px -8px, -8px 0;
        background-color: #eef5ef;
        border: 1px solid #d4e2d8; object-fit: contain; }
</style></head><body>
<h1>Imagens processadas (1200×1200)</h1>
<p>Checkerboard = transparência. ${entries.length} produtos.</p>
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
  const onlyBrand = arg("brand")
  const force = hasFlag("force")
  const skipRembg = hasFlag("skip-rembg")
  // Prefer --choice-from; accept legacy --rembg-from as the same choice file.
  const choiceFrom =
    arg("choice-from") || arg("rembg-from") || (existsSync(DEFAULT_CHOICE) ? DEFAULT_CHOICE : null)

  const choices = await loadChoices(choiceFrom)
  if (choiceFrom) {
    console.log(
      `Escolhas: ${path.relative(ROOT, resolveRepoPath(choiceFrom))} (${Object.keys(choices).length} ficheiros)`,
    )
  }

  const jobs = []
  for (const entry of mapping) {
    if (only && entry.slug !== only) continue
    if (onlyBrand && entry.marca !== onlyBrand) continue
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
  const cutouts = skipRembg ? new Map() : await ensureCutouts(allSources)

  let ok = 0
  let skipped = 0
  let missing = 0
  let usedCutout = 0
  let usedOriginal = 0
  let excluded = 0
  const previewEntries = []

  for (const { entry, sources } of jobs) {
    if (sources.length === 0) {
      console.log(`  — ${entry.slug}: sem imagens`)
      missing++
      continue
    }

    const destDir = path.join(OUT_ROOT, entry.marca, entry.slug)
    const dests = []
    let outIndex = 0
    for (let i = 0; i < sources.length; i++) {
      const srcAbs = sources[i]
      const rel = toRepoRelative(srcAbs)
      const prefer =
        choices[rel] || choices[srcAbs] || (cutouts.has(srcAbs) ? "cutout" : "original")
      if (prefer === "exclude") {
        excluded++
        console.log(`  ⊗ ${entry.slug} #${i + 1}: excluída`)
        continue
      }
      const useCutout = prefer === "cutout" && cutouts.has(srcAbs)
      const src = useCutout ? cutouts.get(srcAbs) : srcAbs
      if (useCutout) usedCutout++
      else usedOriginal++

      outIndex++
      const dest = path.join(destDir, `${String(outIndex).padStart(2, "0")}.png`)
      dests.push(dest)
      if (!force && existsSync(dest)) {
        skipped++
        continue
      }
      try {
        await processOne(src, dest)
        console.log(
          `  ✓ ${path.relative(ROOT, dest)} (${useCutout ? "cutout" : "original"})`,
        )
        ok++
      } catch (err) {
        console.warn(
          `  ✗ ${entry.slug} #${i + 1}: ${err instanceof Error ? err.message : err}`,
        )
      }
    }
    if (dests.length === 0) {
      // Drop stale PNGs from earlier process runs so upload won't reattach them.
      if (existsSync(destDir)) {
        await rm(destDir, { recursive: true, force: true })
      }
      console.log(`  — ${entry.slug}: todas as imagens excluídas`)
      missing++
      continue
    }
    previewEntries.push({ marca: entry.marca, slug: entry.slug, dests })
  }

  await writePreview(previewEntries)
  console.log(
    `\nConcluído. processados=${ok} ignorados=${skipped} excluídas=${excluded} falhas/em falta=${missing}`,
  )
  console.log(`Versões: cutout=${usedCutout} original=${usedOriginal}`)
  console.log(`Preview: ${path.relative(ROOT, PREVIEW)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

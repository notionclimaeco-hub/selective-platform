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

// Explicit slug → crawl pageSlug aliases (Nipon site naming ≠ catalog slugs).
const ALIASES = {
  "mitsubishi-msz-ap": ["gama-domestica-mural"],
  "nipon-magnum": ["armario-mono-split-magnum"],
  "nipon-cassete-xb": ["cassete-mono-split", "cassete-multi-split"],
  "nipon-conduta-xd": ["conduta-mono-split", "conduta-multi-split"],
  "nipon-consola-xc": ["consola-mono-split", "consola-multi-split"],
  "nipon-topsmart": ["topsmart-mono-split", "topsmart-multi-split"],
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
  "nipon-supra-slim": ["ventiloconvetor-supra-slim"],
  "nipon-supra-reverse": ["ventiloconvetor-supra-reverse"],
  "nipon-milan": ["ventiloconvetor-mural"],
  "nipon-hawaii": ["ventiloconvetor-consola"],
  "nipon-venice-h": ["ventiloconvetor-cassete"],
  "nipon-venice-hf": ["ventiloconvetor-cassete"],
  "nipon-venice-hn": ["ventiloconvetor-cassete"],
  "nipon-venice-v": ["ventiloconvetor-cassete"],
  "nipon-venice-vf": ["ventiloconvetor-cassete"],
  "nipon-venice-vn": ["ventiloconvetor-cassete"],
  "nipon-evabox-95": ["vmc-evabox-95"],
  "nipon-evaslim-75": ["vmc-evaslim-75"],
  // Standalone depósito that has a dedicated page.
  NI0130120: ["deposito-de-aqs"],
}

/** Score how well a crawled page matches a catalog target. */
function score(target, image) {
  if (target.marca !== image.marca) return -1

  let s = 0
  const aliases = ALIASES[target.slug] ?? []
  if (aliases.includes(image.pageSlug)) s += 100

  const page = norm(`${image.pageSlug} ${image.pageTitle} ${image.alt}`)
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
  return s
}

async function manualSlugs() {
  if (!existsSync(MANUAL)) return new Set()
  const dirs = await readdir(MANUAL, { withFileTypes: true })
  return new Set(dirs.filter((d) => d.isDirectory()).map((d) => d.name))
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
    // Score every page for this marca; pick the best.
    let bestKey = null
    let bestScore = 0
    for (const [key, imgs] of byPage) {
      if (!key.startsWith(`${target.marca}::`)) continue
      const sample = imgs[0]
      const sc = score(target, sample)
      if (sc > bestScore) {
        bestScore = sc
        bestKey = key
      }
    }

    // Families need a solid match; standalone accessories almost never have
    // dedicated product photos on brand sites, so require an alias-level hit
    // (score ≥ 100) to avoid false positives (filters matching EvaBox, etc.).
    const threshold = target.aplicarAoGrupo ? 20 : 100
    if (bestKey && bestScore >= threshold) {
      const files = byPage
        .get(bestKey)
        .slice()
        .sort((a, b) => a.file.localeCompare(b.file))
        .map((i) => i.file)
      mapping.push({
        slug: target.slug,
        marca: target.marca,
        ref: target.ref,
        nome: target.nome,
        gama: target.gama ?? null,
        aplicarAoGrupo: target.aplicarAoGrupo,
        score: bestScore,
        pageSlug: bestKey.split("::")[1],
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
        aplicarAoGrupo: target.aplicarAoGrupo,
        score: bestScore,
        pageSlug: null,
        files: [],
        manual: manuals.has(target.slug),
      })
    }
  }

  await mkdir(path.dirname(MAPPING_OUT), { recursive: true })
  await writeFile(MAPPING_OUT, JSON.stringify(mapping, null, 2))

  const matched = mapping.filter((m) => m.files.length > 0 || m.manual)
  console.log(
    `Matched ${matched.length}/${mapping.length} targets (${unmatched.length} unmatched).`,
  )

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
          <small>${escapeHtml(m.marca)}${m.gama ? " · " + escapeHtml(m.gama) : ""} · score ${m.score}${m.pageSlug ? " · page " + escapeHtml(m.pageSlug) : ""}</small>
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

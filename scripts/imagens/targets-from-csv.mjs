// Build image targets from a schema v3 CSV, for brands not yet imported into
// Convex (targets.mjs can only see what's already in the database).
//
// Usage:
//   node scripts/imagens/targets-from-csv.mjs product-scaffold/pdf-extract/daikin/daikin-2026-produtos.csv
//
// Merges into product-scaffold/targets.json: entries of the CSV's marca are
// replaced, other brands are kept. Then run `pnpm imagens:match`.

import { readFile, writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const TARGETS = path.join(ROOT, "product-scaffold/targets.json")

/** Minimal RFC4180 parser (the v3 CSV is QUOTE_ALL with CRLF). */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      quoted = true
    } else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n") {
      row.push(field)
      field = ""
      rows.push(row)
      row = []
    } else if (c !== "\r") {
      field += c
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  const header = rows.shift() ?? []
  return rows
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])))
}

async function main() {
  const csvArg = process.argv[2]
  if (!csvArg) {
    console.error("Indica o CSV: node scripts/imagens/targets-from-csv.mjs <csv>")
    process.exit(1)
  }
  const csvPath = path.isAbsolute(csvArg) ? csvArg : path.join(process.cwd(), csvArg)
  const rows = parseCsv(await readFile(csvPath, "utf8"))
  if (rows.length === 0) throw new Error("CSV vazio")

  const grupos = new Map()
  for (const r of rows) {
    const grupo = (r.grupoModelo || "").trim()
    if (!grupo) continue
    if (!grupos.has(grupo)) grupos.set(grupo, [])
    grupos.get(grupo).push(r)
  }

  const marcas = new Set()
  const targets = []
  for (const [grupoModelo, variantes] of grupos) {
    // Canonical = cheapest, tie-broken by ref (same rule as the catalog).
    const canonica = variantes.reduce((melhor, atual) => {
      const a = Number(atual.pvpCents || 0)
      const m = Number(melhor.pvpCents || 0)
      if (a < m) return atual
      if (a === m && (atual.ref || "") < (melhor.ref || "")) return atual
      return melhor
    })
    const marca = (canonica.marca || "").trim()
    marcas.add(marca)
    targets.push({
      slug: grupoModelo,
      marca,
      nome: (canonica.nomeGrupo || "").trim(),
      gama: (canonica.gama || "").trim() || undefined,
      familia: (canonica.familia || "").trim(),
      componente: (canonica.componente || "").trim() || undefined,
      ref: (canonica.ref || "").trim(),
      refs: variantes.map((v) => (v.ref || "").trim()).filter(Boolean),
      aplicarAoGrupo: true,
      estados: ["rascunho"],
      numImagens: 0,
    })
  }

  const existing = existsSync(TARGETS)
    ? JSON.parse(await readFile(TARGETS, "utf8"))
    : []
  const kept = existing.filter((t) => !marcas.has(t.marca))
  const merged = [...kept, ...targets].sort((a, b) =>
    a.marca !== b.marca
      ? a.marca.localeCompare(b.marca)
      : String(a.nome).localeCompare(String(b.nome)),
  )

  await mkdir(path.dirname(TARGETS), { recursive: true })
  await writeFile(TARGETS, JSON.stringify(merged, null, 2))
  console.log(
    `${targets.length} targets de ${[...marcas].join(", ")} (${rows.length} SKUs) ` +
      `+ ${kept.length} de outras marcas → ${path.relative(ROOT, TARGETS)}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

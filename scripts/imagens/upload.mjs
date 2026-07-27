// Bulk-upload processed product images to Convex.
//
// Usage:
//   node scripts/imagens/upload.mjs
//   node scripts/imagens/upload.mjs --only nipon-vita
//   node scripts/imagens/upload.mjs --force
//
// Reads product-scaffold/mapping.json + product-scaffold/produtos/<marca>/<slug>/*.png
// Uses IMPORT_SECRET + importData.gerarUploadUrl / definirImagensPorRef.
// Idempotent via product-scaffold/.upload-state.json (file sha256 → storageId).

import { ConvexHttpClient } from "convex/browser"
import { createHash } from "node:crypto"
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { api } from "../../convex/_generated/api.js"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const MAPPING = path.join(ROOT, "product-scaffold/mapping.json")
const PRODUTOS = path.join(ROOT, "product-scaffold/produtos")
const STATE = path.join(ROOT, "product-scaffold/.upload-state.json")

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}
function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
}

async function loadEnv() {
  const txt = await readFile(path.join(ROOT, ".env"), "utf8")
  const env = {}
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

async function loadState() {
  if (!existsSync(STATE)) return { files: {}, targets: {} }
  return JSON.parse(await readFile(STATE, "utf8"))
}

async function saveState(state) {
  await mkdir(path.dirname(STATE), { recursive: true })
  await writeFile(STATE, JSON.stringify(state, null, 2))
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex")
}

async function listPngs(dir) {
  if (!existsSync(dir)) return []
  const files = await readdir(dir)
  return files
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort()
    .map((f) => path.join(dir, f))
}

async function main() {
  const env = await loadEnv()
  const url = env.VITE_CONVEX_URL || env.CONVEX_URL
  const secret = env.IMPORT_SECRET
  if (!url) throw new Error("VITE_CONVEX_URL / CONVEX_URL em falta no .env")
  if (!secret) throw new Error("IMPORT_SECRET em falta no .env")
  if (!existsSync(MAPPING)) {
    throw new Error("Falta product-scaffold/mapping.json")
  }

  const mapping = JSON.parse(await readFile(MAPPING, "utf8"))
  const client = new ConvexHttpClient(url)
  const state = await loadState()
  const only = arg("only")
  const onlyBrand = arg("brand")
  const force = hasFlag("force")

  let uploadedFiles = 0
  let attached = 0
  let skipped = 0

  for (const entry of mapping) {
    if (only && entry.slug !== only) continue
    if (onlyBrand && entry.marca !== onlyBrand) continue
    const dir = path.join(PRODUTOS, entry.marca, entry.slug)
    const pngs = await listPngs(dir)
    if (pngs.length === 0) {
      console.log(`  — ${entry.slug}: sem PNGs processados`)
      skipped++
      continue
    }

    if (
      !force &&
      state.targets[entry.slug]?.count === pngs.length &&
      entry.numImagensAlreadyOk === undefined
    ) {
      // Still re-attach if hashes match but allow --force to redo.
    }

    const storageIds = []
    for (const png of pngs) {
      const bytes = await readFile(png)
      const hash = sha256(bytes)
      let storageId = state.files[hash]
      if (!storageId || force) {
        const uploadUrl = await client.mutation(api.importData.gerarUploadUrl, {
          secret,
        })
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: bytes,
        })
        if (!res.ok) {
          throw new Error(`Upload falhou ${png} (${res.status})`)
        }
        const json = await res.json()
        storageId = json.storageId
        state.files[hash] = storageId
        uploadedFiles++
        console.log(`  ↑ ${path.relative(ROOT, png)}`)
      } else {
        console.log(`  = ${path.relative(ROOT, png)} (já no storage)`)
      }
      storageIds.push(storageId)
    }

    const r = await client.mutation(api.importData.definirImagensPorRef, {
      secret,
      ref: entry.ref,
      imagens: storageIds,
      aplicarAoGrupo: entry.aplicarAoGrupo,
    })
    state.targets[entry.slug] = {
      ref: entry.ref,
      count: storageIds.length,
      storageIds,
      produtosAtualizados: r.produtosAtualizados,
      at: new Date().toISOString(),
    }
    await saveState(state)
    attached++
    console.log(
      `  ✓ ${entry.slug} → ${r.produtosAtualizados} produtos atualizados`,
    )
  }

  console.log(
    `\nConcluído. targets=${attached} ficheirosNovos=${uploadedFiles} semPNG=${skipped}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

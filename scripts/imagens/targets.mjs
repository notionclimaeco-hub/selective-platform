// Export image targets from Convex: one row per family (grupoModelo) or
// standalone product. Written to product-scaffold/targets.json for the matching stage.
//
// Usage:
//   node scripts/imagens/targets.mjs
//
// Requires VITE_CONVEX_URL / CONVEX_URL in the root .env. Uses a public query
// (listarCatalogo) plus a one-off read via ConvexHttpClient against a small
// admin-style dump — actually we need ALL products including rascunho.
// So this script uses IMPORT_SECRET + a dedicated export mutation, OR we
// call the public APIs and supplement. Simplest: use ConvexHttpClient to call
// a secret-guarded query if we add one, OR dump via npx convex run.
//
// For now we add importData.listarTargetsImagens (secret-guarded) and call it.

import { ConvexHttpClient } from "convex/browser"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { api } from "../../convex/_generated/api.js"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const OUT = path.join(ROOT, "product-scaffold/targets.json")

async function loadEnv() {
  const txt = await readFile(path.join(ROOT, ".env"), "utf8")
  const env = {}
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

async function main() {
  const env = await loadEnv()
  const url = env.VITE_CONVEX_URL || env.CONVEX_URL
  const secret = env.IMPORT_SECRET
  if (!url) throw new Error("VITE_CONVEX_URL / CONVEX_URL em falta no .env")
  if (!secret) throw new Error("IMPORT_SECRET em falta no .env")

  const client = new ConvexHttpClient(url)
  const targets = await client.query(api.importData.listarTargetsImagens, {
    secret,
  })

  await mkdir(path.dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(targets, null, 2))
  console.log(`Wrote ${targets.length} targets → ${path.relative(ROOT, OUT)}`)
  const porMarca = {}
  for (const t of targets) {
    porMarca[t.marca] = (porMarca[t.marca] ?? 0) + 1
  }
  console.log(porMarca)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

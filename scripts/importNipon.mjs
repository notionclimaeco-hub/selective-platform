// One-off bulk importer for a brand price table.
//
// Reads staged data from .import-data/ and loads it into Convex via the
// secret-guarded functions in convex/importData.ts:
//   - products  -> importData.importarProdutos (upsert by ref, idempotent)
//   - page PDFs -> upload URL + importData.registarPagina (idempotent by tabela+pagina)
//
// Usage:
//   node scripts/importNipon.mjs
//   node scripts/importNipon.mjs --products <file.json> --pages <dir>
//
// Requires (from the root .env): VITE_CONVEX_URL (or CONVEX_URL) + IMPORT_SECRET.

import { ConvexHttpClient } from "convex/browser"
import { readFile, readdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { api } from "../convex/_generated/api.js"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

// --- tiny .env reader (only what we need) ---
async function loadEnv() {
  const txt = await readFile(path.join(ROOT, ".env"), "utf8")
  const env = {}
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  const env = await loadEnv()
  const url = env.VITE_CONVEX_URL || env.CONVEX_URL
  const secret = env.IMPORT_SECRET
  if (!url) throw new Error("VITE_CONVEX_URL / CONVEX_URL em falta no .env")
  if (!secret) throw new Error("IMPORT_SECRET em falta no .env")

  const client = new ConvexHttpClient(url)
  const productsPath = arg("products", path.join(ROOT, ".import-data/products.json"))
  const pagesDir = arg("pages", path.join(ROOT, ".import-data/pages"))

  // --- 1) Products ---
  const produtos = JSON.parse(await readFile(productsPath, "utf8"))
  console.log(`\n== Produtos (${produtos.length}) ==`)
  let criados = 0
  let atualizados = 0
  const errosProd = []
  for (const lote of chunk(produtos, 50)) {
    const r = await client.mutation(api.importData.importarProdutos, {
      secret,
      produtos: lote,
    })
    criados += r.criados
    atualizados += r.atualizados
    errosProd.push(...r.erros)
    process.stdout.write(".")
  }
  console.log(
    `\n  criados: ${criados} | atualizados: ${atualizados} | erros: ${errosProd.length}`,
  )
  for (const e of errosProd) console.log(`  ERRO ${e.ref}: ${e.erro}`)

  // --- 2) Catalog page PDFs ---
  const ficheiros = (await readdir(pagesDir)).filter((f) => f.endsWith(".pdf"))
  console.log(`\n== Páginas (${ficheiros.length}) ==`)
  let paginasOk = 0
  const errosPag = []
  for (const nome of ficheiros.sort()) {
    const m = nome.match(/^(.*)-p(\d+)\.pdf$/i)
    if (!m) {
      errosPag.push(`${nome}: nome não corresponde a <tabela>-p<N>.pdf`)
      continue
    }
    const tabelaOrigem = m[1]
    const pagina = Number(m[2])
    try {
      const bytes = await readFile(path.join(pagesDir, nome))
      const uploadUrl = await client.mutation(api.importData.gerarUploadUrl, {
        secret,
      })
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: bytes,
      })
      if (!res.ok) throw new Error(`upload falhou (${res.status})`)
      const { storageId } = await res.json()
      await client.mutation(api.importData.registarPagina, {
        secret,
        tabelaOrigem,
        pagina,
        ficheiro: storageId,
      })
      paginasOk += 1
      process.stdout.write(".")
    } catch (err) {
      errosPag.push(`${nome}: ${err instanceof Error ? err.message : err}`)
    }
  }
  console.log(`\n  ok: ${paginasOk} | erros: ${errosPag.length}`)
  for (const e of errosPag) console.log(`  ERRO ${e}`)

  console.log("\nConcluído.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

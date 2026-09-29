// Save the agent's photo picks as group decisions (imagens.gravarEscolhasAgente).
//   node scripts/imagens/escolhas.mjs --brand hisense [--dry-run]
// Reads product-scaffold/imagens/<marca>/escolhas.json ({ grupoModelo: [n, …] },
// numbers from the contact sheets, first = cover) and folhas/indice.json.
// Groups a person already saved are left alone by the mutation.
import { ConvexHttpClient } from "convex/browser"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { api } from "../../convex/_generated/api.js"
import { resolverEscolhas } from "./lib/escolhas.mjs"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 ? process.argv[i + 1] : null }
const flag = (n) => process.argv.includes(`--${n}`)
const marca = arg("brand")
if (!marca) { console.error("uso: escolhas.mjs --brand <marca> [--dry-run]"); process.exit(1) }
const pasta = path.join(ROOT, "product-scaffold/imagens", marca)

async function loadEnv() {
  const txt = await readFile(path.join(ROOT, ".env"), "utf8")
  const env = {}
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

const escolhasJson = JSON.parse(await readFile(path.join(pasta, "escolhas.json"), "utf8"))
const indice = JSON.parse(await readFile(path.join(pasta, "folhas/indice.json"), "utf8"))
const { escolhas, avisos } = resolverEscolhas(escolhasJson, indice)
for (const a of avisos) console.log(`  aviso: ${a}`)
const semEscolha = Object.keys(indice).filter((g) => !escolhas.some((e) => e.grupoModelo === g))
console.log(`${escolhas.length} grupos com escolha, ${semEscolha.length} com folha e sem escolha`)
if (flag("dry-run")) process.exit(0)

const env = await loadEnv()
const url = env.VITE_CONVEX_URL || env.CONVEX_URL
const secret = env.IMPORT_SECRET
if (!url || !secret) throw new Error("VITE_CONVEX_URL/CONVEX_URL e IMPORT_SECRET em falta no .env")
const client = new ConvexHttpClient(url)

let gravadas = 0, mantidas = 0
for (let i = 0; i < escolhas.length; i += 25) {
  const r = await client.mutation(api.imagens.gravarEscolhasAgente, { secret, marca, escolhas: escolhas.slice(i, i + 25) })
  gravadas += r.gravadas; mantidas += r.mantidas
}
console.log(`${gravadas} decisões do agente gravadas, ${mantidas} mantidas (já escolhidas por pessoas)`)

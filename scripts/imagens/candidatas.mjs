// Upload candidate photos from a manifest to Convex (imagens.registarCandidatas).
//   node scripts/imagens/candidatas.mjs --brand hisense [--dry-run] [--recortar]
// Reads product-scaffold/imagens/<marca>/{alvos.json,candidatas.json}; writes cobertura.md.
import { ConvexHttpClient } from "convex/browser"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { api } from "../../convex/_generated/api.js"
import { cobertura, coberturaMarkdown, lerManifesto, prepararFicheiro } from "./lib/candidatas.mjs"
import { ensureCutouts } from "./lib/rembg.mjs"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 ? process.argv[i + 1] : null }
const flag = (n) => process.argv.includes(`--${n}`)
const marca = arg("brand")
if (!marca) { console.error("uso: candidatas.mjs --brand <marca> [--dry-run] [--recortar]"); process.exit(1) }
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

const alvos = JSON.parse(await readFile(path.join(pasta, "alvos.json"), "utf8"))
const manifesto = JSON.parse(await readFile(path.join(pasta, "candidatas.json"), "utf8"))
let entradas = lerManifesto(manifesto, alvos)
const absDe = (ficheiro) => (path.isAbsolute(ficheiro) ? ficheiro : path.join(pasta, ficheiro))

// Optional local cutouts (uvx rembg), uploaded as "recorte" linked by origemHash.
if (flag("recortar")) {
  const fontes = entradas.filter((e) => e.fonte !== "recorte").map((e) => absDe(e.ficheiro))
  const cortes = await ensureCutouts(fontes)
  for (const e of [...entradas]) {
    if (e.fonte === "recorte") continue
    const corte = cortes.get(absDe(e.ficheiro))
    if (corte) entradas.push({ ...e, ficheiro: corte, fonte: "recorte", origemDe: e.ficheiro })
  }
}

const preparadas = []
for (const e of entradas) {
  const p = await prepararFicheiro(await readFile(absDe(e.ficheiro)))
  preparadas.push({ ...e, ...p })
}
const hashDe = new Map(preparadas.filter((p) => p.fonte !== "recorte").map((p) => [p.ficheiro, p.hash]))

const relatorio = cobertura(alvos, entradas)
await writeFile(path.join(pasta, "cobertura.md"), coberturaMarkdown(relatorio))
console.log(`${preparadas.length} candidatas, ${relatorio.semCandidatas.length} grupos de equipamento sem nenhuma, ` +
  `${relatorio.equipamentoSemSiteNemMegaclima.length} sem site/megaclima → cobertura.md`)
if (flag("dry-run")) process.exit(0)

const env = await loadEnv()
const url = env.VITE_CONVEX_URL || env.CONVEX_URL
const secret = env.IMPORT_SECRET
if (!url || !secret) throw new Error("VITE_CONVEX_URL/CONVEX_URL e IMPORT_SECRET em falta no .env")
const client = new ConvexHttpClient(url)

let criadas = 0, repetidas = 0
for (let i = 0; i < preparadas.length; i += 50) {
  const lote = []
  for (const p of preparadas.slice(i, i + 50)) {
    const uploadUrl = await client.mutation(api.importData.gerarUploadUrl, { secret })
    const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": p.contentType }, body: p.bytes })
    if (!res.ok) throw new Error(`upload falhou (${res.status}) para ${p.ficheiro}`)
    const { storageId } = await res.json()
    const c = { marca: p.marca, grupoModelo: p.grupoModelo, ficheiro: storageId, fonte: p.fonte, hash: p.hash,
      largura: p.largura, altura: p.altura }
    if (p.origemUrl) c.origemUrl = p.origemUrl
    if (p.aviso) c.aviso = p.aviso
    if (p.cor) c.cor = p.cor
    if (p.fonte === "recorte" && p.origemDe) c.origemHash = hashDe.get(p.origemDe)
    lote.push(c)
  }
  const r = await client.mutation(api.imagens.registarCandidatas, { secret, candidatas: lote })
  criadas += r.criadas; repetidas += r.repetidas
  console.log(`  lote ${Math.floor(i / 50) + 1}: ${r.criadas} novas, ${r.repetidas} repetidas`)
}
console.log(`${criadas} candidatas novas, ${repetidas} já existiam (${marca})`)

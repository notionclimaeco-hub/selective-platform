// Contact sheets of a brand's photo candidates, one PNG per group, for the
// agent to pick from (then escolhas.mjs).
//   node scripts/imagens/folhas.mjs --brand hisense [--grupo <grupoModelo>] [--todos]
// Reads the candidates from Convex (imagens.candidatasDaMarca) and
// product-scaffold/imagens/<marca>/alvos.json for the header; writes
// product-scaffold/imagens/<marca>/folhas/{<grupo>.png,indice.json}.
// Groups a person already saved are skipped unless --todos.
import { ConvexHttpClient } from "convex/browser"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import { api } from "../../convex/_generated/api.js"
import { ordenarParaFolha } from "./lib/escolhas.mjs"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 ? process.argv[i + 1] : null }
const flag = (n) => process.argv.includes(`--${n}`)
const marca = arg("brand")
if (!marca) { console.error("uso: folhas.mjs --brand <marca> [--grupo <grupoModelo>] [--todos]"); process.exit(1) }
const pasta = path.join(ROOT, "product-scaffold/imagens", marca)
const saida = path.join(pasta, "folhas")
const cache = path.join(saida, "cache")

async function loadEnv() {
  const txt = await readFile(path.join(ROOT, ".env"), "utf8")
  const env = {}
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

const TILE = 280
const LEGENDA = 44
const COLS = 5
const MARGEM = 12
const CAB = 92

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch])
const corta = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

async function bytesDe(c) {
  const f = path.join(cache, c.ficheiro)
  if (existsSync(f)) return await readFile(f)
  const res = await fetch(c.url)
  if (!res.ok) throw new Error(`download ${c.ficheiro}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(f, buf)
  return buf
}

// Checkerboard so a cutout's edges and holes show.
const xadrez = await sharp(Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}"><defs><pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#fff"/><rect width="10" height="10" fill="#e6e6e6"/><rect x="10" y="10" width="10" height="10" fill="#e6e6e6"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`,
)).png().toBuffer()

async function tile(c) {
  let img
  try {
    img = await sharp(await bytesDe(c)).rotate().resize(TILE - 8, TILE - 8, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  } catch (e) {
    img = await sharp({ create: { width: TILE - 8, height: TILE - 8, channels: 4, background: "#fdd" } }).png().toBuffer()
    console.warn(`  ${c.ficheiro}: ${e.message}`)
  }
  const tipo = c.fonte === "recorte" ? `recorte de #${c.origemN ?? "?"}` : c.fonte
  const cor = c.aviso ? "#b45309" : c.fonte === "recorte" ? "#0369a1" : "#111"
  const legenda = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${LEGENDA}">` +
    `<rect width="100%" height="100%" fill="${c.aviso ? "#fef3c7" : "#fff"}"/>` +
    `<text x="6" y="17" font-family="Helvetica" font-size="15" font-weight="bold" fill="${cor}">#${c.n} · ${esc(tipo)} · ${c.largura}×${c.altura}${c.cor ? ` · ${esc(c.cor)}` : ""}</text>` +
    (c.aviso ? `<text x="6" y="36" font-family="Helvetica" font-size="12" fill="#92400e">${esc(corta(c.aviso, 44))}</text>` : "") +
    `</svg>`,
  )
  const borda = c.aviso ? "#f59e0b" : c.fonte === "recorte" ? "#0ea5e9" : "#999"
  return await sharp({ create: { width: TILE, height: TILE + LEGENDA, channels: 4, background: borda } })
    .composite([
      { input: xadrez, left: 0, top: 0 },
      { input: img, left: 4, top: 4 },
      { input: legenda, left: 0, top: TILE },
    ])
    .png().toBuffer()
}

async function folha(grupo, alvo, itens) {
  const linhas = Math.ceil(itens.length / COLS)
  const largura = MARGEM + COLS * (TILE + MARGEM)
  const altura = CAB + linhas * (TILE + LEGENDA + MARGEM) + MARGEM
  const refs = alvo?.refs ?? []
  const cab = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${CAB}">` +
    `<text x="${MARGEM}" y="28" font-family="Helvetica" font-size="22" font-weight="bold">${esc(alvo?.nomeGrupo ?? grupo)}</text>` +
    `<text x="${MARGEM}" y="52" font-family="Helvetica" font-size="15" fill="#444">${esc(grupo)} · ${esc([alvo?.componente, alvo?.tipoUnidade, alvo?.acessorio ? "acessório" : null].filter(Boolean).join(" · "))}${alvo?.cores?.length ? ` · cores: ${esc(alvo.cores.join(", "))}` : ""}</text>` +
    `<text x="${MARGEM}" y="76" font-family="Helvetica" font-size="14" fill="#666">${esc(corta(`${refs.length} refs: ${refs.join(" ")}`, 150))}</text>` +
    `</svg>`,
  )
  const partes = [{ input: cab, left: 0, top: 0 }]
  for (const [i, c] of itens.entries()) {
    partes.push({
      input: await tile(c),
      left: MARGEM + (i % COLS) * (TILE + MARGEM),
      top: CAB + Math.floor(i / COLS) * (TILE + LEGENDA + MARGEM),
    })
  }
  await sharp({ create: { width: largura, height: altura, channels: 3, background: "#f4f4f5" } })
    .composite(partes).png().toFile(path.join(saida, `${grupo}.png`))
}

const env = await loadEnv()
const url = env.VITE_CONVEX_URL || env.CONVEX_URL
const secret = env.IMPORT_SECRET
if (!url || !secret) throw new Error("VITE_CONVEX_URL/CONVEX_URL e IMPORT_SECRET em falta no .env")
const client = new ConvexHttpClient(url)
await mkdir(cache, { recursive: true })

const alvosPath = path.join(pasta, "alvos.json")
const alvos = existsSync(alvosPath) ? JSON.parse(await readFile(alvosPath, "utf8")).grupos : []
const alvoDe = new Map(alvos.map((a) => [a.grupoModelo, a]))

const indicePath = path.join(saida, "indice.json")
const indice = existsSync(indicePath) ? JSON.parse(await readFile(indicePath, "utf8")) : {}
const grupos = await client.query(api.imagens.candidatasDaMarca, { secret, marca })
let feitas = 0, humanas = 0
for (const g of grupos) {
  if (arg("grupo") && g.grupoModelo !== arg("grupo")) continue
  if (g.escolhaHumana && !flag("todos")) { humanas++; continue }
  const itens = ordenarParaFolha(g.candidatas.filter((c) => c.url !== null))
  await folha(g.grupoModelo, alvoDe.get(g.grupoModelo), itens)
  indice[g.grupoModelo] = itens.map(({ n, _id, fonte, origemN, aviso }) => ({ n, _id, fonte, origemN, aviso }))
  feitas++
}
await writeFile(indicePath, JSON.stringify(indice, null, 2))
console.log(`${feitas} folhas em ${path.relative(ROOT, saida)}/ (${humanas} grupos já escolhidos por pessoas, saltados)`)

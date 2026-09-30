// Packshots by searching the ref on dealer sites (the "google the ref, open the
// first result, take the picture" move), for groups that still have no candidate.
//
//   node scripts/imagens/procurar-ref.mjs --brand hisense [--only <grupoModelo>] [--all]
//
// Sources (in order): klima.pt site search (PrestaShop; product page og:image).
// Add more dealers to DEALERS as they prove useful. Everything found is copied
// into product-scaffold/imagens/<marca>/<grupo>/ and merged into candidatas.json
// with `fonte: "web"` and the product page as origemUrl. Idempotent: groups that
// already have candidates are skipped unless --all.

import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import sharp from "sharp"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
const MIN_PX = 300

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function curl(url, extra = []) {
  const res = spawnSync("curl", ["-sL", "--max-time", "45", "-A", UA, ...extra, url], {
    encoding: "buffer",
    maxBuffer: 30 * 1024 * 1024,
  })
  if (res.status !== 0) throw new Error(`curl ${url}: ${res.stderr?.toString() || res.status}`)
  return res.stdout
}

const refSlug = (ref) => ref.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
// "YXE-E01U(E)" → "YXE-E01U", "HCCS-H64H2C1M#01" → "HCCS-H64H2C1M": the printed suffix is not part of the model.
const termoDe = (ref) => ref.replace(/\(E\)$/i, "").replace(/#[A-Z0-9]+$/i, "").trim()

/** Dealer site searches: each returns the product page URL for a ref, or null. */
const DEALERS = [
  {
    nome: "klima.pt",
    async procurar(ref) {
      const termo = termoDe(ref)
      const html = curl(`https://klima.pt/pt/pesquisa?controller=search&s=${encodeURIComponent(termo)}`).toString("utf8")
      // Results are a JSON-LD ItemList: [{ name, url }]. Require the ref in the
      // name or URL so a generic listing never matches.
      const compact = refSlug(termo).replace(/-/g, "")
      const itens = [...html.matchAll(/"name":\s*"([^"]+)",\s*"url":\s*"(https:\/\/klima\.pt\/[^"]+)"/g)]
      const hit = itens.find((m) => m[2].endsWith(".html") && !m[2].includes("pesquisa") &&
        refSlug(m[1] + " " + m[2]).replace(/-/g, "").includes(compact))
      return hit ? hit[2] : null
    },
    imagem(html) {
      // large_default is the biggest variant klima.pt serves (thickbox 404s).
      return html.match(/property="og:image" content="([^"]+)"/)?.[1] ?? null
    },
  },
  {
    // Hisense's German distributor (Shopware): the whole VRF/accessory catalogue,
    // product URL = /<ref>/<article id>/, image = media/…/<id>bild01bild_<ref>_web.jpg
    nome: "kaut-hisense.de",
    async procurar(ref) {
      const termo = termoDe(ref)
      const html = curl(`https://www.kaut-hisense.de/search?search=${encodeURIComponent(termo)}`).toString("utf8")
      const slug = refSlug(termo)
      const links = [...html.matchAll(/href="(https:\/\/www\.kaut-hisense\.de\/([a-z0-9-]+)\/\d+\/)"/g)]
      const exato = links.find((m) => m[2] === slug)?.[1]
      if (exato) return exato
      // Search ranking hides some exact refs; the product URL is predictable enough
      // (/<ref>/<id>/) that a canonical redirect from /<ref>/ resolves it.
      const res = spawnSync("curl", ["-sL", "-o", "/dev/null", "-w", "%{http_code} %{url_effective}", "-A", UA, "--max-time", "30", `https://www.kaut-hisense.de/${slug}/`], { encoding: "utf8" })
      const [code, url] = (res.stdout || "").split(" ")
      return code === "200" && url && new URL(url).pathname.startsWith(`/${slug}/`) ? url : null
    },
    imagem(html) {
      const id = html.match(/kaut-hisense\.de\/[a-z0-9-]+\/(\d+)\//)?.[1]
      // Filenames vary: <id>bild01bild_<ref>, <id>bild01bild-<ref>, <id>_bild01_bild-<ref>.
      const imgs = [...html.matchAll(/(?:src|data-src)="(https:\/\/www\.kaut-hisense\.de\/media\/[^"?]+bild01[-_]?bild[-_][^"?]+)/g)].map((m) => m[1])
      return imgs.find((u) => id && u.includes(`/${id}`)) ?? imgs[0] ?? null
    },
  },
]

async function guardar(url, destSemExt) {
  const buf = curl(url)
  const meta = await sharp(buf).metadata().catch(() => null)
  if (!meta || Math.max(meta.width ?? 0, meta.height ?? 0) < MIN_PX) return null
  const ext = meta.format === "png" ? "png" : meta.format === "webp" ? "webp" : "jpg"
  const dest = `${destSemExt}.${ext}`
  await mkdir(path.dirname(dest), { recursive: true })
  await writeFile(dest, buf)
  return { dest, width: meta.width, height: meta.height }
}

async function main() {
  const marca = arg("brand")
  if (!marca) throw new Error("--brand é obrigatório")
  const pasta = path.join(ROOT, "product-scaffold/imagens", marca)
  const alvos = JSON.parse(await readFile(path.join(pasta, "alvos.json"), "utf8"))
  const candPath = path.join(pasta, "candidatas.json")
  const candidatas = existsSync(candPath) ? JSON.parse(await readFile(candPath, "utf8")) : {}
  const only = arg("only")
  const grupos = alvos.grupos.filter((g) => (only ? g.grupoModelo === only : process.argv.includes("--all") || !(candidatas[g.grupoModelo]?.length)))
  console.log(`${grupos.length} grupos sem candidatas (${marca})`)

  const encontrados = []
  const semNada = []
  for (const g of grupos) {
    let hit = null
    for (const ref of g.refs.slice(0, 4)) {
      for (const dealer of DEALERS) {
        try {
          const pageUrl = await dealer.procurar(ref)
          if (!pageUrl) continue
          const html = curl(pageUrl).toString("utf8")
          const img = dealer.imagem(html)
          if (!img) continue
          const raw = path.join(ROOT, "product-scaffold/crawl-raw", marca, `web-${refSlug(ref)}`, "01")
          const saved = await guardar(img, raw)
          if (!saved) continue
          hit = { ref, dealer: dealer.nome, pageUrl, file: saved.dest, w: saved.width, h: saved.height }
        } catch (err) {
          console.warn(`  ${g.grupoModelo} ${ref} ${dealer.nome}: ${err instanceof Error ? err.message : err}`)
        }
        if (hit) break
        await sleep(250)
      }
      if (hit) break
    }
    if (!hit) {
      semNada.push(g.grupoModelo)
      console.log(`  ✗ ${g.grupoModelo} (${g.refs.slice(0, 4).join(", ")})`)
      continue
    }
    const dir = path.join(pasta, g.grupoModelo)
    await mkdir(dir, { recursive: true })
    const n = (candidatas[g.grupoModelo]?.length ?? 0) + 1
    const nome = `${String(n).padStart(2, "0")}${path.extname(hit.file)}`
    await copyFile(hit.file, path.join(dir, nome))
    candidatas[g.grupoModelo] = [...(candidatas[g.grupoModelo] ?? []), { ficheiro: `${g.grupoModelo}/${nome}`, fonte: "web", origemUrl: hit.pageUrl }]
    encontrados.push({ grupo: g.grupoModelo, ...hit })
    console.log(`  ✓ ${g.grupoModelo} ← ${hit.ref} @ ${hit.dealer} (${hit.w}x${hit.h})`)
    await writeFile(candPath, JSON.stringify(candidatas, null, 2) + "\n")
  }
  await writeFile(path.join(pasta, "web-procura.json"), JSON.stringify({ encontrados, semNada }, null, 2) + "\n")
  console.log(`\n${encontrados.length} encontrados, ${semNada.length} sem nada → web-procura.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

// Shared rembg helpers for process.mjs + preview.mjs.
import { mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..")
export const REMBG_CACHE = path.join(ROOT, "product-scaffold/.rembg-cache")

export async function fileHash(abs) {
  const buf = await readFile(abs)
  return createHash("sha256").update(buf).digest("hex").slice(0, 16)
}

export function cutoutPathForHash(hash) {
  return path.join(REMBG_CACHE, `${hash}.png`)
}

export async function cutoutPathForSource(abs) {
  const hash = await fileHash(abs)
  const cached = cutoutPathForHash(hash)
  return { hash, cached, exists: existsSync(cached) }
}

function photoroomKey() {
  if (process.env.PHOTOROOM_API_KEY) return process.env.PHOTOROOM_API_KEY
  const envPath = path.join(ROOT, ".env")
  if (!existsSync(envPath)) return null
  const m = /^PHOTOROOM_API_KEY=(.+)$/m.exec(readFileSyncUtf8(envPath))
  return m ? m[1].trim().replace(/^"|"$/g, "") : null
}

function readFileSyncUtf8(p) {
  return readFileSync(p, "utf8")
}

/** A packshot that already has a transparent background needs no cutout. */
async function jaTransparente(src) {
  const img = sharp(src)
  const meta = await img.metadata()
  if (!meta.hasAlpha) return false
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3]
  const cantos = [alphaAt(0, 0), alphaAt(info.width - 1, 0), alphaAt(0, info.height - 1), alphaAt(info.width - 1, info.height - 1)]
  return cantos.every((a) => a === 0)
}

/** Photoroom `segment` endpoint: one call per image, PNG with alpha back. */
async function photoroomCutout(key, src) {
  const png = await sharp(src).rotate().png().toBuffer()
  const form = new FormData()
  form.append("image_file", new Blob([png], { type: "image/png" }), "in.png")
  form.append("format", "png")
  const res = await fetch("https://sdk.photoroom.com/v1/segment", { method: "POST", headers: { "x-api-key": key }, body: form })
  if (!res.ok) throw new Error(`Photoroom ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Cutouts for every source, cached by content hash. Sources that are already
 * transparent are copied as-is. With PHOTOROOM_API_KEY (env or root .env) the
 * Photoroom API does the work; otherwise rembg runs once over the batch.
 */
export async function ensureCutouts(sources) {
  await mkdir(REMBG_CACHE, { recursive: true })
  const bySrc = new Map()
  const pending = []

  for (const src of sources) {
    const hash = await fileHash(src)
    const cached = cutoutPathForHash(hash)
    bySrc.set(src, cached)
    if (existsSync(cached)) continue
    if (await jaTransparente(src)) {
      await writeFile(cached, await sharp(src).rotate().png().toBuffer())
      continue
    }
    pending.push({ src, hash })
  }

  if (pending.length === 0) return bySrc

  const key = photoroomKey()
  if (key) {
    console.log(`A remover fundo de ${pending.length} imagens (Photoroom)…`)
    let feitas = 0
    const fila = [...pending]
    const worker = async () => {
      for (let item = fila.shift(); item; item = fila.shift()) {
        for (let tentativa = 1; ; tentativa++) {
          try {
            await writeFile(cutoutPathForHash(item.hash), await photoroomCutout(key, item.src))
            break
          } catch (err) {
            // 429 = plan rate limit; the body says how long to wait.
            const espera = /available in (\d+) seconds/.exec(String(err))?.[1]
            if (tentativa >= 6) throw err
            await new Promise((r) => setTimeout(r, espera ? (Number(espera) + 1) * 1000 : 1500 * tentativa))
          }
        }
        feitas += 1
        if (feitas % 25 === 0) console.log(`  ${feitas}/${pending.length}`)
      }
    }
    await Promise.all(Array.from({ length: 2 }, worker))
    return bySrc
  }

  const workIn = path.join(tmpdir(), `rembg-in-${Date.now()}`)
  const workOut = path.join(tmpdir(), `rembg-out-${Date.now()}`)
  await mkdir(workIn, { recursive: true })
  await mkdir(workOut, { recursive: true })

  for (const { src, hash } of pending) {
    const png = await sharp(src).rotate().png().toBuffer()
    await writeFile(path.join(workIn, `${hash}.png`), png)
  }

  console.log(`A remover fundo de ${pending.length} imagens (rembg)…`)
  const res = spawnSync(
    "uvx",
    ["--python", "3.11", "--from", "rembg[cpu,cli]", "rembg", "p", workIn, workOut],
    { stdio: "inherit" },
  )
  if (res.status !== 0) {
    throw new Error(
      "rembg falhou — verifica que o uv está instalado (https://docs.astral.sh/uv/)",
    )
  }

  for (const { hash } of pending) {
    const out = path.join(workOut, `${hash}.png`)
    if (!existsSync(out)) throw new Error(`rembg não produziu output para ${hash}`)
    await copyFile(out, cutoutPathForHash(hash))
  }

  await rm(workIn, { recursive: true, force: true })
  await rm(workOut, { recursive: true, force: true })
  return bySrc
}

export function resolveRepoPath(p) {
  return path.isAbsolute(p) ? p : path.join(ROOT, p)
}

export function toRepoRelative(abs) {
  return path.relative(ROOT, abs).split(path.sep).join("/")
}

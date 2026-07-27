// Shared rembg helpers for process.mjs + preview.mjs.
import { mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
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

/** Run rembg once over all uncached sources (batch = model loads once). */
export async function ensureCutouts(sources) {
  await mkdir(REMBG_CACHE, { recursive: true })
  const bySrc = new Map()
  const pending = []

  for (const src of sources) {
    const hash = await fileHash(src)
    const cached = cutoutPathForHash(hash)
    bySrc.set(src, cached)
    if (!existsSync(cached)) pending.push({ src, hash })
  }

  if (pending.length === 0) return bySrc

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

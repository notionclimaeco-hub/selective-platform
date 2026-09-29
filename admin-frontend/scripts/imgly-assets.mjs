// Mirrors the `@imgly/background-removal` runtime and model into
// `public/imgly/` so the "Recortar fundo" button loads them from the admin's
// own origin instead of IMG.LY's CDN (issue #63).
//
// IMG.LY never published the 1.7.x data package to npm (the npm package stops
// at 1.4.5 with a different layout), so this fetches the CDN dist directly:
// `resources.json` plus content-addressed 4 MB chunks. Only the entries the
// admin uses are kept (CPU runtime + isnet_fp16, ~96 MB of the ~220 MB total).
// Chunks already on disk with the right size are skipped, so re-runs are free.
//
// Runs as `prebuild`; call directly with `node scripts/imgly-assets.mjs` to
// use the mirror in dev too (recorte.ts falls back to the CDN when absent).
import { createRequire } from "node:module"
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

// Keys of resources.json the admin needs: recorte.ts runs with the default
// `device: "cpu"` and the default `model: "isnet_fp16"`.
export const RECURSOS_USADOS = [
  "/onnxruntime-web/ort-wasm-simd-threaded.wasm",
  "/onnxruntime-web/ort-wasm-simd-threaded.mjs",
  "/models/isnet_fp16",
]

/**
 * Filters the CDN manifest down to `nomes`, throwing when one is missing so a
 * library upgrade that renames a file fails the build instead of the button.
 */
export function selecionarRecursos(manifesto, nomes) {
  const usados = {}
  for (const nome of nomes) {
    const entrada = manifesto[nome]
    if (!entrada) {
      throw new Error(
        `resources.json não tem "${nome}". Entradas disponíveis: ${Object.keys(manifesto).join(", ")}`
      )
    }
    usados[nome] = entrada
  }
  return usados
}

/** Every chunk of the selected entries, in manifest order, with its byte size. */
export function listarChunks(recursos) {
  const chunks = []
  for (const entrada of Object.values(recursos)) {
    for (const chunk of entrada.chunks) {
      chunks.push({
        nome: chunk.name,
        tamanho: chunk.offsets[1] - chunk.offsets[0],
      })
    }
  }
  return chunks
}

/** Chunks not on disk, or on disk with the wrong size (truncated download). */
export function chunksEmFalta(chunks, tamanhosLocais) {
  return chunks.filter((c) => tamanhosLocais.get(c.nome) !== c.tamanho)
}

const CONCORRENCIA = 6

// The package's `exports` map hides its package.json, so walk up from the
// resolved entry point (dist/index.mjs) instead.
async function versaoInstalada() {
  const require = createRequire(import.meta.url)
  const entrada = require.resolve("@imgly/background-removal")
  const pacote = join(dirname(dirname(entrada)), "package.json")
  return JSON.parse(await readFile(pacote, "utf8"))
}

async function descarregar(url, tentativas = 2) {
  for (let i = 1; ; i++) {
    try {
      const resposta = await fetch(url)
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
      return new Uint8Array(await resposta.arrayBuffer())
    } catch (err) {
      if (i >= tentativas) throw new Error(`${url}: ${err.message}`)
    }
  }
}

async function main() {
  const raiz = dirname(dirname(fileURLToPath(import.meta.url)))
  const { version } = await versaoInstalada()
  const base = `https://staticimgly.com/@imgly/background-removal-data/${version}/dist/`
  const destino = join(raiz, "public", "imgly")
  await mkdir(destino, { recursive: true })

  const manifesto = JSON.parse(
    new TextDecoder().decode(await descarregar(`${base}resources.json`))
  )
  const usados = selecionarRecursos(manifesto, RECURSOS_USADOS)
  const chunks = listarChunks(usados)

  const locais = new Map()
  for (const nome of await readdir(destino)) {
    locais.set(nome, (await stat(join(destino, nome))).size)
  }
  const emFalta = chunksEmFalta(chunks, locais)
  const totalMB = (
    chunks.reduce((s, c) => s + c.tamanho, 0) /
    1024 /
    1024
  ).toFixed(0)
  console.log(
    `imgly ${version}: ${chunks.length} chunks (${totalMB} MB), ${emFalta.length} em falta`
  )

  let feitos = 0
  const fila = [...emFalta]
  await Promise.all(
    Array.from({ length: CONCORRENCIA }, async () => {
      for (let chunk = fila.shift(); chunk; chunk = fila.shift()) {
        const dados = await descarregar(`${base}${chunk.nome}`)
        if (dados.byteLength !== chunk.tamanho) {
          throw new Error(
            `${chunk.nome}: esperado ${chunk.tamanho} bytes, recebido ${dados.byteLength}`
          )
        }
        await writeFile(join(destino, chunk.nome), dados)
        feitos++
        console.log(`  ${feitos}/${emFalta.length} ${chunk.nome.slice(0, 12)}…`)
      }
    })
  )
  // Written last so a half-finished mirror is never picked up by recorte.ts.
  await writeFile(
    join(destino, "resources.json"),
    JSON.stringify(usados, null, 2)
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}

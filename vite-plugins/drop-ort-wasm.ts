import type { Plugin } from "vite"

/**
 * `@imgly/background-removal` bundles ONNX Runtime Web, whose chunk references
 * its wasm binary through `new URL(..., import.meta.url)`, so Vite emits a
 * ~24 MB `ort-wasm-*.wasm` asset. The library never fetches that copy: it
 * points the runtime at its own `publicPath` (IMG.LY's CDN by default), so the
 * asset is dead weight in the deploy. Drop it from the client bundle.
 */
export function dropOrtWasm(): Plugin {
  return {
    name: "drop-ort-wasm",
    apply: "build",
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      for (const nome of Object.keys(bundle)) {
        if (/ort-wasm[^/]*\.wasm$/.test(nome)) delete bundle[nome]
      }
    },
  }
}

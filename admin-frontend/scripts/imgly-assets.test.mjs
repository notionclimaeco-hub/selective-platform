import { describe, expect, it } from "vitest"

import {
  RECURSOS_USADOS,
  chunksEmFalta,
  listarChunks,
  selecionarRecursos,
} from "./imgly-assets.mjs"

// Shape of the CDN's resources.json: one entry per file, each split into
// content-addressed chunks. Sizes shrunk for readability.
const manifesto = {
  "/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm": {
    size: 30,
    mime: "application/wasm",
    chunks: [{ hash: "jsep1", name: "jsep1", offsets: [0, 30] }],
  },
  "/onnxruntime-web/ort-wasm-simd-threaded.wasm": {
    size: 25,
    mime: "application/wasm",
    chunks: [
      { hash: "wasm1", name: "wasm1", offsets: [0, 10] },
      { hash: "wasm2", name: "wasm2", offsets: [10, 25] },
    ],
  },
  "/onnxruntime-web/ort-wasm-simd-threaded.mjs": {
    size: 3,
    mime: "text/javascript",
    chunks: [{ hash: "mjs1", name: "mjs1", offsets: [0, 3] }],
  },
  "/models/isnet_fp16": {
    size: 20,
    mime: "application/octet-steam",
    chunks: [
      { hash: "m1", name: "m1", offsets: [0, 10] },
      { hash: "m2", name: "m2", offsets: [10, 20] },
    ],
  },
  "/models/isnet": {
    size: 40,
    mime: "application/octet-steam",
    chunks: [{ hash: "big1", name: "big1", offsets: [0, 40] }],
  },
}

describe("selecionarRecursos", () => {
  it("keeps only the CPU runtime and the fp16 model", () => {
    const usados = selecionarRecursos(manifesto, RECURSOS_USADOS)
    expect(Object.keys(usados).sort()).toEqual(
      [
        "/models/isnet_fp16",
        "/onnxruntime-web/ort-wasm-simd-threaded.mjs",
        "/onnxruntime-web/ort-wasm-simd-threaded.wasm",
      ].sort()
    )
    expect(usados["/models/isnet_fp16"]).toBe(manifesto["/models/isnet_fp16"])
  })

  it("fails loudly when the CDN manifest no longer has an entry we rely on", () => {
    expect(() =>
      selecionarRecursos(manifesto, ["/models/isnet_fp16", "/models/nope"])
    ).toThrow(/\/models\/nope/)
  })
})

describe("listarChunks", () => {
  it("lists every chunk of the selected entries with its byte size", () => {
    const usados = selecionarRecursos(manifesto, RECURSOS_USADOS)
    expect(listarChunks(usados)).toEqual([
      { nome: "wasm1", tamanho: 10 },
      { nome: "wasm2", tamanho: 15 },
      { nome: "mjs1", tamanho: 3 },
      { nome: "m1", tamanho: 10 },
      { nome: "m2", tamanho: 10 },
    ])
  })
})

describe("chunksEmFalta", () => {
  const chunks = [
    { nome: "a", tamanho: 10 },
    { nome: "b", tamanho: 20 },
    { nome: "c", tamanho: 30 },
  ]

  it("skips chunks already on disk with the expected size", () => {
    const locais = new Map([
      ["a", 10],
      ["b", 20],
    ])
    expect(chunksEmFalta(chunks, locais)).toEqual([{ nome: "c", tamanho: 30 }])
  })

  it("re-downloads a chunk whose local size is wrong (truncated download)", () => {
    const locais = new Map([["a", 4]])
    expect(chunksEmFalta(chunks, locais).map((c) => c.nome)).toEqual([
      "a",
      "b",
      "c",
    ])
  })
})

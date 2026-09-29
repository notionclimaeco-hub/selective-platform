import { describe, expect, it } from "vitest"
import { ESTADO_INICIAL, listaAtiva, paraGuardar, reduzir } from "./imagens-estado"
import type { Candidata } from "./imagens-estado"

const c = (id: string, extra: Partial<Candidata> = {}): Candidata => ({
  _id: `id-${id}`, ficheiro: id, url: `u/${id}`, fonte: "site", ...extra,
})

describe("iniciar", () => {
  it("seeds from the decision when present", () => {
    const e = reduzir(ESTADO_INICIAL, { tipo: "iniciar", candidatas: [c("a")],
      escolhidas: { imagens: [{ ficheiro: "a", url: "u/a" }], porRef: [{ ref: "R2", imagens: [{ ficheiro: "b", url: "u/b" }] }] },
      atuais: [] })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["a"])
    expect(listaAtiva(reduzir(e, { tipo: "ativar-ref", ref: "R2" })).map((i) => i.ficheiro)).toEqual(["b"])
  })
  it("iniciar com atuais: seeds the group from the first live ref and per-ref lists that differ", () => {
    const e = reduzir(ESTADO_INICIAL, { tipo: "iniciar", candidatas: [], escolhidas: null,
      atuais: [{ ref: "R1", imagens: [{ ficheiro: "x", url: "u/x" }] }, { ref: "R2", imagens: [{ ficheiro: "y", url: "u/y" }] }] })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["x"])
    expect(e.porRef.R2.map((i) => i.ficheiro)).toEqual(["y"])
    expect(e.porRef.R1).toBeUndefined()
  })
})

describe("escolher / remover / reordenar / capa", () => {
  const base = reduzir(ESTADO_INICIAL, { tipo: "iniciar", candidatas: [c("a"), c("b"), c("d")], escolhidas: null, atuais: [] })
  it("moves a candidate into the active list and back", () => {
    let e = reduzir(base, { tipo: "escolher", ficheiro: "a" })
    e = reduzir(e, { tipo: "escolher", ficheiro: "b" })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["a", "b"])
    expect(reduzir(e, { tipo: "escolher", ficheiro: "a" })).toBe(e) // no duplicates
    e = reduzir(e, { tipo: "remover", ficheiro: "a" })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["b"])
  })
  it("reorders and sets the cover", () => {
    let e = base
    for (const f of ["a", "b", "d"]) e = reduzir(e, { tipo: "escolher", ficheiro: f })
    e = reduzir(e, { tipo: "reordenar", de: "d", para: "a" })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["d", "a", "b"])
    e = reduzir(e, { tipo: "capa", ficheiro: "b" })
    expect(listaAtiva(e)[0]?.ficheiro).toBe("b")
  })
  it("per-ref edits start from the group list and do not touch it", () => {
    let e = reduzir(base, { tipo: "escolher", ficheiro: "a" })
    e = reduzir(e, { tipo: "ativar-ref", ref: "R2" })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["a"])
    e = reduzir(e, { tipo: "escolher", ficheiro: "b" })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["a", "b"])
    expect(e.grupo.map((i) => i.ficheiro)).toEqual(["a"])
    expect(paraGuardar(e)).toEqual({ imagens: ["a"], porRef: [{ ref: "R2", imagens: ["a", "b"] }] })
  })
})

describe("candidata-nova / trocar-recorte", () => {
  it("adds an upload and optionally chooses it; trocar-recorte mantém a posição", () => {
    let e = reduzir(ESTADO_INICIAL, { tipo: "iniciar", candidatas: [c("a"), c("b")], escolhidas: null, atuais: [] })
    e = reduzir(e, { tipo: "candidata-nova", candidata: c("up", { fonte: "upload" }), escolher: true })
    expect(e.candidatas.map((x) => x.ficheiro)).toContain("up")
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["up"])
    e = reduzir(e, { tipo: "escolher", ficheiro: "a" })
    e = reduzir(e, { tipo: "capa", ficheiro: "a" })
    const recorte = c("a-cut", { fonte: "recorte", origem: "id-a" })
    e = reduzir(e, { tipo: "trocar-recorte", ficheiro: "a", recorte })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["a-cut", "up"])
    expect(e.candidatas.find((x) => x._id === "id-a")?.recorteId).toBe("id-a-cut")
    // toggling back swaps the original into the same slot
    e = reduzir(e, { tipo: "trocar-recorte", ficheiro: "a-cut", recorte: c("a") })
    expect(listaAtiva(e).map((i) => i.ficheiro)).toEqual(["a", "up"])
  })
})

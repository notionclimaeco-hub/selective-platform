// Helpers for candidatas.mjs: manifest parsing, coverage report and image preparation.
import { createHash } from "node:crypto"
import sharp from "sharp"

// "web": packshot found by searching the ref (dealer listings, image search); origemUrl says where.
export const FONTES = ["site", "megaclima", "web", "pdf", "upload", "recorte"]

/** manifest {grupoModelo: [{ficheiro, fonte, origemUrl?, cor?}]} → flat entries. */
export function lerManifesto(json, alvos) {
  if (!json || typeof json !== "object") throw new Error("manifesto inválido")
  const grupos = new Map(alvos.grupos.map((g) => [g.grupoModelo, g]))
  const out = []
  for (const [grupoModelo, lista] of Object.entries(json)) {
    if (!grupos.has(grupoModelo)) throw new Error(`grupo desconhecido no manifesto: ${grupoModelo}`)
    for (const e of lista) {
      if (!FONTES.includes(e.fonte)) throw new Error(`fonte inválida em ${grupoModelo}: ${e.fonte}`)
      if (!e.ficheiro) throw new Error(`entrada sem ficheiro em ${grupoModelo}`)
      const entrada = { grupoModelo, marca: alvos.marca, ficheiro: e.ficheiro, fonte: e.fonte }
      if (e.origemUrl) entrada.origemUrl = e.origemUrl
      if (e.cor) entrada.cor = e.cor
      if (e.aviso) entrada.aviso = e.aviso   // why the agent doubts this photo; shown in the review
      out.push(entrada)
    }
  }
  return out
}

const INTERIOR_RX = /(?:interior|indoor|mural|wall|(?:^|[^a-z])ui(?![a-z]))/i
const EXTERIOR_RX = /(?:exterior|outdoor|multisplit|condens|(?:^|[^a-z])ue(?![a-z]))/i

export function cobertura(alvos, entradas) {
  const porGrupo = []
  const semCandidatas = []
  const equipamentoSemSiteNemMegaclima = []
  for (const g of alvos.grupos) {
    const minhas = entradas.filter((e) => e.grupoModelo === g.grupoModelo)
    const n = (fonte) => minhas.filter((e) => e.fonte === fonte).length
    const cores = new Set(minhas.map((e) => e.cor).filter(Boolean))
    const coresEmFalta = g.cores.filter((c) => !cores.has(c))
    const soInterior =
      g.componente === "unidade-exterior" && minhas.length > 0 &&
      minhas.some((e) => INTERIOR_RX.test(e.ficheiro)) &&
      !minhas.some((e) => EXTERIOR_RX.test(e.ficheiro))
    porGrupo.push({ grupoModelo: g.grupoModelo, site: n("site"), megaclima: n("megaclima"), web: n("web"), pdf: n("pdf"),
      upload: n("upload"), recorte: n("recorte"), coresEmFalta, soInterior })
    if (g.acessorio) continue
    if (minhas.length === 0) semCandidatas.push(g.grupoModelo)
    if (n("site") + n("megaclima") + n("web") === 0) equipamentoSemSiteNemMegaclima.push(g.grupoModelo)
  }
  return { porGrupo, semCandidatas, equipamentoSemSiteNemMegaclima }
}

export function coberturaMarkdown(c) {
  const linhas = ["# Cobertura de imagens", "", "| grupo | site | megaclima | web | pdf | upload | recorte | cores em falta | só interior |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
  for (const g of c.porGrupo) {
    linhas.push(`| ${g.grupoModelo} | ${g.site} | ${g.megaclima} | ${g.web} | ${g.pdf} | ${g.upload} | ${g.recorte} | ${g.coresEmFalta.join(", ") || "—"} | ${g.soInterior ? "⚠" : ""} |`)
  }
  linhas.push("", `## Sem candidatas (${c.semCandidatas.length})`, ...c.semCandidatas.map((g) => `- ${g}`))
  linhas.push("", `## Equipamento sem foto do site, Megaclima nem web (${c.equipamentoSemSiteNemMegaclima.length})`,
    ...c.equipamentoSemSiteNemMegaclima.map((g) => `- ${g}`))
  return linhas.join("\n") + "\n"
}

export const MAX_PX = 1600

/** Resize (max 1600 px), JPEG q85 or PNG when there is alpha; sha256 of the result. */
export async function prepararFicheiro(buffer) {
  const img = sharp(buffer).rotate()
  const meta = await img.metadata()
  const comAlfa = meta.hasAlpha === true
  const pipeline = img.resize({ width: MAX_PX, height: MAX_PX, fit: "inside", withoutEnlargement: true })
  const bytes = comAlfa ? await pipeline.png().toBuffer() : await pipeline.jpeg({ quality: 85 }).toBuffer()
  const out = await sharp(bytes).metadata()
  return {
    bytes, hash: createHash("sha256").update(bytes).digest("hex"),
    largura: out.width, altura: out.height, contentType: comAlfa ? "image/png" : "image/jpeg",
  }
}

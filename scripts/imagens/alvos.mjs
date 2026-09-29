// staged run JSON → product-scaffold/imagens/<marca>/alvos.json (groups to photograph).
//   node scripts/imagens/alvos.mjs product-scaffold/pdf-extract/hisense/hisense-2026-staged.json
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const staged = process.argv[2]
if (!staged) { console.error("uso: alvos.mjs <staged.json>"); process.exit(1) }
const run = JSON.parse(await readFile(staged, "utf8"))
const grupos = new Map()
for (const s of run.skus) {
  let g = grupos.get(s.grupoModelo)
  if (!g) {
    g = { grupoModelo: s.grupoModelo, nomeGrupo: s.nomeGrupo, gama: s.gama ?? null, familia: s.familia,
      tipoUnidade: s.tipoUnidade ?? null, componente: s.componente, refs: [], cores: [],
      acessorio: s.familia === "acessorios-e-controlo" || ["acessorio", "comando"].includes(s.componente) }
    grupos.set(s.grupoModelo, g)
  }
  g.refs.push(s.ref)
  const cor = s.atributos.find((a) => a.chave === "cor")?.valor
  if (cor && !g.cores.includes(cor)) g.cores.push(cor)
}
const alvos = { marca: run.marca, tabelaOrigem: run.tabelaOrigem, grupos: [...grupos.values()] }
const out = path.join(ROOT, "product-scaffold/imagens", run.marca, "alvos.json")
await mkdir(path.dirname(out), { recursive: true })
await writeFile(out, JSON.stringify(alvos, null, 2) + "\n")
console.log(`${alvos.grupos.length} grupos (${alvos.grupos.filter((g) => !g.acessorio).length} equipamento) → ${path.relative(ROOT, out)}`)

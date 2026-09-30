// Pure helpers for the agent's photo picks: numbering a group's candidates on
// its contact sheet (folhas.mjs) and turning picked numbers into candidate
// ids for imagens.gravarEscolhasAgente (escolhas.mjs).

/**
 * Sheet order: each photo followed by its cutout, cutouts without a known
 * source last. Numbers start at 1; a cutout carries its source's number
 * (`origemN`) and warning.
 */
export function ordenarParaFolha(candidatas) {
  const recortesDe = new Map()
  const orfaos = []
  const ids = new Set(candidatas.map((c) => c._id))
  for (const c of candidatas) {
    if (c.fonte !== "recorte") continue
    if (c.origem && ids.has(c.origem)) recortesDe.set(c.origem, [...(recortesDe.get(c.origem) ?? []), c])
    else orfaos.push(c)
  }
  const out = []
  for (const c of candidatas) {
    if (c.fonte === "recorte") continue
    const n = out.length + 1
    out.push({ ...c, n })
    for (const r of recortesDe.get(c._id) ?? []) {
      out.push({ ...r, n: out.length + 1, origemN: n, aviso: r.aviso ?? c.aviso })
    }
  }
  for (const r of orfaos) out.push({ ...r, n: out.length + 1 })
  return out
}

/**
 * `escolhas` = { grupoModelo: [n, …] } (first = cover), `indice` = the
 * folhas' { grupoModelo: [{ n, _id, fonte }] }. Empty picks are skipped;
 * unknown groups, numbers or repeats throw. Non-cutout picks come back as
 * `avisos`.
 */
export function resolverEscolhas(escolhas, indice) {
  const out = []
  const avisos = []
  for (const [grupoModelo, numeros] of Object.entries(escolhas)) {
    const folha = indice[grupoModelo]
    if (!folha) throw new Error(`${grupoModelo}: grupo sem folha (corra folhas.mjs)`)
    if (numeros.length === 0) continue
    if (new Set(numeros).size !== numeros.length) throw new Error(`${grupoModelo}: número repetido`)
    const candidatas = numeros.map((n) => {
      const t = folha.find((x) => x.n === n)
      if (!t) throw new Error(`${grupoModelo}: #${n} não existe na folha`)
      if (t.fonte !== "recorte") avisos.push(`${grupoModelo}: #${n} não é recorte (${t.fonte})`)
      return t._id
    })
    out.push({ grupoModelo, candidatas })
  }
  return { escolhas: out, avisos }
}

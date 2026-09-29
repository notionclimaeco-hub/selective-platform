// Pure state for the review page's image panel. The active list is the group
// list or, when a ref is selected, that ref's override (seeded from the group).
export type Fonte = "site" | "megaclima" | "pdf" | "upload" | "recorte"
export type Imagem = { ficheiro: string; url: string }
export type Candidata = Imagem & {
  _id: string
  fonte: Fonte
  origemUrl?: string
  cor?: string
  origem?: string
  recorteId?: string
}
export type Estado = {
  grupo: Array<Imagem>
  porRef: Record<string, Array<Imagem>>
  refAtiva: string | null
  candidatas: Array<Candidata>
}
export type Acao =
  | {
      tipo: "iniciar"
      escolhidas: { imagens: Array<Imagem>; porRef: Array<{ ref: string; imagens: Array<Imagem> }> } | null
      atuais: Array<{ ref: string; imagens: Array<Imagem> }>
      candidatas: Array<Candidata>
    }
  | { tipo: "ativar-ref"; ref: string | null }
  | { tipo: "escolher"; ficheiro: string }
  | { tipo: "remover"; ficheiro: string }
  | { tipo: "reordenar"; de: string; para: string }
  | { tipo: "capa"; ficheiro: string }
  | { tipo: "candidata-nova"; candidata: Candidata; escolher: boolean }
  | { tipo: "trocar-recorte"; ficheiro: string; recorte: Candidata }

export const ESTADO_INICIAL: Estado = { grupo: [], porRef: {}, refAtiva: null, candidatas: [] }

export function listaAtiva(e: Estado): Array<Imagem> {
  if (e.refAtiva !== null && Object.hasOwn(e.porRef, e.refAtiva)) return e.porRef[e.refAtiva]
  return e.grupo
}

function comLista(e: Estado, lista: Array<Imagem>): Estado {
  if (e.refAtiva !== null) return { ...e, porRef: { ...e.porRef, [e.refAtiva]: lista } }
  return { ...e, grupo: lista }
}

function mover<T>(arr: Array<T>, de: number, para: number): Array<T> {
  const out = arr.slice()
  const [item] = out.splice(de, 1)
  if (item !== undefined) out.splice(para, 0, item)
  return out
}

const iguais = (a: Array<Imagem>, b: Array<Imagem>) =>
  a.length === b.length && a.every((x, i) => x.ficheiro === b[i]?.ficheiro)

export function reduzir(e: Estado, a: Acao): Estado {
  switch (a.tipo) {
    case "iniciar": {
      if (a.escolhidas) {
        const porRef: Record<string, Array<Imagem>> = {}
        for (const p of a.escolhidas.porRef) porRef[p.ref] = p.imagens
        return { grupo: a.escolhidas.imagens, porRef, refAtiva: null, candidatas: a.candidatas }
      }
      const grupo = a.atuais[0]?.imagens ?? []
      const porRef: Record<string, Array<Imagem>> = {}
      for (const p of a.atuais) if (!iguais(p.imagens, grupo)) porRef[p.ref] = p.imagens
      return { grupo, porRef, refAtiva: null, candidatas: a.candidatas }
    }
    case "ativar-ref": {
      return { ...e, refAtiva: a.ref }
    }
    case "escolher": {
      const lista = listaAtiva(e)
      if (lista.some((i) => i.ficheiro === a.ficheiro)) return e
      const c = e.candidatas.find((x) => x.ficheiro === a.ficheiro)
      if (!c) return e
      return comLista(e, [...lista, { ficheiro: c.ficheiro, url: c.url }])
    }
    case "remover":
      return comLista(e, listaAtiva(e).filter((i) => i.ficheiro !== a.ficheiro))
    case "reordenar": {
      const lista = listaAtiva(e)
      const de = lista.findIndex((i) => i.ficheiro === a.de)
      const para = lista.findIndex((i) => i.ficheiro === a.para)
      if (de === -1 || para === -1 || de === para) return e
      return comLista(e, mover(lista, de, para))
    }
    case "capa": {
      const lista = listaAtiva(e)
      const idx = lista.findIndex((i) => i.ficheiro === a.ficheiro)
      if (idx <= 0) return e
      return comLista(e, mover(lista, idx, 0))
    }
    case "candidata-nova": {
      const candidatas = e.candidatas.some((x) => x._id === a.candidata._id)
        ? e.candidatas
        : [...e.candidatas, a.candidata]
      const comCand = { ...e, candidatas }
      return a.escolher ? reduzir(comCand, { tipo: "escolher", ficheiro: a.candidata.ficheiro }) : comCand
    }
    case "trocar-recorte": {
      const lista = listaAtiva(e)
      const idx = lista.findIndex((i) => i.ficheiro === a.ficheiro)
      if (lista.some((i) => i.ficheiro === a.recorte.ficheiro)) return e
      const candidatas = e.candidatas.some((x) => x._id === a.recorte._id)
        ? e.candidatas
        : [...e.candidatas, a.recorte]
      const ligadas = candidatas.map((x) =>
        x._id === a.recorte.origem ? { ...x, recorteId: a.recorte._id } : x,
      )
      const comCand = { ...e, candidatas: ligadas }
      if (idx === -1) return comCand
      const nova = lista.slice()
      nova[idx] = { ficheiro: a.recorte.ficheiro, url: a.recorte.url }
      return comLista(comCand, nova)
    }
  }
}

export function paraGuardar(e: Estado): { imagens: Array<string>; porRef?: Array<{ ref: string; imagens: Array<string> }> } {
  const porRef = Object.entries(e.porRef)
    .filter(([, lista]) => !iguais(lista, e.grupo))
    .map(([ref, lista]) => ({ ref, imagens: lista.map((i) => i.ficheiro) }))
  return porRef.length > 0
    ? { imagens: e.grupo.map((i) => i.ficheiro), porRef }
    : { imagens: e.grupo.map((i) => i.ficheiro) }
}

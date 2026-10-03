// PROTOTYPE (#86) — throwaway. Fixture installer orders and an in-memory copy
// of the order machine (convex/lib/encomendaEstados.ts) so the orders list and
// order page variants can be driven without a backend. Reload resets
// everything. Nothing here is imported by production code.

import { useSyncExternalStore } from "react"

export type EstadoEncomenda =
  | "recebida"
  | "aguardando_stock"
  | "aguardando_pagamento"
  | "paga"
  | "pronta_a_levantar"
  | "cancelada"
  | "concluida"

export type EstadoLinha = "por_confirmar" | "confirmada" | "retirada"

export type MotivoCancelamento =
  "installer" | "office" | "payment_expired" | "all_lines_dropped"

export type Buckets = {
  porEnviar: number
  emTransito: number
  noArmazem: number
  falhada: number
}

export type Guia = { numero: string; qty: number; em: number }

export type Linha = {
  id: string
  ref: string
  marca: string
  nome: string
  qty: number
  precoRevendaCents: number
  pvpCents: number
  estadoLinha: EstadoLinha
  custoCents?: number
  buckets?: Buckets
  guias: Array<Guia>
}

export type Excecao = {
  id: string
  tipo: "reembolso" | "faturacao"
  linhaId?: string
  /** Units a reembolso covers; while open, more failures on the line add to it. */
  qty?: number
  /** The nota de crédito that goes with a reembolso. */
  documentoId?: string
  valorCents?: number
  descricao: string
  criadaEm: number
  resolvidaEm?: number
  resolvidaPor?: string
}

export type TipoDocumento = "fatura-recibo" | "nota-credito" | "guia-transporte"

export type Documento = {
  id: string
  tipo: TipoDocumento
  numero?: string
  estado: "a_emitir" | "emitido" | "erro"
  valorCents?: number
  em?: number
  erro?: string
  emailEnviadoEm?: number
}

export type Actor = "staff" | "instalador" | "sistema" | "revolut"

export type Evento = { em: number; actor: Actor; por: string; texto: string }

export type Encomenda = {
  numero: number
  empresa: { nome: string; nif: string; email: string; telefone: string }
  colocadaPor: { nome: string; email: string }
  estado: EstadoEncomenda
  cancelReason?: MotivoCancelamento
  motivoCancelamento?: string
  placedAt: number
  stockRequestedAt?: number
  paymentRequestedAt?: number
  paymentExpiresAt?: number
  paidAt?: number
  prontaAt?: number
  levantadaAt?: number
  cancelledAt?: number
  pagamentoToken?: string
  linhas: Array<Linha>
  excecoes: Array<Excecao>
  documentos: Array<Documento>
  eventos: Array<Evento>
  /** Supplier invoices for what we bought for this order, one or more per
   *  brand. Adding the last one is what moves a paid order to "Em trânsito". */
  faturasFornecedor?: Array<FaturaFornecedor>
}

/** The supplier's invoice PDF for one brand of an order: just the file. */
export type FaturaFornecedor = {
  id: string
  marca: string
  ficheiro: string
  em: number
  /** Object URL of the uploaded file (prototype stand-in for storage). */
  url?: string
}

export const IVA = 23
export const STAFF = "Tu"

// --- labels -----------------------------------------------------------------

export const ESTADO_LABELS: Record<EstadoEncomenda, string> = {
  recebida: "Recebida",
  aguardando_stock: "A confirmar stock",
  aguardando_pagamento: "Aguarda pagamento",
  paga: "Paga",
  pronta_a_levantar: "Pronta a levantar",
  cancelada: "Cancelada",
  concluida: "Concluída",
}

/** Tone of each order state for `Marcador`: the client app's
 *  ESTADO_ENCOMENDA_CLASSES — neutral while the order is on its way, green
 *  once the money is in, red when cancelled. */
export const ESTADO_TOM: Record<
  EstadoEncomenda,
  "neutro" | "aviso" | "progresso" | "feito" | "perigo" | "inativo"
> = {
  recebida: "neutro",
  aguardando_stock: "neutro",
  aguardando_pagamento: "neutro",
  paga: "feito",
  pronta_a_levantar: "feito",
  concluida: "feito",
  cancelada: "perigo",
}

export const ESTADOS_ORDEM: Array<EstadoEncomenda> = [
  "recebida",
  "aguardando_stock",
  "aguardando_pagamento",
  "paga",
  "pronta_a_levantar",
  "concluida",
  "cancelada",
]

export const ESTADO_LINHA_LABELS: Record<EstadoLinha, string> = {
  por_confirmar: "Por confirmar",
  confirmada: "Confirmada",
  retirada: "Retirada",
}

export const MOTIVO_LABELS: Record<MotivoCancelamento, string> = {
  installer: "Pelo instalador",
  office: "Pelo escritório",
  payment_expired: "Pagamento expirado",
  all_lines_dropped: "Todas as linhas retiradas",
}

export const DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  "fatura-recibo": "Fatura-recibo",
  "nota-credito": "Nota de crédito",
  "guia-transporte": "Guia de transporte",
}

export const MARCA_LABELS: Record<string, string> = {
  daikin: "Daikin",
  midea: "Midea",
  hisense: "Hisense",
  nipon: "Nipon",
  mitsubishi: "Mitsubishi",
}

export const BUCKET_LABELS: Record<keyof Buckets, string> = {
  porEnviar: "Por enviar",
  emTransito: "Em trânsito",
  noArmazem: "No armazém",
  falhada: "Falhada",
}

// --- formatting ----------------------------------------------------------------

const eurFmt = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
})
export function eur(cents: number): string {
  return eurFmt.format(cents / 100)
}

const dataHora = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})
const soData = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
})
export function dataHoraCurta(ms: number): string {
  return dataHora.format(ms)
}
export function dataCurta(ms: number): string {
  return soData.format(ms)
}

/** "há 3 h", "há 2 dias", "agora". */
export function ha(ms: number, agora = Date.now()): string {
  const min = Math.round((agora - ms) / 60_000)
  if (min < 1) return "agora"
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? "há 1 dia" : `há ${d} dias`
}

/** "faltam 6 dias" / "expira hoje" / "expirou". */
export function prazo(fim: number, agora = Date.now()): string {
  if (fim < agora) return "expirou"
  const dia = (ms: number) => new Date(ms).setHours(0, 0, 0, 0)
  const dias = Math.round((dia(fim) - dia(agora)) / 86_400_000)
  if (dias === 0) return "expira hoje"
  if (dias === 1) return "falta 1 dia"
  return `faltam ${dias} dias`
}

export function enc(numero: number): string {
  return `ENC-${numero}`
}

// --- derived -------------------------------------------------------------------

export function restantes(e: Encomenda): Array<Linha> {
  return e.linhas.filter((l) => l.estadoLinha !== "retirada")
}

export function totalCents(e: Encomenda): number {
  return restantes(e).reduce((a, l) => a + l.precoRevendaCents * l.qty, 0)
}

export function totalComIvaCents(e: Encomenda): number {
  return Math.round(totalCents(e) * (1 + IVA / 100))
}

/** Sum of recorded supplier costs on remaining lines; null if any is missing. */
export function custoCents(e: Encomenda): number | null {
  let soma = 0
  for (const l of restantes(e)) {
    if (l.custoCents === undefined) return null
    soma += l.custoCents * l.qty
  }
  return soma
}

export function marcas(e: Encomenda): Array<string> {
  return [...new Set(restantes(e).map((l) => l.marca))]
}

export function linhasDaMarca(e: Encomenda, marca: string): Array<Linha> {
  return e.linhas.filter((l) => l.marca === marca)
}

export function somaBuckets(e: Encomenda): Buckets {
  const s: Buckets = { porEnviar: 0, emTransito: 0, noArmazem: 0, falhada: 0 }
  for (const l of restantes(e)) {
    if (!l.buckets) continue
    s.porEnviar += l.buckets.porEnviar
    s.emTransito += l.buckets.emTransito
    s.noArmazem += l.buckets.noArmazem
    s.falhada += l.buckets.falhada
  }
  return s
}

export function excecoesAbertas(e: Encomenda): Array<Excecao> {
  return e.excecoes.filter((x) => !x.resolvidaEm)
}

export type ProximoPasso = {
  /** Office has to do something now. Drives the "action needed" marker. */
  precisa: boolean
  /** Who the order is waiting on. */
  quem: "escritorio" | "instalador" | "fornecedor" | "ninguem"
  texto: string
}

/**
 * PROPOSAL for "action needed" (open question on map #82): office-owned
 * states plus anything with an open exceção or a failed document. Waiting on
 * the installer (payment, pickup) or on a supplier (guias) is not counted.
 */
export function proximoPasso(e: Encomenda, agora = Date.now()): ProximoPasso {
  const abertas = excecoesAbertas(e)
  const docErro = e.documentos.find((d) => d.estado === "erro")
  if (docErro) {
    return {
      precisa: true,
      quem: "escritorio",
      texto: `${DOCUMENTO_LABELS[docErro.tipo]} falhou`,
    }
  }
  if (abertas.length > 0) {
    const tipo = abertas[0].tipo === "reembolso" ? "Reembolso" : "Faturação"
    return {
      precisa: true,
      quem: "escritorio",
      texto:
        abertas.length > 1
          ? `${abertas.length} exceções por resolver`
          : `${tipo} por resolver`,
    }
  }
  switch (e.estado) {
    case "recebida":
      return { precisa: true, quem: "escritorio", texto: "Pedir stock" }
    case "aguardando_stock": {
      const n = e.linhas.filter((l) => l.estadoLinha === "por_confirmar").length
      return n > 0
        ? {
            precisa: true,
            quem: "escritorio",
            texto: n === 1 ? "Confirmar 1 linha" : `Confirmar ${n} linhas`,
          }
        : { precisa: true, quem: "escritorio", texto: "Pedir pagamento" }
    }
    case "aguardando_pagamento":
      return {
        precisa: false,
        quem: "instalador",
        texto: `Pagamento · ${prazo(e.paymentExpiresAt ?? agora, agora)}`,
      }
    case "paga": {
      const s = somaBuckets(e)
      const partes = []
      if (s.porEnviar) partes.push(`${s.porEnviar} por enviar`)
      if (s.emTransito) partes.push(`${s.emTransito} em trânsito`)
      return {
        precisa: false,
        quem: "fornecedor",
        texto: `Fornecedor · ${partes.join(", ")}`,
      }
    }
    case "pronta_a_levantar":
      return { precisa: false, quem: "instalador", texto: "Levantamento" }
    case "concluida":
      return { precisa: false, quem: "ninguem", texto: "—" }
    case "cancelada":
      return { precisa: false, quem: "ninguem", texto: "—" }
  }
}

export function emailFornecedor(
  e: Encomenda,
  marca: string
): {
  assunto: string
  corpo: string
} {
  const linhas = linhasDaMarca(e, marca).filter(
    (l) => l.estadoLinha !== "retirada"
  )
  const tabela = linhas
    .map((l) => `${l.ref.padEnd(22)} ${String(l.qty).padStart(3)}  ${l.nome}`)
    .join("\n")
  return {
    assunto: `Pedido de stock ${enc(e.numero)} — ${MARCA_LABELS[marca] ?? marca}`,
    corpo: `Bom dia,

Pedimos a confirmação de stock e preço para a encomenda ${enc(e.numero)}:

Referência             Qtd  Descrição
${tabela}

Obrigado,
Climaeco · Selective`,
  }
}

export function linkPagamento(e: Encomenda): string | null {
  return e.pagamentoToken
    ? `https://climaecopro.com/pagamento/${e.pagamentoToken}`
    : null
}

// --- fixtures ------------------------------------------------------------------

const AGORA = Date.now()
const H = 3_600_000
const D = 24 * H

const EMPRESAS = {
  clima: {
    nome: "Clima Teste Lda",
    nif: "509876543",
    email: "geral@climateste.pt",
    telefone: "912 345 678",
  },
  frio: {
    nome: "Frio Norte Instalações",
    nif: "514223901",
    email: "compras@frionorte.pt",
    telefone: "226 001 220",
  },
  termo: {
    nome: "Termotec Algarve",
    nif: "507112398",
    email: "encomendas@termotec.pt",
    telefone: "289 410 500",
  },
  ar: {
    nome: "ArPuro Serviços Unipessoal",
    nif: "516003774",
    email: "arpuro@gmail.com",
    telefone: "934 777 102",
  },
  beira: {
    nome: "Beira Clima & Energia",
    nif: "513998120",
    email: "info@beiraclima.pt",
    telefone: "232 118 404",
  },
}

const PESSOAS = {
  rui: { nome: "Rui Almeida", email: "rui@climateste.pt" },
  joana: { nome: "Joana Pires", email: "joana@frionorte.pt" },
  miguel: { nome: "Miguel Sousa", email: "miguel@termotec.pt" },
  tiago: { nome: "Tiago Faria", email: "arpuro@gmail.com" },
  sara: { nome: "Sara Lopes", email: "sara@beiraclima.pt" },
}

/** Small catalog for "Adicionar linha". */
export const CATALOGO: Array<
  Pick<Linha, "ref" | "marca" | "nome" | "precoRevendaCents" | "pvpCents">
> = [
  {
    ref: "FTXM35R",
    marca: "daikin",
    nome: "Perfera FTXM-R 3,5 kW — unidade interior",
    precoRevendaCents: 41250,
    pvpCents: 61800,
  },
  {
    ref: "RXM35R",
    marca: "daikin",
    nome: "Perfera RXM-R 3,5 kW — unidade exterior",
    precoRevendaCents: 58900,
    pvpCents: 88200,
  },
  {
    ref: "FTXM25R",
    marca: "daikin",
    nome: "Perfera FTXM-R 2,5 kW — unidade interior",
    precoRevendaCents: 36800,
    pvpCents: 55100,
  },
  {
    ref: "BRC1H52W",
    marca: "daikin",
    nome: "Madoka comando por cabo, branco",
    precoRevendaCents: 8900,
    pvpCents: 13300,
  },
  {
    ref: "MSAGBU-12HRFN8",
    marca: "midea",
    nome: "Xtreme Save 12000 BTU — conjunto",
    precoRevendaCents: 49900,
    pvpCents: 74900,
  },
  {
    ref: "M4OD-28HFN8-Q",
    marca: "midea",
    nome: "Multi-split exterior 8,2 kW (4 saídas)",
    precoRevendaCents: 112000,
    pvpCents: 168000,
  },
  {
    ref: "AS-12UW4RYDTV",
    marca: "hisense",
    nome: "Energy Pro 3,5 kW — conjunto",
    precoRevendaCents: 54500,
    pvpCents: 81500,
  },
  {
    ref: "AMW-08U4RGC",
    marca: "hisense",
    nome: "Hi-Therma monobloco 8 kW",
    precoRevendaCents: 289000,
    pvpCents: 432000,
  },
  {
    ref: "NIP-VEN-09",
    marca: "nipon",
    nome: "Venice 9000 BTU — conjunto",
    precoRevendaCents: 31900,
    pvpCents: 47900,
  },
]

let seq = 0
function linha(
  ref: string,
  qty: number,
  estadoLinha: EstadoLinha,
  extra: Partial<Linha> = {}
): Linha {
  const sku = CATALOGO.find((c) => c.ref === ref)
  if (!sku) throw new Error(ref)
  return { id: `l${++seq}`, ...sku, qty, estadoLinha, guias: [], ...extra }
}

function b(
  porEnviar: number,
  emTransito = 0,
  noArmazem = 0,
  falhada = 0
): Buckets {
  return { porEnviar, emTransito, noArmazem, falhada }
}

function ev(em: number, actor: Actor, texto: string, por?: string): Evento {
  const nomes: Record<Actor, string> = {
    staff: "Ana Ribeiro",
    instalador: "Instalador",
    sistema: "Sistema",
    revolut: "Revolut",
  }
  return { em, actor, por: por ?? nomes[actor], texto }
}

function fixtures(): Array<Encomenda> {
  return [
    {
      numero: 1048,
      empresa: EMPRESAS.clima,
      colocadaPor: PESSOAS.rui,
      estado: "recebida",
      placedAt: AGORA - 2 * H,
      linhas: [
        linha("FTXM35R", 3, "por_confirmar"),
        linha("RXM35R", 3, "por_confirmar"),
        linha("BRC1H52W", 3, "por_confirmar"),
        linha("MSAGBU-12HRFN8", 2, "por_confirmar"),
      ],
      excecoes: [],
      documentos: [],
      eventos: [
        ev(AGORA - 2 * H, "instalador", "Encomenda colocada", "Rui Almeida"),
      ],
    },
    {
      numero: 1047,
      empresa: EMPRESAS.ar,
      colocadaPor: PESSOAS.tiago,
      estado: "recebida",
      placedAt: AGORA - 20 * H,
      linhas: [linha("NIP-VEN-09", 4, "por_confirmar")],
      excecoes: [],
      documentos: [],
      eventos: [
        ev(AGORA - 20 * H, "instalador", "Encomenda colocada", "Tiago Faria"),
      ],
    },
    {
      numero: 1046,
      empresa: EMPRESAS.frio,
      colocadaPor: PESSOAS.joana,
      estado: "aguardando_stock",
      placedAt: AGORA - 1.5 * D,
      stockRequestedAt: AGORA - 1.4 * D,
      linhas: [
        linha("AS-12UW4RYDTV", 5, "confirmada", { custoCents: 41200 }),
        linha("AMW-08U4RGC", 1, "por_confirmar"),
        linha("FTXM25R", 2, "confirmada", { custoCents: 27900 }),
        linha("RXM35R", 2, "retirada"),
      ],
      excecoes: [],
      documentos: [],
      eventos: [
        ev(AGORA - 1.5 * D, "instalador", "Encomenda colocada", "Joana Pires"),
        ev(AGORA - 1.4 * D, "staff", "Stock pedido (Hisense, Daikin)"),
        ev(
          AGORA - 0.9 * D,
          "staff",
          "AS-12UW4RYDTV confirmada · custo 412,00 €"
        ),
        ev(AGORA - 0.8 * D, "staff", "RXM35R retirada"),
        ev(AGORA - 0.7 * D, "staff", "FTXM25R confirmada · custo 279,00 €"),
      ],
    },
    {
      numero: 1045,
      empresa: EMPRESAS.termo,
      colocadaPor: PESSOAS.miguel,
      estado: "aguardando_stock",
      placedAt: AGORA - 2.2 * D,
      stockRequestedAt: AGORA - 2.1 * D,
      linhas: [
        linha("M4OD-28HFN8-Q", 1, "confirmada", { custoCents: 84500 }),
        linha("MSAGBU-12HRFN8", 4, "confirmada", { custoCents: 37600 }),
      ],
      excecoes: [],
      documentos: [],
      eventos: [
        ev(AGORA - 2.2 * D, "instalador", "Encomenda colocada", "Miguel Sousa"),
        ev(AGORA - 2.1 * D, "staff", "Stock pedido (Midea)"),
        ev(AGORA - 3 * H, "staff", "M4OD-28HFN8-Q confirmada · custo 845,00 €"),
        ev(
          AGORA - 3 * H,
          "staff",
          "MSAGBU-12HRFN8 confirmada · custo 376,00 €"
        ),
      ],
    },
    {
      numero: 1044,
      empresa: EMPRESAS.beira,
      colocadaPor: PESSOAS.sara,
      estado: "aguardando_pagamento",
      placedAt: AGORA - 4 * D,
      stockRequestedAt: AGORA - 3.9 * D,
      paymentRequestedAt: AGORA - 2 * D,
      paymentExpiresAt: AGORA + 5 * D,
      pagamentoToken: "p7Kq2xVb9LmT",
      linhas: [
        linha("FTXM35R", 2, "confirmada", { custoCents: 30800 }),
        linha("RXM35R", 2, "confirmada", { custoCents: 44000 }),
      ],
      excecoes: [],
      documentos: [],
      eventos: [
        ev(AGORA - 4 * D, "instalador", "Encomenda colocada", "Sara Lopes"),
        ev(AGORA - 3.9 * D, "staff", "Stock pedido (Daikin)"),
        ev(AGORA - 2.1 * D, "staff", "2 linhas confirmadas"),
        ev(
          AGORA - 2 * D,
          "staff",
          "Pagamento pedido · 1 820,64 € c/IVA · expira em 7 dias"
        ),
        ev(
          AGORA - 1 * D,
          "revolut",
          "Tentativa de pagamento recusada pelo banco"
        ),
      ],
    },
    {
      numero: 1043,
      empresa: EMPRESAS.clima,
      colocadaPor: PESSOAS.rui,
      estado: "aguardando_pagamento",
      placedAt: AGORA - 8 * D,
      stockRequestedAt: AGORA - 7.9 * D,
      paymentRequestedAt: AGORA - 6.8 * D,
      paymentExpiresAt: AGORA + 4 * H,
      pagamentoToken: "Zr4nW8cQe1Ha",
      linhas: [linha("AS-12UW4RYDTV", 2, "confirmada", { custoCents: 41200 })],
      excecoes: [],
      documentos: [],
      eventos: [
        ev(AGORA - 8 * D, "instalador", "Encomenda colocada", "Rui Almeida"),
        ev(AGORA - 7.9 * D, "staff", "Stock pedido (Hisense)"),
        ev(AGORA - 6.9 * D, "staff", "1 linha confirmada"),
        ev(
          AGORA - 6.8 * D,
          "staff",
          "Pagamento pedido · 1 340,70 € c/IVA · expira em 7 dias"
        ),
      ],
    },
    {
      numero: 1042,
      empresa: EMPRESAS.frio,
      colocadaPor: PESSOAS.joana,
      estado: "paga",
      placedAt: AGORA - 12 * D,
      stockRequestedAt: AGORA - 11.9 * D,
      paymentRequestedAt: AGORA - 10 * D,
      paymentExpiresAt: AGORA - 3 * D,
      paidAt: AGORA - 9 * D,
      pagamentoToken: "Hs81PdEw0yNu",
      linhas: [
        linha("FTXM35R", 4, "confirmada", {
          custoCents: 30800,
          buckets: b(0, 0, 4, 0),
          guias: [{ numero: "GT 2026/18842", qty: 4, em: AGORA - 6 * D }],
        }),
        linha("RXM35R", 4, "confirmada", {
          custoCents: 44000,
          buckets: b(0, 2, 0, 2),
          guias: [{ numero: "GT 2026/18843", qty: 2, em: AGORA - 6 * D }],
        }),
        linha("MSAGBU-12HRFN8", 3, "confirmada", {
          custoCents: 37600,
          buckets: b(3, 0, 0, 0),
        }),
      ],
      excecoes: [
        {
          id: "x1",
          tipo: "reembolso",
          linhaId: "",
          qty: 2,
          documentoId: "d2",
          valorCents: Math.round(2 * 58900 * 1.23),
          descricao: "RXM35R · 2 un. falhadas pelo fornecedor",
          criadaEm: AGORA - 5 * D,
        },
      ],
      documentos: [
        {
          id: "d1",
          tipo: "fatura-recibo",
          numero: "FR 2026/311",
          estado: "emitido",
          em: AGORA - 9 * D,
          emailEnviadoEm: AGORA - 9 * D,
        },
        {
          id: "d2",
          tipo: "nota-credito",
          estado: "a_emitir",
          valorCents: Math.round(2 * 58900 * 1.23),
        },
      ],
      eventos: [
        ev(AGORA - 12 * D, "instalador", "Encomenda colocada", "Joana Pires"),
        ev(AGORA - 11.9 * D, "staff", "Stock pedido (Daikin, Midea)"),
        ev(AGORA - 10.2 * D, "staff", "3 linhas confirmadas"),
        ev(AGORA - 10 * D, "staff", "Pagamento pedido"),
        ev(AGORA - 9 * D, "revolut", "Pagamento recebido"),
        ev(
          AGORA - 9 * D,
          "sistema",
          "Fatura-recibo FR 2026/311 emitida e enviada"
        ),
        ev(AGORA - 6 * D, "staff", "Guia GT 2026/18842 · FTXM35R × 4"),
        ev(AGORA - 6 * D, "staff", "Guia GT 2026/18843 · RXM35R × 2"),
        ev(AGORA - 5 * D, "staff", "RXM35R × 2 falhada · reembolso aberto"),
        ev(AGORA - 2 * D, "staff", "Receção FTXM35R × 4"),
      ],
    },
    {
      numero: 1041,
      empresa: EMPRESAS.termo,
      colocadaPor: PESSOAS.miguel,
      estado: "paga",
      placedAt: AGORA - 6 * D,
      stockRequestedAt: AGORA - 5.9 * D,
      paymentRequestedAt: AGORA - 5 * D,
      paymentExpiresAt: AGORA + 2 * D,
      paidAt: AGORA - 1 * D,
      pagamentoToken: "Qa0pLx3vTn6S",
      linhas: [
        linha("AMW-08U4RGC", 1, "confirmada", {
          custoCents: 221000,
          buckets: b(1),
        }),
        linha("AS-12UW4RYDTV", 3, "confirmada", {
          custoCents: 41200,
          buckets: b(3),
        }),
      ],
      excecoes: [],
      documentos: [
        {
          id: "d3",
          tipo: "fatura-recibo",
          numero: "FR 2026/318",
          estado: "emitido",
          em: AGORA - 1 * D,
          emailEnviadoEm: AGORA - 1 * D,
        },
      ],
      eventos: [
        ev(AGORA - 6 * D, "instalador", "Encomenda colocada", "Miguel Sousa"),
        ev(AGORA - 5.9 * D, "staff", "Stock pedido (Hisense)"),
        ev(AGORA - 5 * D, "staff", "Pagamento pedido"),
        ev(AGORA - 1 * D, "revolut", "Pagamento recebido"),
        ev(
          AGORA - 1 * D,
          "sistema",
          "Fatura-recibo FR 2026/318 emitida e enviada"
        ),
      ],
    },
    {
      numero: 1040,
      empresa: EMPRESAS.beira,
      colocadaPor: PESSOAS.sara,
      estado: "pronta_a_levantar",
      placedAt: AGORA - 15 * D,
      stockRequestedAt: AGORA - 14.9 * D,
      paymentRequestedAt: AGORA - 13 * D,
      paidAt: AGORA - 12 * D,
      prontaAt: AGORA - 1 * D,
      pagamentoToken: "Bv5mRk2sUe7W",
      linhas: [
        linha("FTXM25R", 3, "confirmada", {
          custoCents: 27900,
          buckets: b(0, 0, 3, 0),
          guias: [{ numero: "GT 2026/18701", qty: 3, em: AGORA - 5 * D }],
        }),
        linha("BRC1H52W", 3, "confirmada", {
          custoCents: 6600,
          buckets: b(0, 0, 3, 0),
          guias: [{ numero: "GT 2026/18701", qty: 3, em: AGORA - 5 * D }],
        }),
      ],
      excecoes: [],
      documentos: [
        {
          id: "d4",
          tipo: "fatura-recibo",
          numero: "FR 2026/297",
          estado: "emitido",
          em: AGORA - 12 * D,
          emailEnviadoEm: AGORA - 12 * D,
        },
      ],
      eventos: [
        ev(AGORA - 15 * D, "instalador", "Encomenda colocada", "Sara Lopes"),
        ev(AGORA - 12 * D, "revolut", "Pagamento recebido"),
        ev(
          AGORA - 5 * D,
          "staff",
          "Guia GT 2026/18701 · FTXM25R × 3, BRC1H52W × 3"
        ),
        ev(AGORA - 1 * D, "staff", "Receção FTXM25R × 3, BRC1H52W × 3"),
        ev(
          AGORA - 1 * D,
          "sistema",
          "Pronta a levantar · email enviado ao instalador"
        ),
      ],
    },
    {
      numero: 1039,
      empresa: EMPRESAS.clima,
      colocadaPor: PESSOAS.rui,
      estado: "concluida",
      placedAt: AGORA - 25 * D,
      stockRequestedAt: AGORA - 24.9 * D,
      paymentRequestedAt: AGORA - 23 * D,
      paidAt: AGORA - 22 * D,
      prontaAt: AGORA - 16 * D,
      levantadaAt: AGORA - 14 * D,
      pagamentoToken: "Lc2oYt8aIr4P",
      linhas: [
        linha("MSAGBU-12HRFN8", 6, "confirmada", {
          custoCents: 37600,
          buckets: b(0, 0, 6, 0),
          guias: [{ numero: "MD-55120", qty: 6, em: AGORA - 18 * D }],
        }),
      ],
      excecoes: [],
      documentos: [
        {
          id: "d5",
          tipo: "fatura-recibo",
          numero: "FR 2026/280",
          estado: "emitido",
          em: AGORA - 22 * D,
          emailEnviadoEm: AGORA - 22 * D,
        },
        {
          id: "d6",
          tipo: "guia-transporte",
          numero: "GT 2026/0412",
          estado: "emitido",
          em: AGORA - 14 * D,
          emailEnviadoEm: AGORA - 14 * D,
        },
      ],
      eventos: [
        ev(AGORA - 25 * D, "instalador", "Encomenda colocada", "Rui Almeida"),
        ev(AGORA - 22 * D, "revolut", "Pagamento recebido"),
        ev(AGORA - 16 * D, "sistema", "Pronta a levantar"),
        ev(AGORA - 14 * D, "staff", "Levantamento registado"),
        ev(
          AGORA - 14 * D,
          "sistema",
          "Guia de transporte GT 2026/0412 emitida e enviada"
        ),
      ],
    },
    {
      numero: 1038,
      empresa: EMPRESAS.ar,
      colocadaPor: PESSOAS.tiago,
      estado: "cancelada",
      cancelReason: "payment_expired",
      placedAt: AGORA - 18 * D,
      stockRequestedAt: AGORA - 17.9 * D,
      paymentRequestedAt: AGORA - 16 * D,
      paymentExpiresAt: AGORA - 9 * D,
      cancelledAt: AGORA - 9 * D,
      linhas: [linha("NIP-VEN-09", 2, "confirmada", { custoCents: 22100 })],
      excecoes: [],
      documentos: [],
      eventos: [
        ev(AGORA - 18 * D, "instalador", "Encomenda colocada", "Tiago Faria"),
        ev(AGORA - 16 * D, "staff", "Pagamento pedido"),
        ev(
          AGORA - 9 * D,
          "revolut",
          "Pagamento expirado · encomenda cancelada"
        ),
      ],
    },
    {
      numero: 1037,
      empresa: EMPRESAS.termo,
      colocadaPor: PESSOAS.miguel,
      estado: "concluida",
      placedAt: AGORA - 30 * D,
      paidAt: AGORA - 27 * D,
      prontaAt: AGORA - 20 * D,
      levantadaAt: AGORA - 19 * D,
      linhas: [
        linha("AS-12UW4RYDTV", 2, "confirmada", {
          custoCents: 41200,
          buckets: b(0, 0, 1, 1),
          guias: [{ numero: "HS-7781", qty: 1, em: AGORA - 22 * D }],
        }),
      ],
      excecoes: [
        {
          id: "x2",
          tipo: "reembolso",
          valorCents: Math.round(54500 * 1.23),
          descricao: "AS-12UW4RYDTV · 1 un. falhada",
          criadaEm: AGORA - 23 * D,
          resolvidaEm: AGORA - 21 * D,
          resolvidaPor: "Ana Ribeiro",
        },
      ],
      documentos: [
        {
          id: "d7",
          tipo: "fatura-recibo",
          numero: "FR 2026/251",
          estado: "emitido",
          em: AGORA - 27 * D,
          emailEnviadoEm: AGORA - 27 * D,
        },
        {
          id: "d8",
          tipo: "nota-credito",
          numero: "NC 2026/14",
          estado: "emitido",
          em: AGORA - 21 * D,
          emailEnviadoEm: AGORA - 21 * D,
        },
        {
          id: "d9",
          tipo: "guia-transporte",
          estado: "erro",
          erro: "InvoiceXpress 422: morada de carga em falta",
        },
      ],
      eventos: [
        ev(AGORA - 30 * D, "instalador", "Encomenda colocada", "Miguel Sousa"),
        ev(AGORA - 27 * D, "revolut", "Pagamento recebido"),
        ev(
          AGORA - 23 * D,
          "staff",
          "AS-12UW4RYDTV × 1 falhada · reembolso aberto"
        ),
        ev(AGORA - 21 * D, "staff", "Reembolso resolvido · NC 2026/14"),
        ev(AGORA - 19 * D, "staff", "Levantamento registado"),
        ev(
          AGORA - 19 * D,
          "sistema",
          "Guia de transporte falhou: InvoiceXpress 422"
        ),
      ],
    },
    {
      numero: 1036,
      empresa: EMPRESAS.frio,
      colocadaPor: PESSOAS.joana,
      estado: "cancelada",
      cancelReason: "office",
      motivoCancelamento: "Instalador pediu por telefone",
      placedAt: AGORA - 21 * D,
      stockRequestedAt: AGORA - 20.9 * D,
      cancelledAt: AGORA - 20 * D,
      linhas: [linha("AMW-08U4RGC", 2, "por_confirmar")],
      excecoes: [],
      documentos: [],
      eventos: [
        ev(AGORA - 21 * D, "instalador", "Encomenda colocada", "Joana Pires"),
        ev(AGORA - 20.9 * D, "staff", "Stock pedido (Hisense)"),
        ev(
          AGORA - 20 * D,
          "staff",
          "Cancelada · Instalador pediu por telefone"
        ),
      ],
    },
  ]
}

// --- store ---------------------------------------------------------------------

let estado: Array<Encomenda> = fixtures()
// Point the open reembolso at its line now that ids exist.
{
  const e = estado.find((x) => x.numero === 1042)!
  e.excecoes[0].linhaId = e.linhas[1].id
}
// Supplier invoices (the "Por encomendar" → "Em trânsito" step) on orders that
// are past it, and one order sitting in transit.
{
  const fatura = (numero: number, marca: string, num: string, dias: number) => {
    const e = estado.find((x) => x.numero === numero)!
    ;(e.faturasFornecedor ??= []).push({
      id: `f${numero}${marca}`,
      marca,
      ficheiro: `${num.replace(/\W+/g, "-")}.pdf`,
      em: AGORA - dias * D,
    })
  }
  fatura(1042, "daikin", "FA 2026/7702", 7)
  fatura(1040, "daikin", "FA 2026/7690", 6)
  fatura(1039, "midea", "MD-F 55120", 19)
  fatura(1037, "hisense", "HS/2026/0391", 24)

  const transito: Encomenda = {
    numero: 1049,
    empresa: EMPRESAS.clima,
    colocadaPor: PESSOAS.rui,
    estado: "paga",
    placedAt: AGORA - 7 * D,
    stockRequestedAt: AGORA - 6.9 * D,
    paymentRequestedAt: AGORA - 6 * D,
    paymentExpiresAt: AGORA + D,
    paidAt: AGORA - 4 * D,
    pagamentoToken: "Tm3sWq9xLp2E",
    linhas: [
      linha("AS-12UW4RYDTV", 4, "confirmada", {
        custoCents: 41200,
        buckets: b(0, 4),
      }),
      linha("NIP-VEN-09", 6, "confirmada", {
        custoCents: 22100,
        buckets: b(0, 6),
      }),
    ],
    excecoes: [],
    documentos: [
      {
        id: "d49",
        tipo: "fatura-recibo",
        numero: "FR 2026/321",
        estado: "emitido",
        em: AGORA - 4 * D,
        emailEnviadoEm: AGORA - 4 * D,
      },
    ],
    eventos: [
      ev(AGORA - 7 * D, "instalador", "Encomenda colocada", "Rui Almeida"),
      ev(AGORA - 6.9 * D, "staff", "Stock pedido (Hisense, Nipon)"),
      ev(AGORA - 6 * D, "staff", "Pagamento pedido"),
      ev(AGORA - 4 * D, "revolut", "Pagamento recebido"),
      ev(
        AGORA - 3 * D,
        "staff",
        "Fatura da Hisense adicionada · HS-2026-0412.pdf"
      ),
      ev(AGORA - 2 * D, "staff", "Fatura da Nipon adicionada · NP-88213.pdf"),
    ],
  }
  estado = [transito, ...estado]
  fatura(1049, "hisense", "HS/2026/0412", 3)
  fatura(1049, "nipon", "NP 88213", 2)
}
const ouvintes = new Set<() => void>()

function emitir() {
  estado = [...estado]
  ouvintes.forEach((f) => f())
}

function subscrever(f: () => void) {
  ouvintes.add(f)
  return () => ouvintes.delete(f)
}

export function useEncomendas(): Array<Encomenda> {
  return useSyncExternalStore(
    subscrever,
    () => estado,
    () => estado
  )
}

export function useEncomenda(numero: number): Encomenda | undefined {
  return useEncomendas().find((e) => e.numero === numero)
}

/** Total of the nav badge / list marker. */
export function useContagemAccao(): number {
  return useEncomendas().filter((e) => esperaPor(e).vez === "nos").length
}

function alterar(numero: number, f: (e: Encomenda) => void): Encomenda {
  const i = estado.findIndex((e) => e.numero === numero)
  const antes = estado[i]
  const copia = structuredClone(antes)
  f(copia)
  estado[i] = copia
  emitir()
  return antes
}

function log(e: Encomenda, texto: string, actor: Actor = "staff") {
  e.eventos.push({
    em: Date.now(),
    actor,
    por:
      actor === "staff" ? STAFF : actor === "revolut" ? "Revolut" : "Sistema",
    texto,
  })
}

function falhar(msg: string): never {
  throw new Error(msg)
}

function linhaDe(e: Encomenda, id: string): Linha {
  return e.linhas.find((l) => l.id === id) ?? falhar("linha")
}

/** The line's open reembolso that failures can still add to or undo. */
export function reembolsoAberto(e: Encomenda, linhaId: string) {
  return e.excecoes.find(
    (x) =>
      x.tipo === "reembolso" &&
      x.linhaId === linhaId &&
      !x.resolvidaEm &&
      x.qty !== undefined
  )
}

function aposMovimento(e: Encomenda) {
  const r = restantes(e)
  const resolvidas = r.every(
    (l) => l.buckets && l.buckets.noArmazem + l.buckets.falhada === l.qty
  )
  if (!resolvidas) return
  if (r.some((l) => (l.buckets?.noArmazem ?? 0) > 0)) {
    e.estado = "pronta_a_levantar"
    e.prontaAt = Date.now()
    log(e, "Pronta a levantar · email enviado ao instalador", "sistema")
  } else {
    e.estado = "concluida"
    log(e, "Tudo falhado · encomenda concluída sem levantamento", "sistema")
  }
}

/**
 * Every action returns the order as it was before, so a variant can offer
 * "Anular" by calling `restaurar` (prototype shortcut; the real thing would
 * delay the commit or run the inverse mutation).
 */
export const accoes = {
  restaurar(anterior: Encomenda) {
    const i = estado.findIndex((e) => e.numero === anterior.numero)
    estado[i] = anterior
    emitir()
  },
  pedirStock(n: number) {
    return alterar(n, (e) => {
      if (e.estado !== "recebida") falhar("estado")
      e.estado = "aguardando_stock"
      e.stockRequestedAt = Date.now()
      log(
        e,
        `Stock pedido (${marcas(e)
          .map((m) => MARCA_LABELS[m] ?? m)
          .join(", ")})`
      )
    })
  },
  confirmarLinha(n: number, linhaId: string, custoCents: number) {
    return alterar(n, (e) => {
      const l = linhaDe(e, linhaId)
      l.estadoLinha = "confirmada"
      l.custoCents = custoCents
      log(e, `${l.ref} confirmada · custo ${eur(custoCents)}`)
    })
  },
  alterarQty(n: number, linhaId: string, qty: number) {
    return alterar(n, (e) => {
      const l = linhaDe(e, linhaId)
      const antes = l.qty
      if (qty > antes) l.estadoLinha = "por_confirmar"
      l.qty = qty
      log(e, `${l.ref} quantidade ${antes} → ${qty}`)
    })
  },
  retirarLinha(n: number, linhaId: string) {
    return alterar(n, (e) => {
      const l = linhaDe(e, linhaId)
      l.estadoLinha = "retirada"
      log(e, `${l.ref} retirada`)
      if (restantes(e).length === 0) {
        e.estado = "cancelada"
        e.cancelReason = "all_lines_dropped"
        e.cancelledAt = Date.now()
        log(e, "Todas as linhas retiradas · encomenda cancelada", "sistema")
      }
    })
  },
  adicionarLinha(n: number, ref: string, qty: number) {
    return alterar(n, (e) => {
      const nova = linha(ref, qty, "por_confirmar")
      e.linhas.push(nova)
      log(e, `${ref} × ${qty} adicionado`)
    })
  },
  pedirPagamento(n: number) {
    return alterar(n, (e) => {
      e.estado = "aguardando_pagamento"
      e.paymentRequestedAt = Date.now()
      e.paymentExpiresAt = Date.now() + 7 * D
      e.pagamentoToken ??= Math.random().toString(36).slice(2, 14)
      log(
        e,
        `Pagamento pedido · ${eur(totalComIvaCents(e))} c/IVA · expira em 7 dias`
      )
      log(e, "Email “Link de pagamento” enviado ao instalador", "sistema")
    })
  },
  voltarAEditar(n: number) {
    return alterar(n, (e) => {
      e.estado = "aguardando_stock"
      e.paymentExpiresAt = undefined
      log(e, "Voltou a editar · ordem Revolut cancelada")
    })
  },
  /** Prototype-only: stands in for the Revolut ORDER_COMPLETED webhook. */
  simularPagamento(n: number) {
    return alterar(n, (e) => {
      e.estado = "paga"
      e.paidAt = Date.now()
      for (const l of restantes(e)) l.buckets = b(l.qty)
      log(e, "Pagamento recebido", "revolut")
      e.documentos.push({
        id: `d${++seq}`,
        tipo: "fatura-recibo",
        numero: `FR 2026/${320 + seq}`,
        estado: "emitido",
        em: Date.now(),
        emailEnviadoEm: Date.now(),
      })
      log(e, "Fatura-recibo emitida e enviada ao instalador", "sistema")
    })
  },
  cancelar(n: number, motivo: string) {
    return alterar(n, (e) => {
      const tinhaPagamento = e.estado === "aguardando_pagamento"
      e.estado = "cancelada"
      e.cancelReason = "office"
      e.motivoCancelamento = motivo || undefined
      e.cancelledAt = Date.now()
      log(
        e,
        `Cancelada${motivo ? ` · ${motivo}` : ""}${tinhaPagamento ? " · ordem Revolut cancelada" : ""}`
      )
    })
  },
  /** Record the supplier invoice for one brand: that brand is ordered, its
   *  quantities leave "por enviar" (they are on their way). */
  adicionarFaturaFornecedor(
    n: number,
    marca: string,
    ficheiro: string,
    url?: string
  ) {
    return alterar(n, (e) => {
      ;(e.faturasFornecedor ??= []).push({
        id: `f${++seq}`,
        marca,
        ficheiro,
        em: Date.now(),
        url,
      })
      for (const l of restantes(e)) {
        if (l.marca !== marca || !l.buckets) continue
        l.buckets.emTransito += l.buckets.porEnviar
        l.buckets.porEnviar = 0
      }
      log(
        e,
        `Fatura da ${MARCA_LABELS[marca] ?? marca} adicionada · ${ficheiro}`
      )
    })
  },
  /** Swap the file of a supplier invoice; stock does not move. */
  substituirFaturaFornecedor(
    n: number,
    id: string,
    ficheiro: string,
    url?: string
  ) {
    return alterar(n, (e) => {
      const f =
        (e.faturasFornecedor ?? []).find((x) => x.id === id) ?? falhar("fatura")
      const antes = f.ficheiro
      f.ficheiro = ficheiro
      f.url = url
      f.em = Date.now()
      log(
        e,
        `Fatura da ${MARCA_LABELS[f.marca] ?? f.marca} substituída · ${antes} → ${ficheiro}`
      )
    })
  },
  /** Remove a supplier invoice. Removing a brand's last one puts what is
   *  still in transit back to "por enviar" (the brand is to order again). */
  removerFaturaFornecedor(n: number, id: string) {
    return alterar(n, (e) => {
      const f =
        (e.faturasFornecedor ?? []).find((x) => x.id === id) ?? falhar("fatura")
      e.faturasFornecedor = (e.faturasFornecedor ?? []).filter(
        (x) => x.id !== id
      )
      log(
        e,
        `Fatura da ${MARCA_LABELS[f.marca] ?? f.marca} apagada · ${f.ficheiro}`
      )
      const restam = e.faturasFornecedor.some((x) => x.marca === f.marca)
      if (restam || e.estado !== "paga") return
      for (const l of restantes(e)) {
        if (l.marca !== f.marca || !l.buckets) continue
        l.buckets.porEnviar += l.buckets.emTransito
        l.buckets.emTransito = 0
      }
    })
  },
  registarGuia(n: number, linhaId: string, numero: string, qty: number | null) {
    return alterar(n, (e) => {
      const l = linhaDe(e, linhaId)
      const bk = l.buckets ?? falhar("buckets")
      const q = qty ?? bk.porEnviar
      if (q < 1 || q > bk.porEnviar)
        falhar(`Qtd inválida (disponível ${bk.porEnviar})`)
      bk.porEnviar -= q
      bk.emTransito += q
      l.guias.push({ numero, qty: q, em: Date.now() })
      log(e, `Guia ${numero} · ${l.ref} × ${q}`)
    })
  },
  registarRececao(n: number, linhaId: string, qty: number | null) {
    return alterar(n, (e) => {
      const l = linhaDe(e, linhaId)
      const bk = l.buckets ?? falhar("buckets")
      const q = qty ?? bk.emTransito
      if (q < 1 || q > bk.emTransito)
        falhar(`Qtd inválida (disponível ${bk.emTransito})`)
      bk.emTransito -= q
      bk.noArmazem += q
      log(e, `Receção ${l.ref} × ${q}`)
      aposMovimento(e)
    })
  },
  falharQty(n: number, linhaId: string, qty: number | null) {
    return alterar(n, (e) => {
      const l = linhaDe(e, linhaId)
      const bk = l.buckets ?? falhar("buckets")
      // Before the supplier invoice the qty is "por enviar"; after it, "em trânsito".
      const fonte: "porEnviar" | "emTransito" =
        bk.porEnviar > 0 ? "porEnviar" : "emTransito"
      const q = qty ?? bk[fonte]
      if (q < 1 || q > bk[fonte])
        falhar(`Qtd inválida (disponível ${bk[fonte]})`)
      bk[fonte] -= q
      bk.falhada += q
      const valor = Math.round(q * l.precoRevendaCents * (1 + IVA / 100))
      // One open reembolso per line: failing more adds to it.
      const aberto = reembolsoAberto(e, linhaId)
      if (aberto) {
        aberto.qty! += q
        aberto.valorCents = (aberto.valorCents ?? 0) + valor
        aberto.descricao = `${l.ref} · ${aberto.qty} un. ${aberto.qty === 1 ? "falhada" : "falhadas"} pelo fornecedor`
        const nc = e.documentos.find((d) => d.id === aberto.documentoId)
        if (nc) nc.valorCents = aberto.valorCents
      } else {
        const documentoId = `d${++seq}`
        e.excecoes.push({
          id: `x${++seq}`,
          tipo: "reembolso",
          linhaId,
          qty: q,
          documentoId,
          valorCents: valor,
          descricao: `${l.ref} · ${q} un. ${q === 1 ? "falhada" : "falhadas"} pelo fornecedor`,
          criadaEm: Date.now(),
        })
        e.documentos.push({
          id: documentoId,
          tipo: "nota-credito",
          estado: "a_emitir",
          valorCents: valor,
        })
      }
      log(e, `${l.ref} × ${q} falhada · reembolso ${eur(valor)} aberto`)
      aposMovimento(e)
    })
  },
  /** Undo one received unit: back to "em trânsito". */
  desfazerRececao(n: number, linhaId: string) {
    return alterar(n, (e) => {
      const l = linhaDe(e, linhaId)
      const bk = l.buckets ?? falhar("buckets")
      if (e.estado !== "paga" || bk.noArmazem < 1) falhar("Nada para desfazer")
      bk.noArmazem -= 1
      bk.emTransito += 1
      log(e, `Receção ${l.ref} × 1 desfeita`)
    })
  },
  /** Undo one failed unit while its reembolso is still open: the unit goes
   *  back where it came from and the reembolso (and its nota de crédito)
   *  shrinks, or disappears at zero. */
  desfazerFalha(n: number, linhaId: string) {
    return alterar(n, (e) => {
      const l = linhaDe(e, linhaId)
      const bk = l.buckets ?? falhar("buckets")
      const x = reembolsoAberto(e, linhaId)
      if (e.estado !== "paga" || !x || bk.falhada < 1)
        falhar("Só se desfaz com o reembolso por resolver")
      const valor = Math.round(l.precoRevendaCents * (1 + IVA / 100))
      x.qty! -= 1
      x.valorCents = (x.valorCents ?? 0) - valor
      x.descricao = `${l.ref} · ${x.qty} un. ${x.qty === 1 ? "falhada" : "falhadas"} pelo fornecedor`
      const nc = e.documentos.find((d) => d.id === x.documentoId)
      if (nc) nc.valorCents = x.valorCents
      if (x.qty === 0) {
        e.excecoes = e.excecoes.filter((y) => y !== x)
        e.documentos = e.documentos.filter((d) => d.id !== x.documentoId)
      }
      bk.falhada -= 1
      if (marcasSemFatura(e).includes(l.marca)) bk.porEnviar += 1
      else bk.emTransito += 1
      log(e, `Falha ${l.ref} × 1 desfeita`)
    })
  },
  registarLevantamento(n: number) {
    return alterar(n, (e) => {
      e.estado = "concluida"
      e.levantadaAt = Date.now()
      log(e, "Levantamento registado")
      e.documentos.push({
        id: `d${++seq}`,
        tipo: "guia-transporte",
        numero: `GT 2026/0${430 + seq}`,
        estado: "emitido",
        em: Date.now(),
        emailEnviadoEm: Date.now(),
      })
      log(e, "Guia de transporte emitida e enviada ao instalador", "sistema")
    })
  },
  resolverExcecao(n: number, id: string) {
    return alterar(n, (e) => {
      const x = e.excecoes.find((y) => y.id === id) ?? falhar("excecao")
      x.resolvidaEm = Date.now()
      x.resolvidaPor = STAFF
      const nc = e.documentos.find(
        (d) => d.tipo === "nota-credito" && d.estado === "a_emitir"
      )
      if (nc) {
        nc.estado = "emitido"
        nc.numero = `NC 2026/${20 + seq}`
        nc.em = Date.now()
        nc.emailEnviadoEm = Date.now()
      }
      log(e, `Exceção resolvida: ${x.descricao}`)
    })
  },
  repetirDocumento(n: number, id: string) {
    return alterar(n, (e) => {
      const d = e.documentos.find((y) => y.id === id) ?? falhar("doc")
      d.estado = "emitido"
      d.erro = undefined
      d.numero = `GT 2026/0${440 + seq}`
      d.em = Date.now()
      d.emailEnviadoEm = Date.now()
      log(e, `${DOCUMENTO_LABELS[d.tipo]} emitida (nova tentativa)`)
    })
  },
}

/** Valid office actions per state — what each order page must surface. */
export function accoesValidas(e: Encomenda) {
  return {
    pedirStock: e.estado === "recebida",
    editarLinhas: e.estado === "recebida" || e.estado === "aguardando_stock",
    pedirPagamento:
      e.estado === "aguardando_stock" &&
      restantes(e).length > 0 &&
      restantes(e).every((l) => l.estadoLinha === "confirmada"),
    voltarAEditar: e.estado === "aguardando_pagamento",
    simularPagamento: e.estado === "aguardando_pagamento",
    cancelar:
      e.estado === "recebida" ||
      e.estado === "aguardando_stock" ||
      e.estado === "aguardando_pagamento",
    moverQty: e.estado === "paga",
    registarLevantamento: e.estado === "pronta_a_levantar",
  }
}

// --- who the order is waiting on (board + ticket screen) ------------------------

export type Vez = "nos" | "cliente" | "fornecedor" | "ninguem"

export type Espera = {
  vez: Vez
  /** What has to happen next, as a short imperative or noun phrase. */
  titulo: string
  /** When the wait started (for "há 3 dias"). */
  desde?: number
  /** Brands involved when waiting on suppliers. */
  marcas?: Array<string>
  /** Late enough to flag: payment expiring, supplier slow, pickup stalled. */
  atrasada?: boolean
}

const DIA = 86_400_000

/**
 * Whose move it is. "nos" = the office must act now; "cliente" = the installer
 * company (pay, collect); "fornecedor" = a supplier (confirm stock, ship,
 * deliver). Open exceptions and failed documents always put it back on us.
 */
export function esperaPor(e: Encomenda, agora = Date.now()): Espera {
  const docErro = e.documentos.find((d) => d.estado === "erro")
  if (docErro) {
    return {
      vez: "nos",
      titulo: `Emitir ${DOCUMENTO_LABELS[docErro.tipo].toLowerCase()}`,
    }
  }
  const abertas = excecoesAbertas(e)
  if (abertas.length > 0) {
    return {
      vez: "nos",
      titulo:
        abertas[0].tipo === "reembolso"
          ? "Resolver reembolso"
          : "Resolver faturação",
      desde: abertas[0].criadaEm,
    }
  }
  switch (e.estado) {
    case "recebida":
      return { vez: "nos", titulo: "Pedir stock", desde: e.placedAt }
    case "aguardando_stock": {
      const pendentes = e.linhas.filter(
        (l) => l.estadoLinha === "por_confirmar"
      )
      if (pendentes.length === 0) {
        return { vez: "nos", titulo: "Pedir pagamento" }
      }
      const desde = e.stockRequestedAt ?? e.placedAt
      return {
        vez: "fornecedor",
        titulo: "Confirmação de stock",
        desde,
        marcas: [...new Set(pendentes.map((l) => l.marca))],
        atrasada: agora - desde > 2 * DIA,
      }
    }
    case "aguardando_pagamento": {
      const fim = e.paymentExpiresAt ?? agora
      return {
        vez: "cliente",
        titulo: "Pagamento",
        desde: e.paymentRequestedAt,
        atrasada: fim - agora < DIA,
      }
    }
    case "paga": {
      const semFatura = marcasSemFatura(e)
      if (semFatura.length > 0) {
        const desde = e.paidAt ?? agora
        return {
          vez: "nos",
          titulo: "Encomendar",
          desde,
          marcas: semFatura,
          atrasada: agora - desde > DIA,
        }
      }
      const s = somaBuckets(e)
      const desde = ultimaFatura(e) ?? e.paidAt ?? agora
      return {
        vez: "fornecedor",
        titulo: `Entrega de ${s.emTransito} un. no armazém`,
        desde,
        marcas: [
          ...new Set(
            restantes(e)
              .filter((l) => (l.buckets?.emTransito ?? 0) > 0)
              .map((l) => l.marca)
          ),
        ],
        atrasada: agora - desde > 5 * DIA,
      }
    }
    case "pronta_a_levantar": {
      const desde = e.prontaAt ?? agora
      return {
        vez: "cliente",
        titulo: "Levantamento no armazém",
        desde,
        atrasada: agora - desde > 7 * DIA,
      }
    }
    case "concluida":
    case "cancelada":
      return { vez: "ninguem", titulo: ESTADO_LABELS[e.estado] }
  }
}

// --- stages (board lanes) ---------------------------------------------------------

/**
 * The office's stages for an order (user, 2026-10-01). "Por encomendar" and
 * "Em trânsito" split the backend's single `paga` state: a paid order is "por
 * encomendar" until every supplier's invoice is recorded (the purchase was
 * placed by email or on the portal), then "em trânsito" until everything is at
 * the warehouse. "Em armazém" is the backend's `pronta_a_levantar`.
 */
export type Etapa =
  | "recebida"
  | "aguardando_stock"
  | "aguardando_pagamento"
  | "por_encomendar"
  | "em_transito"
  | "em_armazem"
  | "concluida"
  | "cancelada"

/** The open stages, one board lane each. */
export type Fase = Exclude<Etapa, "concluida" | "cancelada">

export const ETAPAS_QUADRO: Array<Fase> = [
  "recebida",
  "aguardando_stock",
  "aguardando_pagamento",
  "por_encomendar",
  "em_transito",
  "em_armazem",
]

/** Short phase names: the board's lanes and the order page's progress bar
 *  use these, so the two always read the same. */
export const FASE_LABELS: Record<Fase, string> = {
  recebida: "Recebida",
  aguardando_stock: "Stock",
  aguardando_pagamento: "Pagamento",
  por_encomendar: "Encomenda",
  em_transito: "Trânsito",
  em_armazem: "Armazém",
}

export const ETAPA_LABELS: Record<Etapa, string> = {
  recebida: "Recebida",
  aguardando_stock: "A confirmar stock",
  aguardando_pagamento: "Aguardar pagamento",
  por_encomendar: "Por encomendar",
  em_transito: "Em trânsito",
  em_armazem: "Em armazém",
  concluida: "Concluída",
  cancelada: "Cancelada",
}

export const ETAPA_TOM: Record<
  Etapa,
  "neutro" | "aviso" | "progresso" | "feito" | "perigo" | "inativo"
> = {
  recebida: "neutro",
  aguardando_stock: "neutro",
  aguardando_pagamento: "neutro",
  por_encomendar: "progresso",
  em_transito: "progresso",
  em_armazem: "feito",
  concluida: "feito",
  cancelada: "perigo",
}

/** Brands of a paid order still to be ordered (no supplier invoice yet). */
export function marcasSemFatura(e: Encomenda): Array<string> {
  const faturadas = new Set((e.faturasFornecedor ?? []).map((f) => f.marca))
  return [
    ...new Set(
      restantes(e)
        .filter((l) => l.buckets && l.buckets.falhada < l.qty)
        .map((l) => l.marca)
    ),
  ].filter((m) => !faturadas.has(m))
}

function ultimaFatura(e: Encomenda): number | undefined {
  const ems = (e.faturasFornecedor ?? []).map((f) => f.em)
  return ems.length ? Math.max(...ems) : undefined
}

export function etapa(e: Encomenda): Etapa {
  switch (e.estado) {
    case "paga":
      return marcasSemFatura(e).length > 0 ? "por_encomendar" : "em_transito"
    case "pronta_a_levantar":
      return "em_armazem"
    default:
      return e.estado
  }
}

/** Expected supplier total for one brand: confirmed cost × qty still wanted. */
export function custoMarcaCents(e: Encomenda, marca: string): number {
  return restantes(e)
    .filter((l) => l.marca === marca)
    .reduce(
      (a, l) => a + (l.custoCents ?? 0) * (l.qty - (l.buckets?.falhada ?? 0)),
      0
    )
}

/** The purchase-order email for one supplier (after the installer paid). */
export function emailEncomendaFornecedor(
  e: Encomenda,
  marca: string
): { assunto: string; corpo: string } {
  const linhas = restantes(e).filter(
    (l) => l.marca === marca && (l.buckets?.porEnviar ?? l.qty) > 0
  )
  const tabela = linhas
    .map(
      (l) =>
        `${l.ref.padEnd(22)} ${String(l.buckets?.porEnviar ?? l.qty).padStart(3)}  ${eur(l.custoCents ?? 0).padStart(12)}  ${l.nome}`
    )
    .join("\n")
  return {
    assunto: `Encomenda ${enc(e.numero)} — ${MARCA_LABELS[marca] ?? marca}`,
    corpo: `Bom dia,

Confirmamos a encomenda ${enc(e.numero)}, conforme o stock e os preços que nos indicaram:

Referência             Qtd   Preço un.     Descrição
${tabela}

Total s/IVA: ${eur(custoMarcaCents(e, marca))}
Entrega: Rua Dona Dulce de Aragão 9, Loja 3, 2605-652 Belas

Agradecemos o envio da fatura.

Obrigado,
Climaeco · Selective`,
  }
}

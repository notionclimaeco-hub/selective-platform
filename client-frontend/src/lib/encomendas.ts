// Installer-facing labels for installer orders. Keep in sync with the
// validators in convex/schema.ts (estadoEncomenda, estadoLinha, motivo).
import type {
  EstadoEncomenda,
  EstadoLinha,
  FiltroEncomenda,
  MotivoCancelamento,
} from "@convex/lib/encomendaEstados"

export const ESTADO_ENCOMENDA_LABELS: Record<EstadoEncomenda, string> = {
  recebida: "Recebida",
  aguardando_stock: "A confirmar stock",
  aguardando_pagamento: "Aguarda pagamento",
  paga: "Paga",
  cancelada: "Cancelada",
  concluida: "Concluída",
}

/** Badge colours, tokens only: primary once the money is in, destructive
 *  when cancelled, neutral while the order is on its way. */
export const ESTADO_ENCOMENDA_CLASSES: Record<EstadoEncomenda, string> = {
  recebida: "bg-secondary text-secondary-foreground ring-border",
  aguardando_stock: "bg-secondary text-secondary-foreground ring-border",
  aguardando_pagamento: "bg-secondary text-secondary-foreground ring-border",
  paga: "bg-primary/10 text-primary ring-primary/20",
  cancelada: "bg-destructive/10 text-destructive ring-destructive/20",
  concluida: "bg-primary/10 text-primary ring-primary/20",
}

/** Dot colour used by the badge. */
export const ESTADO_ENCOMENDA_PONTO: Record<EstadoEncomenda, string> = {
  recebida: "bg-muted-foreground/60",
  aguardando_stock: "bg-muted-foreground/60",
  aguardando_pagamento: "bg-muted-foreground/60",
  paga: "bg-primary",
  cancelada: "bg-destructive",
  concluida: "bg-primary",
}

export const ESTADO_LINHA_LABELS: Record<EstadoLinha, string> = {
  por_confirmar: "Stock por confirmar",
  confirmada: "Stock confirmado",
  retirada: "Retirada",
}

export const MOTIVO_CANCELAMENTO_LABELS: Record<MotivoCancelamento, string> = {
  installer: "Pela sua empresa",
  office: "Pelo escritório",
  payment_expired: "Prazo de pagamento expirado",
  all_lines_dropped: "Linhas retiradas pelo escritório",
}

/** The orders list chips, in display order; "Todas" is the absent filter. */
export const FILTROS_LISTA: ReadonlyArray<{
  valor: FiltroEncomenda
  rotulo: string
}> = [
  { valor: "a-pagar", rotulo: "A pagar" },
  { valor: "em-curso", rotulo: "Em curso" },
  { valor: "concluidas", rotulo: "Concluídas" },
  { valor: "canceladas", rotulo: "Canceladas" },
]

/** `?filtro=` on /encomendas; anything unknown means "Todas". */
export function lerFiltroEncomendas(search: Record<string, unknown>): {
  filtro?: FiltroEncomenda
} {
  const filtro = FILTROS_LISTA.find((f) => f.valor === search.filtro)?.valor
  return filtro ? { filtro } : {}
}

export function podeCancelarEncomenda(estado: EstadoEncomenda): boolean {
  return (
    estado === "recebida" ||
    estado === "aguardando_stock" ||
    estado === "aguardando_pagamento"
  )
}

/** Orders the installer still has something to wait for or do. */
export function encomendaEmCurso(estado: EstadoEncomenda): boolean {
  return estado !== "cancelada" && estado !== "concluida"
}

const dataHora = new Intl.DateTimeFormat("pt-PT", {
  dateStyle: "medium",
  timeStyle: "short",
})

const soData = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" })

export function formatarDataEncomenda(ms: number): string {
  return dataHora.format(ms)
}

export function formatarData(ms: number): string {
  return soData.format(ms)
}

/** "faltam 6 dias" / "falta 1 dia" / "expira hoje" / "expirou" for a deadline. */
export function prazoRelativo(fimMs: number, agoraMs: number): string {
  const dias = Math.ceil((fimMs - agoraMs) / 86_400_000)
  if (dias < 0) return "expirou"
  if (dias === 0) return "expira hoje"
  if (dias === 1) return "falta 1 dia"
  return `faltam ${dias} dias`
}

// --- timeline -------------------------------------------------------------------

export type PassoEstado = "feito" | "actual" | "futuro" | "cancelado"

export type Passo = {
  chave: string
  titulo: string
  /** One line under the title: a date when the step happened, otherwise a hint. */
  detalhe: string
  estado: PassoEstado
}

type EncomendaParaPassos = {
  estado: EstadoEncomenda
  cancelReason?: MotivoCancelamento
  placedAt: number
  stockRequestedAt?: number
  paymentRequestedAt?: number
  paidAt?: number
  cancelledAt?: number
}

const PASSOS = [
  { chave: "recebida", titulo: "Recebida" },
  { chave: "stock", titulo: "Confirmação de stock" },
  { chave: "pagamento", titulo: "Pagamento" },
  { chave: "fornecedores", titulo: "Encomenda aos fornecedores" },
  { chave: "levantamento", titulo: "Pronta a levantar" },
] as const

/** Index of the step the order is currently on (0..4). */
function indicePasso(e: EncomendaParaPassos): number {
  switch (e.estado) {
    case "recebida":
      return 0
    case "aguardando_stock":
      return 1
    case "aguardando_pagamento":
      return 2
    case "paga":
      return 3
    case "concluida":
      return 4
    case "cancelada":
      // Where it was when cancelled, derived from what had already happened.
      if (e.paidAt) return 3
      if (e.paymentRequestedAt) return 2
      if (e.stockRequestedAt) return 1
      return 0
  }
}

/**
 * The five-step lifecycle as the installer sees it. A cancelled order keeps
 * the steps it completed and marks the one it was on as cancelled, so the
 * timeline still tells the story instead of collapsing to a single label.
 */
export function passosEncomenda(e: EncomendaParaPassos): Array<Passo> {
  const actual = indicePasso(e)
  const cancelada = e.estado === "cancelada"

  return PASSOS.map((passo, i) => {
    let estado: PassoEstado
    if (i < actual) estado = "feito"
    else if (i === actual) estado = cancelada ? "cancelado" : "actual"
    else estado = "futuro"
    // The last step is "done" rather than "current" once the order is complete.
    if (e.estado === "concluida" && i === 4) estado = "feito"

    return { ...passo, detalhe: detalhePasso(passo.chave, estado, e), estado }
  })
}

function detalhePasso(
  chave: (typeof PASSOS)[number]["chave"],
  estado: PassoEstado,
  e: EncomendaParaPassos
): string {
  if (estado === "cancelado") {
    return e.cancelledAt
      ? `Cancelada ${formatarData(e.cancelledAt)}`
      : "Cancelada"
  }
  switch (chave) {
    case "recebida":
      return formatarData(e.placedAt)
    case "stock":
      if (estado === "feito" && e.paymentRequestedAt) {
        return `Confirmado ${formatarData(e.paymentRequestedAt)}`
      }
      if (estado === "actual") return "Com os fornecedores"
      return e.stockRequestedAt
        ? formatarData(e.stockRequestedAt)
        : "Após a receção"
    case "pagamento":
      if (e.paidAt) return `Recebido ${formatarData(e.paidAt)}`
      if (estado === "actual") return "À sua espera"
      return "Transferência bancária"
    case "fornecedores":
      if (estado === "actual") return "Em curso"
      if (estado === "feito") return "Concluída"
      return "Após o pagamento"
    case "levantamento":
      if (estado === "feito") return "No nosso armazém"
      return "Avisamos quando chegar"
  }
}

// --- totals -----------------------------------------------------------------------

/**
 * VAT line for the summary. Uses the charged amount when it exists (so the
 * numbers match the payment exactly) and estimates from the rate otherwise.
 */
export function totaisEncomenda(e: {
  totalRevendaCents: number
  ivaPercent: number
  totalPagamentoCents?: number
}): { subtotal: number; iva: number; total: number; estimado: boolean } {
  const subtotal = e.totalRevendaCents
  if (e.totalPagamentoCents !== undefined) {
    return {
      subtotal,
      iva: e.totalPagamentoCents - subtotal,
      total: e.totalPagamentoCents,
      estimado: false,
    }
  }
  const total = Math.round((subtotal * (100 + e.ivaPercent)) / 100)
  return { subtotal, iva: total - subtotal, total, estimado: true }
}

/** Maps a Convex error message from `encomendas.submeter` to installer copy. */
export function mensagemErroSubmeter(error: unknown): string {
  const raw = error instanceof Error ? error.message : ""
  if (raw.includes("not approved")) return "A empresa ainda não está aprovada."
  if (raw.includes("Not authenticated"))
    return "Entre na área de cliente para submeter."
  if (raw.includes("empty")) return "A lista está vazia."
  if (raw.includes("unpublished") || raw.includes("Unknown"))
    return "Um produto da lista já não está disponível. Remova-o e volte a tentar."
  if (raw.includes("Too many lines"))
    return "A lista tem demasiadas referências (máximo 50)."
  return "Não foi possível submeter a encomenda. Tente novamente."
}

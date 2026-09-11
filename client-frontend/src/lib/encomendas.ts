// Installer-facing labels for installer orders. Keep in sync with the
// validators in convex/schema.ts (estadoEncomenda, estadoLinha, motivo).
import type {
  EstadoEncomenda,
  EstadoLinha,
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

export const ESTADO_ENCOMENDA_CLASSES: Record<EstadoEncomenda, string> = {
  recebida: "bg-amber-100 text-amber-800",
  aguardando_stock: "bg-sky-100 text-sky-800",
  aguardando_pagamento: "bg-orange-100 text-orange-800",
  paga: "bg-green-100 text-green-800",
  cancelada: "bg-muted text-muted-foreground",
  concluida: "bg-green-100 text-green-800",
}

/** What the installer should expect next, per header state. */
export const ESTADO_ENCOMENDA_TEXTO: Record<EstadoEncomenda, string> = {
  recebida:
    "Recebemos a encomenda. O escritório vai pedir stock aos fornecedores. Os preços ficam congelados.",
  aguardando_stock:
    "Estamos a confirmar stock com os fornecedores. Quando todas as linhas estiverem confirmadas, enviamos o pedido de pagamento.",
  aguardando_pagamento:
    "Stock confirmado. Pague por transferência bancária através do link abaixo (válido 7 dias); a fatura-recibo é emitida após o pagamento.",
  paga: "Pagamento recebido. Estamos a encomendar aos fornecedores; o levantamento é no nosso armazém.",
  cancelada: "Esta encomenda foi cancelada. Pode voltar a encomendar a partir do catálogo.",
  concluida: "Todos os equipamentos estão disponíveis para levantamento ou foram reembolsados.",
}

export const ESTADO_LINHA_LABELS: Record<EstadoLinha, string> = {
  por_confirmar: "Por confirmar",
  confirmada: "Stock confirmado",
  retirada: "Retirada",
}

export const MOTIVO_CANCELAMENTO_LABELS: Record<MotivoCancelamento, string> = {
  installer: "Cancelada pela sua empresa.",
  office: "Cancelada pelo escritório.",
  payment_expired: "O prazo de pagamento expirou.",
  all_lines_dropped: "Todas as linhas foram retiradas pelo escritório.",
}

export function podeCancelarEncomenda(estado: EstadoEncomenda): boolean {
  return (
    estado === "recebida" ||
    estado === "aguardando_stock" ||
    estado === "aguardando_pagamento"
  )
}

const dataHora = new Intl.DateTimeFormat("pt-PT", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function formatarDataEncomenda(ms: number): string {
  return dataHora.format(ms)
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

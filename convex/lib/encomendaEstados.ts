import type { Infer } from "convex/values";
import {
  estadoEncomendaValidator,
  estadoLinhaValidator,
  motivoCancelamentoValidator,
} from "../schema";

/**
 * Pure rules of the installer-order machine locked on #5. No database access
 * here — `encomendas.ts` loads documents and calls these.
 */

export type EstadoEncomenda = Infer<typeof estadoEncomendaValidator>;
export type EstadoLinha = Infer<typeof estadoLinhaValidator>;
export type MotivoCancelamento = Infer<typeof motivoCancelamentoValidator>;

export const IVA_PADRAO_PERCENT = 23;
export const MAX_LINHAS_ENCOMENDA = 50;
export const MAX_QTY_LINHA = 999;

export function tituloEncomenda(numero: number, nomeLegal: string): string {
  return `ENC-${numero} — ${nomeLegal}`;
}

export function assertQty(qty: number): number {
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_LINHA) {
    throw new Error(`qty must be an integer between 1 and ${MAX_QTY_LINHA}`);
  }
  return qty;
}

// --- installer list filters -------------------------------------------------

/** The chips on the installer's orders list, each a fixed set of states. */
export const FILTROS_ENCOMENDA = {
  "a-pagar": ["aguardando_pagamento"],
  "em-curso": ["recebida", "aguardando_stock", "paga"],
  concluidas: ["concluida"],
  canceladas: ["cancelada"],
} as const satisfies Record<string, ReadonlyArray<EstadoEncomenda>>;

export type FiltroEncomenda = keyof typeof FILTROS_ENCOMENDA;

// --- header gates -----------------------------------------------------------

/** Installer or office cancel; also ORDER_FAILED and all-lines-dropped. */
export function podeCancelar(estado: EstadoEncomenda): boolean {
  return (
    estado === "recebida" ||
    estado === "aguardando_stock" ||
    estado === "aguardando_pagamento"
  );
}

export function assertPodeCancelar(estado: EstadoEncomenda): void {
  if (!podeCancelar(estado)) {
    throw new Error(`Cannot cancel an order in state ${estado}`);
  }
}

/** Office one-shot "stock requested". */
export function assertPodePedirStock(estado: EstadoEncomenda): void {
  if (estado !== "recebida") {
    throw new Error(`Cannot request stock from state ${estado}`);
  }
}

/** Office confirm / drop / qty / add-line. Not once payment is requested. */
export function podeEditarLinhas(estado: EstadoEncomenda): boolean {
  return estado === "recebida" || estado === "aguardando_stock";
}

export function assertPodeEditarLinhas(estado: EstadoEncomenda): void {
  if (!podeEditarLinhas(estado)) {
    throw new Error(`Cannot edit lines in state ${estado}`);
  }
}

// --- lines ------------------------------------------------------------------

/** A remaining line is any line that is not `retirada`. */
export function linhasRestantes<T extends { estadoLinha: EstadoLinha }>(
  linhas: ReadonlyArray<T>,
): Array<T> {
  return linhas.filter((linha) => linha.estadoLinha !== "retirada");
}

export function totalRestanteCents(
  linhas: ReadonlyArray<{
    estadoLinha: EstadoLinha;
    qty: number;
    precoRevendaCents: number;
  }>,
): number {
  return linhasRestantes(linhas).reduce(
    (acc, linha) => acc + linha.precoRevendaCents * linha.qty,
    0,
  );
}

/**
 * Move to `aguardando_pagamento` only from `aguardando_stock`, with at least
 * one remaining line and every remaining line `confirmada`. There is no
 * pró-forma document: the order page itself is the quote the installer pays.
 */
export function prontaParaPagamento(
  estado: EstadoEncomenda,
  linhas: ReadonlyArray<{ estadoLinha: EstadoLinha }>,
): boolean {
  if (estado !== "aguardando_stock") return false;
  const restantes = linhasRestantes(linhas);
  return (
    restantes.length > 0 &&
    restantes.every((linha) => linha.estadoLinha === "confirmada")
  );
}

export function assertProntaParaPagamento(
  estado: EstadoEncomenda,
  linhas: ReadonlyArray<{ estadoLinha: EstadoLinha }>,
): void {
  if (!prontaParaPagamento(estado, linhas)) {
    throw new Error(
      estado === "aguardando_stock"
        ? "Every remaining line must be confirmed before requesting payment"
        : `Cannot request payment from state ${estado}`,
    );
  }
}

/** Office void-to-edit: back to `aguardando_stock`, Revolut order cancelled. */
export function assertPodeVoltarAEditar(estado: EstadoEncomenda): void {
  if (estado !== "aguardando_pagamento") {
    throw new Error(`Cannot return to editing from state ${estado}`);
  }
}

/** Reduce keeps `confirmada`; any increase returns to `por_confirmar`. */
export function estadoLinhaAposQty(
  estadoLinha: EstadoLinha,
  qtyAtual: number,
  qtyNova: number,
): EstadoLinha {
  if (estadoLinha === "retirada") {
    throw new Error("Cannot change qty of a dropped line");
  }
  return qtyNova > qtyAtual ? "por_confirmar" : estadoLinha;
}

// --- post-pay qty buckets ----------------------------------------------------

export type QtyBuckets = {
  qtyPorEnviar: number;
  qtyEmTransito: number;
  qtyAguardaRecolha: number;
  qtyFalhada: number;
};

export function bucketsIniciais(qty: number): QtyBuckets {
  return {
    qtyPorEnviar: qty,
    qtyEmTransito: 0,
    qtyAguardaRecolha: 0,
    qtyFalhada: 0,
  };
}

export function bucketsValidos(b: QtyBuckets, qty: number): boolean {
  return (
    b.qtyPorEnviar + b.qtyEmTransito + b.qtyAguardaRecolha + b.qtyFalhada ===
    qty
  );
}

function assertMovimento(q: number, disponivel: number, acao: string): void {
  if (!Number.isInteger(q) || q < 1 || q > disponivel) {
    throw new Error(`Invalid ${acao} qty ${q} (available ${disponivel})`);
  }
}

/** Guia de transporte for qty q: porEnviar → emTransito. */
export function registarGuia(b: QtyBuckets, q: number): QtyBuckets {
  assertMovimento(q, b.qtyPorEnviar, "guia");
  return {
    ...b,
    qtyPorEnviar: b.qtyPorEnviar - q,
    qtyEmTransito: b.qtyEmTransito + q,
  };
}

/** Warehouse receipt for qty q: emTransito → aguardaRecolha. */
export function registarRecepcao(b: QtyBuckets, q: number): QtyBuckets {
  assertMovimento(q, b.qtyEmTransito, "warehouse receipt");
  return {
    ...b,
    qtyEmTransito: b.qtyEmTransito - q,
    qtyAguardaRecolha: b.qtyAguardaRecolha + q,
  };
}

/** Fail qty q: porEnviar → falhada. Other qty on the line continues. */
export function registarFalha(b: QtyBuckets, q: number): QtyBuckets {
  assertMovimento(q, b.qtyPorEnviar, "fail");
  return {
    ...b,
    qtyPorEnviar: b.qtyPorEnviar - q,
    qtyFalhada: b.qtyFalhada + q,
  };
}

/** `paga` → `concluida` once every remaining line is fully at the warehouse or failed. */
export function prontaParaConcluir(
  linhas: ReadonlyArray<{
    estadoLinha: EstadoLinha;
    qty: number;
    buckets: QtyBuckets | null;
  }>,
): boolean {
  const restantes = linhasRestantes(linhas);
  return (
    restantes.length > 0 &&
    restantes.every(
      (l) =>
        l.buckets !== null &&
        l.buckets.qtyAguardaRecolha + l.buckets.qtyFalhada === l.qty,
    )
  );
}

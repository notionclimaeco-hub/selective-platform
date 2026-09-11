/**
 * Pure payment rules (#8, #5). No fetch, no database. The Revolut order is
 * created when the office asks for payment; the installer pays on
 * /pagamento/$token; only signed webhooks advance the installer order.
 */

/** Revolut fails a pending order after this; we mirror it as `payment_expired`. */
export const PRAZO_PAGAMENTO_DIAS = 7;
export const PRAZO_PAGAMENTO_ISO = `PT${PRAZO_PAGAMENTO_DIAS * 24}H`;
export const PRAZO_PAGAMENTO_MS = PRAZO_PAGAMENTO_DIAS * 24 * 60 * 60 * 1000;

/** Header totals are s/IVA; the installer pays the documents' total c/IVA. */
export function totalPagamentoCents(totalRevendaCents: number, ivaPercent: number): number {
  return Math.round((totalRevendaCents * (100 + ivaPercent)) / 100);
}

export function referenciaRevolut(numero: number): string {
  return `ENC-${numero}`;
}

export function urlPagamento(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/pagamento/${token}`;
}

// --- webhooks ------------------------------------------------------------------

export const EVENTOS_WEBHOOK = [
  "ORDER_COMPLETED",
  "ORDER_AUTHORISED",
  "ORDER_FAILED",
  "ORDER_CANCELLED",
  "ORDER_PAYMENT_DECLINED",
  "ORDER_PAYMENT_FAILED",
] as const;

export type EventoRevolut = (typeof EVENTOS_WEBHOOK)[number];

export type WebhookRevolut = {
  evento: EventoRevolut;
  orderId: string;
  referencia: string | null;
};

/** `{ event, order_id, merchant_order_ext_ref }`; anything else is ignored. */
export function interpretarWebhook(corpo: unknown): WebhookRevolut | null {
  if (typeof corpo !== "object" || corpo === null) return null;
  const c = corpo as Record<string, unknown>;
  const evento = c.event;
  const orderId = c.order_id;
  if (typeof evento !== "string" || typeof orderId !== "string" || orderId.length === 0) {
    return null;
  }
  if (!(EVENTOS_WEBHOOK as ReadonlyArray<string>).includes(evento)) return null;
  return {
    evento: evento as EventoRevolut,
    orderId,
    referencia: typeof c.merchant_order_ext_ref === "string" ? c.merchant_order_ext_ref : null,
  };
}

/**
 * Terminal Revolut order states map onto the same effects as their webhook
 * events, so the reconciliation sweep and the webhook share one code path.
 */
export function eventoDoEstadoRevolut(state: unknown): EventoRevolut | null {
  switch (state) {
    case "completed":
      return "ORDER_COMPLETED";
    case "failed":
      return "ORDER_FAILED";
    case "cancelled":
      return "ORDER_CANCELLED";
    default:
      return null;
  }
}

// --- signature -----------------------------------------------------------------

/** Accept webhooks whose timestamp is within this window (replay guard). */
export const TOLERANCIA_TIMESTAMP_MS = 5 * 60 * 1000;

/** `Revolut-Signature` may carry several `v1=<hex>` values during rotation. */
export function assinaturasDoCabecalho(cabecalho: string | null): Array<string> {
  if (!cabecalho) return [];
  return cabecalho
    .split(",")
    .map((parte) => parte.trim())
    .filter((parte) => parte.startsWith("v1="))
    .map((parte) => parte.slice(3).toLowerCase());
}

export function timestampValido(timestamp: string | null, agora: number): boolean {
  if (!timestamp) return false;
  const ms = Number(timestamp);
  return Number.isFinite(ms) && Math.abs(agora - ms) <= TOLERANCIA_TIMESTAMP_MS;
}

export function payloadAssinado(timestamp: string, corpo: string): string {
  return `v1.${timestamp}.${corpo}`;
}

export async function hmacHex(segredo: string, mensagem: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(mensagem));
  return [...new Uint8Array(assinatura)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function assinaturaValida(
  segredo: string,
  timestamp: string,
  corpo: string,
  cabecalho: string | null,
): Promise<boolean> {
  const esperada = await hmacHex(segredo, payloadAssinado(timestamp, corpo));
  return assinaturasDoCabecalho(cabecalho).some((s) => s === esperada);
}

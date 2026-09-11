import { describe, expect, it } from "vitest";
import {
  assinaturasDoCabecalho,
  assinaturaValida,
  eventoDoEstadoRevolut,
  hmacHex,
  interpretarWebhook,
  payloadAssinado,
  PRAZO_PAGAMENTO_ISO,
  timestampValido,
  totalPagamentoCents,
  urlPagamento,
} from "./regras";

describe("payment amounts", () => {
  it("charges the s/IVA total plus IVA, rounded to the cent", () => {
    expect(totalPagamentoCents(10000, 23)).toBe(12300);
    expect(totalPagamentoCents(333, 23)).toBe(410); // 409.59 → 410
    expect(totalPagamentoCents(0, 23)).toBe(0);
  });

  it("uses the 7-day window in Revolut's PT form", () => {
    expect(PRAZO_PAGAMENTO_ISO).toBe("PT168H");
  });

  it("builds the public payment url without double slashes", () => {
    expect(urlPagamento("https://selective.pt/", "abc")).toBe("https://selective.pt/pagamento/abc");
  });
});

describe("webhook payloads", () => {
  it("accepts the documented shape and known events", () => {
    expect(
      interpretarWebhook({
        event: "ORDER_COMPLETED",
        order_id: "9fc0",
        merchant_order_ext_ref: "ENC-7",
      }),
    ).toEqual({ evento: "ORDER_COMPLETED", orderId: "9fc0", referencia: "ENC-7" });
    expect(interpretarWebhook({ event: "ORDER_FAILED", order_id: "x" })).toMatchObject({
      evento: "ORDER_FAILED",
      referencia: null,
    });
  });

  it("ignores unknown events and malformed bodies", () => {
    expect(interpretarWebhook({ event: "SOMETHING_ELSE", order_id: "x" })).toBeNull();
    expect(interpretarWebhook({ event: "ORDER_COMPLETED" })).toBeNull();
    expect(interpretarWebhook("nope")).toBeNull();
    expect(interpretarWebhook(null)).toBeNull();
  });

  it("maps terminal Revolut order states to the same events", () => {
    expect(eventoDoEstadoRevolut("completed")).toBe("ORDER_COMPLETED");
    expect(eventoDoEstadoRevolut("failed")).toBe("ORDER_FAILED");
    expect(eventoDoEstadoRevolut("cancelled")).toBe("ORDER_CANCELLED");
    expect(eventoDoEstadoRevolut("pending")).toBeNull();
  });
});

describe("webhook signature", () => {
  const segredo = "wsk_test";
  const timestamp = "1683650202360";
  const corpo = '{"event":"ORDER_COMPLETED","order_id":"1"}';

  it("verifies v1 HMAC-SHA256 over v1.{timestamp}.{body}", async () => {
    const hex = await hmacHex(segredo, payloadAssinado(timestamp, corpo));
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(await assinaturaValida(segredo, timestamp, corpo, `v1=${hex}`)).toBe(true);
    expect(await assinaturaValida(segredo, timestamp, corpo, `v1=${hex.toUpperCase()}`)).toBe(true);
    expect(await assinaturaValida("other", timestamp, corpo, `v1=${hex}`)).toBe(false);
    expect(await assinaturaValida(segredo, timestamp, corpo + " ", `v1=${hex}`)).toBe(false);
    expect(await assinaturaValida(segredo, timestamp, corpo, null)).toBe(false);
  });

  it("accepts any one of several signatures during rotation", async () => {
    const hex = await hmacHex(segredo, payloadAssinado(timestamp, corpo));
    expect(assinaturasDoCabecalho(`v1=abc, v1=${hex}`)).toEqual(["abc", hex]);
    expect(await assinaturaValida(segredo, timestamp, corpo, `v1=abc,v1=${hex}`)).toBe(true);
  });

  it("rejects stale or missing timestamps", () => {
    const agora = 1_700_000_000_000;
    expect(timestampValido(String(agora - 60_000), agora)).toBe(true);
    expect(timestampValido(String(agora - 10 * 60_000), agora)).toBe(false);
    expect(timestampValido("abc", agora)).toBe(false);
    expect(timestampValido(null, agora)).toBe(false);
  });
});

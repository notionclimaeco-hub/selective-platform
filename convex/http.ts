import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { assinaturaValida, interpretarWebhook, timestampValido } from "./revolut/regras";

const http = httpRouter();

/**
 * Revolut Merchant webhooks (#8). Signature over `v1.{timestamp}.{raw body}`
 * with the webhook's signing secret (REVOLUT_WEBHOOK_SECRET); reject stale
 * timestamps. Effects are applied in a mutation, idempotent per event.
 */
http.route({
  path: "/revolut/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const segredo = process.env.REVOLUT_WEBHOOK_SECRET;
    if (!segredo) return new Response("Webhook not configured", { status: 503 });

    const timestamp = request.headers.get("Revolut-Request-Timestamp");
    const corpo = await request.text();
    if (!timestampValido(timestamp, Date.now())) {
      return new Response("Stale timestamp", { status: 401 });
    }
    const valida = await assinaturaValida(
      segredo,
      timestamp as string,
      corpo,
      request.headers.get("Revolut-Signature"),
    );
    if (!valida) return new Response("Invalid signature", { status: 401 });

    let json: unknown;
    try {
      json = JSON.parse(corpo);
    } catch {
      return new Response("Bad Request", { status: 400 });
    }
    const evento = interpretarWebhook(json);
    if (evento === null) return new Response(null, { status: 202 });

    await ctx.runMutation(internal.pagamentos.aplicarEvento, {
      revolutOrderId: evento.orderId,
      evento: evento.evento,
      recebidoEm: Date.now(),
    });
    return new Response(null, { status: 200 });
  }),
});

export default http;

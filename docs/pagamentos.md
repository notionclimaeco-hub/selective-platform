# Payments — Revolut Pay by Bank (#8)

The installer pays one installer order with one bank transfer on our own
page, `/pagamento/$token` (client-frontend, no login — the token is the
credential). The order page in the client area is the quote; there is no
pró-forma document (#14 amendment). Only a **signed Revolut webhook**
moves the order to `paga`; the widget's `onSuccess` never does.

## Flow

1. Office sets **Ação → `Pedir pagamento`** on a ticket at `Pronta a cobrar`
   (every remaining line `confirmada`). `revolut/fluxo.ts::pedirPagamento`
   creates the Revolut order (`amount` = total s/IVA + IVA, `EUR`,
   `expire_pending_after: PT168H`, `merchant_order_data.reference: ENC-n`)
   and the header moves to `aguardando_pagamento` with `pagamentoToken`,
   `revolutOrderId`, `revolutToken`, `totalPagamentoCents`,
   `paymentExpiresAt`. Notion mirrors `Link pagamento` and logs the request.
   If the header cannot move (lines changed meanwhile) the Revolut order is
   cancelled again.
2. Installer opens the link (client area CTA or the mirrored link), clicks
   **Pagar com o meu banco**. The page loads `@revolut/checkout`, calls
   `RevolutCheckout.payments({ publicToken, mode, locale: "pt" })` and mounts
   **only** `payByBank({ createOrder: () => ({ publicId: revolutToken }),
   location: "PT" })`. Card / Revolut Pay / hosted `checkout_url` are not
   offered.
3. Revolut posts to `POST /revolut/webhook` (convex `http.ts`). We verify
   `Revolut-Signature` = HMAC-SHA256(`v1.{timestamp}.{raw body}`) with
   `REVOLUT_WEBHOOK_SECRET`, reject timestamps older than 5 minutes, then
   `pagamentos.aplicarEvento` (idempotent per order × event, audited in
   `pagamentoEventos`):
   - `ORDER_COMPLETED` → `paga`, `paidAt`, qty buckets initialised on the
     remaining lines, Registo "Pagamento recebido". (Fatura-recibo emission
     hooks here — #14, next slice.)
   - `ORDER_FAILED` (7-day expiry) → `cancelada` / `payment_expired`.
   - `ORDER_CANCELLED` (cancelled outside the platform) → `cancelada` / `office`.
   - `ORDER_PAYMENT_DECLINED` / `ORDER_PAYMENT_FAILED` → Registo only; the
     installer retries on the same Revolut order.
   - `ORDER_COMPLETED` on an order no longer `aguardando_pagamento` (paid
     during a cancel / void-to-edit race) → `paidAt` set, header unchanged,
     Registo `ATENÇÃO … reembolso manual necessário`. Pay by Bank has no API
     refunds.
4. **`Voltar a editar`** cancels the Revolut order first; if Revolut says it
   is already `completed`, the payment is applied instead and the action is
   refused. Installer / office **`Cancelar`** while awaiting payment
   schedules a best-effort cancel of the Revolut order.
5. Cron `revolut payment reconciliation` (hourly): orders past
   `paymentExpiresAt` still awaiting payment are read back from Revolut and
   their terminal state applied — covers a missed webhook.

The payment page is reactive: once the webhook lands it flips to
"Pagamento recebido" on its own.

## Configuration

Convex deployment (`npx convex env set …`):

| Var | Purpose |
| --- | --- |
| `REVOLUT_SECRET_KEY` | Merchant API secret key (`sk_…`). Development uses the developer's own Revolut Business merchant account — Pay by Bank has no sandbox. |
| `REVOLUT_WEBHOOK_SECRET` | `signing_secret` returned when the webhook is created (below). |
| `REVOLUT_API_HOST` | Optional. Default `https://merchant.revolut.com`; `https://sandbox-merchant.revolut.com` for card-only CI runs. |
| `CLIENT_APP_URL` | Public origin of client-frontend, used for the mirrored `Link pagamento` (e.g. `http://localhost:3000` in dev). |

client-frontend (`.env`): `VITE_REVOLUT_PUBLIC_KEY` (`pk_…`, must match the
secret key's environment) and optional `VITE_REVOLUT_MODE=sandbox`
(default `prod`).

### Register the webhook (once per deployment)

Revolut has no dashboard UI for Merchant webhooks; use the API. Never paste
the secret anywhere — pipe it straight into the Convex env:

```sh
export RK=$(npx convex env get REVOLUT_SECRET_KEY)
curl -s -X POST https://merchant.revolut.com/api/webhooks \
  -H "Authorization: Bearer $RK" -H "Revolut-Api-Version: 2026-04-20" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<deployment>.convex.site/revolut/webhook",
       "events":["ORDER_COMPLETED","ORDER_AUTHORISED","ORDER_FAILED","ORDER_CANCELLED","ORDER_PAYMENT_DECLINED","ORDER_PAYMENT_FAILED"]}' \
  > /tmp/wh.json
npx convex env set REVOLUT_WEBHOOK_SECRET "$(jq -r .signing_secret /tmp/wh.json)"
rm /tmp/wh.json
```

`GET /api/webhooks` lists what is registered (max 10 per account). Dev
deployment `accurate-grouse-482` is registered (webhook
`d841f490-cb2b-45e5-b2bb-e789c9e5da1a`).

### Testing

- Rules and webhook effects: `npx vitest run convex` (`revolut/regras.test.ts`,
  `pagamentos.test.ts`).
- Real flow on dev: confirm every line of a ticket, set `Pedir pagamento`,
  open the link from the client area, pay a small amount with a real bank
  (Pay by Bank is production-only). `npx convex run
  revolut/fluxo:pedirPagamentoAction '{"encomendaId":"…"}'` does the same
  from the CLI.
- Webhook plumbing without paying: sign a body with the secret
  (`openssl dgst -sha256 -hmac`) and POST it; an unknown `order_id` returns
  200 and is ignored, a bad signature 401.

## Production cutover

1. Open Climaeco's Revolut Business merchant account; confirm it is on a
   **blended** pricing plan (Pay by Bank is unavailable on unblended plans).
2. Set `REVOLUT_SECRET_KEY`, `CLIENT_APP_URL` on the production deployment
   and `VITE_REVOLUT_PUBLIC_KEY` on the production client build.
3. Register the production webhook (above) → `REVOLUT_WEBHOOK_SECRET`.
4. €1 smoke order end to end (go-live gate, #13).

# Revolut Pay by Bank — what Merchant actually guarantees

Research for [issue #8](https://github.com/notionclimaeco-hub/selective-platform/issues/8). Standing constraints: Portuguese merchant; installer orders €2k–€20k; Pay by Bank is the default on the merchant-hosted payment route `/pagamento/<token>`; advance installer-order state only from webhooks. The decision to use our own payment page (not Revolut `checkout_url`) is not reopened.

Consulted **Revolut Merchant / Business developer docs only** (2026-08-13). No blogs.

## Verdict

| Claim | Revolut's own docs |
| --- | --- |
| Web SDK can render Pay by Bank alone on a merchant-hosted page | **Yes.** Payments module `payByBank()` is a standalone widget, not `checkout_url`. |
| Create Order + `expire_pending_after: P7D` | **Yes, in range.** Field is ISO 8601 duration, `PT1M`–`PT720H`. `P7D` is 7 days and sits inside that range. Official examples use the `PT…` form (`PT30M`, `PT24H`); `PT168H` is the hour-form equivalent. |
| Webhooks `ORDER_COMPLETED` and `ORDER_FAILED` | **Yes.** Fulfil only on `ORDER_COMPLETED`. `ORDER_FAILED` means the pending order **expired**, not that a bank attempt failed. Also subscribe to payment-attempt and cancel events. |
| `merchant_order_data.reference` | **Yes.** Create-order field; echoed on webhooks as `merchant_order_ext_ref`. |
| Webhook signature verification | **Yes.** HMAC-SHA256 over `v1.{timestamp}.{raw body}`; headers `Revolut-Signature` and `Revolut-Request-Timestamp`. |
| Hosted `checkout_url` cannot restrict methods per order | **Yes — no per-order allowlist.** Create Order has no payment-method filter. Hosted checkout shows the customer's preferred method from the account-level set. |
| Pay by Bank has no sandbox; card / Revolut Pay stand in for CI | **Yes.** Pay by Bank (and Apple Pay) are production-only. Sandbox has test cards and a Revolut Pay mock. Same Create Order + webhooks work there. |
| No Merchant API refunds for Pay by Bank | **Yes, documented twice.** Refund outside Revolut's payment system. |

## 1. Pay by Bank alone on `/pagamento/<token>`

Revolut's Web SDK is one package (`@revolut/checkout`) with **four initialisation patterns**. The one that isolates a single method is the **payments module**, not token-based checkout, not `embeddedCheckout`, and not the hosted `checkout_url`.

> Payments module initialisation creates a `RevolutPaymentsModuleInstance` with separate payment methods. Use this method when you need individual payment method buttons with granular control over UI placement and create orders on-demand during checkout.

Source: [Payments module initialisation](https://developer.revolut.com/docs/sdks/merchant-web-sdk/initialisation/payments-module).

The instance exposes `revolutPay`, `paymentRequest` (Apple/Google Pay), and `payByBank` as **separate** methods. You can call only `payByBank`.

`payByBank` opens a **modal widget** on the page that already loaded the SDK:

> Enables customers to pay directly from their bank account via Open Banking… The SDK opens a modal widget where customers can select their bank and complete the transfer.

Required option: `createOrder: () => Promise<{ publicId: string }>`. That `publicId` is the Create Order **`token`**, not the permanent `id`. Optional: `instantOnly`, `location` (ISO 3166-1 alpha-2 — use `PT` to show only Portuguese banks), `onSuccess` / `onError` / `onCancel`.

Sources: [Pay by Bank SDK](https://developer.revolut.com/docs/sdks/merchant-web-sdk/payment-methods/pay-by-bank); [Create an order](https://developer.revolut.com/docs/api/merchant/operations/create-order.md) (`token` is “returned by the `createOrder` callback” for Pay by Bank).

The product intro states the same embedding model:

> You can embed the Pay by Bank widget on your website using our web SDK to give your customers a quick, seamless online checkout experience directly via bank transfer.

Source: [Introduction to Pay by Bank](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/pay-by-bank/introduction).

Revolut Checkout (the all-in-one widget) is the **other** path: it aggregates every enabled method and is configured in the Business Dashboard, not in code. Revolut tells you to use **individual** methods when you want a custom UI or different methods on different pages. That is the documented justification for a merchant-hosted `/pagamento/<token>` that shows Pay by Bank first (and only, if we never mount the other buttons).

Source: [Accept payments via Revolut Checkout — Web](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/revolut-checkout/web).

**Portugal.** Pay by Bank lists Portugal (`PT`) with EUR and SEPA Credit Transfer / SEPA Instant, and names CaixaBank, Millennium bcp, Banco BPI, Activo Bank, Banco Montepio, Santander, Crédito Agrícola, Novo Banco, Bankinter.

Source: [Introduction to Pay by Bank](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/pay-by-bank/introduction).

**Do not use `onSuccess` to mark the installer order paid.** Revolut's webhook guide:

> Instead of only relying on the `onSuccess` callback that is executed from the Merchant Web SDK, set up a webhook URL for receiving `ORDER_COMPLETED` events. This is a much more robust approach to moving your own orders to a "successful" state…

The card-field SDK repeats the same rule: widget callbacks are not guaranteed (network, tab close, ad-blockers); webhooks are for fulfilment.

Sources: [Use webhooks](https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/using-webhooks); [createCardField()](https://developer.revolut.com/docs/sdks/merchant-web-sdk/payment-methods/card-field).

**Pricing caveat.** Pay by Bank is “not available for merchants on unblended pricing plans.” Confirm the Climaeco Merchant account is on a blended plan before go-live.

Source: [Introduction to Pay by Bank](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/pay-by-bank/introduction).

**Pre-authorisation excludes Pay by Bank.** Create Order with `authorisation_type: pre_authorisation` supports card / Apple Pay / Google Pay only. Do not use pre-auth or incremental auth for these installer payments.

Source: [Create an order](https://developer.revolut.com/docs/api/merchant/operations/create-order.md).

## 2. Create Order and `expire_pending_after: P7D`

`POST /api/orders` accepts optional `expire_pending_after` (string, ISO 8601 duration):

> Orders in `pending` state will be automatically failed if they stay unpaid for longer than the period specified. When the order expires, it transitions to the `failed` state and an `ORDER_FAILED` webhook event is triggered.

Constraints: set only at creation (cannot be patched later); must be between `PT1M` (1 minute) and `PT720H` (30 days); cannot be negative.

Source: [Create an order](https://developer.revolut.com/docs/api/merchant/operations/create-order.md).

Seven calendar days is inside that window. ISO 8601 writes that as `P7D` or `PT168H`. Revolut's own Hosted Checkout examples use the `PT…` form (`PT30M`, and “e.g. 24 hours: `PT24H`”). Either `P7D` or `PT168H` matches the documented type and range; `PT168H` matches their examples more closely if an implementation is picky about the `P` vs `PT` form.

Default if omitted: **30 days**, then `ORDER_FAILED`.

Source: [Hosted Checkout Page — API](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/hosted-checkout-page/api).

Create Order also returns `checkout_url`. That URL is for Revolut-hosted checkout. The decided route does not send the installer there.

`merchant_order_data.url` (optional) is a link back to the merchant OMS. It must be `http`/`https`, not `localhost` or an IP, max 2000 chars. Useful as a staff deep-link; not required for payment.

Source: [Create an order](https://developer.revolut.com/docs/api/merchant/operations/create-order.md).

## 3. Webhooks we must handle

Register via `POST /api/webhooks` with a public `url` (not `localhost` or an IP) and an `events` list. Max **10** webhook URLs. Response includes `signing_secret`.

Source: [Create a webhook](https://developer.revolut.com/docs/api/merchant/operations/create-webhook.md); [Use webhooks](https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/using-webhooks).

Payload shape Revolut documents:

```json
{
  "event": "ORDER_COMPLETED",
  "order_id": "9fc01989-3f61-4484-a5d9-ffe768531be9",
  "merchant_order_ext_ref": "Test #3928"
}
```

Source: [Use webhooks](https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/using-webhooks).

### Events that matter for `/pagamento/<token>`

| Event | What Revolut says it means | What we should do |
| --- | --- | --- |
| `ORDER_COMPLETED` | “Order successfully paid and captured (trigger fulfilment).” | **Only** this (or `ORDER_AUTHORISED` if we ever used manual capture) advances the installer order to paid. |
| `ORDER_FAILED` | Pending order **expired** (`expire_pending_after` or default 30 days). | Mark the payment link expired. Not a bank-decline. |
| `ORDER_CANCELLED` | Cancelled via API / dashboard, or authorised-payment expiry. | Terminal unsuccessful if we cancel. Distinct from `ORDER_FAILED`. |
| `ORDER_PAYMENT_DECLINED` | One **attempt** declined (card, funds, …). | Do **not** fail the installer order. Customer can retry on the same Revolut order. |
| `ORDER_PAYMENT_FAILED` | One **attempt** failed technically. | Same: order stays retryable. |
| `ORDER_AUTHORISED` | Authorised, awaiting capture (manual capture). | Irrelevant if `capture_mode` is automatic (default). |

Sources: [Hosted Checkout Page — API](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/hosted-checkout-page/api) (event table and the explicit note that `ORDER_PAYMENT_*` is not a final unsuccessful order); [Create a webhook](https://developer.revolut.com/docs/api/merchant/operations/create-webhook.md) (full enum); [Order lifecycle](https://developer.revolut.com/docs/guides/merchant/reference/order-lifecycle) (`processing` → `pending` on a failed attempt so a new payment object can be created on the same order).

Subscribe at least to: `ORDER_COMPLETED`, `ORDER_FAILED`, `ORDER_CANCELLED`, `ORDER_PAYMENT_DECLINED`, `ORDER_PAYMENT_FAILED`. Incremental-auth, subscription, payout, and dispute events are unused for this flow.

### Delivery rules Revolut actually states

- Event **order is not guaranteed**. Do not assume `ORDER_AUTHORISED` before `ORDER_COMPLETED`.
- Failed delivery (HTTP error or timeout): Revolut retries **3 more times**, **10 minutes** apart.
- Respond `200 OK` quickly; process asynchronously; treat deliveries as **idempotent**.
- Widget callbacks are for UX; webhooks are for backend state.

Sources: [Use webhooks](https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/using-webhooks); [Revolut Checkout — Web](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/revolut-checkout/web).

## 4. `merchant_order_data.reference`

Create Order (and later Update Order, while `pending` / `authorised` / `completed`):

> `merchant_order_data.reference` — Merchant order ID for external reference. Use this field to set the ID that your own system can use to easily track orders.

Source: [Create an order](https://developer.revolut.com/docs/api/merchant/operations/create-order.md).

The same value is what webhooks call `merchant_order_ext_ref`. The refunds guide says it in one sentence: the reference “is included in webhook callbacks as `merchant_order_ext_ref`.”

Sources: [Use webhooks](https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/using-webhooks) (example payload); [Refund payments](https://developer.revolut.com/docs/guides/merchant/operations/refunds).

Put the installer-order / pró-forma identifier here so the webhook can be matched without a side table on `order_id` alone (still store Revolut `id` as well).

## 5. Webhook signature verification

Merchant webhook docs (not the Business-accounts webhook pages):

Headers:

- `Revolut-Request-Timestamp` — UNIX timestamp, e.g. `1683650202360`
- `Revolut-Signature` — `v1=<hex HMAC-SHA256>`, e.g. `v1=09a9989dd8d9282c1d34974fc730f5cbfc4f4296941247e90ae5256590a11e8c`

Algorithm: HMAC-SHA256. Signing secret is created with the webhook and returned on retrieve; it changes only on rotation. During rotation, **multiple** signatures may be sent; any one matching a still-valid secret is enough.

Payload to sign (exact raw body, no pretty-print):

```
v1.{Revolut-Request-Timestamp}.{raw JSON body}
```

Expected header value: `v1=` + hex digest. Compare to `Revolut-Signature` (or one of several). “The signature is sensitive to any modifications” — verify before parsing/rewriting the body.

Source: [Webhook signature verification](https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/verify-the-payload-signature).

## 6. Hosted `checkout_url` cannot restrict methods per order

This is why the own-page decision stands, and what Revolut actually wrote.

Create Order's request body has **no** field to allow or deny Card / Revolut Pay / Pay by Bank / wallets on that order. The only API-level method restriction in that spec is the opposite kind: **pre-authorisation** orders reject Pay by Bank.

Sources: [Create an order](https://developer.revolut.com/docs/api/merchant/operations/create-order.md) (request attributes; pre-auth “Payment method support”).

Hosted Checkout is a Revolut-hosted page reached by the `checkout_url` returned on every order:

> Customer completes payment on the Revolut-hosted checkout page using their preferred payment method.

Supported methods on that page: Revolut Pay, card, Apple Pay or Google Pay, Pay by Bank. Branding (logo, colours) is dashboard-wide and “applies to all checkout pages created via both Payment link and API methods.”

Sources: [Introduction to Hosted Checkout Page](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/hosted-checkout-page/introduction); [Hosted Checkout Page — API](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/hosted-checkout-page/api).

The all-in-one **Revolut Checkout** widget (different product, still not per-order) is explicit:

> The ordering and availability of payment methods are configured through your Business Dashboard, not through code.

Source: [Accept payments via Revolut Checkout — Web](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/revolut-checkout/web).

So: `checkout_url` cannot be “Pay by Bank only” for one pró-forma. The payments-module widget can.

## 7. No sandbox for Pay by Bank — what CI can use instead

Documented on the Pay by Bank intro and again on Revolut Checkout:

> No sandbox environment: Pay by Bank is not available in the sandbox environment. Real transactions must be made to test your implementation in the production environment.

> Apple Pay and Pay by Bank are not available in the Sandbox environment. These payment methods can only be tested in the production environment.

Sources: [Introduction to Pay by Bank](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/pay-by-bank/introduction); [Revolut Checkout — Web](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/revolut-checkout/web).

Sandbox **does** exist for the rest of Merchant:

- API host `https://sandbox-merchant.revolut.com/` vs `https://merchant.revolut.com/`
- SDK `mode: 'sandbox'` with sandbox public key (must match the key's environment)
- Sandbox and production accounts are **not** connected

Source: [Set up Sandbox](https://developer.revolut.com/docs/guides/merchant/test-and-go-live/set-up-sandbox).

**Card (CI stand-in).** Official test PANs (sandbox only), any future expiry, 3-digit CVV. Success: Visa `4929420573595709`, Mastercard `5281438801804148`. Separate PANs for 3DS failure, issuer decline, stuck `processing`. Same Create Order → token → widget/hosted page → webhooks path as production.

Source: [Test cards](https://developer.revolut.com/docs/guides/merchant/test-and-go-live/testing/test-cards).

**Revolut Pay (CI stand-in).** Sandbox has no retail app. Revolut documents a **mock sign-up**: guest checkout, test card, unused phone number, then later A2A with that phone and passcode `124455`; Approve/Decline buttons replace the app challenge. UX differs from production.

Source: [Test payment flows](https://developer.revolut.com/docs/guides/merchant/test-and-go-live/testing/test-flows).

**What CI can honestly cover**

| Layer | Sandbox? |
| --- | --- |
| Create Order, `token`, `expire_pending_after`, `merchant_order_data.reference` | Yes |
| Webhook delivery, signature, `ORDER_COMPLETED` / `ORDER_FAILED` / `ORDER_PAYMENT_*` | Yes (card or Revolut Pay) |
| Payments-module wiring (`createOrder` → `{ publicId }`, `onSuccess` UX only) | Yes, against `revolutPay` or card field — **not** `payByBank` |
| Open Banking bank picker, PT bank list, SEPA Instant vs SCT | **No** — production only, real money |
| Pay by Bank refund behaviour | N/A — API refunds unsupported |

Production smoke with a small live Pay by Bank payment is the only way Revolut offers to test the widget itself.

## 8. No Merchant API refunds for Pay by Bank

Pay by Bank intro:

> No refund support: Pay by Bank does not support refunds through the Merchant API. If you need to refund a payment, you must process it through alternate channels outside of Revolut's payment system.

Refunds tutorial (same sentence, listed among the integration types that *do* refund):

> Refunds are not supported with Pay by Bank payments.

Sources: [Introduction to Pay by Bank](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/pay-by-bank/introduction); [Refund payments](https://developer.revolut.com/docs/guides/merchant/operations/refunds).

`POST /api/orders/{order_id}/refund` exists for completed card/wallet orders. It is the wrong tool after a Pay by Bank capture. Office refunds (nota de crédito + bank transfer out) are the documented alternative.

## Implementation notes (decided shape, not a new decision)

1. Page `/pagamento/<token>` loads `@revolut/checkout`, calls `RevolutCheckout.payments({ publicToken, mode, locale })`, then only `payByBank({ createOrder, location: 'PT', … })`. Do not mount `embeddedCheckout` or redirect to `checkout_url` if Pay by Bank must be the only method on that page.
2. Backend `createOrder` (secret key) sends `amount` in minor units, `currency: "EUR"`, `expire_pending_after: "P7D"` or `"PT168H"`, `merchant_order_data.reference` = installer-order / pró-forma id. Return `{ publicId: order.token }` to the widget.
3. `onSuccess` / `onError` / `onCancel` update the page only. Paid / expired / cancelled come from signed webhooks.
4. Treat `ORDER_PAYMENT_DECLINED` and `ORDER_PAYMENT_FAILED` as “try again on the same Revolut order,” not as a failed installer order.
5. Verify HMAC before trusting `order_id` or `merchant_order_ext_ref`.
6. CI: sandbox card (and optionally Revolut Pay mock) for order + webhook + expiry. Live Pay by Bank only in production.

## Gaps Revolut does not document (in the pages above)

- No published per-order or per-payment **amount cap** for Pay by Bank. €2k–€20k is not contradicted; it is also not guaranteed in these docs.
- No sandbox fixture for Open Banking (no fake PT bank, no fake SEPA Instant).
- Hosted Checkout dashboard toggles are documented clearly for the **Revolut Checkout widget**; the hosted page is specified as “preferred payment method” from a fixed method set, with no Create Order filter.

## Sources

- [Revolut Merchant Web SDK](https://developer.revolut.com/docs/sdks/merchant-web-sdk/introduction)
- [Payments module initialisation](https://developer.revolut.com/docs/sdks/merchant-web-sdk/initialisation/payments-module)
- [Pay by Bank SDK](https://developer.revolut.com/docs/sdks/merchant-web-sdk/payment-methods/pay-by-bank)
- [Introduction to Pay by Bank](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/pay-by-bank/introduction)
- [Create an order](https://developer.revolut.com/docs/api/merchant/operations/create-order.md)
- [Create a webhook](https://developer.revolut.com/docs/api/merchant/operations/create-webhook.md)
- [Use webhooks](https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/using-webhooks)
- [Webhook signature verification](https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/verify-the-payload-signature)
- [Hosted Checkout Page — introduction](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/hosted-checkout-page/introduction)
- [Hosted Checkout Page — API](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/hosted-checkout-page/api)
- [Revolut Checkout — Web](https://developer.revolut.com/docs/guides/merchant/accept-payments/online-payments/revolut-checkout/web)
- [Order and payment lifecycle](https://developer.revolut.com/docs/guides/merchant/reference/order-lifecycle)
- [Refund payments](https://developer.revolut.com/docs/guides/merchant/operations/refunds)
- [Set up Sandbox](https://developer.revolut.com/docs/guides/merchant/test-and-go-live/set-up-sandbox)
- [Test cards](https://developer.revolut.com/docs/guides/merchant/test-and-go-live/testing/test-cards)
- [Test payment flows](https://developer.revolut.com/docs/guides/merchant/test-and-go-live/testing/test-flows)
- [createCardField()](https://developer.revolut.com/docs/sdks/merchant-web-sdk/payment-methods/card-field)

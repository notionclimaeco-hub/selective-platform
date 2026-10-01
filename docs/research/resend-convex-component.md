# Resend through the Convex component: setup, attachments, limits (#88)

Research for map #82. It feeds the build ticket "Installer emails" (#91).
Read on 2026-10-01 against `@convex-dev/resend` **0.2.8** (latest on npm,
[tag v0.2.8](https://github.com/get-convex/resend/tree/v0.2.8); the npm
tarball's `src/` matches the tag byte for byte) and the Resend docs at
`resend.com/docs`. Source links below point at the v0.2.8 tag.

Context: five transactional emails per installer order. Three of them carry an
InvoiceXpress PDF from Convex storage (fatura-recibo, nota de crédito, guia de
transporte). From `encomendas@climaecopro.pt` (domain not bought yet),
reply-to `geral@climaeco.pt`, to the company email with a CC to the member who
placed the order. Volume is tens of orders a month.

## TL;DR

- **The component cannot attach files with `sendEmail`.** It always sends
  through Resend's `/emails/batch` endpoint, and that endpoint has no
  attachments. The component's own answer is `sendEmailManually`: you make the
  `POST /emails` call yourself and the component only tracks the status. That
  path has **no retries, no `idempotencyKey` dedupe, no test-mode guard, and no
  `onEmailEvent` callback** unless something else has called `sendEmail` first.
  We have to build those pieces for the three PDF emails.
- **Version blocker:** 0.2.8 (and 0.2.7) declare the peer dependency
  `convex ^1.43.0`, but this repo locks `convex@1.42.3`. #91 has to bump
  `convex` (1.46.0 is the latest) and add `convex-helpers`, which is also a
  peer dependency.
- **Domain blocker for real delivery:** until a domain is verified, Resend only
  sends from `onboarding@resend.dev`, and only to the Resend account owner's
  own address or to the `@resend.dev` test addresses. #91's "emails arrive in
  the e2e inbox on dev" acceptance depends on the domain (or on the e2e inbox
  being the Resend account email).
- The Free plan (3,000 a month, 100 a day) is ample. The EU region
  (`eu-west-1`, Ireland) is available on every plan, but account data and logs
  are stored in the US whichever region you pick.
- The component ignores `email.suppressed` events. A suppressed recipient would
  stay `sent` for ever unless we handle that event ourselves.

## 1. Setup

**Install and mount.** Run `npm install @convex-dev/resend`, then
`app.use(resend)` in `convex/convex.config.ts`, then
`new Resend(components.resend, {...})`
([README, Get Started](https://github.com/get-convex/resend/blob/v0.2.8/README.md#get-started)).
The component mounts its own child components: `@convex-dev/rate-limiter` and
two `@convex-dev/workpool` pools (`emailWorkpool`, `callbackWorkpool`)
([convex.config.ts](https://github.com/get-convex/resend/blob/v0.2.8/src/component/convex.config.ts)).
This repo has no `convex/convex.config.ts` yet, so #91 creates it.

**Peer dependencies.** The 0.2.8 `package.json` declares
`"convex": "^1.43.0", "convex-helpers": "^0.1.106"`
([package.json](https://github.com/get-convex/resend/blob/v0.2.8/package.json)).
The CHANGELOG has "0.2.7: Bumps Workpool dependency and convex peer dependency"
([CHANGELOG](https://github.com/get-convex/resend/blob/v0.2.8/CHANGELOG.md)),
and 0.2.6 still accepted `convex ^1.31.7`. Our root `package.json` has
`convex ^1.42.3`, locked at `1.42.3` in `pnpm-lock.yaml`, and no
`convex-helpers`. So #91 bumps convex to at least 1.43 rather than pinning an
older component. Pinning 0.2.6 would lose `idempotencyKey`.

**Environment variables.** The defaults are read from `process.env`:
`RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET`. Each can be overridden with the
`apiKey` and `webhookSecret` options
([client/index.ts L43-L51](https://github.com/get-convex/resend/blob/v0.2.8/src/client/index.ts#L43-L51)).
`sendEmail` throws `"API key is not set"` when the key is empty, and
`handleResendEventWebhook` throws `"Webhook secret is not set"`.

**Webhook route.** Mount
`http.route({ path: "/resend-webhook", method: "POST", handler: httpAction((ctx, req) => resend.handleResendEventWebhook(ctx, req)) })`
in `convex/http.ts`. Then create a webhook in the Resend dashboard pointing at
`https://<deployment>.convex.site/resend-webhook`, enable the `email.*` events,
and copy its signing secret into `RESEND_WEBHOOK_SECRET`
([README, Setting up a Resend webhook](https://github.com/get-convex/resend/blob/v0.2.8/README.md#setting-up-a-resend-webhook)).
The handler checks the Svix signature on the raw body and the
`svix-id`/`svix-timestamp`/`svix-signature` headers, applies the event, and
returns `201`
([client/index.ts L471-L497](https://github.com/get-convex/resend/blob/v0.2.8/src/client/index.ts#L471-L497)).
This matches Resend's own guidance ("use the raw request body", Svix libraries)
([Verify Webhooks Requests](https://resend.com/docs/webhooks/verify-webhooks-requests)).
The repo's `convex/http.ts` already routes `/notion/webhook` and Revolut, so
the new route goes in next to them.

**Test mode.** `testMode` **defaults to `true`**
([client/index.ts L49](https://github.com/get-convex/resend/blob/v0.2.8/src/client/index.ts#L49)).
While it is on, `sendEmail` throws unless every `to`/`cc`/`bcc` address is a
Resend test address
([lib.ts L163-L172](https://github.com/get-convex/resend/blob/v0.2.8/src/component/lib.ts#L163-L172)).
Test addresses means `delivered`, `bounced` or `complained` `@resend.dev`,
optionally with a `+label` matching `[a-zA-Z0-9_-]*`
([utils.ts L36-L37](https://github.com/get-convex/resend/blob/v0.2.8/src/component/utils.ts#L36-L37)).
Resend also documents `suppressed@resend.dev`, which takes no label, and the
component's check does not accept it. Resend notes that **test emails count
against the quota**
([Send Test Emails](https://resend.com/docs/dashboard/emails/send-test-emails)).
The guard lives only in `sendEmail`. `createManualEmail` does no check
([lib.ts L239-L276](https://github.com/get-convex/resend/blob/v0.2.8/src/component/lib.ts#L239-L276)).

**Without a verified domain**, Resend lets you send from `onboarding@resend.dev`
only, and only to "the email address associated with your Resend account". Any
other recipient returns `403 validation_error`
([403 using resend.dev](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain),
[Errors](https://resend.com/docs/api-reference/errors)). The component's own
example sends from `onboarding@resend.dev` to the `@resend.dev` test addresses
([example/convex/example.ts](https://github.com/get-convex/resend/blob/v0.2.8/example/convex/example.ts)).

## 2. PDF attachments

**`sendEmail` cannot attach.** Its arguments are `from`, `to`, `cc`, `bcc`,
`subject`, `html`/`text` or `template`, `replyTo`, `headers` and
`idempotencyKey`. There is no `attachments` field
([lib.ts L123-L145](https://github.com/get-convex/resend/blob/v0.2.8/src/component/lib.ts#L123-L145)).
The worker always posts to `https://api.resend.com/emails/batch`
([lib.ts L574](https://github.com/get-convex/resend/blob/v0.2.8/src/component/lib.ts#L574)),
and Resend states: "We currently do not support sending attachments when using
our batch endpoint"
([Attachments](https://resend.com/docs/dashboard/emails/attachments),
[Send Batch Emails](https://resend.com/docs/api-reference/emails/send-batch-emails)).
The component's `content` table has `filename`/`path` columns
([schema.ts L6-L11](https://github.com/get-convex/resend/blob/v0.2.8/src/component/schema.ts#L6-L11)),
but nothing uses them. A maintainer confirms that attachments are "unlikely to
happen short-term without skipping all the batching benefits"
([get-convex/resend#2](https://github.com/get-convex/resend/issues/2)).

**The supported workaround is `sendEmailManually(ctx, {from, to, cc, subject, replyTo, headers}, async (emailId) => resendId)`**
([README, Sending emails manually](https://github.com/get-convex/resend/blob/v0.2.8/README.md#sending-emails-manually-eg-for-attachments),
[client/index.ts L342-L385](https://github.com/get-convex/resend/blob/v0.2.8/src/client/index.ts#L342-L385)).
It inserts a component `emails` row with status `queued`, runs your callback,
and then patches the row to `sent` with the returned Resend id, or to `failed`
with the error message and rethrows. That gives us the component's status
tracking and its webhook updates. What we lose compared with `sendEmail`:

| | `sendEmail` | `sendEmailManually` |
|---|---|---|
| Endpoint | `/emails/batch` (no attachments) | Your own call, e.g. `POST /emails` |
| Retries | Workpool, 5 attempts, 30 s initial backoff, base 2 ([lib.ts L481-L498](https://github.com/get-convex/resend/blob/v0.2.8/src/component/lib.ts#L481-L498), [client L47-L48](https://github.com/get-convex/resend/blob/v0.2.8/src/client/index.ts#L47-L48)) | None. One shot, and a throw marks the row `failed` |
| `idempotencyKey` enqueue dedupe | Yes, indexed ([lib.ts L147-L161](https://github.com/get-convex/resend/blob/v0.2.8/src/component/lib.ts#L147-L161)) | No (not an argument) |
| Test-mode guard | Yes | No |
| Rate limiting | 1 call per 600 ms ([lib.ts L37](https://github.com/get-convex/resend/blob/v0.2.8/src/component/lib.ts#L37)) | No |
| `onEmailEvent` callback | Yes | Only if `sendEmail` has run at least once on the deployment (see §4) |

**How to pass the PDF.** On `POST /emails`, each entry in `attachments` takes
`filename` plus either `content` (a Base64 string or buffer) or `path` (a URL
Resend downloads), and optionally `content_type`. The limit is **40 MB per
email after Base64 encoding**
([Send Email](https://resend.com/docs/api-reference/emails/send-email),
[Attachments](https://resend.com/docs/dashboard/emails/attachments)). `.pdf` is
not on the blocked-extension list
([Unsupported attachment types](https://resend.com/docs/knowledge-base/what-attachment-types-are-not-supported)).
Use **`content` (Base64)**, not `path`:

- In an action, `ctx.storage.get(storageId)` returns a `Blob`
  ([Convex: Serving files](https://docs.convex.dev/file-storage/serve-files)).
  Base64-encode its bytes and send them inline. InvoiceXpress PDFs are tens of
  kB, which is far under Convex's 64 MiB default-runtime memory and 16 MiB
  argument limits
  ([Convex limits](https://docs.convex.dev/production/state/limits)) and under
  Resend's 40 MB.
- `path` would need `ctx.storage.getUrl()`, which is a bearer URL: "anyone with
  the URL can access the file", and it is revoked only by deleting the file
  ([Convex: Serving files](https://docs.convex.dev/file-storage/serve-files)).
  It also adds a remote fetch that can fail on Resend's side. Invoices with the
  installer's NIF should not sit behind a shareable URL.

**Link instead of attach?** You can, and then all five emails could use
`sendEmail` with the full queue, retry, dedupe and test-mode features. But #82's
destination says the documents are "issued and emailed to the installer", so
attaching is the requirement. A link to `CLIENT_APP_URL/encomendas/$id` goes in
every email anyway (#91 scope).

## 3. Idempotency and retries

**Two layers exist.**

1. **Component → Resend.** `sendEmail` batches send `Idempotency-Key: <first email id in the batch>`
   ([lib.ts L579](https://github.com/get-convex/resend/blob/v0.2.8/src/component/lib.ts#L579)),
   so a workpool retry of the same batch does not double-send. Errors fall
   into two groups. Permanent ones (400, 401, 403, 404, 422 and others, but not
   409 or 429) mark the emails `failed` without retrying. Everything else
   throws and is retried
   ([lib.ts L59-L66](https://github.com/get-convex/resend/blob/v0.2.8/src/component/lib.ts#L59-L66),
   [L583-L604](https://github.com/get-convex/resend/blob/v0.2.8/src/component/lib.ts#L583-L604)).
   After the last attempt, `onEmailComplete` marks them `failed`.
2. **App → component.** Since 0.2.8, `sendEmail({ ..., idempotencyKey })`
   returns the existing `EmailId` if that key was already enqueued, and the
   check is transactional
   ([README, Enqueue-time idempotency](https://github.com/get-convex/resend/blob/v0.2.8/README.md#enqueue-time-idempotency),
   [CHANGELOG 0.2.8](https://github.com/get-convex/resend/blob/v0.2.8/CHANGELOG.md)).
   The dedupe has no time limit, but it only lasts while the row exists, and
   rows are deleted by `cleanupOldEmails` (7 days after finalization by
   default) or `cleanupAbandonedEmails`
   ([README, Data retention](https://github.com/get-convex/resend/blob/v0.2.8/README.md#data-retention)).

**Resend's own `Idempotency-Key`** (on `POST /emails` and `/emails/batch`) is up
to 256 characters and kept for **24 hours**. A replay with the same key and the
same payload returns the original response without sending again. The same key
with a different payload gives `409 invalid_idempotent_request`. A replay while
the first request is still in flight gives `409 concurrent_idempotent_requests`,
which is safe to retry. Resend suggests keys of the form
`<event-type>/<entity-id>`
([Idempotency Keys](https://resend.com/docs/dashboard/emails/idempotency-keys)).

**One email per order event.**

- For the two emails without attachments (payment link, pronta a levantar),
  call `sendEmail` with `idempotencyKey: "encomenda/<encomendaId>/<evento>"`.
  For example, `encomenda/k17.../link-pagamento`.
- For the three PDF emails, the README sample passes the component's fresh
  `emailId` as Resend's `Idempotency-Key`. That **does not** dedupe an
  action-level retry, because every `sendEmailManually` call inserts a new row
  with a new id. So set the header to the same stable
  `encomenda/<id>/<evento>` key. Within 24 h, Resend then collapses retries to
  one send. Beyond 24 h, the app has to have recorded "sent" in its own table
  (per order and event) before giving up the retry. Our own row is what makes
  the email "sent once", not Resend's key.
- Retries for the manual path are ours to build. #82 already defaults to
  "documents and emails run in retried, idempotent actions". Use a scheduled
  internal action that reschedules itself with backoff on a retryable failure
  (429, 5xx, network) and stops on permanent 4xx. Note that `sendEmailManually`
  marks its row `failed` and rethrows on every callback error, so a retried send
  leaves one `failed` component row per attempt. That is harmless.
- Daily-quota exhaustion comes back as `429 daily_quota_exceeded` (the Free
  plan's day resets at midnight UTC)
  ([Rate limit](https://resend.com/docs/api-reference/rate-limit)). Retrying
  with backoff covers it.

## 4. Delivery status, bounces, and surfacing failures

**What the component stores.** It accepts `email.sent`, `delivered`,
`delivery_delayed`, `bounced`, `complained`, `failed`, `opened` and `clicked`
([shared.ts L149-L158](https://github.com/get-convex/resend/blob/v0.2.8/src/component/shared.ts#L149-L158)).
It writes each one to `deliveryEvents` and moves the email's status forward
only: waiting → queued → sent → delivery_delayed → delivered → bounced/failed.
`resend.status(ctx, emailId)` returns `{ status, bounced, failed, complained,
deliveryDelayed, errorMessage, ... }`
([README, Checking email status](https://github.com/get-convex/resend/blob/v0.2.8/README.md#checking-email-status-programmatically)).
Events are matched to rows by Resend id. Unknown ids are logged and ignored.

**Gaps that matter for us:**

- **`email.suppressed` is not handled.** Resend sends it when the recipient is
  on the account suppression list, for example after an earlier bounce
  ([Event Types](https://resend.com/docs/webhooks/event-types),
  [email.suppressed](https://resend.com/docs/webhooks/emails/suppressed)). The
  component's validator rejects it, logs "Invalid email event received", and
  returns 201
  ([lib.ts L935-L944](https://github.com/get-convex/resend/blob/v0.2.8/src/component/lib.ts#L935-L944)).
  The email stays `sent`. The same happens to `email.scheduled` and
  `email.received`, which we don't use.
- **`onEmailEvent` does not fire for manual emails on a fresh deployment.** The
  callback handle is read from the component's `lastOptions` row, which only
  `sendEmail` writes. With no row, the callback is skipped
  ([lib.ts L987-L1011](https://github.com/get-convex/resend/blob/v0.2.8/src/component/lib.ts#L987-L1011);
  CHANGELOG 0.2.3, "Fixed receiving webhooks responses for emails if you only
  use the manual method", only stopped it from crashing). In our flow the
  payment-link email (via `sendEmail`) always comes first, so in practice the
  row exists. That is still too fragile to rely on.

**Recommended route.** Use our own `/resend-webhook` `httpAction`. It reads the
raw body once, hands the component a rebuilt `Request` (so the component does
the Svix check and updates its status), and then parses the same JSON for our
own mutation:

```ts
const raw = await req.text();
const res = await resend.handleResendEventWebhook(
  ctx,
  new Request(req.url, { method: "POST", headers: req.headers, body: raw }),
); // throws on a bad signature
const evt = JSON.parse(raw);
await ctx.runMutation(internal.emailsEncomenda.registarEvento, {
  resendId: evt.data.email_id, tipo: evt.type, detalhe: /* bounce/failed/suppressed message */,
});
return res;
```

Our order-email row stores the Resend id. The `sendEmailManually` callback
returns it, and for `sendEmail` it can be read with `resend.get(ctx, emailId)`
once sent. That one handler covers all five emails, including `suppressed`, and
writes the order event log.

**Mapping to exceção** (#82 already says "raise an exceção on failure"):

- `failed`, meaning the API refused the send or retries ran out, or Resend's
  `email.failed`: open an exceção. Resend fires `email.failed` for "invalid
  recipients, API key problems, domain verification issues, email quota
  limits", with `failed.reason` such as `reached_daily_quota`
  ([email.failed](https://resend.com/docs/webhooks/emails/failed)).
- `bounced` and `suppressed`: open an exceção. The installer's company email is
  wrong or dead, so the office must fix the contact and resend. Store
  `bounce.message` or `suppressed.message`.
- `delivery_delayed`: log only. It is transient.
- `complained`: log only.
- `opened` and `clicked`: ignore. They are off unless tracking is enabled on
  the domain.

Resend retries a failing webhook for about 32 hours (immediately, then 5 s,
5 min, 30 min, 2 h, 5 h, 10 h, 10 h), emails the team when the endpoint fails,
and disables it in the end. Replays can be triggered manually from the
dashboard
([Retries and Replays](https://resend.com/docs/webhooks/retries-and-replays)).

## 5. Region, plan limits, DNS

**Region.** You pick one of `us-east-1`, `eu-west-1` (Ireland), `sa-east-1` or
`ap-northeast-1` per domain when adding it. It cannot be changed later, except
by deleting the domain, re-adding it and redoing DNS
([Choosing a Region](https://resend.com/docs/dashboard/domains/regions),
[Add a domain](https://resend.com/docs/add-a-domain)). Pick **`eu-west-1`**.
Caveat from the same page: "All account data, including email metadata, logs,
and API records, is stored in the United States regardless of the sending
region". That is a GDPR note for the privacy policy or subprocessor list, not
a blocker. Multi-region is included on every plan
([Pricing](https://resend.com/pricing)).

**Plan.** Free gives 3,000 emails a month, 100 a day, 3 domains and 30-day
retention, with no overage (sends past the quota are refused). Pro is $20 a
month for 50,000 emails with no daily cap
([Pricing](https://resend.com/pricing)). The API rate limit is 10 requests a
second per team
([Rate limit](https://resend.com/docs/api-reference/rate-limit)). Our volume:
tens of orders × 5 emails is roughly 100–300 sends a month. The pricing page
does not say whether CC recipients count separately, but even doubled that is
far under 3,000. The 100-a-day cap only matters for a burst of over 100 email
events in a UTC day. Shared dev and test sends count too, so dev should use
test addresses sparingly.

**DNS records** (exact values come from the domain's Records tab and must be
copied verbatim) ([Add a domain](https://resend.com/docs/add-a-domain)):

| Purpose | Type | Name | Value (example) |
|---|---|---|---|
| SPF / bounce (Return-Path) | MX | `send` (or `send.<sub>`) | `feedback-smtp.<region>.amazonses.com`, priority 10 |
| SPF | TXT | `send` (or `send.<sub>`) | `"v=spf1 include:amazonses.com ~all"` |
| DKIM | TXT | `resend._domainkey` (or `resend._domainkey.<sub>`) | key generated by Resend |
| DMARC (after verify) | TXT | `_dmarc` | start `v=DMARC1; p=none; rua=mailto:…`, then `quarantine` or `reject` |

Sources:
[Cloudflare guide](https://resend.com/docs/knowledge-base/cloudflare) (record
names and example values),
[custom Return-Path](https://resend.com/docs/dashboard/domains/custom-return-path)
(default `send`; some domains get two CNAMEs instead of the MX/TXT pair; fixed
at creation), and [DMARC](https://resend.com/docs/dashboard/domains/dmarc).
Verification "often" takes about 15 minutes and can take up to 72 h.
Cloudflare-hosted domains can add the records automatically through Domain
Connect.

**Subdomain.** Resend "strongly recommend[s] sending emails from a subdomain"
for reputation isolation
([Add a domain](https://resend.com/docs/add-a-domain),
[subdomain vs root](https://resend.com/docs/knowledge-base/is-it-better-to-send-emails-from-a-subdomain-or-the-root-domain)).
The `from` address must be on the verified (sub)domain, so
`encomendas@climaecopro.pt` means verifying the apex `climaecopro.pt`. A
subdomain changes the address, for example
`encomendas@notificacoes.climaecopro.pt`. The same knowledge-base page also
warns against "lookalike" domains next to the main brand (`climaeco.pt`). That
is fine if `climaecopro.pt` is the real Climaeco Pro product domain where the
app lives, but it is a reason not to use it for mail only.

## 6. Templates in Convex

Three options are documented:

1. **Plain HTML strings** in a TypeScript module, passed as `html` and `text`.
   They work from a mutation or the default runtime, so they suit the
   `sendEmail` path inside the same transaction as the state change, and they
   are trivial to snapshot-test in convex-test.
2. **React Email.** The README requires a **`"use node"` action** ("React Email
   requires some Node dependencies") and the packages
   `@react-email/components react react-dom react-email @react-email/render`
   ([README, Using React Email](https://github.com/get-convex/resend/blob/v0.2.8/README.md#using-react-email)).
   This adds a Node action hop for every email, and Node actions take at most
   5 MiB of arguments
   ([Convex limits](https://docs.convex.dev/production/state/limits)).
3. **Resend dashboard templates** (`template: { id, variables }`). These work
   via `sendEmail` only, and you cannot combine them with `html`/`text`
   ([README, Using Resend Templates](https://github.com/get-convex/resend/blob/v0.2.8/README.md#using-resend-templates)).
   The copy then lives outside the repo, which goes against #82's "one fixed
   template in code" stance.

For five short pt-PT emails with one layout, **HTML strings from a small
`layout(corpo)` helper** are the lightest choice. They need no new runtime and
no React in `convex/`, and the same renderer serves both send paths.

## 7. Blockers and risks

| Item | Severity | Notes |
|---|---|---|
| `convex` peer `^1.43.0` vs locked 1.42.3; `convex-helpers` missing | Must do in #91 | Bump convex (check the shared dev deployment still deploys) |
| No attachments in `sendEmail` | Design | Use `sendEmailManually` plus our own retry, dedupe and test-mode guard for 3 of the 5 emails |
| Domain `climaecopro.pt` not bought or verified | Blocks real delivery | Before then: `onboarding@resend.dev` to the Resend account email, or `delivered+…@resend.dev` only |
| `email.suppressed` ignored by the component | Gap | Handle it in our webhook wrapper |
| Account data stored in US even with `eu-west-1` | Compliance note | Mention in privacy and subprocessors |
| Free 100/day, test sends count | Low | Fine at our volume |

## Recommendation for the Installer emails ticket (#91)

1. Bump `convex` to ≥1.43 and add `convex-helpers`. Install
   `@convex-dev/resend@0.2.8`, add `convex/convex.config.ts` with
   `app.use(resend)`, and set `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET` on
   dev.
2. Create one `Resend` instance with
   `testMode: process.env.RESEND_TEST_MODE !== "false"`. Mirror that flag in the
   manual path: when test mode is on, rewrite every recipient to
   `delivered+<evento>@resend.dev`, or to the Resend account email before the
   domain exists.
3. Keep an app table `emailsEncomenda` with `(encomendaId, evento)` unique,
   holding the component `EmailId`, the Resend id, the status and the last
   error. It is the source of "one email per event" and of the Admin event log.
4. Payment link and pronta a levantar: `resend.sendEmail` with
   `idempotencyKey: "encomenda/<id>/<evento>"`.
   Fatura-recibo, nota de crédito and guia: a retried internal action. It
   reads the PDF with `ctx.storage.get`, Base64-encodes it, and calls
   `resend.sendEmailManually` with a `fetch("https://api.resend.com/emails")`
   callback carrying `attachments: [{ filename, content }]`, `reply_to`, `cc`
   and `Idempotency-Key: encomenda/<id>/<evento>`. It backs off on 429/5xx,
   stops on other 4xx, and opens an exceção on final failure.
5. Our own `/resend-webhook` passes the request to
   `resend.handleResendEventWebhook` and then records the event in
   `emailsEncomenda`. It opens an exceção on `bounced`, `failed` or
   `suppressed`.
6. Templates: plain HTML and text strings from one pt-PT layout helper. No
   React Email.
7. Domain: register the domain in `eu-west-1`. Decide apex `climaecopro.pt`
   (matches the agreed `encomendas@climaecopro.pt`) or a subdomain (Resend's
   recommendation). Add DMARC `p=none` first. Until the domain is verified,
   #91's dev acceptance can only reach the Resend account owner's inbox.
8. Add a daily cron for `cleanupOldEmails` and `cleanupAbandonedEmails`. Our
   own table keeps the long-term history.

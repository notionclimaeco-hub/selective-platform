# Moloni API: pró-forma, fatura, recibo, nota de crédito

Researched 13 Aug 2026 against Moloni first-party API docs only. This note answers what the APIs can emit. It does not decide when Climaeco’s order flow should emit.

**Verdict:** Yes, for a Portuguese company, Moloni can emit a certified fatura, a recibo, a fatura-recibo, and a nota de crédito; apply IVA 23%; carry an installer-order id as `our_reference` / `ourReference` (and/or `your_reference` / `yourReference`); and return a PDF download URL. A dedicated fatura pró-forma (SAF-T `PF`) is a first-class type on **Moloni ON**. Classic Moloni’s published Documents index has no pró-forma class — the closest documented insert is **Estimates** (`orçamentos`). Closing a fatura with `status = 1` is what communicates it to AT when that option is active. PDF links are download URLs, not durable permalinks (Moloni ON tokens last ~10 s).

Moloni publishes two distinct APIs. Pick one product; they are not interchangeable.

| Product | Docs | Transport | Host |
| --- | --- | --- | --- |
| Classic Moloni | [moloni.pt/dev](https://www.moloni.pt/dev/) | HTTP POST, JSON or `x-www-form-urlencoded` | `https://api.moloni.pt/v1/` |
| Moloni ON | [docs.molonion.pt](https://docs.molonion.pt/) | GraphQL | `POST https://api.molonion.pt/v1` |

Classic Moloni is certified AT software nº 2860 ([dev footer](https://www.moloni.pt/dev/)). Moloni ON is a separate billing product with its own GraphQL API ([Moloni ON intro](https://docs.molonion.pt/)).

---

## Capability matrix

| Need | Classic Moloni (`api.moloni.pt/v1`) | Moloni ON (`api.molonion.pt/v1`) |
| --- | --- | --- |
| Fatura pró-forma (SAF-T `PF`) | No dedicated Documents class. Runtime list: [`documents/getAllDocumentTypes`](https://www.moloni.pt/dev/documents/documents/getalldocumenttypes/). Closest insert: [`estimates/insert`](https://www.moloni.pt/dev/documents/estimates/insert/) (orçamento). | Yes. `proFormaInvoice` id 13, SAF-T `PF`. [`proFormaInvoiceCreate`](https://docs.molonion.pt/reference/mutations/proFormaInvoiceCreate). Estimate is a different type (`estimate` id 14, SAF-T `OR`) ([document types](https://docs.molonion.pt/guides/documents/documentTypes)). |
| Certified fatura (SAF-T `FT`) | [`invoices/insert`](https://www.moloni.pt/dev/documents/invoices/insert/) with `status = 1` → communicated to AT if the company has that option active. | [`invoiceCreate`](https://docs.molonion.pt/guides/documents/creatingAnInvoice) with `status: 1` → finalized, sequential number, reported to tax authorities if applicable. Invoice SAF-T `FT`, id 1. |
| Recibo (SAF-T `RE`) | [`receipts/insert`](https://www.moloni.pt/dev/documents/receipts/insert/). Must associate invoices / credit notes / migrated invoices. | [`receiptCreate`](https://docs.molonion.pt/guides/documents/payingAnInvoice). `relatedWith` required. Receipt id 2, SAF-T `RE`. |
| Fatura-recibo (SAF-T `FR`) | [`invoiceReceipts/insert`](https://www.moloni.pt/dev/documents/invoice-receipts/insert/) (v1.7+). | [`invoiceReceiptCreate`](https://docs.molonion.pt/reference/mutations/invoiceReceiptCreate). Table id 27, SAF-T `FR`. Credit-note guide also cites id 10 for invoice-receipt — query `documentTypes` at runtime ([document types](https://docs.molonion.pt/guides/documents/documentTypes) vs [credit notes](https://docs.molonion.pt/guides/documents/correctingWithCreditNotes)). |
| Nota de crédito (SAF-T `NC`) | [`creditNotes/insert`](https://www.moloni.pt/dev/documents/credit-notes/insert/). Unless `rappel` is set, `associated_documents` and per-line `related_id` are required. | [`creditNoteCreate`](https://docs.molonion.pt/guides/documents/correctingWithCreditNotes). `relatedWith` required. Id 3, SAF-T `NC`. |
| IVA 23% | Look up or create a tax via [`taxes/getAll`](https://www.moloni.pt/dev/settings/tax-fees/getall/) / [`taxes/insert`](https://www.moloni.pt/dev/settings/tax-fees/insert/) (`type` 1 percentage, `saft_type` 1 IVA, `vat_type` `NOR`, `value` 23, `fiscal_zone` `PT`). Attach `tax_id` on each line. Docs do not hard-code 23% as a company default. | Portuguese companies get 23% / 13% / 6% (and exemptions) created automatically ([reference data](https://docs.molonion.pt/guides/gettingStarted/referenceData)). `value` is e.g. `23`. Product taxes apply on invoice lines unless overridden. |
| Installer-order id | `our_reference` and `your_reference` on fatura, fatura-recibo, and nota de crédito insert. Estimates insert documents only `your_reference`. Receipts insert does **not** list either field (they appear on `getAll` responses). | `ourReference` (internal, e.g. contract/project) and `yourReference` (customer PO) on Invoice, ProForma, InvoiceReceipt, Receipt, and CreditNote insert inputs. |
| PDF / permalink | [`documents/getPDFLink`](https://www.moloni.pt/dev/documents/documents/getpdflink/) → `{ url }`. Document must not be draft (`status` 0). Optional `signed`. Docs do not say the URL is durable. | `{apiCode}GetPDF` then `{apiCode}GetPDFToken` then `GET https://mediaapi.moloni.org{path}?jwt={token}`. Token TTL ~10 s. Do not store it ([PDF guide](https://docs.molonion.pt/guides/documents/downloadingDocumentPDF)). |

---

## Authentication

### Classic Moloni

OAuth 2.0 ([autenticação](https://www.moloni.pt/dev/autenticacao/)). Developer ID + redirect URI + client secret from the Moloni client area. API access depends on the Moloni plan; developers building for other accounts need a Developer ID but not a paid plan ([intro](https://www.moloni.pt/dev/)).

| Flow | Endpoint | Notes |
| --- | --- | --- |
| Web (recommended) | `GET https://www.moloni.pt/ac/root/oauth/?response_type=code&client_id=…&redirect_uri=…` then `GET https://api.moloni.pt/v1/grant/?grant_type=authorization_code&…` | User logs in on Moloni; credentials never hit the third-party UI. |
| Native / password | `GET https://api.moloni.pt/v1/grant/?grant_type=password&client_id=…&client_secret=…&username=…&password=…` | Do not persist the password; re-prompt when the refresh token expires. |
| Refresh | `GET https://api.moloni.pt/v1/grant/?grant_type=refresh_token&…` | Returns a new access token **and** a new refresh token. |

Token lifetimes: access 1 hour; refresh 14 days. After 14 days the user must authenticate again ([autenticação](https://www.moloni.pt/dev/autenticacao/), [utilização](https://www.moloni.pt/dev/utilizacao/)).

Every API call is POST. Query string must include `access_token`. Default body is `x-www-form-urlencoded`; add `json=true` on the query string to send JSON. Optional `human_errors=true` for verbose validation messages. `company_id` is required on document calls; list companies with [`companies/getAll`](https://www.moloni.pt/dev/company/company/getall/).

Auth failures: HTTP 400 with `{ error, error_description }` (e.g. `invalid_grant` / “Refresh token has expired”, “Token is no longer valid”) ([controlo de erros](https://www.moloni.pt/dev/controlo-de-erros/)).

### Moloni ON

Two methods, both from Account → API ([getting started](https://docs.molonion.pt/guides/gettingStarted)):

| Method | Best for | Token |
| --- | --- | --- |
| API Key | Machine-to-machine (Convex action / cron). Format `apik:{keyId}:{secret}`. Inherits the creating user’s permissions. Optional expiry (default suggestion 1 year). Shown once. ([API Keys](https://docs.molonion.pt/guides/gettingStarted/apiKeys)) | Bearer, no refresh. |
| OAuth 2.0 API Client | User-facing web apps. Authorize `https://api.molonion.pt/v1/auth/authorize`, grant `POST https://api.molonion.pt/v1/auth/grant`. Access 1 h, refresh 14 days, auth code 1 minute. ([API Clients](https://docs.molonion.pt/guides/gettingStarted/apiClients)) | `Authorization: Bearer …` |

Company-related endpoints need the **API Access** add-on on that Moloni ON company ([intro](https://docs.molonion.pt/), [getting started](https://docs.molonion.pt/guides/gettingStarted)). Resolve `companyId` via `me { userCompanies { companyId } }`.

Auth failures: HTTP 401, top-level GraphQL `{ errors: [{ message: "Not authenticated", extensions: { code: "UNAUTHENTICATED" } }] }` ([error handling](https://docs.molonion.pt/guides/advanced/errorHandling)). Validation errors stay inside the mutation payload (`errors[]` + `data: null`) with HTTP 200.

For Climaeco (Convex as source of truth, Moloni as legal system), an API Key on a dedicated integration user matches Moloni ON’s machine-to-machine guidance. Classic Moloni has no API-key grant; password or a one-time web OAuth then stored refresh tokens.

---

## Document series (AT)

Portuguese series must be registered with AT since 1 January 2023. A signed document can only use a series whose (série, document type) pair has been communicated ([ATInsertCode](https://www.moloni.pt/dev/settings/document-sets/atinsertcode/)).

**Classic.** [`documentSets/insert`](https://www.moloni.pt/dev/settings/document-sets/insert/) creates a named series (`name`, optional `cash_vat_scheme_indicator`, `active_by_default`, `template_id`). Then [`documentSets/ATInsertCode`](https://www.moloni.pt/dev/settings/document-sets/atinsertcode/) registers a type on that series (`document_type_id` 1 = fatura in their example). Automatic AT communication: send `company_id`, `document_set_id`, `document_type_id`. Manual: also `document_set_at_code`, `initial_num`, `initial_date`. Cash-VAT companies may only use series created for that regime; otherwise insert errors ([invoices/insert](https://www.moloni.pt/dev/documents/invoices/insert/)). Every insert requires `document_set_id`.

**Moloni ON.** [`documentSetCreate`](https://docs.molonion.pt/guides/gettingStarted/firstTimeInvoicing) takes `documentTypes: [{ documentTypeId, initialNumber, at: { date, state, isAutomatic } }]`. For Portugal, each type needs an `at` block. `isAutomatic: true` communicates the series on create; `state` starts `initialise` and becomes `active` when AT accepts. Manual: `isAutomatic: false`, `state: active`, and AT’s 8-character code of uppercase consonants only (e.g. `KLMPDSTV`). Look up usable series with `documentSetsForDocument(companyId, documentTypeId)`.

A single set can cover several types (e.g. invoice + receipt). Each type still needs its own AT registration for Portugal.

---

## IVA 23%

**Classic.** Taxes are company records, not a magic constant. [`taxes/getAll`](https://www.moloni.pt/dev/settings/tax-fees/getall/) returns `{ tax_id, name, value, type, saft_type, vat_type, fiscal_zone, … }` and can filter by `value`, `fiscal_zone`, `type`. To create: `type` 1 = percentage (IVA), `saft_type` 1 = IVA, `vat_type` `NOR` (normal; also `RED` / `INT` / `ISE` / `OUT`), `value` 0–100, `fiscal_zone` ISO 3166-1 or a regional code (`PT`, `PT-AC`, `PT-MA`). Zero-rate taxes require `exemption_reason` (`M01`–`M16` for Portugal) ([taxes/insert](https://www.moloni.pt/dev/settings/tax-fees/insert/)). On each document line send `taxes: [{ tax_id, value?, order?, cumulative? }]`. Empty / non-IVA / zero IVA taxes make `exemption_reason` mandatory on the line. One IVA per article (error 15); “other” + IVA must be ordered/cumulative correctly (error 14) ([controlo de erros](https://www.moloni.pt/dev/controlo-de-erros/)).

**Moloni ON.** Portuguese companies are pre-seeded with 23%, 13%, 6%, and exemptions ([reference data](https://docs.molonion.pt/guides/gettingStarted/referenceData)). Query `taxes(companyId)` and use `taxId` where `value` is `23`. Attach taxes on the product; invoice lines inherit unless `products[].taxes` overrides ([creating an invoice](https://docs.molonion.pt/guides/documents/creatingAnInvoice)). EUR is the default currency for Portuguese companies.

---

## Merchant reference (installer-order id)

There is no field named “merchant reference”. The documented pair is:

| Classic | Moloni ON | Stated meaning (ON) |
| --- | --- | --- |
| `our_reference` | `ourReference` | Internal reference (contract, project code) |
| `your_reference` | `yourReference` | Customer’s reference (e.g. PO number) |

Climaeco’s installer-order id fits **`our_reference` / `ourReference`**. Put the installer’s own PO in `your_reference` / `yourReference` if needed.

**Classic insert fields (as published):**

- Fatura, fatura-recibo, nota de crédito: both `our_reference` and `your_reference` ([invoices/insert](https://www.moloni.pt/dev/documents/invoices/insert/), [invoiceReceipts/insert](https://www.moloni.pt/dev/documents/invoice-receipts/insert/), [creditNotes/insert](https://www.moloni.pt/dev/documents/credit-notes/insert/)).
- Orçamento: `your_reference` only ([estimates/insert](https://www.moloni.pt/dev/documents/estimates/insert/)).
- Recibo insert: neither field listed ([receipts/insert](https://www.moloni.pt/dev/documents/receipts/insert/)). Both appear on [`receipts/getAll`](https://www.moloni.pt/dev/documents/receipts/getall/) responses, so they exist on the document, but the insert docs do not expose a setter.

**Moloni ON:** both fields on [`InvoiceInsert`](https://docs.molonion.pt/reference/inputs/InvoiceInsert), [`ProFormaInvoiceInsert`](https://docs.molonion.pt/reference/inputs/ProFormaInvoiceInsert), [`InvoiceReceiptInsert`](https://docs.molonion.pt/reference/inputs/InvoiceReceiptInsert), [`ReceiptInsert`](https://docs.molonion.pt/reference/inputs/ReceiptInsert), [`CreditNoteInsert`](https://docs.molonion.pt/reference/inputs/CreditNoteInsert).

Lookups: classic `getAll` / `getOne` accept `your_reference` as a search field on several document classes (e.g. [estimates/getAll](https://www.moloni.pt/dev/documents/estimates/getall/)).

---

## PDFs

**Classic.** [`POST …/documents/getPDFLink/`](https://www.moloni.pt/dev/documents/documents/getpdflink/) with `company_id`, `document_id`, optional `signed`. Response `{ url: string }`. Drafts (`status` 0) are rejected. Docs do not specify TTL or that the URL is a stable permalink. `signed` “garante a assinatura do pdf”; omitting it downloads an unsigned PDF.

**Moloni ON.** Not a single permalink ([PDF guide](https://docs.molonion.pt/guides/documents/downloadingDocumentPDF)):

1. `{apiCode}GetPDF(companyId, documentId)` — queues generation (`true`/`false`). `false` if draft / not ready.
2. `{apiCode}GetPDFToken(documentId)` — `{ token, path, filename }`. Retry if still generating.
3. `GET https://mediaapi.moloni.org{path}?jwt={token}` immediately. Token ~10 s; request a new one each download.

Same pattern for `invoice`, `receipt`, `creditNote`, `proFormaInvoice`, `invoiceReceipt`.

---

## Sandbox / test mode

**Classic.** Documented sandbox: [moloni.pt/dev/sandbox](https://www.moloni.pt/dev/sandbox/). Explorer at `https://api.moloni.pt/sandbox/explorer.php`. Login with the Moloni client-area account. The login must already have access to the **demonstration account**; otherwise email `apoio@moloni.pt` with the login email. Docs do not describe a separate production-vs-sandbox API host for live company data — the Explorer is a controlled demo.

**Moloni ON.** In-browser GraphiQL Explorer against the live API ([docs home](https://docs.molonion.pt/), [getting started](https://docs.molonion.pt/guides/gettingStarted)). API Keys guide lists “Development and testing: quick API access during development” as a use of live keys ([API Keys](https://docs.molonion.pt/guides/gettingStarted/apiKeys)). No separate sandbox host is documented. Closing `status: 1` on a real Portuguese company talks to AT.

Practical implication: do not test certified emission against Climaeco production. Classic: request the demo account. Moloni ON: a dedicated test company (not documented as a product feature — an operational choice).

---

## Failure modes the order flow must handle

### Status machine

| Status | Classic | Moloni ON |
| --- | --- | --- |
| 0 | Draft (default if omitted). Editable / deletable. No PDF. | Draft. Editable / deletable. `GetPDF` may return `false`. |
| 1 | Closed. Sequential number. Fatura / fatura-recibo / NC communicated to AT if the company option is on. Stocks move. Cannot update or delete ([invoices/update](https://www.moloni.pt/dev/documents/invoices/update/), [invoices](https://www.moloni.pt/dev/documents/invoices/)). | Finalized. Locked, numbered, reported if applicable. Cannot edit or delete ([creating an invoice](https://docs.molonion.pt/guides/documents/creatingAnInvoice)). |
| 2 | Anulado via [`documents/documentCancel`](https://www.moloni.pt/dev/documents/documents/documentcancel/) (v1.26+). Only if closed, not pending AT, no AT transport code, originated no other document, and the type allows cancel. | Void via `{apiCode}Nullify`. Portuguese companies: `nullifiedReason` required. Cannot nullify a paid invoice until the receipt is nullified, or issue a credit note instead ([credit notes](https://docs.molonion.pt/guides/documents/correctingWithCreditNotes)). |

Default insert is draft. Certified emission is an explicit `status = 1`.

### Classic data errors

Returned as `"<code> <field> …"` arrays, or verbose objects with `human_errors=true` ([controlo de erros](https://www.moloni.pt/dev/controlo-de-erros/)). Codes that matter here:

| Code | Meaning |
| --- | --- |
| 1 | Required field (e.g. missing `document_set_id` → `"2 document_set_id"` is the numeric-field form; required is code 1) |
| 2 | Numeric constraints |
| 5 | Invalid value |
| 8 | Invalid Portuguese NIF |
| 10 | Invalid document association / nothing left to reconcile |
| 11 | Document cannot be sent to AT |
| 14 / 15 | Tax stacking (other+IVA order; more than one IVA) |
| 16 | CIVA art. 36.º n.º 15 — cannot use Consumidor Final / Desconhecido / 0000-000 above the legal threshold |
| 17 | Field length limit |

Credit-note extra rules (classic): NC total cannot exceed reconciliation; each line qty/price cannot exceed the associated document ([creditNotes/insert](https://www.moloni.pt/dev/documents/credit-notes/insert/)). Receipts may only associate faturas, notas de crédito, and migrated invoices ([receipts/insert](https://www.moloni.pt/dev/documents/receipts/insert/)).

Tokens: refresh before the 1 h access token dies; after 14 days re-auth. Auth errors are HTTP 400, not the numeric data codes.

### Moloni ON errors

Always read `errors[]` before `data`. HTTP 200 can still be a failed mutation ([error handling](https://docs.molonion.pt/guides/advanced/errorHandling)). Common document cases from the guides:

- Invalid / missing `documentSetId`, customer, or product
- `relatedWith` missing on credit note or receipt
- `"Document is in use as a payment in other document"` on nullify
- `"Nullified reason is required"` for PT
- `"You don't have access to this company."` / `"Expired subscription."` / `"You don't have permissions to execute this action."`
- PDF token not ready yet — retry
- AT series still `initialise` (not yet `active`)

Invoice-receipt insert in classic copies “fatura simplificada” wording when describing AT communication ([invoiceReceipts/insert](https://www.moloni.pt/dev/documents/invoice-receipts/insert/)); treat that as likely copy-paste, not a different document type. The endpoint is still `invoiceReceipts/insert`.

### Prerequisites that fail closed emission

- `customer_id` / `customerId` must exist in that company.
- Products must exist; classic lines also require `name`, `qty`, `price`, `product_id`.
- Series registered with AT for that document type (PT, since 2023).
- Moloni ON: `productAT.productType` on every product for Portuguese companies (`M` mercadorias, `S` serviços, …) ([first-time invoicing](https://docs.molonion.pt/guides/gettingStarted/firstTimeInvoicing)).
- Fatura-recibo / recibo: payment method. Classic auto-picks customer/company default or the first method if `payments` is omitted ([invoiceReceipts/insert](https://www.moloni.pt/dev/documents/invoice-receipts/insert/), [receipts/insert](https://www.moloni.pt/dev/documents/receipts/insert/)).
- Portugal id 1; PT postcodes must be `NNNN-NNN` ([invoices/insert](https://www.moloni.pt/dev/documents/invoices/insert/)).

---

## What this note does not decide

- Which Moloni product Climaeco uses (classic vs ON). Confirm against the live account; the APIs are different.
- When in the installer-order flow to emit each document (that is issue #11).
- Whether an orçamento is an acceptable stand-in for a fatura pró-forma on classic Moloni. SAF-T `OR` ≠ `PF` on Moloni ON.
- Idempotency / retries after a timeout on `status = 1` (AT may already have the document). Docs do not describe an idempotency key; search by `our_reference` / `ourReference` after a failed close.

---

## Sources

Classic Moloni (`www.moloni.pt/dev`, `api.moloni.pt/v1`):

- [Introdução](https://www.moloni.pt/dev/)
- [Autenticação](https://www.moloni.pt/dev/autenticacao/)
- [Utilização](https://www.moloni.pt/dev/utilizacao/)
- [Controlo de erros](https://www.moloni.pt/dev/controlo-de-erros/)
- [Sandbox](https://www.moloni.pt/dev/sandbox/) (Explorer: `https://api.moloni.pt/sandbox/explorer.php`)
- [Documents index](https://www.moloni.pt/dev/documents/)
- [invoices/insert](https://www.moloni.pt/dev/documents/invoices/insert/), [invoices/update](https://www.moloni.pt/dev/documents/invoices/update/)
- [invoiceReceipts/insert](https://www.moloni.pt/dev/documents/invoice-receipts/insert/)
- [receipts/insert](https://www.moloni.pt/dev/documents/receipts/insert/), [receipts/getAll](https://www.moloni.pt/dev/documents/receipts/getall/)
- [creditNotes/insert](https://www.moloni.pt/dev/documents/credit-notes/insert/)
- [estimates/insert](https://www.moloni.pt/dev/documents/estimates/insert/)
- [documents/getPDFLink](https://www.moloni.pt/dev/documents/documents/getpdflink/)
- [documents/getAllDocumentTypes](https://www.moloni.pt/dev/documents/documents/getalldocumenttypes/)
- [documents/documentCancel](https://www.moloni.pt/dev/documents/documents/documentcancel/)
- [documentSets/insert](https://www.moloni.pt/dev/settings/document-sets/insert/), [documentSets/ATInsertCode](https://www.moloni.pt/dev/settings/document-sets/atinsertcode/)
- [taxes/getAll](https://www.moloni.pt/dev/settings/tax-fees/getall/), [taxes/insert](https://www.moloni.pt/dev/settings/tax-fees/insert/)
- [companies/getAll](https://www.moloni.pt/dev/company/company/getall/)

Moloni ON (`docs.molonion.pt`, `api.molonion.pt/v1`):

- [Moloni ON API](https://docs.molonion.pt/)
- [Getting started](https://docs.molonion.pt/guides/gettingStarted)
- [API Keys](https://docs.molonion.pt/guides/gettingStarted/apiKeys)
- [API Clients](https://docs.molonion.pt/guides/gettingStarted/apiClients)
- [First-time invoicing](https://docs.molonion.pt/guides/gettingStarted/firstTimeInvoicing)
- [Reference data (taxes 23/13/6)](https://docs.molonion.pt/guides/gettingStarted/referenceData)
- [Document types](https://docs.molonion.pt/guides/documents/documentTypes)
- [Creating an invoice](https://docs.molonion.pt/guides/documents/creatingAnInvoice)
- [Paying an invoice](https://docs.molonion.pt/guides/documents/payingAnInvoice)
- [Credit notes](https://docs.molonion.pt/guides/documents/correctingWithCreditNotes)
- [Downloading a PDF](https://docs.molonion.pt/guides/documents/downloadingDocumentPDF)
- [Error handling](https://docs.molonion.pt/guides/advanced/errorHandling)
- Insert inputs: [InvoiceInsert](https://docs.molonion.pt/reference/inputs/InvoiceInsert), [ProFormaInvoiceInsert](https://docs.molonion.pt/reference/inputs/ProFormaInvoiceInsert), [InvoiceReceiptInsert](https://docs.molonion.pt/reference/inputs/InvoiceReceiptInsert), [ReceiptInsert](https://docs.molonion.pt/reference/inputs/ReceiptInsert), [CreditNoteInsert](https://docs.molonion.pt/reference/inputs/CreditNoteInsert)
- Mutations: [proFormaInvoiceCreate](https://docs.molonion.pt/reference/mutations/proFormaInvoiceCreate), [invoiceReceiptCreate](https://docs.molonion.pt/reference/mutations/invoiceReceiptCreate)

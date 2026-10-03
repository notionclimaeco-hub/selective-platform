# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Climaeco office staff** (Clerk `role = staff`) using the **Admin app** (`admin-frontend`). They approve installer companies, set tiers and brand × tier discounts, manage the catalog and its yearly price-table imports, and (map #82) run every installer order end to end: stock requests to suppliers, payment requests, supplier guias, warehouse receipt, exceptions, levantamento and documents.
- *Inferred, not confirmed (question left unanswered 2026-10-01):* a small team working long desktop sessions; screenshots are judged at 1440 px with 390 px as a sanity check (map #82 Notes: "Desktop-first").
- Installer companies and end customers never see the Admin app; they use the Climaeco Pro storefront (`client-frontend`).

## Product Purpose

Climaeco is an HVAC distributor for installer companies and a certified installer for end customers. The Admin app is where staff keep that business running: who may buy at reseller prices, what the catalog holds and costs, and what state every installer order is in. Success: staff never need another tool (Notion was dropped 2026-10-01) and always know which orders need them now.

## Positioning

An internal operations tool, not a product for sale. Its edge is that it owns the full order lifecycle against Climaeco's own rules (qty buckets per line, one payment, one levantamento, InvoiceXpress documents) instead of a generic CRM or Notion board.

## Operating Context

- Pages today: Painel, Empresas (+ detail), Comercial (tiers, discount grid), Produtos (images), Páginas do catálogo (per-page PDFs), Importações (+ review of an import run), sign-in; orders list and order page are being prototyped (#86).
- Staff copy supplier stock-request emails into their own mail client; payment is Revolut Pay by Bank via a 7-day link; documents come from InvoiceXpress; installer emails go out through Resend.
- Domain vocabulary is Portuguese (pt-PT) and fixed in `CONTEXT.md` (installer order, linha, guia do fornecedor, levantamento, pronta a levantar, fatura-recibo, nota de crédito, exceção, tier, PVP, preço de revenda…).

## Capabilities and Constraints

- Stack: TanStack Start/Router, React 19, Tailwind v4, shadcn on Base UI, lucide-react, sonner, Clerk, Convex.
- UI copy is pt-PT and shows data only: no explanatory sentences under titles; compact cards with title left / value right; per-row inline edits (pencil → input with X / check) confirmed by a toast with *Reverter*; one primary action per state (user preferences, see memory).
- Undecided: what the "action needed" count includes (map #82), per-staff permissions.

## Brand Commitments

- **Same design language as the client app (user, 2026-10-01, binding):** the Admin app copies the Climaeco Pro client
  app's look (`client-frontend`): its tokens and Inter, `rounded-xl` settings-style cards with title-left / value-right
  header rows, column tables inside a card, pill badges with a dot, rounded-full filter chips, the collapsible icon
  sidebar, the tinted sign-in page. A first, distinct "price table" admin look was built and rejected the same day.
- **Logo:** the leaf + "climaeco" wordmark drawn as SVG (`components/brand/wordmark.tsx`, client's "PRO" subtitle reads
  "ADMIN"); `logo-climaeco.png` is the source. Binding.
- **Palette:** forest green primary + lime/leaf brand used sparingly (primary actions, active states, small highlights) on
  neutral greys, exactly as the client. Binding.
- Name in UI: "Clima Eco Selective" / "Climaeco"; the "Admin app" (avoid back-office, desk, Notion).

## Evidence on Hand

- Real catalog brands: Daikin, Hisense, Midea, Mitsubishi, Nipon (logos in `images/logos/`).
- Dev deployment data (`accurate-grouse-482`) for companies, catalog and imports; orders exist only as #86 fixtures.

## Product Principles

1. The office should see what needs it first; everything else waits.
2. Data over prose: every word on screen is a value, a label or an action.
3. One way to do each thing, the same on every page.
4. Never lose work: inline edits are reversible, destructive actions are confirmed or undoable.

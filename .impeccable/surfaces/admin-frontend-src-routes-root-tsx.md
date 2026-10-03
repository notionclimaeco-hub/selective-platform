---
version: 1
slug: "admin-frontend-src-routes-root-tsx"
primary_target: "admin-frontend/src/routes/__root.tsx"
related_targets: ["admin-frontend/src/routes"]
---

# Admin app (admin-frontend) — whole surface

Scope: the whole Admin app shell and every page (Painel, Encomendas prototype #86, Empresas, Comercial, Produtos, Páginas do catálogo, Importações, sign-in). Mode: Operate.
Audience/job: Climaeco office staff running companies, catalog, imports and installer orders on desktop (390 px sanity). Constraints: pt-PT data-only copy; inline row edits with Reverter toasts; one primary action per state.
Chosen direction: Client parity — user-pinned 2026-10-01 ("Copy the design language of the client front-end"), replacing the rejected "Tabela de Preços" build. User-pinned direction beats the roll; no concept seed for this round.

## Direction contract

THESIS: The Admin app is the staff side of the same product as Climaeco Pro, so it wears the client app's design language unchanged: calm neutral sheets, settings-style cards and column tables, green only where something is chosen or acted on. It refuses a separate "admin tool" identity.

OWN-WORLD: client-frontend tokens and Inter at -0.011em; rounded-xl border cards with a min-h-14 title-left/value-right header row; tables inside cards with a bg-secondary/40 header row and divide-y body; pill badges with a dot (client EstadoBadge colours); rounded-full chips, filled primary when active; rounded-lg buttons/inputs; collapsible icon sidebar with lime-tinted active item and primary count pills; lime dot = needs the office.

STORY: Staff land on the Painel queue, open a list, filter with chips, open a record, edit a row inline, done — the same gestures installers use in their app.

FIRST VIEWPORT: Left collapsible sidebar (wordmark "climaeco ADMIN", icon destinations with count pills, account at the bottom). Content: plain page title (2xl semibold) with actions right, chips under it, then the first white card with its header row and table.

FORM: Client parity (user-pinned; not from a seed roll). Previous seed key 52392fd1 belonged to the rejected round.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

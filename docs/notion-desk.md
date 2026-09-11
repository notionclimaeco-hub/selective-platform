# Notion office desk (installer orders)

Convex is the source of truth; Notion is the desk (contract on
[#12](https://github.com/notionclimaeco-hub/selective-platform/issues/12),
amended 2026-09-11: no pró-forma). Code lives in `convex/notion/`.

## Setup (once per deployment)

Prerequisites (manual, #10): internal integration **Climaeco Plataforma**
connected to the `back-end` page; Convex env `NOTION_API_KEY`,
`NOTION_BACKEND_PAGE_ID`, `NOTION_WEBHOOK_SECRET` (any long random string).

```bash
npx convex run notion/setup:configurar          # dev
npx convex run notion/setup:configurar --prod   # production, at cutover
```

Creates inside `back-end`, or upgrades if they already exist (adds missing
properties, never deletes):

| Database | Purpose |
| --- | --- |
| `db-encomendas-selectivedistribui` | one ticket per installer order (`ENC-<n> — <empresa>`) |
| `db-linhas-selectivedistribui` | one row per order line, related to its ticket |
| `db-excecoes-selectivedistribui` | refunds / invoicing / other exceptions (later slice) |
| `db-modelos-selectivedistribui` | supplier email templates; `default` is seeded |

The office works through linked views of these databases in its own hub.

## Automations (by hand — the Notion API cannot create them)

Webhook URL (same for all three; the secret is the `NOTION_WEBHOOK_SECRET`
value from the Convex dashboard → Settings → Environment Variables):

```
https://<deployment>.convex.site/notion/webhook?secret=<NOTION_WEBHOOK_SECRET>
```

Dev deployment: `https://accurate-grouse-482.convex.site/notion/webhook?secret=…`

| Database | Trigger(s) | Action |
| --- | --- | --- |
| `db-encomendas-selectivedistribui` | property **Ação** edited | Send webhook → URL above |
| `db-linhas-selectivedistribui` | property **Ação** edited · **page added** | Send webhook → URL above |
| `db-excecoes-selectivedistribui` | property **Resolvida** edited | Send webhook → URL above (handled in a later slice) |

Convex ignores the payload beyond the page id and re-reads the page. A
reconciliation cron (`convex/crons.ts`, every 15 min) re-renders open
tickets and picks up any Ação or new row whose webhook did not arrive, so a
missed automation delays the desk, never loses it.

## Ticket page template (by hand)

The API cannot create linked views, so the ticket body comes from a
**database template** in `db-encomendas-selectivedistribui` marked as
*default* (template menu → "Set as default"). The current template holds a
linked view of `db-linhas-selectivedistribui` filtered to the ticket
("Linhas da encomenda"). When a default template exists Convex creates the
ticket with `template: { type: "default" }`, waits for Notion to copy it
(the page is blank for a few seconds; the render re-runs 15 s later) and
then appends its own sections — **Emails aos fornecedores** and
**Registo**. Without a default template Convex falls back to writing a
static lines table itself. Tickets created before the template existed keep
their old body; new ones get the template. Edit the template freely — only
the two Convex headings above are looked up by name.

## How the office uses it (this phase: stock)

- **Estado** is written by Convex only: `Nova — pedir stock` → `A confirmar
  stock` → `Pronta a cobrar` → `A aguardar pagamento` → `Paga — em curso` →
  `Concluída`; `Cancelada (…)`.
- Ticket **Ação**: `Stock pedido` (after emailing the suppliers — drafts are
  in the ticket body), `Cancelar` (+ optional `Motivo`). `Pedir pagamento`
  and `Voltar a editar` arrive with the Revolut slice.
- Line **Ação**: `Confirmar stock` (+ `Custo (€)`), `Retirar`, `Alterar qtd`
  (+ `Nova qtd`). `Registar guia`, `Receção armazém`, `Falhar qtd` arrive
  with the post-payment slice.
- **Add a line**: new row in `db-linhas`, fill `Ref`, `Qtd` and the
  `Encomenda` relation. Convex validates the ref, snapshots the current
  reseller price and fills the rest.
- **Erro**: Convex clears `Ação` after every attempt and writes the reason
  here when it could not apply the action. Fix the input and set `Ação`
  again; the text is cleared on the next successful action.
- Templates: edit `db-modelos` rows (`Assunto`, `Corpo`); placeholders
  `{{marca}}` (brand name), `{{encomenda}}` (`ENC-n`, no customer name) and
  `{{linhas}}` (replaced by a Referência / Descrição / Quantidade table).
  Blank lines in `Corpo` become separate paragraphs. Each draft is rendered
  as a callout titled with the brand. Add a row titled with the marca slug
  (e.g. `hisense`) to override `default`. Convex never sends email.

## Production cutover

1. Create the production integration + connection, set the three env vars
   on the production deployment.
2. `npx convex run notion/setup:configurar --prod`.
3. Configure the three automations with the production URL.

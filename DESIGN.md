---
name: Climaeco Admin app
description: The staff side of Climaeco Pro, wearing the client app's design language unchanged.
colors:
  primary: "oklch(0.45 0.115 148)"
  primary-hover: "oklch(0.405 0.104 148)"
  primary-foreground: "oklch(0.985 0.005 130)"
  brand: "oklch(0.76 0.185 129)"
  accent: "oklch(0.955 0.03 132)"
  accent-foreground: "oklch(0.35 0.08 148)"
  ring: "oklch(0.55 0.11 148)"
  background: "oklch(1 0 0)"
  foreground: "oklch(0.2 0.005 260)"
  secondary: "oklch(0.968 0.002 260)"
  secondary-foreground: "oklch(0.3 0.005 260)"
  muted-foreground: "oklch(0.52 0.012 260)"
  border: "oklch(0.905 0.003 260)"
  input: "oklch(0.87 0.004 260)"
  sidebar: "oklch(0.985 0.002 260)"
  auth-tint: "oklch(0.982 0.005 132)"
  warning: "oklch(0.97 0.04 85)"
  warning-foreground: "oklch(0.48 0.11 65)"
  destructive: "oklch(0.577 0.245 27.325)"
typography:
  headline:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "2rem"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: "1.25rem"
    letterSpacing: "-0.011em"
  body:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    letterSpacing: "-0.011em"
    fontFeature: "\"cv11\", \"ss01\""
  button:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
    letterSpacing: "-0.011em"
  chip:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: "1.25rem"
    letterSpacing: "-0.011em"
  label:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
    letterSpacing: "-0.011em"
  count:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: "1.25rem"
    fontFeature: "\"tnum\""
rounded:
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "14px"
  4xl: "24px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "16px"
  gutter: "20px"
  lg: "24px"
  xl: "32px"
  row: "56px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.secondary}"
  button-ghost-hover:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
  button-destructive:
    textColor: "{colors.destructive}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "4px 12px"
    height: "40px"
  input-table:
    backgroundColor: "{colors.background}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  chip:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.chip}"
    rounded: "{rounded.full}"
    padding: "0 12px"
    height: "32px"
  chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
  card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.xl}"
  card-header:
    textColor: "{colors.foreground}"
    typography: "{typography.title}"
    padding: "0 20px"
    height: "56px"
  table-header:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    padding: "10px 16px"
  table-row:
    typography: "{typography.body}"
    padding: "10px 16px"
    height: "56px"
  badge-neutral:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-warning:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.warning-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-done:
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-danger:
    textColor: "{colors.destructive}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  sidebar:
    backgroundColor: "{colors.sidebar}"
    width: "240px"
  sidebar-collapsed:
    width: "56px"
  sidebar-item:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  sidebar-item-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
  count-pill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.count}"
    rounded: "{rounded.full}"
    padding: "0 6px"
    height: "20px"
  edit-tile:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.md}"
    size: "24px"
  edit-tile-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
  needs-office-dot:
    backgroundColor: "{colors.brand}"
    rounded: "{rounded.full}"
    size: "8px"
  auth-page:
    backgroundColor: "{colors.auth-tint}"
  auth-card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.2xl}"
    padding: "24px"
    width: "400px"
---

# Design System: Climaeco Admin app

> **Scope and authority.** This file documents the **Admin app** (`admin-frontend`). It does not own its design language: the authority is the **Climaeco Pro client app** (`client-frontend`), which the Admin app copies on purpose (user decision, 2026-10-01, binding in PRODUCT.md). Make a visual change in `client-frontend` first, then mirror it here and in the admin files listed below. An admin-only change is allowed only for the adaptations recorded under **Admin-only adaptations**, each of which has a reason.
>
> **Verbatim copies of client files** (keep identical; the diff should only ever be the noted line):
> - `src/styles.css`: the client's foundation (`@theme`, `:root`, `.dark`, base layer, `.sem-scrollbar`, `.fundo-auth`, reduced-motion) plus the two `--warning` tokens. The client's chrome-offset variables, landing motion, marquee and success-transition rules are client-only and are left out.
> - `components/ui/button.tsx`, `input.tsx`, `tooltip.tsx`: identical.
> - `components/ui/dialog.tsx`: identical except the "Fechar" screen-reader label.
> - `components/ui/skeleton.tsx`: identical `Skeleton`, plus admin loading shapes (`LinhasEsqueleto`, `FichaEsqueleto`, `CabecalhoEsqueleto`).
> - `components/auth/cartao-auth.tsx`, `components/shell/avatar-clerk.ts`: identical.
> - `lib/clerk-ui.ts`: identical appearance (formatting and a localization type cast differ).
> - `components/brand/wordmark.tsx`: identical drawing; the subtitle reads "ADMIN" instead of "PRO".
>
> **Admin-side mirrors** (admin code written to match a client component; re-check against the source when the client changes):
> - `components/ui/tabela.tsx`: `Cabecalho` ← `shell/pagina.tsx` `CabecalhoPagina`; `Seccao` / `Banda` ← `empresa/seccao.tsx`; `Tabela` / `Th` / `Td` / `linhaCls` ← `encomendas/lista-encomendas.tsx`; `Marcador` ← `encomendas/estado-badge.tsx` + `lib/encomendas.ts`; `Ficha` ← `empresa/seccao.tsx` `Linhas`; `Filtros` ← `catalogo/filter-chips.tsx`.
> - `components/ui/campo-editavel.tsx` ← `empresa/conta-dialog.tsx` (pencil → X / check row, toast with *Reverter*).
> - `components/ui/seletor.tsx` ← `catalogo/sort-select.tsx`.
> - `components/ui/paginacao.tsx` ← `catalogo/pagination.tsx`.
> - `components/ui/sonner.tsx` ← client `ui/sonner.tsx` (bottom offset differs, see below).
> - `components/shell/app-shell.tsx` ← `shell/app-shell.tsx` (sidebar ported; phone chrome differs, see below).

## Overview

**Creative North Star: "The Staff Side of the Same Counter"**

Installers buy at the front of the counter in Climaeco Pro; staff work behind the same counter in the Admin app. Both sides are built from the same materials: white sheets on a pale grey sidebar, settings-style cards whose header row puts the title on the left and the value on the right, column tables living inside those cards, pill badges with a dot, rounded filter chips. Nothing on the staff side announces itself as an "admin tool"; a staff member who has used the client app already knows every gesture.

The world is calm and dense. Colour is almost entirely neutral grey; forest green appears only where something is chosen or acted on (the primary button, the active chip, the count pill, the current page number), and lime appears only as the tint behind the active sidebar item and the edit tile, and as the small dot that means "this needs the office". Depth comes from hairline borders, not shadows. Copy is data only: titles, values, labels and actions, never explanatory sentences.

A separate "price table" admin look was built and rejected on 2026-10-01. Do not reintroduce a distinct admin identity.

**Key Characteristics:**
- Client parity: every token, radius and component shape comes from `client-frontend`.
- Neutral sheets; green is reserved for choice and action.
- Settings-style cards with a 56px title-left / value-right header row.
- Column tables inside cards: tinted header row, 56px rows, hairline dividers.
- Pill badges with a coloured dot for every state.
- Inline row edits (pencil tile → X / check) confirmed by a toast with *Reverter*.
- Collapsible icon sidebar with lime-tinted active item and green count pills.

### Admin-only adaptations

These are the only places the Admin app departs from the client, and why:
- **Sidebar count pills on three destinations** (Encomendas, Empresas, Importações). The client shows its counter pill only on Orçamento; staff need queue sizes at a glance. Same pill, more places.
- **Phone chrome: top bar + menu, no bottom tab bar.** The client's phone bottom bar holds five tabs; the Admin app has seven destinations, so phones get the client's sticky top bar with a menu button that opens the same destination list (with counts).
- **Amber warning tone.** The client uses amber only in its pending-company banner and estado badge; the Admin app turns that amber into the `warning` / `warning-foreground` token pair for "aviso" badges, import warnings and payment deadlines.
- **1600px import review page.** The import run review (`importacoes_.$importacaoId.tsx`) widens to 1600px: an expanded group shows its variants table beside a 28rem PDF page panel, and a sticky decision bar sits at the bottom. Every other page keeps the client's 72rem column.
- **"climaeco ADMIN" wordmark.** The client's mark with the subtitle changed from "PRO" to "ADMIN".
- **Toast offset fixed at 80px** to clear the import review's decision bar (the client computes it from `--toast-fundo`).

## Colors

Neutral greys at hue 260 carry the page; two greens from the logo carry every decision. All values are OKLCH, as in `styles.css`.

### Primary
- **Forest Green** (`primary`): the action colour. Primary buttons, the active filter chip, count pills, the current page in the pager, the save check of an inline edit, links, "done" badges (at 10% fill with a 20% ring). Hovered by mixing 10% black in OKLCH (`primary-hover`).
- **Forest Ink** (`accent-foreground`): green text on lime tint, used by the active sidebar item and the edit tile.
- **Focus Green** (`ring`): focus borders, with a 3px ring at 25% alpha.

### Secondary
- **Leaf Lime** (`brand`): the leaf and "clima" in the wordmark, and the 8px "needs the office" dot (`Destaque`) beside Painel queues and list rows. Never a fill for large areas or text.
- **Lime Wash** (`accent`): the active sidebar item, the pencil edit tile, hover behind pager numbers, initials avatars, and the soft glow at the top of the sign-in page.

### Tertiary
- **Amber Wash / Amber Ink** (`warning`, `warning-foreground`): the "aviso" state. Badge fill and text, import warning lists, photo-review flags, deadline text on the last day. Admin-only token; see adaptations.
- **Signal Red** (`destructive`): "perigo" badges and the destructive button, both at 10% fill with full-strength text; the Sem acesso lock tile.

### Neutral
- **Paper White** (`background`): page, cards, popovers, inputs.
- **Graphite** (`foreground`): primary text.
- **Mist** (`secondary`): neutral badge fill, table header row (at 40%), row hover (at 40%), outline and ghost button hover.
- **Slate** (`secondary-foreground`): neutral badge text.
- **Pewter** (`muted-foreground`): labels, table headers, meta lines, counts beside card titles, inactive sidebar items.
- **Hairline** (`border`): every card border, header-row rule, table divider.
- **Field Edge** (`input`): input, select and outline-button borders; darkens 15% toward `foreground` on hover.
- **Sidebar Grey** (`sidebar`): the sidebar sheet, a step off white.
- **Auth Tint** (`auth-tint`): the sign-in and Sem acesso page background (`.fundo-auth`).

Dark-mode tokens exist in `styles.css` (copied from the client) but neither app switches them on. Do not design against them until the client does.

### Named Rules
**The Green Means Chosen Rule.** Forest green fills only what is selected or what acts: the primary button, the active chip, the current page, count pills, the save check. A green surface that is neither chosen nor clickable is wrong.

**The Lime Dot Rule.** The lime `brand` dot means exactly one thing: this needs the office now. It is never decoration and never a status colour inside a badge.

## Typography

**Display Font:** none; the system has no display face.
**Body Font:** Inter Variable (with sans-serif), self-hosted via `@fontsource-variable/inter`.

**Character:** One face at a slightly negative tracking (-0.011em) with Inter's `cv11` and `ss01` alternates, the single biggest "modern product" cue in the client app. Hierarchy comes from weight and size steps, never from a second family.

### Hierarchy
- **Headline** (600, 1.5rem / 2rem, tracking -0.025em): the page title in `Cabecalho`, and the auth card title. One per page.
- **Title** (600, 0.875rem / 1.25rem): card header rows (`Banda`, `Seccao`), with an optional count in 400 Pewter beside it.
- **Body** (400, 0.875rem / 1.25rem): table cells, label / value rows, meta line under the page title. Inputs use 1rem on phones (stops iOS zoom) and 0.875rem from `sm` up.
- **Button** (500, 0.875rem): buttons, sidebar items, the action of a toast (0.75rem there).
- **Chip** (500, 0.8125rem): filter chips only.
- **Label** (500, 0.75rem / 1rem): table header cells and badges.
- **Count** (600, 0.6875rem, tabular figures): sidebar count pills (0.625rem when the sidebar is collapsed).

### Named Rules
**The Tabular Figures Rule.** Every number that lines up in a column or can change in place (quantities, prices, counts, page numbers) uses tabular figures and right alignment in tables.

## Layout

- **Shell.** Desktop (`md`, 768px, and up): a sticky full-height sidebar, 240px wide or 56px collapsed (stored per browser), with the wordmark row (56px) at the top, destinations below, and the Clerk account button at the bottom behind a hairline. Phones: a sticky 56px top bar (blurred white at 85-95%) with wordmark, avatar and a menu button; the menu opens the destination list under the bar.
- **Page column.** `mx-auto`, max 72rem (1152px), gutters 16px on phones and 24px from `sm`, 24px top padding (32px from `lg`), 24px gap between blocks. The import review page alone widens to 1600px.
- **Page order.** Title block (optional back link, headline, one data line, actions right-aligned on the title row) → filter chips → the first card. Two-column record pages (Empresa detail) split cards side by side from `lg`.
- **Card rhythm.** 20px horizontal gutter everywhere inside a card; header row and table rows are both 56px tall, so a card reads as a column of equal bands. Label / value rows use a 7.5rem label column (10rem from `sm`) with 16px between label and value.
- **Chips.** 6px gaps; on phones the chip row scrolls sideways without a scrollbar and bleeds to the screen edge; from `sm` it wraps.
- **Tables.** Scroll sideways inside their card, never the page. On phones, secondary columns are hidden rather than squeezed.

### Named Rules
**The 56px Band Rule.** Card header rows, table rows and editable rows share one height (56px) and one gutter (20px). A new row type joins that rhythm.

## Elevation & Depth

Flat by default. Cards, tables, chips, sidebar and inputs sit on hairline borders with no shadow; depth is conveyed by the white card on the white page through its `border` line, and by the `sidebar` grey one step off white. Shadows appear only on things that float above the page.

### Shadow Vocabulary
- **Button lift** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`, Tailwind `shadow-xs`): primary and outline buttons only.
- **Auth card** (`box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -16px rgba(0,0,0,0.16)`): the single card on the sign-in and Sem acesso pages.
- **Toast** (Tailwind `shadow-lg` + a 1px `foreground` ring at 5%): sonner toasts.
- **Dialog** (Tailwind `shadow-xl` + a 1px `foreground` ring at 5%): modal dialogs.

### Named Rules
**The Floating-Only Shadow Rule.** A shadow means the element floats over the page (toast, dialog, the lone auth card). In-page cards and tables never carry one.

## Shapes

Radii derive from one base (`--radius`, 10px) and step by role: 8px for small in-row controls (sidebar items, the 24px edit tile, skeleton bars), 10px for buttons, inputs, selects and pager numbers, 12px for cards, 14px for the auth card, 24px for dialogs, and full pills for chips, badges, count pills and dots. Borders are always 1px hairlines; badges use an inset 1px ring instead of a border. Cards clip their contents (`overflow: hidden`) so table header tints and row hovers follow the corner.

## Components

### Buttons
Quiet and solid; one primary per state.
- **Shape:** gently rounded (10px), 36px tall (32px `sm`, 40px `lg`, 24px `xs`), 12px side padding, 16px icons with 6px gap.
- **Primary:** Forest Green fill and border, near-white text, button lift; hover darkens by mixing 10% black.
- **Outline:** white with a Field Edge border; hover fills Mist. Used for secondary actions and the pager's Anterior / Seguinte.
- **Ghost:** no fill; Mist on hover.
- **Destructive:** Signal Red text on a 10% red fill (20% on hover); no solid red button exists.
- **Focus / Press:** focus shows a Focus Green border with a 3px ring at 25%; press nudges down 1px; disabled is 50% opacity.

### Chips
- **Style:** 32px pills, 12px padding, 13px medium text, white with a hairline border; hover darkens the border to 25% `foreground`.
- **State:** the active chip fills Forest Green with near-white text. Chips are single-select filters (`role="tab"`); there is no multi-select or removable chip.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Paper White.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px Hairline.
- **Internal Padding:** 20px gutter; header row 56px with a bottom hairline, title left in Title type, count / values / small actions right in Pewter.
- **Variants:** `Seccao` (header row + body), `Cartao` (no header, for lists whose chips already name them), `Vazio` (one muted line, 24px vertical padding, when a card has no rows).

### Tables
- **Header row:** Mist at 40%, Label type in Pewter, 10px vertical padding, 16px cell padding with 20px at the outer edges.
- **Body rows:** 56px, hairline between rows, none after the last; hover tints Mist at 40%; a trailing chevron marks a row that opens a record.
- **Numbers:** right-aligned, tabular, no wrap.

### Badges
A pill with a 6px dot, 12px medium text, 2px × 10px padding, inset ring at 20%. Tones (`Marcador`): **neutro** (Mist / Slate, grey dot), **aviso** (Amber Wash / Amber Ink, amber dot), **progresso** (green 10% fill, green dot at 50%), **feito** (green 10% fill, solid green dot), **perigo** (red 10% fill, red dot), **inativo** (Mist / Pewter, faint dot). These match the client's `EstadoBadge` colours.

### Inputs / Fields
- **Style:** 40px tall (36px at table density, `campoCls`), white, 1px Field Edge border, 10px radius, 12px side padding, Pewter placeholder.
- **Hover:** border darkens 15% toward Graphite.
- **Focus:** Focus Green border plus a 3px ring at 25%.
- **Error / Disabled:** `aria-invalid` turns the border Signal Red with a 20% red ring; disabled is 50% opacity.
- **Select (`Seletor`):** a native select on the same look with a right chevron; when it narrows a list it turns its border green at 40% and its text green.

### Inline Edit Row
The client's account-editor row. Label (Pewter) | value | one 24px Lime Wash pencil tile that turns Forest Green on hover. Editing swaps the value for an input and the pencil for an X (ghost) and a Forest Green check; Enter saves, Escape cancels. A save confirms with a toast whose *Reverter* action writes the previous value back.

### Navigation
- **Sidebar items:** 36px, 8px radius, 10px padding, 16px icon + Button type in Pewter; hover fills Lime Wash with Graphite text; the current page is Lime Wash with Forest Ink text. Collapsed, items become 40px icon squares with a right-side tooltip and the count pill pinned to the icon's top-right corner.
- **Count pills:** 20px tall Forest Green pills with near-white Count type, shown only when the count is above zero ("50+" when paginated).
- **Phone:** top bar with wordmark, avatar and menu; the open menu lists the same items at 40px with counts.
- **Pager:** Anterior (outline) left, page numbers centre (current filled Forest Green, others Pewter with Lime Wash hover), Seguinte right; phones show "Página X de Y" instead of numbers.

### Toasts
White popover sheet, 10px radius, 22rem wide, 14px text with a medium title, floating shadow; the action button is a 28px Forest Green pill-rectangle (8px radius) in 12px medium. Used for inline-edit confirmations with *Reverter* and for errors.

### Sign-in Card
On the Auth Tint page with a lime glow at the top: the wordmark (32px tall) centred above one 400px white card (14px radius, auth-card shadow, 20px padding on phones, 24px from `sm`) holding a centred headline and Clerk's form styled through `lib/clerk-ui.ts` to match the inputs and buttons above.

## Do's and Don'ts

### Do:
- **Do** make the change in `client-frontend` first and mirror it into the admin copy; keep the files listed at the top of this document in step.
- **Do** build every page as title block → filter chips → cards, inside the 72rem column with 16px / 24px gutters.
- **Do** put lists in a card with a tinted header row and 56px rows, and records in `Seccao` cards with label / value rows on the 7.5rem / 10rem label column.
- **Do** show every state as a dot badge from the six `Marcador` tones.
- **Do** edit one property at a time with the pencil tile and confirm with a *Reverter* toast.
- **Do** keep one primary (Forest Green) button per state; secondary actions are outline or ghost.
- **Do** use tabular figures and right alignment for every number in a column.

### Don't:
- **Don't** give the Admin app its own look: no separate palette, typeface, density or "admin tool" chrome (the rejected "Tabela de Preços" world).
- **Don't** fill large areas with green or lime; green fills only what is chosen or acts, lime only tints the active item and the edit tile.
- **Don't** use the lime dot for anything except "needs the office".
- **Don't** put shadows on in-page cards, tables or chips.
- **Don't** add explanatory sentences under titles or in cards; the meta line under a title carries data only.
- **Don't** use a second typeface or a display size above the 1.5rem headline.
- **Don't** add a solid red button; destructive actions are red text on a 10% red fill.
- **Don't** let a table scroll the page sideways; it scrolls inside its card.

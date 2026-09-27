# Sign-in / sign-up page patterns in modern SaaS (measured, 2026-09-27)

Primary-source survey of eight live login pages, captured headless with
Playwright (Chromium 149, desktop UA, `locale: en-US`) at 390x844 and 1440x900,
with computed styles pulled via `page.evaluate`. No blog write-ups were used.

Artifacts (local only, `.context/` is git-excluded):

- Screenshots: `.context/research-login/<app>-<viewport>.png`
- Raw measurements: `.context/research-login/merged.json`
- Scripts: `.context/research-login/capture.mjs` (capture + extraction),
  `summarize.mjs` (merge + table), `targeted.mjs` (follow-up probes)

Values below are the computed values Chromium reported. "ring" means a 1px
`box-shadow` spread used instead of a CSS border. Where extraction failed or
needed a fallback, it says so.

## Comparison table

| App (page) | Layout | Card? | Logo | Heading | Input | Primary button | OAuth | Footer / legal | Mobile (390) |
|---|---|---|---|---|---|---|---|---|---|
| Attio (sign-in; sign-up redirects here) | White page; one 1130px bordered panel split form-left / copy-right | Panel 1130x692, 1px `rgb(238,239,241)`, r20, no shadow; not a form-width card | Wordmark 96x24 centered at page top (y32) | No heading on the form side; right panel "Welcome to Attio." 24/600 | 372x34, r10, 1px ring, placeholder only, 14px | "Continue" 372x32, `rgb(38,109,240)`, r9, 14/500 white | Google only, full-width above email, 1px line divider, no "or" text | Consent paragraph under form; page footer "© 2026 Attio Limited · Privacy Policy · Support" 12/500 | Panel + right copy removed; borderless 372px column, 9px margins |
| T3 Chat (`signin.t3.chat`, WorkOS AuthKit) | Pink page `rgb(243,230,245)`, centered column | Yes 440x471, r16, 1px inset ring, padding 48 | 48x48 icon centered above heading, outside card | "Sign in to T3 Chat" h1 24/600 centered | 344x40, r6, 1px ring, label "Email" above, 16px | "Continue with email" 344x40, `rgb(167,66,112)`, r6, 16/500 | Google, Microsoft, Apple stacked full-width **below** email, "OR" text divider | "Don't have an account? Sign up" inside card; "Terms of Service and Privacy Policy" at page bottom | Card kept, 358 wide (16px margins), r12, padding 32 |
| Linear | Grey page `rgb(248,248,249)`, centered column | No | 48x48 icon centered above heading | "Log in to Linear" h1 18/500 centered | Hidden until "Continue with email"; then 288x44, 1px `rgb(210,210,210)`, r10, bg `rgb(248,248,249)`, 13px | Pill (r9999) 288x44, 13/500; Google filled `rgb(109,120,213)`, email button white | Google (filled, first), then email, SAML SSO, passkey; all pills; no divider | "Don't have an account? Sign up or learn more"; **no legal text** | Identical 288px column centered |
| Vercel login | Off-white `rgb(250,250,250)`, centered column | No | 20x20 icon top-left + "Sign Up" button top-right | "Log in to Vercel" h1 32/600, ls -0.96 | 320x40, wrapper r8 + 1px ring `rgba(0,0,0,.08)`, placeholder only, 16px | "Continue with Email" 320x40, `rgb(23,23,23)`, r8, 16/500, no shadow | Google, GitHub, ChatGPT, SAML SSO, Passkey stacked full-width **below** email; 1px line divider, no text; "Show other options" | "Don't have an account? Sign Up" (blue link) below; "Terms · Privacy Policy" tiny at page bottom | Identical 320px column; logo stays top-left |
| Vercel signup | Same page bg, centered card | Yes 550x600 (max-w 550), white, r12, ring + `0 2px 2px` shadow | Wordmark 110x22 top-left + "Log In" top-right | Marketing copy "Your first deploy is just a sign-up away." 32/600 (24/600 at 390) | None on first screen ("Continue with Email →" link) | n/a (OAuth-first) | Google, GitHub, ChatGPT, Apple stacked 390x40; "Show other options" | "By joining, you agree to our Terms of Service and Privacy Policy" inside card; social-proof strip below card | Card kept, 358 wide (16px margins) |
| Resend login / signup | Black page + full-bleed image, centered column | No | 14px mark in "‹ Home" top-left; 48px tile centered above heading | "Log in to Resend" / "Create a Resend account" h1 28/500 centered | 512x48, r16, 2px border white/5% + 1px ring white/20%, label "Email" above, 16px | "Log In" / "Create account" 512x48, r16, gradient, 14/600 (50% opacity until valid) | Google, GitHub side-by-side 248x48 **above** email; "or" divider with `hr` lines | "Don't have an account? Sign up." **under heading**; "By signing in, you agree to our Terms and Privacy Policy." under button | 358 column (16px margins); social buttons stack full-width |
| Cal.com | Light `lab(98.26)` + dotted world-map canvas + timezone strip | Yes 448x518 (max-w-md), white, 1px black/8%, r16, `0 10px 15px -3px` shadow | Text "Cal.com" h1 20/700 doubles as wordmark inside card | "Cal.com" + sub "Welcome back! Sign in to continue" 14/400 | 366x32, r10, 1px black/10%, `0 1px 2px` shadow, labels "Email"/"Password" above, no placeholder, 14px | "Continue" 366x36, near-black `lab(15.2)`, r10, 14/500, inset highlight | Google (filled near-black), Microsoft (grey) stacked 366x36 **above** email; "or" divider with lines | Card footer strip "Create account · Sign in with SAML/OIDC"; **no legal text** | Card kept, 358 wide; inputs 36, buttons 40, 16px text; PWA banner |
| Raycast (`/users/sign_in`) | Dark `rgb(7,8,10)` marketing site chrome (nav bar) + centered column | No | Nav wordmark top-left; 48px icon centered above heading | "Log in to Raycast" h1 24/600 white centered | 282x42, r8, bg white/5%, 1px white/5%, placeholder only, 14px; email + "Password (optional)" | `<input type=submit>` "Send Magic Link" 282x42, white/90%, black 14/500, r8 | Icon-only row Apple/GitHub/Google 3x 86x44 **above** email; "or" text, no lines | "Don't have an account? Sign up →" as outlined 282x44 box; legal only in marketing footer far below | 342 column (24px margins); icon row stays 3-across; nav collapses |
| Clerk (`dashboard.clerk.com/sign-in`, Clerk's own `<SignIn/>`) | Grey `rgb(236,236,238)` + soft image, centered card | Yes 400 wide; outer r12 shadow `0 5px 15px` + `0 15px 35px -5px` + ring; inner white r8, padding 32x40 | Wordmark 24px tall centered inside card top | "Sign in to Clerk" h1 16/500 + sub "Welcome back! Please sign in to continue" 14/400 | 322x33, r6, 1px ring black/11%, label "Email address" above, 14px | "Continue ▸" 322x33, `rgb(108,71,255)`, r6, 14/500, ring + shadow | GitHub, Google side-by-side 157x33 **above** email; "or" divider | Card footer strip "Don't have an account? Sign up"; "Secured by Clerk"; page footer "© 2026 Clerk · Support · Privacy · Terms" | Card kept, 352 wide (15px margins); social stacks |

## Per-app measurements

### Attio — `https://app.attio.com/welcome/sign-in`

Screenshots: `attio-signin-1440.png`, `attio-signin-390.png`
(`attio-signup-*` are identical: `/welcome/sign-up` 302s to `/welcome/sign-in`).

- Page: `html`/`body` `rgb(255,255,255)`, Inter. Centered wordmark link 96x24 at y32.
- 1440: one bordered panel 1130x692 at x155/y112, `1px solid rgb(238,239,241)`,
  radius 20px, no shadow, transparent bg. Inside, form column 372px at x252 and
  a right-hand copy block "Welcome to Attio." (a `div`, 24px/600, lh 28,
  ls -0.48px; picked via largest-text fallback, no `h1` on the page). The form
  side has no heading at all.
- "Sign in with Google" 372x40, white, radius 10px, ring via shadow
  `rgba(28,40,64,.18) 0 0 2px + rgba(0,0,0,.04) 0 1px 3px`, label 14/500.
- Divider: 1px line at y357, no text.
- Input wrapper 372x34 (input 332x34 inside), radius 10px, 1px ring (captured
  focused: `rgb(38,109,240) 0 0 0 1px inset`), placeholder "Enter your work
  email address", 14px, no label.
- Primary "Continue" 372x32, `rgb(38,109,240)`, radius 9px, label 14/500
  white, shadow `rgba(0,0,0,.06) 0 0 0 1px inset, rgba(38,109,240,.12) 0 2px 4px -2px, ...`.
- No "Don't have an account" link (single flow). Consent text under form
  (~10px) linking "privacy policy"; page footer 12px/500 at 63% black:
  "© 2026 Attio Limited · Privacy Policy · Support".
- 390: panel border and right copy are gone; form column stays 372px wide at
  x9; wordmark still centered; footer still present.

### T3 Chat — `https://t3.chat/auth/login` → `https://signin.t3.chat/…`

Screenshots: `t3chat-authlogin-1440.png`, `t3chat-authlogin-390.png`.
(`/auth` and `/login` return the app's 404 page; root `/` is the chat app with a
"Login" link in the sidebar. Sign-in is a hosted WorkOS AuthKit page.)

- Page bg `rgb(243,230,245)`, font "Untitled Sans", `color-scheme: light`.
- Logo `img` 48x48 centered at y120; h1 "Sign in to T3 Chat" 24/600, lh 30,
  centered, above the card.
- Card (Radix `rt-Card`) 440x471 at y238, radius 16px, `box-shadow: oklab(… /0.35) 0 0 0 1px inset`
  (ring, no border), padding 48px.
- Label "Email" (bold, above). Input wrapper 344x40, radius 6px, 1px inset ring,
  bg `rgba(255,255,255,.85)`, 16px, placeholder "Your email address".
- Primary "Continue with email" 344x40, `rgb(167,66,112)`, radius 6px, 16/500.
- "OR" text divider at y437, then Google / Microsoft / Apple stacked 344x40,
  bg white 80%, same ring, radius 6px, 16/500 (14/500 at 390).
- "Don't have an account? Sign up" (pink link) inside the card bottom.
- Page footer "Terms of Service and Privacy Policy" at y865.
- 390: card kept, 358x439 at x16, radius 12px, padding 32px.

### Linear — `https://linear.app/login`

Screenshots: `linear-login-1440.png`, `linear-login-390.png`; after clicking
"Continue with email": `linear-login-email-1440.png`, `linear-login-email-390.png`.

- `body` transparent; effective bg is a wrapper `div` `rgb(248,248,249)`. Inter Variable.
- Logo `svg` 48x48 centered at y258; h1 "Log in to Linear" 18/500 centered.
- No card. Column 288px.
- Four pill buttons (radius 9999px) 288x44, label 13/500, 1px transparent
  border: "Continue with Google" filled `rgb(109,120,213)` white text with
  `0 3px 6px -2px` shadow; "Continue with email", "Continue with SAML SSO",
  "Log in with passkey" white `rgb(254,254,255)`.
- No divider. "Don't have an account? Sign up or learn more" 60px below.
  No legal text anywhere on the page.
- Email step: h1 "What's your email address?" 18/500; input 288x44,
  `1px solid rgb(210,210,210)`, radius 10px, bg `rgb(248,248,249)`, 13px,
  padding 12px, placeholder "Enter your email address…"; submit "Continue with
  email" pill 288x44 bg `rgb(243,243,243)` (inactive until valid); "Back to login".
- 390: identical 288px column centered; nothing collapses.

### Vercel — `https://vercel.com/login` and `https://vercel.com/signup`

Screenshots: `vercel-login-1440.png`, `vercel-login-390.png`,
`vercel-signup-1440.png`, `vercel-signup-390.png`.

Login:
- Page bg `rgb(250,250,250)`, GeistSans. Logo mark 20x20 top-left (x24,y23),
  "Sign Up" outlined button top-right.
- h1 "Log in to Vercel" 32/600, lh 40, ls -0.96px.
- No card. Column `w-80` = 320px, `max-width: 100%`.
- Input 320x40, 16px, padding 0 12px, bg white; visible border is on the wrapper
  `div`: radius 8px, `box-shadow … rgba(0,0,0,.08) 0 0 0 1px`. Placeholder
  "Email Address", no visible label.
- Primary "Continue with Email" 320x40, `rgb(23,23,23)`, radius 8px, 16/500
  white, no shadow.
- 1px line divider at y330 (no text). Then Google, GitHub, ChatGPT, SAML SSO,
  Passkey stacked 320x40 white, ring `rgb(235,235,235) 0 0 0 1px`, radius 8px,
  16/500. "Show other options" text button. "Don't have an account? Sign Up"
  (blue link). Page footer "Terms · Privacy Policy" tiny grey at y860.
- 390: same 320px column; logo stays top-left.

Signup:
- Card `main` 550x600 (`max-width: 550px`), white, radius 12px,
  shadow `rgba(0,0,0,.08) 0 0 0 1px, rgba(0,0,0,.04) 0 2px 2px`.
- h1 marketing copy "Your first deploy is just a sign-up away." 32/600
  centered, ls -1.28px (24/600 at 390).
- OAuth first: Google, GitHub, ChatGPT, Apple 390x40 (same style as login);
  "Show other options"; "Continue with Email →" is a link, no input rendered.
- Legal inside card: "By joining, you agree to our Terms of Service and
  Privacy Policy". Wordmark 110x22 top-left, "Log In" button top-right.
  Blurred social-proof strip below the card.
- 390: card kept, 358x544 at x16, radius 12px.

### Resend — `https://resend.com/login` and `https://resend.com/signup`

Screenshots: `resend-login-1440.png`, `resend-login-390.png`,
`resend-signup-1440.png`, `resend-signup-390.png`. (networkidle timed out on
all four loads; captured after `load` + 1.5s. Page renders fine.)

- `body` `rgb(0,0,0)`, `color-scheme: dark`, Inter; full-viewport decorative
  `img` (1440x900) behind everything. "‹ Home" top-left with a 14px mark.
- Logo `svg` 48x48 centered at y157 above the heading (the generic extractor
  picked the 14px top-left mark first; re-measured with a targeted probe).
- h1 "Log in to Resend" / "Create a Resend account" 28/500, lh 34, ls -0.72px,
  centered. Sub line directly under: "Don't have an account? Sign up." /
  "Already have an account? Log in." 14/400 `rgb(161,164,165)`.
- No card. Column `main` 512px (`max-width: 512px`).
- Google, GitHub side-by-side 248x48 each, transparent bg, `2px solid` white
  5%, radius 16px, shadow `0 1px 3px, 0 1px 2px -1px`, label 14/600.
- "or" divider with two `hr` elements at y391.
- Label "Email" above; input 512x48, radius 16px, `2px solid` white 5% +
  ring white 20%, 16px, padding 0 16px, placeholder "alan.turing@example.com".
  Signup adds "Password" with live requirement hints.
- Primary "Log In" / "Create account" 512x48, radius 16px,
  `linear-gradient(104deg, rgba(253,253,253,.05), rgba(240,240,228,.1))`,
  2px border, label 14/600 at 50% opacity (disabled until valid).
- Legal directly under the button: "By signing in, you agree to our Terms and
  Privacy Policy." (signup: "…Terms, Acceptable Use, and Privacy Policy.").
- 390: no card, 358 column at x16; social buttons stack full-width 358x48.

### Cal.com — `https://app.cal.com/auth/login`

Screenshots: `calcom-login-1440.png`, `calcom-login-390.png`.

- `body` `lab(98.26 0 0)` (~#f9f9f9); full-viewport dotted world-map `canvas`
  plus a timezone strip along the bottom.
- Card 448px (`max-w-md`), white, `1px solid` black 8%, radius 16px, shadow
  `lab(0 0 0/.05) 0 10px 15px -3px, 0 4px 6px -4px`; inner content card radius
  `16 16 14 14`.
- h1 "Cal.com" 20/700 (text wordmark, no image logo); sub "Welcome back! Sign
  in to continue" 14/400 grey.
- Google 366x36 filled near-black `lab(15.2)` white 14/500, inset highlight
  shadow; Microsoft 366x36 bg black 4%, radius 10px. Stacked above email.
- "or" divider with two 160px lines at y394.
- Labels "Email", "Password" (with "Forgot?" right-aligned). Input wrapper
  `span` 366x32, `1px solid` black 10%, radius 10px, `0 1px 2px` black 5%,
  white bg; input 14px, padding 0 11px, no placeholder.
- Primary "Continue" 366x36, near-black, `1px solid` same, radius 10px, 14/500.
- Card footer strip (grey bg): "Create account · Sign in with SAML/OIDC" 14/500.
  No legal text on the page.
- 390: card kept, 358x540 at x16; inputs 36px, buttons 40px, 16px text;
  "Add this app to your home screen" banner overlays the bottom.

### Raycast — `https://www.raycast.com/users/sign_in`

Screenshots: `raycast-signin-1440.png`, `raycast-signin-390.png`.
(`/login` is a 404; the nav's "Log in" links to `/users/sign_in`.)

- `body` `rgb(7,8,10)`, `color-scheme: dark`, Inter. Marketing nav bar stays
  (wordmark, Store/Pro/AI/…, "Log in", "Download"), and the full marketing
  footer follows the form (page is ~2000px tall).
- Logo `svg` 48x48 centered at y271 above heading; h1 "Log in to Raycast"
  24/600 white.
- No card. Column 282px.
- OAuth icon-only row: three `button`s 86x44 (Apple, GitHub, Google), bg
  white 5%, `1px solid` white 5%, radius 8px, padding 12 16. "or" text below,
  no lines.
- Inputs 282x42 "Email address" and "Password (optional)", bg white 5%,
  `1px solid` white 5%, radius 8px, 14px, padding 8 12, no labels.
- Primary is an `<input type=submit value="Send Magic Link">` 282x42, bg white
  90%, black 14/500, radius 8px.
- "Don't have an account? Sign up →" rendered as an outlined 282x44 box,
  `1px solid` white 10%, radius 8px, text white 60%.
- Legal links (Terms, Privacy, Acceptable Use, DPA) exist only in the marketing
  footer at y≈1370+.
- 390: 342 column (24px margins); icon row stays 3-across (Apple/GitHub/Google
  at 106px each); nav collapses to a hamburger.

### Clerk — `https://dashboard.clerk.com/sign-in`

Screenshots: `clerk-dashboard-signin-1440.png`, `clerk-dashboard-signin-390.png`.
(`accounts.clerk.com/sign-in` is a 404 with an illustration; `clerk.com/sign-in`
redirects to the dashboard. networkidle timed out; captured after `load`.)

- `html` `rgb(236,236,238)` with a large soft-gradient `img`; font "suisse".
- Card: outer `cl-cardBox` 400px, radius 12px, shadow
  `0 5px 15px /.08, 0 15px 35px -5px /.2, 0 0 0 1px /.07`; inner `cl-card`
  402x409 white, radius 8px, padding 32px 40px.
- Wordmark "clerk" 24px tall centered inside the card; h1 "Sign in to Clerk"
  16/500; sub "Welcome back! Please sign in to continue" 14/400 `rgb(95,95,111)`.
- GitHub, Google side-by-side 157x33, ring black 7% + `0 2px 3px -1px`,
  radius 6px, label 14/500 at 62% black.
- "or" divider at y359. Label "Email address"; input 322x33, radius 6px, ring
  black 11% + `0 0 1px` black 7%, 14px, padding 7 12, placeholder "Enter your
  email address".
- Primary "Continue ▸" 322x33, `rgb(108,71,255)`, radius 6px, 14/500 white,
  ring same colour + inset highlight + `0 2px 3px` shadow.
- Card footer strip (3% black on white): "Don't have an account? Sign up"
  (purple link), then "Secured by clerk". Page footer "© 2026 Clerk · Support ·
  Privacy · Terms" at y856. A cookie banner overlays the lower third.
- 390: card kept, 352 wide at x15; social buttons stack 272x33.

## Common patterns (majority behaviour, with citations)

Counting the eight apps' login pages (Attio, T3 Chat, Linear, Vercel, Resend,
Cal.com, Raycast, Clerk). Vercel signup is cited separately where it differs.

1. **Page layout: a single centered column. No split layouts.** 8/8 center the
   form horizontally (`formCentered=true` for every page at both viewports;
   Attio's form is centered only at 390 and sits in the left half of its panel
   at 1440). None puts an illustration beside the form. Decoration, when
   present, is a full-bleed background behind the column: Resend (image,
   `resend-login-1440.png`), Cal.com (dotted map canvas, `calcom-login-1440.png`),
   Clerk (soft gradient, `clerk-dashboard-signin-1440.png`); Linear, Vercel,
   T3, Attio use a flat colour.

2. **Card vs no card: an even split, with the no-card group slightly larger for
   login pages.** Visible form card: T3 (440px, `t3chat-authlogin-1440.png`),
   Cal.com (448px, `calcom-login-1440.png`), Clerk (400px,
   `clerk-dashboard-signin-1440.png`), plus Vercel *signup* (550px,
   `vercel-signup-1440.png`). No card: Linear (`linear-login-1440.png`), Vercel
   login (`vercel-login-1440.png`), Resend (`resend-login-1440.png`), Raycast
   (`raycast-signin-1440.png`); Attio's 1130px panel is a page frame, not a
   form card (`attio-signin-1440.png`). Cards are white on a tinted page,
   radius 12–16px, and use a 1px ring plus a soft shadow (Cal.com, Clerk,
   Vercel signup) or ring only (T3).

3. **Widths: controls are 280–390px wide.** Column/control widths measured:
   Raycast 282, Linear 288, Vercel 320, Clerk 322 (in a 400 card), T3 344 (in
   440), Cal.com 366 (in 448), Attio 372, Vercel signup 390 (in 550). Resend is
   the outlier at 512. So: no-card columns ~290–370px; cards 400–450px outer
   with 32–48px padding.

4. **Logo: a ~48px icon centered directly above the heading.** Linear (48 svg),
   T3 (48 img), Resend (48 tile), Raycast (48 icon) do exactly this; Clerk
   centers a 24px-tall wordmark inside the card top; Attio centers a 96x24
   wordmark at the page top. Only Vercel puts a small mark top-left (with a
   "Sign Up"/"Log In" button top-right). Cal.com uses its name as the h1
   instead of an image. Screenshots: `linear-login-1440.png`,
   `t3chat-authlogin-1440.png`, `resend-login-1440.png`, `raycast-signin-1440.png`,
   `clerk-dashboard-signin-1440.png`, `vercel-login-1440.png`.

5. **Heading: "Log in to {Product}" / "Sign in to {Product}", centered, 18–32px,
   weight 500–600.** Exact copy in 6/8: Linear (18/500), Clerk (16/500), Raycast
   (24/600), T3 (24/600), Resend (28/500), Vercel (32/600). Median 24px. Cal.com
   uses "Cal.com" + a "Welcome back!" subline; Attio has no heading on the form
   side. Vercel signup swaps in marketing copy. A subheading appears only on
   Cal.com and Clerk ("Welcome back! …" 14/400 grey) and Resend (the
   account-switch line, 14/400 grey).

6. **Inputs: 40px tall (32–48 range), 1px ring or border, radius 6–10px, 14–16px
   text.** Heights: Cal.com 32, Clerk 33, Attio 34, Vercel 40, T3 40, Raycast
   42, Linear 44, Resend 48. Radius: 6 (T3, Clerk), 8 (Vercel, Raycast), 10
   (Attio, Linear, Cal.com), 16 (Resend). Border is a 1px ring/border at
   8–11% black (Vercel, Cal.com, Clerk, T3) or 1px solid grey (Linear
   `rgb(210,210,210)`). Labels above the field in 4/8 (T3, Resend, Cal.com,
   Clerk); placeholder-only in 4/8 (Attio, Linear, Vercel, Raycast). Cal.com and
   Raycast bump input text to 16px at 390.

7. **Primary button: same height and width as the input, solid fill, 14–16px /
   500.** Height equals the input height in 6/8 (T3 40/40, Linear 44/44, Vercel
   40/40, Resend 48/48, Raycast 42/42, Clerk 33/33; Attio 32 vs 34, Cal.com 36
   vs 32). Full column width in 8/8. Fill: near-black (Vercel `rgb(23,23,23)`,
   Cal.com `lab(15.2)`), brand colour (Attio blue, T3 magenta, Clerk purple,
   Linear indigo on the Google button), white-on-dark (Raycast), translucent
   gradient (Resend). Radius matches the input in every app. Label weight 500 in
   7/8 (Resend 600); size 14px in 5/8, 16px in 2/8 (Vercel, T3), 13px Linear.
   Shadows are subtle or none (Vercel none, Linear none, Raycast none).

8. **OAuth: always present, Google in 8/8, rendered as full-width stacked
   buttons with icon + "Continue with X", placed above the email field.**
   Providers: Google 8/8, GitHub 4 (Vercel, Resend, Raycast, Clerk), Apple 3
   (Raycast, T3, Vercel signup), Microsoft 2 (T3, Cal.com), SAML/SSO 3 (Linear,
   Vercel, Cal.com), passkey 2 (Linear, Vercel). Style: stacked full-width in
   5/8 (Linear, Vercel, T3, Cal.com, Attio); two-column side-by-side in 2/8
   (Resend, Clerk), both of which stack at 390; icon-only row in 1/8 (Raycast).
   Placement: OAuth above email in 6/8 (Linear, Resend, Cal.com, Clerk, Attio,
   Raycast); email first in 2/8 (Vercel login, T3). Divider between the two: a
   text "or" in 5/8 (Resend, Cal.com, Clerk, Raycast, T3 "OR"), a bare 1px line
   in 2/8 (Attio, Vercel), nothing in Linear. Screenshots: `linear-login-1440.png`,
   `vercel-login-1440.png`, `resend-login-1440.png`, `clerk-dashboard-signin-1440.png`,
   `raycast-signin-1440.png`.

9. **"Don't have an account? Sign up" sits directly below the form as a
   one-line sentence with a link.** 6/8 place it below: Linear, Vercel (blue
   link), T3 (inside card bottom), Clerk and Cal.com (a grey card-footer strip),
   Raycast (an outlined button-like box). Resend puts it directly under the
   heading instead (`resend-login-1440.png`). Attio has no such link (one
   unified flow). None uses a separate top-right "Sign up" button except
   Vercel, which does both (`vercel-login-1440.png`).

10. **Legal: small, grey, and either an inline consent sentence under the
    submit button or two tiny links at the page bottom; never inside the
    visual centre.** Inline "By signing in/joining, you agree to our Terms and
    Privacy Policy": Resend (`resend-login-1440.png`), Vercel signup
    (`vercel-signup-1440.png`), Attio (marketing consent, `attio-signin-1440.png`).
    Page-bottom links only: Vercel login ("Terms · Privacy Policy"), T3
    ("Terms of Service and Privacy Policy"), Clerk and Attio ("© year · Privacy ·
    Terms/Support"). No legal text at all: Linear, Cal.com. Raycast only in the
    marketing footer.

11. **Mobile (390): cards keep their border/shadow with ~16px side margins;
    no-card columns stay borderless and centered; nothing switches to a split
    or full-bleed form.** Cards at 390: T3 358px/x16 (`t3chat-authlogin-390.png`),
    Cal.com 358/x16 (`calcom-login-390.png`), Clerk 352/x15
    (`clerk-dashboard-signin-390.png`), Vercel signup 358/x16
    (`vercel-signup-390.png`). No-card pages keep a 288–372px column with 9–24px
    margins (Attio x9, Resend x16, Raycast x24, Linear/Vercel centered fixed
    width). Attio drops its desktop panel border and the right-hand copy block
    entirely (`attio-signin-390.png`). Side-by-side OAuth rows stack (Resend,
    Clerk); Raycast's icon row stays 3-across. Top-left logos stay top-left
    (Vercel); centered logos stay centered.

## Targets that failed or redirected

| Requested URL | Result |
|---|---|
| `https://app.attio.com/welcome/sign-up` | 302 → `/welcome/sign-in`; same page as sign-in (`attio-signup-*.png` identical) |
| `https://t3.chat/auth`, `https://t3.chat/login` | App-shell 404 "Page Not Found" (`t3chat-auth-*.png`, `t3chat-login-*.png`) |
| `https://t3.chat` | Renders the chat app, not a login (`t3chat-root-*.png`); its sidebar "Login" → `/auth/login` → hosted `signin.t3.chat`, which is what was measured |
| `https://www.raycast.com/login` | Marketing 404 (`raycast-login-*.png`); real page is `/users/sign_in` |
| `https://accounts.clerk.com/sign-in` | 404 with illustration (`clerk-signin-*.png`); measured `dashboard.clerk.com/sign-in` instead |
| Resend, Clerk | `networkidle` never settled within 20s (analytics/long-poll); captured after `load` + 1.5s, pages fully rendered |

Extraction caveats: Attio has no `h1`, so its heading came from a
largest-text fallback (and at 390 that fallback hit a button label; the
screenshot confirms there is no heading). Vercel signup and Linear's first
screen have no visible input (email is behind a button/link), so input
measurements come from Vercel login and Linear's second step respectively.
Raycast's OAuth buttons are icon-only, so provider identity is from the
screenshot, not text.

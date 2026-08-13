# Clerk Organization claims in Convex JWTs

Ticket: [#9](https://github.com/notionclimaeco-hub/selective-platform/issues/9). Standing constraint from [#1](https://github.com/notionclimaeco-hub/selective-platform/issues/1): Clerk Organizations = identity and membership; Convex = installer company, approval, tier. Do not store approval or tier in Clerk metadata.

## Answer

Convex sees Clerk org id and membership **only as claims on the JWT it validates**. With the Clerk Convex integration this repo already uses, that JWT is the **session token** (`aud: "convex"`), not a named JWT template. Session token v2 already carries the Active Organization as a nested `o` object (`id`, `rol`, `slg`, `per`) when an org is active. For a reliable `orgId` / role on `ctx.auth.getUserIdentity()` — matching how staff `role` already works — add **top-level string claims** on that same session token. Fetch the Clerk Backend API for invitations, the full membership list, and org/user profile objects; not for the Active Organization id/role on every installer-member Convex function.

## What Convex actually receives

`ctx.auth.getUserIdentity()` returns claims from the validated JWT. Guaranteed fields are `tokenIdentifier`, `subject`, `issuer`. Other fields depend on the token. Clerk custom claims are included. Standard OIDC claims are named fields (`subject`, `email`, …). Dropped entirely: `jti`, `nbf`, and Clerk `fva` (time-varying; would bust the query cache).

Sources: [Convex Auth in Functions — Clerk claims](https://docs.convex.dev/auth/functions-auth#clerk-claims-configuration), [UserIdentity](https://docs.convex.dev/api/interfaces/server.UserIdentity), [Convex Clerk — factor verification age](https://docs.convex.dev/auth/clerk#factor-verification-age).

`applicationID: "convex"` in `convex/auth.config.ts` is checked against the JWT `aud` claim. The issuer is Clerk’s Frontend API URL (`CLERK_JWT_ISSUER_DOMAIN` in Convex docs; `CLERK_FRONTEND_API_URL` in Clerk’s Convex guide — same URL).

Sources: [Convex Clerk `auth.config.ts`](https://docs.convex.dev/auth/clerk), [Clerk Convex integration](https://clerk.com/docs/guides/development/integrations/databases/convex), this repo `convex/auth.config.ts`.

`subject` is the Clerk user id (`user_…`).

## Session token, not a Convex JWT template

Two Clerk token mechanisms:

1. **Session token** — the cookie JWT Clerk issues for the signed-in session. Customize at Dashboard → Sessions → Claims. Lifetime 60 seconds; Clerk refreshes it in the background.
2. **JWT template** — a named template (Dashboard → JWT templates). Minted only when `getToken({ template: "name" })` is called. Custom JWTs omit session-bound claims (`sid`, `v`, `pla`, `fea`). Clerk recommends a customized **session token** when you need session-bound data plus extra claims.

Sources: [Session tokens](https://clerk.com/docs/guides/sessions/session-tokens), [Customize session tokens](https://clerk.com/docs/guides/sessions/customize-session-tokens), [JWT templates](https://clerk.com/docs/guides/sessions/jwt-templates), [How Clerk works — token refresh](https://clerk.com/docs/guides/how-clerk-works/overview).

The Clerk Convex integration maps **session-token** claims, with `aud` pre-set to `convex`. Extra claims go on that same Sessions Claims editor. Shortcodes are the JWT-template shortcodes.

Source: [Clerk Convex — Map additional claims](https://clerk.com/docs/guides/development/integrations/databases/convex).

`ConvexProviderWithClerk` (convex@1.42.3, also current `convex-js` main):

- If `sessionClaims.aud === "convex"` → `getToken()` with **no** template (session token).
- Else → `getToken({ template: "convex" })` (legacy named template).
- Rebuilds the token fetcher when `orgId`, `orgRole`, or `sessionId` change, so an Active Organization switch refetches a token for Convex.

This repo is on the session-token path: `admin-frontend` calls `getToken()` with no template; Convex TanStack Clerk guide does the same.

Sources: [convex-js `ConvexProviderWithClerk.tsx`](https://github.com/get-convex/convex-js/blob/main/src/react-clerk/ConvexProviderWithClerk.tsx), [Convex TanStack Start + Clerk](https://docs.convex.dev/client/tanstack/tanstack-start/clerk), `admin-frontend/src/routes/__root.tsx`.

Do not introduce a named `convex` JWT template unless the Convex integration is not active (`aud` is not `convex`). `getToken({ template })` hits Clerk’s Backend API and counts toward rate limits.

Source: [Auth object `getToken()`](https://clerk.com/docs/reference/backend/types/auth-object#get-token).

## How org id and role appear on the session token

Org claims are included **only if the user is a member of an Organization and that Organization is Active**. No Active Organization → no org claims.

**Session token v2** (current; v1 deprecated 14 Apr 2025): nested `o`:

| Field | Meaning | Example |
| --- | --- | --- |
| `o.id` | Organization id | `org_123` |
| `o.slg` | slug | `example-org` |
| `o.rol` | Role **without** `org:` prefix | `admin` |
| `o.per` | Custom permission names | `example-perm` |
| `o.fpm` | Feature-permission bitmask | `1` |

Clerk’s `Auth` object still exposes decoded `orgId`, `orgRole` (`org:admin`), `orgSlug`, `orgPermissions` to the **app server** (TanStack `auth()`, `useAuth()`). Convex never sees that object — only the JWT.

**Session token v1** (deprecated): top-level `org_id`, `org_role` (`org:admin`), `org_slug`, `org_permissions`.

Sources: [Session tokens — Organization claim](https://clerk.com/docs/guides/sessions/session-tokens#organization-claim), [Auth object example with Active Organization](https://clerk.com/docs/reference/backend/types/auth-object), [Organizations overview — Active Organization](https://clerk.com/docs/guides/organizations/overview).

Default roles: `org:admin` (creator) and `org:member` (default for invitations). In v2, `o.rol` is `admin` / `member` (no prefix). System Permissions are **not** in session claims; only Custom Permissions are.

Sources: [Roles and Permissions](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions), [Session tokens v1 org_permissions note](https://clerk.com/docs/guides/sessions/session-tokens).

The JWT holds **only the Active Organization**. A user can belong to many orgs; other memberships are not on the token. Each browser tab keeps its own Active Organization; the session cookie is a singleton. For Convex, `ConvexProviderWithClerk` already refetches on `orgId`/`orgRole` change. For any other backend call, Clerk says call `getToken()` rather than trusting the cookie across tabs.

Sources: [Organizations overview](https://clerk.com/docs/guides/organizations/overview), [Organizations configure](https://clerk.com/docs/guides/organizations/configure).

## How those claims land on `getUserIdentity()`

This repo uses Clerk as an **OIDC** provider (`applicationID: "convex"`), not Convex Custom JWT auth.

Convex OIDC path (`UserIdentity::from_token` in convex-backend): extra JWT claims go into `custom_claims` as **strings** via `serde_json::Value::to_string()`. Nested objects are **not** dotted-flattened on this path. Custom JWT auth (`from_custom_jwt`) **does** flatten nested objects to `identity["properties.email"]`-style keys.

Sources: [convex-backend `broker.rs` `from_token` / `extract_custom_jwt_claims`](https://github.com/get-convex/convex-backend/blob/main/crates/keybroker/src/broker.rs), [Convex Custom JWT nested fields](https://docs.convex.dev/auth/advanced/custom-jwt), [Auth in Functions — Custom JWT vs Clerk](https://docs.convex.dev/auth/functions-auth).

Consequence: v2’s nested `o` is one custom claim (`identity.o`), with a stringified JSON value — not `identity.org_id` and not `identity["o.id"]`. The staff gate already reads a **top-level string** custom claim:

```ts
// convex/lib/auth.ts — claim "role": "{{user.public_metadata.role}}"
const role = (identity as { role?: unknown }).role;
```

Same pattern for installer-member functions: put **top-level string** `org_id` and `org_role` on the session token so they appear as `identity.org_id` / `identity.org_role` without parsing nested JSON.

Clerk’s JWT-templates page documents `{{user.*}}` shortcodes; org metadata docs use `organization.public_metadata.*`; session-token size docs list `org.public_metadata` and `org_membership.public_metadata`. The Sessions Claims editor is the same shortcode system the Convex integration points at. Confirm the picker values in the Dashboard (the editor that already has `role`) rather than inventing shortcodes. Do not copy entire `user.organizations` or metadata objects onto the token (1.2KB custom-claim budget; oversized cookies break Clerk).

Sources: [JWT templates — shortcodes](https://clerk.com/docs/guides/sessions/jwt-templates#shortcodes), [Organization metadata in the session token](https://clerk.com/docs/guides/organizations/metadata), [Session tokens — size limitations](https://clerk.com/docs/guides/sessions/session-tokens#size-limitations).

Claims can be up to ~60s stale after membership/role changes. Force a token refresh, or read Clerk’s Backend API, when the change must be immediate.

Source: [Customize session tokens — freshness](https://clerk.com/docs/guides/sessions/customize-session-tokens).

## Put on the session token vs fetch from Clerk Backend API

### On the session token (Convex identity)

Already there with the Convex integration:

- `aud`: `"convex"`
- `sub`: Clerk user id → `identity.subject`
- `o` when an org is Active (v2 nested object)
- this repo’s `role`: `{{user.public_metadata.role}}` (staff)

Add (Sessions → Claims), as top-level strings, same as `role`:

- Active Organization id
- Active Organization role (membership role)

That is what installer-member Convex functions should read. Approval and tier stay in Convex, not Clerk metadata.

### Not on the token — Clerk Backend API / Frontend APIs

| Need | Why the token is the wrong place |
| --- | --- |
| Pending invitations | Invitation is not membership. No `o` until the invite is accepted **and** that org is Active. |
| All memberships | Token has only the Active Organization. |
| Create / revoke invitations | Write APIs. Invitations: 250/hour (single), 50/hour (bulk, max 10 per call). |
| Add an existing Clerk user without email invite | `createOrganizationMembership({ organizationId, userId, role })`. |
| Full User / Organization objects | `auth()` is not the Backend User. `clerkClient().users.getUser(userId)` (TanStack example). Rate-limited. |
| Approval, tier, NIF, morada | Standing decision: Convex, not Clerk metadata. |

Sources: [Invite users](https://clerk.com/docs/guides/organizations/add-members/invitations), [createOrganizationMembership](https://clerk.com/docs/reference/backend/organization/create-organization-membership), [TanStack Start — Read user data](https://clerk.com/docs/tanstack-react-start/guides/users/reading), [Session tokens — fetch large claims via Backend API](https://clerk.com/docs/guides/sessions/session-tokens#example).

Clerk’s own rule: prefer session-token claims for data you read on every request; use Backend API when the data is large, rarely needed, or must be fresher than the 60s token.

Source: [Customize session tokens — why customize](https://clerk.com/docs/guides/sessions/customize-session-tokens).

## Invitations vs membership vs Active Organization

1. Admin (default: only `org:admin`) sends an invitation (`role` e.g. `org:member`). Clerk emails a link. Email must be enabled.
2. Invitee visits the link → Account Portal sign-in (or a `redirect_url` you handle). Status `pending` until accepted.
3. `accept()` (or completing the ticket flow) creates an **OrganizationMembership**. Invitation `publicMetadata` copies onto the **membership** `publicMetadata` — unused here (no approval/tier in Clerk).
4. Org claims appear on the session token only after the membership exists **and** that org is the Active Organization.

Existing Clerk users can skip email: `createOrganizationMembership`. Pending invites are listed via `useOrganizationList({ userInvitations: true })` or Backend API — not via JWT.

Sources: [Invite users](https://clerk.com/docs/guides/organizations/add-members/invitations), [UserOrganizationInvitation](https://clerk.com/docs/js-frontend/reference/types/user-organization-invitation), [Custom flow — manage invitations](https://clerk.com/docs/guides/development/custom-flows/organizations/manage-user-org-invitations).

Without an Active Organization, `auth().orgId` is undefined and `o` is absent. Enable Organizations before any of this works (off by default). **Membership required** (Clerk default for newly enabled orgs since 22 Aug 2025) forces every user, including staff, into an org via session tasks. This app’s staff users today have no org. Keep **membership optional**, or put staff in an internal org, so `requireStaff` does not depend on org claims.

Sources: [Configure Organizations](https://clerk.com/docs/guides/organizations/configure), this repo `convex/lib/auth.ts`.

## This repo today (staff-only Clerk)

| Piece | What it does |
| --- | --- |
| `convex/auth.config.ts` | OIDC provider, `applicationID: "convex"`, issuer `CLERK_JWT_ISSUER_DOMAIN` |
| `convex/lib/auth.ts` | `requireStaff`: `getUserIdentity()` then custom claim `role === "staff"` |
| `admin-frontend` | `@clerk/tanstack-react-start`, `ClerkProvider` → `ConvexProviderWithClerk` + `useAuth` |
| SSR | `createServerFn` → `auth()` → `getToken()` (no template) → `serverHttpClient.setAuth(token)`; `sessionClaims.role` for the Sem acesso gate |
| `admin-frontend/src/start.ts` | `clerkMiddleware()` in TanStack `requestMiddleware` |
| `admin-frontend/src/router.tsx` | `ConvexProvider` in router `Wrap` (Convex TanStack example) |
| `client-frontend` | No Clerk |
| `.env.example` | One Clerk app for both frontends; `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN` |

Installer-member Convex functions should follow `requireStaff`: read identity claims, do not take `orgId` as a client argument.

Source: Convex AI guidelines in-repo (`convex/_generated/ai/guidelines.md`): never accept a user identifier as a function argument for authorization; derive identity via `getUserIdentity()`.

## TanStack Start vs Next.js examples

Convex Clerk docs use Next.js as the long example; TanStack Start is a separate page that this admin app already matches.

| | Next.js (Clerk + Convex docs) | TanStack Start (this repo + Convex guide) |
| --- | --- | --- |
| Clerk package | `@clerk/nextjs` | `@clerk/tanstack-react-start` |
| Publishable key | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `VITE_CLERK_PUBLISHABLE_KEY` |
| Server auth | `auth()` from `@clerk/nextjs/server`; `clerkMiddleware()` in `middleware.ts` | `auth()` from `@clerk/tanstack-react-start/server`; `clerkMiddleware()` in `createStart({ requestMiddleware })` |
| Convex client wrapper | `'use client'` `ConvexClientProvider` because `app/layout.tsx` is a Server Component | `ClerkProvider` + `ConvexProviderWithClerk` in the root route component; no extra client wrapper |
| SSR Convex queries | Not the Next.js quickstart’s focus | `beforeLoad` + `createServerFn` + `getToken()` + `convexQueryClient.serverHttpClient?.setAuth(token)` |
| `useAuth` for Convex | `@clerk/nextjs` | `@clerk/tanstack-react-start` — same `useAuth` shape (`getToken`, `orgId`, `orgRole`, `sessionClaims`) |

Sources: [Convex Clerk — Next.js](https://docs.convex.dev/auth/clerk#nextjs), [Convex TanStack Start + Clerk](https://docs.convex.dev/client/tanstack/tanstack-start/clerk), [Clerk TanStack `auth()`](https://clerk.com/docs/reference/tanstack-react-start/auth), [Clerk TanStack — Read user data](https://clerk.com/docs/tanstack-react-start/guides/users/reading).

Gotchas:

1. Clerk TanStack docs: `auth()` needs `clerkMiddleware()`. The Convex TanStack Clerk page does not mention it. This repo already registers it in `admin-frontend/src/start.ts`. Copy that, not only the Convex snippet.
2. Prefer `useConvexAuth()` / `<Authenticated>` over Clerk `useAuth()` when deciding whether Convex queries may run. Same in both frameworks.
3. After activating the Convex integration, sign out and back in; old sessions can keep a token Convex rejects.
4. Client `getToken({ organizationId })` scopes a token to an org **without** changing the session’s Active Organization. ConvexProviderWithClerk does not pass `organizationId`; it uses the Active Organization. Keep installer-member Convex traffic on the Active Organization (OrganizationSwitcher / `setActive`) so `orgId` on `useAuth` and the session token stay aligned.
5. Next.js `clerkMiddleware` route protection is unrelated to Convex. TanStack Start uses `beforeLoad` redirects (this admin app) instead.

Sources: [Clerk TanStack verifying / `auth()`](https://clerk.com/docs/tanstack-react-start/guides/users/reading), [Session `getToken` options](https://clerk.com/docs/tanstack-react-start/reference/objects/session#get-token), [Convex Clerk — debugging](https://docs.convex.dev/auth/clerk#debugging-authentication).

## Installer-member Convex functions (what to implement later)

Not this ticket. When implementing:

1. Enable Organizations with **membership optional** (unless staff are also placed in an org).
2. Confirm Convex integration `aud: convex` on the session token.
3. Add top-level session claims for org id and org role next to existing `role`.
4. Gate installer-member functions like `requireStaff`: `getUserIdentity()`, require `org_id` (and role if needed), look up the installer company in Convex by that Clerk org id, then check Convex approval/tier.
5. Wire client-frontend (or a reserved-door surface) with the same TanStack Clerk + `ConvexProviderWithClerk` pattern; `client-frontend` has no Clerk today.
6. Treat missing `org_id` as unauthenticated-for-installer (no Active Organization), not as “member of nothing.”
7. Use Backend API for invite/accept/list-memberships; webhooks later if Convex must react to membership changes without waiting for the next token.

## Sources

Clerk (primary):

- https://clerk.com/docs/guides/sessions/session-tokens
- https://clerk.com/docs/guides/sessions/customize-session-tokens
- https://clerk.com/docs/guides/sessions/jwt-templates
- https://clerk.com/docs/guides/development/integrations/databases/convex
- https://clerk.com/docs/guides/organizations/overview
- https://clerk.com/docs/guides/organizations/configure
- https://clerk.com/docs/guides/organizations/add-members/invitations
- https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions
- https://clerk.com/docs/guides/organizations/metadata
- https://clerk.com/docs/reference/backend/types/auth-object
- https://clerk.com/docs/reference/backend/organization/create-organization-membership
- https://clerk.com/docs/tanstack-react-start/guides/users/reading
- https://clerk.com/docs/tanstack-react-start/reference/objects/session
- https://clerk.com/docs/guides/how-clerk-works/overview

Convex (primary):

- https://docs.convex.dev/auth/clerk
- https://docs.convex.dev/auth/functions-auth
- https://docs.convex.dev/api/interfaces/server.UserIdentity
- https://docs.convex.dev/client/tanstack/tanstack-start/clerk
- https://docs.convex.dev/auth/advanced/custom-jwt
- https://github.com/get-convex/convex-js/blob/main/src/react-clerk/ConvexProviderWithClerk.tsx
- https://github.com/get-convex/convex-backend/blob/main/crates/keybroker/src/broker.rs

This repo:

- `convex/auth.config.ts`, `convex/lib/auth.ts`
- `admin-frontend/src/routes/__root.tsx`, `admin-frontend/src/start.ts`, `admin-frontend/src/router.tsx`
- `.env.example`

import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  redirect,
} from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"
import type { ConvexQueryClient } from "@convex-dev/react-query"
import type { ConvexReactClient } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import {
  ClerkProvider,
  Show,
  SignOutButton,
  UserButton,
  useAuth,
  useUser,
} from "@clerk/tanstack-react-start"
import { auth } from "@clerk/tanstack-react-start/server"
import { createServerFn } from "@tanstack/react-start"
import { Lock } from "lucide-react"
import type { ReactNode } from "react"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import appCss from "../styles.css?url"

// Runs on the server: read the Clerk identity + a Convex-compatible token.
const fetchClerkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const { userId, getToken, sessionClaims } = await auth()
  const token = await getToken()
  const role =
    (sessionClaims as { role?: string } | null | undefined)?.role ?? null
  return { userId, token, role }
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexClient: ConvexReactClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Selective — Admin" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  beforeLoad: async ({ context, location }) => {
    const { userId, token, role } = await fetchClerkAuth()

    // During SSR only, make authenticated HTTP queries with the Clerk token.
    if (token) {
      context.convexQueryClient.serverHttpClient?.setAuth(token)
    }

    // Auth gate (server-side): unauthenticated users are redirected to sign-in.
    // The sign-in route itself is exempt to avoid a redirect loop. Non-staff
    // users are NOT redirected here — they render the "Sem acesso" page below.
    const isSignInRoute = location.pathname.startsWith("/sign-in")
    if (!userId && !isSignInRoute) {
      throw redirect({ to: "/sign-in" })
    }

    return { userId, token, role, isStaff: role === "staff" }
  },
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  component: RootComponent,
})

function RootComponent() {
  const { convexClient, userId, isStaff } = Route.useRouteContext()
  const showSemAcesso = Boolean(userId) && !isStaff

  return (
    <ClerkProvider signInUrl="/sign-in">
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        <RootDocument>
          {showSemAcesso ? (
            <SemAcesso />
          ) : (
            <>
              <Show when="signed-in">
                <AppHeader />
              </Show>
              <Outlet />
            </>
          )}
        </RootDocument>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}

const NAV = [
  { to: "/", label: "Painel", exact: true },
  { to: "/empresas", label: "Empresas", exact: false },
  { to: "/comercial", label: "Comercial", exact: false },
  { to: "/produtos", label: "Produtos", exact: false },
  { to: "/paginas-catalogo", label: "Páginas do catálogo", exact: false },
] as const

function AppHeader() {
  const { user } = useUser()
  const displayName =
    user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? ""

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <img
              src="/logo-climaeco.png"
              alt="Clima Eco Selective"
              className="h-9 w-auto"
            />
            <span className="hidden rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-foreground sm:inline">
              Admin
            </span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-secondary-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {displayName}
          </span>
          <UserButton />
        </div>
      </div>
    </header>
  )
}

function SemAcesso() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-gradient-to-b from-secondary/60 to-background p-6 text-center">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border bg-card p-8 shadow-sm">
        <img
          src="/logo-climaeco.png"
          alt="Clima Eco Selective"
          className="h-10 w-auto"
        />
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-1.5 self-center rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
            <Lock className="size-3.5" />
            Acesso restrito
          </span>
          <h1 className="text-lg font-semibold">Sem acesso</h1>
          <p className="text-sm text-muted-foreground">
            A tua conta não tem permissões de staff para aceder à
            administração.
          </p>
        </div>
        <SignOutButton>
          <button className="w-full rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted">
            Terminar sessão
          </button>
        </SignOutButton>
      </div>
    </main>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

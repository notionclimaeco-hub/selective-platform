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
  useAuth,
} from "@clerk/tanstack-react-start"
import { auth } from "@clerk/tanstack-react-start/server"
import { createServerFn } from "@tanstack/react-start"
import { Lock } from "lucide-react"
import type { ReactNode } from "react"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import {
  CartaoAuth,
  PaginaAuth,
  TituloAuth,
} from "@/components/auth/cartao-auth"
import { Wordmark } from "@/components/brand/wordmark"
import { AppShell } from "@/components/shell/app-shell"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { clerkAppearance, clerkLocalization } from "@/lib/clerk-ui"
import { authGatePath } from "@/lib/auth-gate"
import { fetchConvexClerkToken } from "@/lib/convex-clerk-token"
import appCss from "../styles.css?url"

// Runs on the server: read the Clerk identity + a Convex-compatible token.
const fetchClerkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const { userId, getToken, sessionClaims } = await auth()
  const claims = sessionClaims as
    { role?: string; aud?: unknown } | null | undefined
  const token = await fetchConvexClerkToken(getToken, claims)
  const role = claims?.role ?? null
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

    // Auth gate (server-side). Anonymous visitors go to /sign-in; signed-in
    // visitors are sent away from it so <SignIn> never mounts in a session
    // (Clerk would otherwise redirect and can loop). Non-staff users are NOT
    // redirected here — they render the "Sem acesso" page below.
    const destino = authGatePath(userId, location.pathname)
    if (destino) {
      throw redirect({ to: destino })
    }

    return { userId, token, role, isStaff: role === "staff" }
  },
  notFoundComponent: () => (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:px-6 lg:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Página não encontrada
      </h1>
      <Link to="/" className="text-sm font-medium text-primary hover:underline">
        Voltar ao painel
      </Link>
    </div>
  ),
  component: RootComponent,
})

function RootComponent() {
  const { convexClient, userId, isStaff } = Route.useRouteContext()
  const showSemAcesso = Boolean(userId) && !isStaff

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signInFallbackRedirectUrl="/"
      appearance={clerkAppearance}
      localization={clerkLocalization}
    >
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        <RootDocument>
          {showSemAcesso ? (
            <SemAcesso />
          ) : (
            <>
              <Show when="signed-in">
                <AppShell>
                  <Outlet />
                </AppShell>
              </Show>
              <Show when="signed-out">
                <Outlet />
              </Show>
            </>
          )}
        </RootDocument>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}

function SemAcesso() {
  return (
    <div className="fundo-auth flex min-h-svh flex-col">
      <div className="flex justify-center pt-10 sm:pt-16">
        <Wordmark className="h-8" />
      </div>
      <main className="flex flex-1 flex-col">
        <PaginaAuth>
          <CartaoAuth className="items-center text-center">
            <span className="mb-4 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Lock className="size-5" />
            </span>
            <TituloAuth titulo="Sem acesso">
              Esta conta não tem permissões de staff.
            </TituloAuth>
            <SignOutButton>
              <Button variant="outline" className="h-10 w-full">
                Terminar sessão
              </Button>
            </SignOutButton>
          </CartaoAuth>
        </PaginaAuth>
      </main>
    </div>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {/* Clears the review page's fixed decision bar. */}
        <Toaster offset={{ bottom: 80 }} mobileOffset={{ bottom: 80 }} />
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}

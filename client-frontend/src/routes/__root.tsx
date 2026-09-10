import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  redirect,
} from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"
import type { ConvexQueryClient } from "@convex-dev/react-query"
import type { ConvexReactClient } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ClerkProvider, useAuth } from "@clerk/tanstack-react-start"
import { auth } from "@clerk/tanstack-react-start/server"
import { createServerFn } from "@tanstack/react-start"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import type { ReactNode } from "react"

import { OrcamentoDrawer } from "@/components/orcamento/orcamento-drawer"
import { OrcamentoProvider } from "@/components/orcamento/orcamento-store"
import { clientAuthRedirect } from "@/lib/auth-gate"
import { fetchConvexClerkToken } from "@/lib/convex-clerk-token"

import appCss from "../styles.css?url"

const fetchClerkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const { userId, getToken, sessionClaims } = await auth()
  const claims = sessionClaims as
    | { org_id?: string; role?: string; aud?: unknown }
    | null
    | undefined
  const token = await fetchConvexClerkToken(getToken, claims)
  return {
    userId,
    token,
    orgId: claims?.org_id ?? null,
  }
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
      { title: "Clima Eco Selective — Distribuição de climatização" },
      {
        name: "description",
        content:
          "Distribuidor de equipamentos de climatização com mais de 20 anos de experiência. Ar condicionado, bombas de calor, ventiloconvetores e VMC das principais marcas.",
      },
      {
        property: "og:title",
        content: "Clima Eco Selective — Distribuição de climatização",
      },
      { property: "og:image", content: "/logo-climaeco.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  beforeLoad: async ({ context, location }) => {
    const { userId, token, orgId } = await fetchClerkAuth()
    if (token) {
      context.convexQueryClient.serverHttpClient?.setAuth(token)
    }

    const destino = clientAuthRedirect(userId, orgId, location.pathname)
    if (destino) {
      throw redirect(destino)
    }

    return { userId, token, orgId }
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
  const { convexClient } = Route.useRouteContext()

  return (
    <ClerkProvider
      signInUrl="/entrar"
      signUpUrl="/registo"
      signInFallbackRedirectUrl="/conta"
    >
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        <RootDocument>
          <OrcamentoProvider>
            <Outlet />
            <OrcamentoDrawer />
          </OrcamentoProvider>
        </RootDocument>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="pt">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
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

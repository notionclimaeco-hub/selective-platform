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
import { ptPT } from "@clerk/localizations"
import { createServerFn } from "@tanstack/react-start"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import type { ReactNode } from "react"

import { OrcamentoDrawer } from "@/components/orcamento/orcamento-drawer"
import { ShellByAuth } from "@/components/shell/shell-by-auth"
import { OrcamentoProvider } from "@/components/orcamento/orcamento-store"
import { clientAuthRedirect } from "@/lib/auth-gate"
import { fetchConvexClerkToken } from "@/lib/convex-clerk-token"

import appCss from "../styles.css?url"

const fetchClerkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const { userId, getToken, sessionClaims } = await auth()
  const claims = sessionClaims as
    { org_id?: string; role?: string; aud?: unknown } | null | undefined
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
      { name: "theme-color", content: "#ffffff" },
      { title: "Climaeco Pro — Climatização para empresas instaladoras" },
      {
        name: "description",
        content:
          "Distribuidor de equipamentos de climatização para empresas instaladoras. Ar condicionado, bombas de calor, ventiloconvetores e VMC das principais marcas, com preços de revenda.",
      },
      {
        property: "og:title",
        content: "Climaeco Pro — Climatização para empresas instaladoras",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "alternate icon", href: "/favicon.ico" },
      { rel: "manifest", href: "/manifest.json" },
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
    <ShellByAuth>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-16 sm:px-6">
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço não existe ou foi movido.
        </p>
      </div>
    </ShellByAuth>
  ),
  component: RootComponent,
})

function RootComponent() {
  const { convexClient } = Route.useRouteContext()

  return (
    <ClerkProvider
      signInUrl="/entrar"
      signUpUrl="/registo"
      signInFallbackRedirectUrl="/inicio"
      localization={ptPT}
      appearance={{
        variables: {
          colorPrimary: "#2f6b3f",
          colorForeground: "#1f2023",
          colorMutedForeground: "#6b6e76",
          colorNeutral: "#1f2023",
          borderRadius: "0.625rem",
          fontFamily: '"Inter Variable", sans-serif',
          fontSize: "0.875rem",
        },
        elements: {
          cardBox: "shadow-none border border-border",
          formButtonPrimary: "shadow-none",
        },
      }}
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

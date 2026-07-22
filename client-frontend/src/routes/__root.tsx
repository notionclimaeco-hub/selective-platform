import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import { OrcamentoDrawer } from "@/components/orcamento/orcamento-drawer"
import { OrcamentoProvider } from "@/components/orcamento/orcamento-store"

import appCss from "../styles.css?url"

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Clima Eco Selective — Distribuição de climatização",
      },
      {
        name: "description",
        content:
          "Distribuidor de equipamentos de climatização com mais de 20 anos de experiência. Ar condicionado, bombas de calor, ventiloconvetores e VMC das principais marcas.",
      },
      {
        property: "og:title",
        content: "Clima Eco Selective — Distribuição de climatização",
      },
      {
        property: "og:image",
        content: "/logo-climaeco.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <head>
        <HeadContent />
      </head>
      <body>
        <OrcamentoProvider>
          {children}
          <OrcamentoDrawer />
        </OrcamentoProvider>
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
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

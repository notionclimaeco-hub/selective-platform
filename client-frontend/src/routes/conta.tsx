import { createFileRoute, redirect } from "@tanstack/react-router"

// The old client area moved to /empresa; keep bookmarks and Clerk redirects
// working. `pedido=enviado` (post-registration) rides along.
export const Route = createFileRoute("/conta")({
  validateSearch: (
    search: Record<string, unknown>
  ): { pedido?: "enviado" } => ({
    pedido: search.pedido === "enviado" ? "enviado" : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/empresa",
      search: { pedido: search.pedido },
      replace: true,
    })
  },
})

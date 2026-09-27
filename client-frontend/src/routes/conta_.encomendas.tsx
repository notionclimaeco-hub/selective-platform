import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/conta_/encomendas")({
  beforeLoad: () => {
    throw redirect({ to: "/encomendas", replace: true })
  },
})

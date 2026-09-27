import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/conta_/encomendas_/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/encomendas/$id",
      params: { id: params.id },
      replace: true,
    })
  },
})

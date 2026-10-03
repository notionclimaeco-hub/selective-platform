// PROTOTYPE (#86) — throwaway. The order page on fixture data (no backend).
// Every action mutates the in-memory fixtures; reload to reset.

import { createFileRoute } from "@tanstack/react-router"

import { FichaEncomenda } from "@/components/prototype-encomendas/ficha"
import { useEncomenda } from "@/components/prototype-encomendas/fixtures"

export const Route = createFileRoute("/prototype/encomendas_/$numero")({
  // Fixture timestamps come from Date.now() at module load; render on the
  // client only so server and client never disagree.
  ssr: false,
  component: Pagina,
})

function Pagina() {
  const { numero } = Route.useParams()
  const e = useEncomenda(Number(numero))
  if (!e) {
    return (
      <main className="p-10 text-sm text-muted-foreground">
        Encomenda não encontrada.
      </main>
    )
  }
  return <FichaEncomenda e={e} />
}

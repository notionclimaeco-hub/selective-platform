import { createFileRoute } from "@tanstack/react-router"

import { useOrcamento } from "@/components/orcamento/orcamento-store"
import { CabecalhoPagina, Pagina } from "@/components/shell/pagina"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_shell/orcamento")({
  component: OrcamentoPage,
})

// Placeholder until the Orçamento page lands: the existing drawer keeps the
// list reachable from here in the meantime.
function OrcamentoPage() {
  const { abrir, totalLinhas, hidratado } = useOrcamento()
  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Orçamento"
        descricao="Página em construção."
        acoes={
          <Button variant="outline" onClick={abrir}>
            Abrir lista de orçamento
            {hidratado && totalLinhas > 0 ? ` (${totalLinhas})` : ""}
          </Button>
        }
      />
    </Pagina>
  )
}

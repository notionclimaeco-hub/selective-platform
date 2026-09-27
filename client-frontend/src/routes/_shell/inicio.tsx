import { createFileRoute } from "@tanstack/react-router"

import { CabecalhoPagina, Pagina } from "@/components/shell/pagina"

export const Route = createFileRoute("/_shell/inicio")({
  component: InicioPage,
})

function InicioPage() {
  return (
    <Pagina>
      <CabecalhoPagina titulo="Início" descricao="Página em construção." />
    </Pagina>
  )
}

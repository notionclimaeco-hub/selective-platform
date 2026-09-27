import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Authenticated, usePaginatedQuery } from "convex/react"
import { PackageOpen } from "lucide-react"

import { api } from "@convex/_generated/api"
import { Aviso, CabecalhoPagina, Pagina } from "@/components/shell/pagina"
import { ListaEncomendas } from "@/components/encomendas/lista-encomendas"
import { Button } from "@/components/ui/button"
import { useEmpresaActiva } from "@/lib/empresa-activa"

export const Route = createFileRoute("/_shell/encomendas")({
  component: EncomendasPage,
})

function EncomendasPage() {
  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Encomendas"
        descricao="Acompanhe cada encomenda desde a receção até ao levantamento no armazém."
        acoes={
          <Button
            render={<Link to="/produtos" />}
            nativeButton={false}
            variant="outline"
          >
            Ver catálogo
          </Button>
        }
      />
      <Authenticated>
        <Lista />
      </Authenticated>
    </Pagina>
  )
}

function Lista() {
  const { vista, orgActiva, activacaoFalhou } = useEmpresaActiva()
  const [agora] = useState(() => Date.now())
  const aprovada =
    vista?.kind === "empresa" && vista.empresa.estadoAprovacao === "aprovada"
  // `minhas` needs the org in the JWT; wait for the active org to match.
  const { results, status, loadMore } = usePaginatedQuery(
    api.encomendas.minhas,
    aprovada && orgActiva ? {} : "skip",
    { initialNumItems: 20 }
  )

  if (vista === undefined) return <Esqueleto />
  if (vista?.kind === "empresa" && aprovada && !orgActiva) {
    return activacaoFalhou ? (
      <Aviso titulo="Empresa não activa nesta sessão">
        Não foi possível activar a organização da empresa. Use o seletor de
        organização no topo da página e tente de novo.
      </Aviso>
    ) : (
      <Esqueleto />
    )
  }
  if (vista?.kind !== "empresa") {
    return (
      <Aviso
        titulo="Ainda sem empresa"
        accao={
          <Button render={<Link to="/registo" />} nativeButton={false}>
            Registar empresa
          </Button>
        }
      >
        Complete o registo da empresa para submeter encomendas. A aprovação é
        feita pela nossa equipa comercial.
      </Aviso>
    )
  }
  if (!aprovada) {
    return (
      <Aviso
        titulo="Empresa em aprovação"
        accao={
          <Button
            render={<Link to="/empresa" />}
            nativeButton={false}
            variant="outline"
          >
            Ver estado do pedido
          </Button>
        }
      >
        As encomendas ficam disponíveis depois da aprovação comercial. Até lá o
        catálogo mostra o PVP.
      </Aviso>
    )
  }
  if (status === "LoadingFirstPage") return <Esqueleto />
  if (results.length === 0) return <SemEncomendas />

  return (
    <>
      <ListaEncomendas encomendas={results} agora={agora} />
      {status === "CanLoadMore" && (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => loadMore(20)}
        >
          Mostrar encomendas mais antigas
        </Button>
      )}
    </>
  )
}

function SemEncomendas() {
  return (
    <section className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-card px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
        <PackageOpen className="size-6" />
      </span>
      <div>
        <h2 className="font-semibold">Ainda não há encomendas</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Adicione equipamentos à lista de orçamento no catálogo e submeta a
          encomenda a partir daí. Os preços de revenda ficam congelados ao
          submeter.
        </p>
      </div>
      <Button render={<Link to="/produtos" />} nativeButton={false}>
        Explorar o catálogo
      </Button>
    </section>
  )
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="h-[4.5rem] animate-pulse rounded-xl border bg-secondary/60"
        />
      ))}
    </div>
  )
}

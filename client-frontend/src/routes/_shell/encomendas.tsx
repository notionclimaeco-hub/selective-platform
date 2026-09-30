import { createFileRoute, Link } from "@tanstack/react-router"
import { Authenticated, usePaginatedQuery } from "convex/react"

import { api } from "@convex/_generated/api"
import type { FiltroEncomenda } from "@convex/lib/encomendaEstados"
import { Chip } from "@/components/catalogo/filter-chips"
import { Aviso, CabecalhoPagina, Pagina } from "@/components/shell/pagina"
import { ListaEncomendas } from "@/components/encomendas/lista-encomendas"
import { Button } from "@/components/ui/button"
import { useEmpresaActiva } from "@/lib/empresa-activa"
import { FILTROS_LISTA, lerFiltroEncomendas } from "@/lib/encomendas"

export const Route = createFileRoute("/_shell/encomendas")({
  validateSearch: lerFiltroEncomendas,
  component: EncomendasPage,
})

function EncomendasPage() {
  return (
    <Pagina>
      <CabecalhoPagina titulo="Encomendas" />
      <Authenticated>
        <Lista />
      </Authenticated>
    </Pagina>
  )
}

function Lista() {
  const { filtro } = Route.useSearch()
  const { vista, orgActiva, activacaoFalhou } = useEmpresaActiva()
  const aprovada =
    vista?.kind === "empresa" && vista.empresa.estadoAprovacao === "aprovada"
  // `minhas` needs the org in the JWT; wait for the active org to match.
  const { results, status, loadMore } = usePaginatedQuery(
    api.encomendas.minhas,
    aprovada && orgActiva ? (filtro ? { filtro } : {}) : "skip",
    { initialNumItems: 20 }
  )

  if (vista === undefined) return <Esqueleto />
  if (vista?.kind !== "empresa") {
    return (
      <Aviso
        titulo="Sem empresa"
        accao={
          <Button render={<Link to="/registo" />} nativeButton={false}>
            Registar empresa
          </Button>
        }
      />
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
            Ver estado
          </Button>
        }
      />
    )
  }
  if (!orgActiva) {
    return activacaoFalhou ? (
      <Aviso titulo="Empresa não activa nesta sessão">
        Escolha a empresa no seletor de organização e tente de novo.
      </Aviso>
    ) : (
      <Esqueleto />
    )
  }

  return (
    <>
      <Filtros filtro={filtro} />
      {status === "LoadingFirstPage" ? (
        <Esqueleto />
      ) : results.length === 0 ? (
        <SemEncomendas filtrada={filtro !== undefined} />
      ) : (
        <>
          <ListaEncomendas encomendas={results} />
          {status !== "Exhausted" && (
            <Button
              variant="outline"
              className="self-center"
              disabled={status === "LoadingMore"}
              onClick={() => loadMore(20)}
            >
              Ver mais
            </Button>
          )}
        </>
      )}
    </>
  )
}

/** One scrolling chip row on phones; the chip lives in `?filtro=`. */
function Filtros({ filtro }: { filtro: FiltroEncomenda | undefined }) {
  const navigate = Route.useNavigate()
  const escolher = (valor: FiltroEncomenda | undefined) =>
    void navigate({ search: valor ? { filtro: valor } : {}, replace: true })

  return (
    <div
      role="group"
      aria-label="Filtrar por estado"
      className="-mx-4 -mt-2 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      <Chip ativo={filtro === undefined} onClick={() => escolher(undefined)}>
        Todas
      </Chip>
      {FILTROS_LISTA.map((f) => (
        <Chip
          key={f.valor}
          ativo={f.valor === filtro}
          onClick={() => escolher(f.valor === filtro ? undefined : f.valor)}
        >
          {f.rotulo}
        </Chip>
      ))}
    </div>
  )
}

function SemEncomendas({ filtrada }: { filtrada: boolean }) {
  if (filtrada) return <Aviso>Nenhuma encomenda neste estado.</Aviso>
  return (
    <Aviso
      titulo="Ainda sem encomendas"
      accao={
        <Button render={<Link to="/produtos" />} nativeButton={false}>
          Ver catálogo
        </Button>
      }
    />
  )
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy>
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-xl border bg-secondary/60 md:h-14"
        />
      ))}
    </div>
  )
}

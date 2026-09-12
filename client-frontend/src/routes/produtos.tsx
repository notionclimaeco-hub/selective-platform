import { useCallback, useEffect, useMemo, useRef } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { FunctionReturnType } from "convex/server"
import { SearchX } from "lucide-react"

import { api } from "@convex/_generated/api"
import { FilterChips } from "@/components/catalogo/filter-chips"
import type { Opcao } from "@/components/catalogo/filter-chips"
import { Pagination } from "@/components/catalogo/pagination"
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/catalogo/product-card"
import { SearchBox } from "@/components/catalogo/search-box"
import { SortSelect } from "@/components/catalogo/sort-select"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { Button } from "@/components/ui/button"
import { FAMILIAS, rotuloFamilia, rotuloMarca } from "@/lib/catalogo"
import {
  argsCatalogo,
  contarFiltrosAtivos,
  POR_PAGINA,
  validarBusca,
} from "@/lib/catalogo-search"
import type { FiltrosCatalogo } from "@/lib/catalogo-search"
import { useMapaDesdePorGrupo } from "@/lib/precos-revenda"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/produtos")({
  validateSearch: validarBusca,
  component: CatalogoPage,
})

type Lista = FunctionReturnType<typeof api.catalogo.listar>

const numero = new Intl.NumberFormat("pt-PT")

function CatalogoPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Catalogo />
      </main>
      <SiteFooter />
    </div>
  )
}

function Catalogo() {
  const filtros = Route.useSearch()
  const navigate = Route.useNavigate()

  // Every change that narrows or reorders the results starts over at page 1 —
  // page 7 of the old result set says nothing about the new one. Typing
  // replaces the history entry so the back button skips over keystrokes.
  const aplicar = useCallback(
    (patch: Partial<FiltrosCatalogo>, replace = false) => {
      void navigate({
        search: (prev) => ({ ...prev, ...patch, pagina: undefined }),
        replace,
      })
    },
    [navigate]
  )
  const onBusca = useCallback(
    (q: string | undefined) => aplicar({ q }, true),
    [aplicar]
  )

  const { data, isLoading, isFetching } = useQuery({
    ...convexQuery(api.catalogo.listar, argsCatalogo(filtros)),
    // Keep the current grid on screen (dimmed) while the next one loads
    // instead of flashing skeletons on every filter change.
    placeholderData: keepPreviousData,
  })

  // The server clamps the page when filters shrink the result set; mirror it
  // back into the URL so a shared link never points past the last page.
  useEffect(() => {
    if (!data || isFetching) return
    const naUrl = filtros.pagina ?? 1
    const noServidor = data.pagina + 1
    if (naUrl !== noServidor) {
      void navigate({
        search: (prev) => ({
          ...prev,
          pagina: noServidor <= 1 ? undefined : noServidor,
        }),
        replace: true,
      })
    }
  }, [data, isFetching, filtros.pagina, navigate])

  // Jump back to the top of the results when the page changes (not on the
  // first render, and not on filter changes — those already show at the top).
  const paginaAnterior = useRef(filtros.pagina)
  useEffect(() => {
    if (paginaAnterior.current !== filtros.pagina) {
      paginaAnterior.current = filtros.pagina
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [filtros.pagina])

  const numFiltros = contarFiltrosAtivos(filtros)
  const limpar = () => void navigate({ search: { ordenar: filtros.ordenar } })

  return (
    <div className="overflow-x-clip">
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
        <Cabecalho
          filtros={filtros}
          total={data?.total}
          aCarregar={isLoading}
        />

        <div className="mt-5 flex items-center gap-2 sm:mt-6 sm:gap-3">
          <SearchBox
            valor={filtros.q ?? ""}
            onBusca={onBusca}
            className="min-w-0 flex-1"
          />
          <SortSelect
            valor={filtros.ordenar ?? "relevancia"}
            onChange={(valor) =>
              aplicar({ ordenar: valor === "relevancia" ? undefined : valor })
            }
            className="h-11 shrink-0"
          />
        </div>

        <Filtros
          filtros={filtros}
          data={data}
          onFamilia={(familia) => aplicar({ familia })}
          onMarca={(marca) => aplicar({ marca })}
        />

        <Resultados
          data={data}
          filtros={filtros}
          aCarregar={isLoading}
          aAtualizar={isFetching && !isLoading}
          temFiltros={numFiltros > 0}
          onLimpar={limpar}
          onPagina={(p) =>
            void navigate({
              search: (prev) => ({
                ...prev,
                pagina: p <= 0 ? undefined : p + 1,
              }),
            })
          }
        />
      </div>
    </div>
  )
}

function Cabecalho({
  filtros,
  total,
  aCarregar,
}: {
  filtros: FiltrosCatalogo
  total: number | undefined
  aCarregar: boolean
}) {
  // The title follows the filters, so a family and/or brand reads like a
  // section of the catalog instead of a filtered list.
  const familia = filtros.familia ? rotuloFamilia(filtros.familia) : undefined
  const marca = filtros.marca ? rotuloMarca(filtros.marca) : undefined
  const titulo =
    familia && marca
      ? `${familia} ${marca}`
      : (familia ?? (marca ? `Equipamentos ${marca}` : "Catálogo"))

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <p className="text-sm font-medium text-primary">Produtos</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {titulo}
        </h1>
      </div>
      <p
        className="text-sm text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        {aCarregar || total === undefined ? (
          <span className="inline-block h-4 w-24 animate-pulse rounded bg-muted align-middle" />
        ) : (
          <>
            {numero.format(total)} {total === 1 ? "produto" : "produtos"}
            {filtros.q ? (
              <>
                {" "}
                para{" "}
                <span className="font-medium text-primary">“{filtros.q}”</span>
              </>
            ) : null}
            <span className="hidden sm:inline"> · preços de tabela s/IVA</span>
          </>
        )}
      </p>
    </div>
  )
}

function Filtros({
  filtros,
  data,
  onFamilia,
  onMarca,
}: {
  filtros: FiltrosCatalogo
  data: Lista | undefined
  onFamilia: (familia: string | undefined) => void
  onMarca: (marca: string | undefined) => void
}) {
  // Families keep their canonical order and brands stay alphabetical, so the
  // chips never jump around as counts change. Options with no matches drop
  // out, except the chosen one (it must stay to be un-chosen).
  const familias = useMemo<Array<Opcao>>(() => {
    const contagens = new Map(
      (data?.familias ?? []).map((f) => [f.valor, f.contagem])
    )
    return FAMILIAS.filter(
      (f) => contagens.has(f) || f === filtros.familia
    ).map((f) => ({
      valor: f,
      rotulo: rotuloFamilia(f),
      contagem: contagens.get(f) ?? 0,
    }))
  }, [data?.familias, filtros.familia])

  const marcas = useMemo<Array<Opcao>>(() => {
    const lista = (data?.marcas ?? []).map((m) => ({
      valor: m.valor,
      rotulo: rotuloMarca(m.valor),
      contagem: m.contagem,
    }))
    if (filtros.marca && !lista.some((m) => m.valor === filtros.marca)) {
      lista.push({
        valor: filtros.marca,
        rotulo: rotuloMarca(filtros.marca),
        contagem: 0,
      })
    }
    return lista.sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt"))
  }, [data?.marcas, filtros.marca])

  if (!data) {
    return (
      <div className="mt-4 flex flex-col gap-2.5">
        <div className="h-8 w-full max-w-2xl animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-full max-w-md animate-pulse rounded-full bg-muted" />
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-2.5">
      <FilterChips
        rotulo="Família"
        rotuloTodos="Todas"
        opcoes={familias}
        escolhida={filtros.familia}
        onEscolher={onFamilia}
      />
      <FilterChips
        rotulo="Marca"
        rotuloTodos="Todas"
        opcoes={marcas}
        escolhida={filtros.marca}
        onEscolher={onMarca}
      />
    </div>
  )
}

function Resultados({
  data,
  filtros,
  aCarregar,
  aAtualizar,
  temFiltros,
  onLimpar,
  onPagina,
}: {
  data: Lista | undefined
  filtros: FiltrosCatalogo
  aCarregar: boolean
  aAtualizar: boolean
  temFiltros: boolean
  onLimpar: () => void
  onPagina: (pagina: number) => void
}) {
  if (aCarregar || data === undefined) {
    return (
      <Grelha>
        {Array.from({ length: 10 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </Grelha>
    )
  }

  if (data.entradas.length === 0) {
    return <SemResultados temFiltros={temFiltros} onLimpar={onLimpar} />
  }

  return (
    <>
      <div
        aria-busy={aAtualizar}
        className={cn(
          "transition-opacity duration-200",
          aAtualizar && "pointer-events-none opacity-60"
        )}
      >
        <GrelhaComPrecos
          entradas={data.entradas}
          mostrarFamilia={filtros.familia === undefined}
        />
      </div>
      <Pagination
        pagina={data.pagina}
        numPaginas={data.numPaginas}
        onPagina={onPagina}
      />
      <p className="mt-4 text-center text-xs text-muted-foreground tabular-nums">
        {numero.format(data.pagina * POR_PAGINA + 1)}–
        {numero.format(data.pagina * POR_PAGINA + data.entradas.length)} de{" "}
        {numero.format(data.total)}
      </p>
    </>
  )
}

function GrelhaComPrecos({
  entradas,
  mostrarFamilia,
}: {
  entradas: Lista["entradas"]
  mostrarFamilia: boolean
}) {
  // Approved installers get one extra query per page with their reseller
  // "desde" prices; everyone else renders the PVP that came with the list.
  const revenda = useMapaDesdePorGrupo(entradas.map((e) => e.grupoModelo))
  return (
    <Grelha>
      {entradas.map((entrada) => (
        <ProductCard
          key={entrada.grupoModelo}
          entrada={entrada}
          mostrarFamilia={mostrarFamilia}
          precoRevendaCents={revenda?.get(entrada.grupoModelo)}
        />
      ))}
    </Grelha>
  )
}

function Grelha({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-2.5 sm:mt-6 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-4">
      {children}
    </div>
  )
}

function SemResultados({
  temFiltros,
  onLimpar,
}: {
  temFiltros: boolean
  onLimpar: () => void
}) {
  return (
    <div className="mt-12 flex flex-col items-center gap-3 text-center sm:mt-20">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
        <SearchX className="size-5" />
      </div>
      <p className="text-lg font-semibold">Nenhum produto encontrado</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {temFiltros
          ? "Experimente outro termo ou remova a família ou a marca escolhida."
          : "O catálogo será publicado em breve. Contacte-nos para conhecer a oferta completa."}
      </p>
      {temFiltros ? (
        <Button variant="outline" onClick={onLimpar} className="mt-1">
          Limpar filtros
        </Button>
      ) : (
        <Button
          render={<Link to="/" />}
          nativeButton={false}
          variant="outline"
          className="mt-1"
        >
          Voltar ao início
        </Button>
      )}
    </div>
  )
}

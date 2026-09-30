import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { FunctionReturnType } from "convex/server"
import { SearchX } from "lucide-react"

import { api } from "@convex/_generated/api"
import { Chip, FilterChips } from "@/components/catalogo/filter-chips"
import type { Opcao } from "@/components/catalogo/filter-chips"
import { FiltrosSheet } from "@/components/catalogo/filtros-sheet"
import { Pagination, VerMais } from "@/components/catalogo/pagination"
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/catalogo/product-card"
import { SearchBox } from "@/components/catalogo/search-box"
import { SortSelect } from "@/components/catalogo/sort-select"
import { Button } from "@/components/ui/button"
import { FAMILIAS, rotuloFamilia, rotuloMarca } from "@/lib/catalogo"
import type { Ordenacao } from "@/lib/catalogo"
import {
  argsCatalogo,
  contarFiltrosAtivos,
  POR_PAGINA,
  validarBusca,
} from "@/lib/catalogo-search"
import type { FiltrosCatalogo } from "@/lib/catalogo-search"
import { useMapaDesdePorGrupo } from "@/lib/precos-revenda"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_shell/produtos")({
  validateSearch: validarBusca,
  component: Catalogo,
})

type Lista = FunctionReturnType<typeof api.catalogo.listar>

const numero = new Intl.NumberFormat("pt-PT")

function Catalogo() {
  const filtros = Route.useSearch()
  const navigate = Route.useNavigate()
  const telemovel = useTelemovel()

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
  const onOrdenar = (valor: Ordenacao) =>
    aplicar({ ordenar: valor === "relevancia" ? undefined : valor })

  const { data, isLoading, isFetching, isPlaceholderData } = useQuery({
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

  // Jump back to the top of the results when the page changes on wide
  // screens (not on the first render, and not on filter changes — those
  // already show at the top). Phones grow the grid in place instead.
  const paginaAnterior = useRef(filtros.pagina)
  useEffect(() => {
    if (paginaAnterior.current !== filtros.pagina) {
      paginaAnterior.current = filtros.pagina
      if (!telemovel) window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [filtros.pagina, telemovel])

  const opcoes = useOpcoes(data, filtros)
  const numFiltros = contarFiltrosAtivos(filtros)
  const limpar = () => void navigate({ search: { ordenar: filtros.ordenar } })
  const pagina = Math.max(0, (filtros.pagina ?? 1) - 1)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-12 sm:px-6 sm:pt-8">
      <Cabecalho filtros={filtros} total={data?.total} aCarregar={isLoading} />

      {/* Sticky band under the shell's top bar: search always, plus the
          chip row on phones so filters stay one tap away while scrolling. */}
      <div className="sticky top-[var(--barra-topo)] z-30 -mx-4 mt-3 bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:-mx-6 sm:mt-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <SearchBox
            valor={filtros.q ?? ""}
            onBusca={onBusca}
            className="min-w-0 flex-1"
          />
          <SortSelect
            valor={filtros.ordenar ?? "relevancia"}
            onChange={onOrdenar}
            className="hidden h-11 shrink-0 sm:inline-flex"
          />
        </div>

        <div
          role="group"
          aria-label="Filtros"
          className="sem-scrollbar -mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 sm:hidden"
        >
          <FiltrosSheet
            familias={opcoes.familias}
            marcas={opcoes.marcas}
            familia={filtros.familia}
            marca={filtros.marca}
            ordenar={filtros.ordenar ?? "relevancia"}
            total={data?.total}
            numAtivos={
              (filtros.familia ? 1 : 0) +
              (filtros.marca ? 1 : 0) +
              (filtros.ordenar ? 1 : 0)
            }
            onFamilia={(familia) => aplicar({ familia })}
            onMarca={(marca) => aplicar({ marca })}
            onOrdenar={onOrdenar}
            onLimpar={limpar}
          />
          {data ? (
            <>
              {opcoes.familias.map((o) => (
                <Chip
                  key={`f-${o.valor}`}
                  ativo={o.valor === filtros.familia}
                  onClick={() =>
                    aplicar({
                      familia:
                        o.valor === filtros.familia ? undefined : o.valor,
                    })
                  }
                >
                  {o.rotulo}
                </Chip>
              ))}
              <span aria-hidden className="my-1.5 w-px shrink-0 bg-border" />
              {opcoes.marcas.map((o) => (
                <Chip
                  key={`m-${o.valor}`}
                  ativo={o.valor === filtros.marca}
                  onClick={() =>
                    aplicar({
                      marca: o.valor === filtros.marca ? undefined : o.valor,
                    })
                  }
                >
                  {o.rotulo}
                </Chip>
              ))}
            </>
          ) : (
            Array.from({ length: 3 }, (_, i) => (
              <span
                key={i}
                className="h-8 w-28 shrink-0 animate-pulse rounded-full bg-muted"
              />
            ))
          )}
        </div>
      </div>

      <FiltrosLargos
        filtros={filtros}
        data={data}
        opcoes={opcoes}
        onFamilia={(familia) => aplicar({ familia })}
        onMarca={(marca) => aplicar({ marca })}
      />

      <Resultados
        data={data}
        filtros={filtros}
        pagina={pagina}
        telemovel={telemovel}
        aCarregar={isLoading}
        aAtualizar={isFetching && !isLoading}
        seguinteACarregar={isPlaceholderData}
        temFiltros={numFiltros > 0}
        onLimpar={limpar}
        onPagina={(p) =>
          void navigate({
            search: (prev) => ({
              ...prev,
              pagina: p <= 0 ? undefined : p + 1,
            }),
            // "Ver mais" grows the grid where the thumb is.
            resetScroll: !telemovel,
          })
        }
      />
    </div>
  )
}

/**
 * Below `sm` (Tailwind's 40rem). False on the server and on the first client
 * render, so SSR and hydration agree; phones switch right after.
 */
function useTelemovel(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia("(width < 40rem)")
      mq.addEventListener("change", avisar)
      return () => mq.removeEventListener("change", avisar)
    },
    () => window.matchMedia("(width < 40rem)").matches,
    () => false
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
    <div className="flex items-baseline justify-between gap-4">
      <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">
        {titulo}
      </h1>
      <p
        className="shrink-0 text-sm text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        {aCarregar || total === undefined ? (
          <span className="inline-block h-4 w-20 animate-pulse rounded bg-muted align-middle" />
        ) : (
          <>
            {numero.format(total)} {total === 1 ? "produto" : "produtos"}
            <span className="hidden sm:inline"> · s/IVA</span>
          </>
        )}
      </p>
    </div>
  )
}

type Opcoes = { familias: Array<Opcao>; marcas: Array<Opcao> }

function useOpcoes(data: Lista | undefined, filtros: FiltrosCatalogo): Opcoes {
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

  return { familias, marcas }
}

/** Family and brand rows from `sm` up (phones use the sticky chip row). */
function FiltrosLargos({
  filtros,
  data,
  opcoes,
  onFamilia,
  onMarca,
}: {
  filtros: FiltrosCatalogo
  data: Lista | undefined
  opcoes: Opcoes
  onFamilia: (familia: string | undefined) => void
  onMarca: (marca: string | undefined) => void
}) {
  if (!data) {
    return (
      <div className="mt-2 hidden flex-col gap-2 sm:flex">
        <div className="h-8 w-full max-w-2xl animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-full max-w-md animate-pulse rounded-full bg-muted" />
      </div>
    )
  }

  return (
    <div className="mt-2 hidden flex-col gap-2 sm:flex">
      <FilterChips
        rotulo="Família"
        rotuloTodos="Todas"
        opcoes={opcoes.familias}
        escolhida={filtros.familia}
        onEscolher={onFamilia}
      />
      <FilterChips
        rotulo="Marca"
        rotuloTodos="Todas"
        opcoes={opcoes.marcas}
        escolhida={filtros.marca}
        onEscolher={onMarca}
      />
    </div>
  )
}

function Resultados({
  data,
  filtros,
  pagina,
  telemovel,
  aCarregar,
  aAtualizar,
  seguinteACarregar,
  temFiltros,
  onLimpar,
  onPagina,
}: {
  data: Lista | undefined
  filtros: FiltrosCatalogo
  /** 0-based page from the URL. */
  pagina: number
  telemovel: boolean
  aCarregar: boolean
  aAtualizar: boolean
  /** The data on screen is the previous query's, kept while this one loads. */
  seguinteACarregar: boolean
  temFiltros: boolean
  onLimpar: () => void
  onPagina: (pagina: number) => void
}) {
  if (aCarregar || data === undefined) {
    return (
      <Grelha>
        <Esqueletos />
      </Grelha>
    )
  }

  if (data.entradas.length === 0) {
    return <SemResultados temFiltros={temFiltros} onLimpar={onLimpar} />
  }

  const mostrarFamilia = filtros.familia === undefined

  // Phones: page N shows pages 1..N stacked ("Ver mais" appends). The earlier
  // pages are separate (cached) queries; while the newly requested page loads,
  // the placeholder is the page above, so show skeletons in its place.
  const acumular = telemovel && pagina > 0
  const aCrescer = acumular && seguinteACarregar

  return (
    <>
      <div
        aria-busy={aAtualizar}
        className={cn(
          "transition-opacity duration-200",
          aAtualizar && !acumular && "pointer-events-none opacity-60"
        )}
      >
        <Grelha>
          {acumular &&
            Array.from({ length: pagina }, (_, i) => (
              <PaginaAnterior
                key={i}
                filtros={filtros}
                pagina={i}
                mostrarFamilia={mostrarFamilia}
              />
            ))}
          {aCrescer ? (
            <Esqueletos quantos={4} />
          ) : (
            <CartoesComPrecos
              key={data.pagina}
              entradas={data.entradas}
              mostrarFamilia={mostrarFamilia}
            />
          )}
        </Grelha>
      </div>
      <VerMais
        mostrados={
          acumular
            ? Math.min(data.total, (pagina + 1) * POR_PAGINA)
            : data.pagina * POR_PAGINA + data.entradas.length
        }
        total={data.total}
        aCarregar={aCrescer || (aAtualizar && !acumular)}
        onMais={() => onPagina(pagina + 1)}
      />
      <Pagination
        pagina={data.pagina}
        numPaginas={data.numPaginas}
        onPagina={onPagina}
      />
      <p className="mt-4 hidden text-center text-xs text-muted-foreground tabular-nums sm:block">
        {numero.format(data.pagina * POR_PAGINA + 1)}–
        {numero.format(data.pagina * POR_PAGINA + data.entradas.length)} de{" "}
        {numero.format(data.total)}
      </p>
    </>
  )
}

/** One already-seen page above the current one in the phone's growing grid. */
function PaginaAnterior({
  filtros,
  pagina,
  mostrarFamilia,
}: {
  filtros: FiltrosCatalogo
  pagina: number
  mostrarFamilia: boolean
}) {
  const { data } = useQuery(
    convexQuery(api.catalogo.listar, {
      ...argsCatalogo(filtros),
      pagina,
    })
  )
  if (!data) return <Esqueletos quantos={4} />
  return (
    <CartoesComPrecos
      entradas={data.entradas}
      mostrarFamilia={mostrarFamilia}
    />
  )
}

function CartoesComPrecos({
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
    <>
      {entradas.map((entrada) => (
        <ProductCard
          key={entrada.grupoModelo}
          entrada={entrada}
          mostrarFamilia={mostrarFamilia}
          precoRevendaCents={revenda?.get(entrada.grupoModelo)}
        />
      ))}
    </>
  )
}

function Esqueletos({ quantos = 8 }: { quantos?: number }) {
  return (
    <>
      {Array.from({ length: quantos }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </>
  )
}

function Grelha({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-5 sm:gap-3 md:grid-cols-3 xl:grid-cols-4 xl:gap-4">
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

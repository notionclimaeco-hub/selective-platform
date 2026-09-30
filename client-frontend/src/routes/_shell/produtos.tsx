import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { SearchX } from "lucide-react"

import { filtrarCatalogo, paginar } from "@convex/lib/catalogoFiltros"
import type {
  FiltroDestaque,
  GrupoIndice,
  ResultadoCatalogo,
} from "@convex/lib/catalogoFiltros"
import { Chip, FilterChips } from "@/components/catalogo/filter-chips"
import type { Opcao } from "@/components/catalogo/filter-chips"
import {
  facetaUtil,
  PilulasDestaque,
} from "@/components/catalogo/filtros-destaque"
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
import { useCapas, useIndiceCatalogo } from "@/lib/catalogo-indice"
import {
  contarFiltrosAtivos,
  escreverFiltro,
  filtrosDestaque,
  pedidoCatalogo,
  POR_PAGINA,
  semFiltrosDestaque,
  validarBusca,
} from "@/lib/catalogo-search"
import type { FiltrosCatalogo } from "@/lib/catalogo-search"
import { useMapaDesdePorGrupo } from "@/lib/precos-revenda"

export const Route = createFileRoute("/_shell/produtos")({
  validateSearch: validarBusca,
  component: Catalogo,
})

const numero = new Intl.NumberFormat("pt-PT")

function Catalogo() {
  const filtros = Route.useSearch()
  const navigate = Route.useNavigate()
  const telemovel = useTelemovel()

  // The whole catalog, loaded once; searching, filtering, sorting and paging
  // below run in the browser without asking the server again.
  const { data: indice } = useIndiceCatalogo()
  const resultado = useMemo(
    () =>
      indice === undefined
        ? undefined
        : filtrarCatalogo(indice, pedidoCatalogo(filtros)),
    [indice, filtros]
  )

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
  // Hero filters belong to a family: changing family drops them.
  const onFamilia = (familia: string | undefined) =>
    void navigate({
      search: (prev) => ({
        ...semFiltrosDestaque(prev),
        familia,
        pagina: undefined,
      }),
    })
  const onMarca = (marca: string | undefined) => aplicar({ marca })
  const onFiltro = (chave: string, filtro: FiltroDestaque | undefined) =>
    aplicar({ [chave]: escreverFiltro(filtro) })

  const paginaPedida = Math.max(0, (filtros.pagina ?? 1) - 1)
  const paginacao =
    resultado === undefined
      ? undefined
      : paginar(resultado.grupos.length, paginaPedida, POR_PAGINA)

  // Filters can shrink the results under a shared link's page; correct the
  // URL so it never points past the last page.
  useEffect(() => {
    if (paginacao === undefined || paginacao.pagina === paginaPedida) return
    void navigate({
      search: (prev) => ({
        ...prev,
        pagina: paginacao.pagina === 0 ? undefined : paginacao.pagina + 1,
      }),
      replace: true,
    })
  }, [paginacao, paginaPedida, navigate])

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

  const opcoes = useOpcoes(resultado, filtros)
  const destaques = filtrosDestaque(filtros)
  const numDestaques = Object.keys(destaques).length
  const numFiltros = contarFiltrosAtivos(filtros)
  const limpar = () => void navigate({ search: { ordenar: filtros.ordenar } })
  const total = resultado?.grupos.length

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-12 sm:px-6 sm:pt-8">
      <Cabecalho
        filtros={filtros}
        total={total}
        aCarregar={resultado === undefined}
      />

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
            facetas={opcoes.facetas}
            familia={filtros.familia}
            marca={filtros.marca}
            filtros={destaques}
            ordenar={filtros.ordenar ?? "relevancia"}
            total={total}
            numAtivos={
              (filtros.familia ? 1 : 0) +
              (filtros.marca ? 1 : 0) +
              numDestaques +
              (filtros.ordenar ? 1 : 0)
            }
            onFamilia={onFamilia}
            onMarca={onMarca}
            onFiltro={onFiltro}
            onOrdenar={onOrdenar}
            onLimpar={limpar}
          />
          {resultado ? (
            <>
              {opcoes.familias.map((o) => (
                <Chip
                  key={`f-${o.valor}`}
                  ativo={o.valor === filtros.familia}
                  onClick={() =>
                    onFamilia(o.valor === filtros.familia ? undefined : o.valor)
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
                    onMarca(o.valor === filtros.marca ? undefined : o.valor)
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
        carregado={resultado !== undefined}
        opcoes={opcoes}
        destaques={destaques}
        onFamilia={onFamilia}
        onMarca={onMarca}
        onFiltro={onFiltro}
      />

      <Resultados
        grupos={resultado?.grupos}
        paginacao={paginacao}
        mostrarFamilia={filtros.familia === undefined}
        telemovel={telemovel}
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

type Opcoes = {
  familias: Array<Opcao>
  marcas: Array<Opcao>
  facetas: ResultadoCatalogo["facetas"]
}

function useOpcoes(
  resultado: ResultadoCatalogo | undefined,
  filtros: FiltrosCatalogo
): Opcoes {
  // Families keep their canonical order and brands stay alphabetical, so the
  // chips never jump around as counts change. Options with no matches drop
  // out, except the chosen one (it must stay to be un-chosen).
  const familias = useMemo<Array<Opcao>>(() => {
    const contagens = new Map(
      (resultado?.familias ?? []).map((f) => [f.valor, f.contagem])
    )
    return FAMILIAS.filter(
      (f) => contagens.has(f) || f === filtros.familia
    ).map((f) => ({
      valor: f,
      rotulo: rotuloFamilia(f),
      contagem: contagens.get(f) ?? 0,
    }))
  }, [resultado?.familias, filtros.familia])

  const marcas = useMemo<Array<Opcao>>(() => {
    const lista = (resultado?.marcas ?? []).map((m) => ({
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
  }, [resultado?.marcas, filtros.marca])

  // A numeric span with one value has nothing to narrow, unless it is the
  // filter already set (it must stay to be cleared).
  const facetas = useMemo(
    () =>
      (resultado?.facetas ?? []).filter(
        (f) => facetaUtil(f) || filtros[f.chave] !== undefined
      ),
    [resultado?.facetas, filtros]
  )

  return { familias, marcas, facetas }
}

/** Family, brand and hero-spec rows from `sm` up (phones use the chip row). */
function FiltrosLargos({
  filtros,
  carregado,
  opcoes,
  destaques,
  onFamilia,
  onMarca,
  onFiltro,
}: {
  filtros: FiltrosCatalogo
  carregado: boolean
  opcoes: Opcoes
  destaques: Record<string, FiltroDestaque>
  onFamilia: (familia: string | undefined) => void
  onMarca: (marca: string | undefined) => void
  onFiltro: (chave: string, filtro: FiltroDestaque | undefined) => void
}) {
  if (!carregado) {
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
      {opcoes.facetas.length > 0 && (
        <div className="flex min-w-0 items-start gap-3">
          <span className="w-14 shrink-0 pt-1.5 text-xs font-medium text-muted-foreground">
            Filtros
          </span>
          <div
            role="group"
            aria-label="Especificações"
            className="flex min-w-0 flex-1 flex-wrap gap-1.5"
          >
            <PilulasDestaque
              facetas={opcoes.facetas}
              filtros={destaques}
              onFiltro={onFiltro}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Resultados({
  grupos,
  paginacao,
  mostrarFamilia,
  telemovel,
  temFiltros,
  onLimpar,
  onPagina,
}: {
  /** Every matching product page, in order; undefined while loading. */
  grupos: Array<GrupoIndice> | undefined
  paginacao: ReturnType<typeof paginar> | undefined
  mostrarFamilia: boolean
  telemovel: boolean
  temFiltros: boolean
  onLimpar: () => void
  onPagina: (pagina: number) => void
}) {
  if (grupos === undefined || paginacao === undefined) {
    return (
      <Grelha>
        <Esqueletos />
      </Grelha>
    )
  }

  if (grupos.length === 0) {
    return <SemResultados temFiltros={temFiltros} onLimpar={onLimpar} />
  }

  // Phones: page N shows pages 1..N stacked ("Ver mais" appends). Each page
  // is its own block so its covers and prices stay cached as the grid grows.
  const { pagina, numPaginas, inicio, fim } = paginacao
  const blocos = telemovel
    ? Array.from({ length: pagina + 1 }, (_, i) => i)
    : [pagina]

  return (
    <>
      <Grelha>
        {blocos.map((i) => (
          <CartoesComPrecos
            key={i}
            grupos={grupos.slice(i * POR_PAGINA, (i + 1) * POR_PAGINA)}
            mostrarFamilia={mostrarFamilia}
          />
        ))}
      </Grelha>
      <VerMais
        mostrados={fim}
        total={grupos.length}
        aCarregar={false}
        onMais={() => onPagina(pagina + 1)}
      />
      <Pagination pagina={pagina} numPaginas={numPaginas} onPagina={onPagina} />
      <p className="mt-4 hidden text-center text-xs text-muted-foreground tabular-nums sm:block">
        {numero.format(inicio + 1)}–{numero.format(fim)} de{" "}
        {numero.format(grupos.length)}
      </p>
    </>
  )
}

function CartoesComPrecos({
  grupos,
  mostrarFamilia,
}: {
  grupos: Array<GrupoIndice>
  mostrarFamilia: boolean
}) {
  const chaves = grupos.map((g) => g.grupoModelo)
  // Covers for this page only. Approved installers also get their reseller
  // "desde" prices; everyone else sees the PVP that came with the index.
  const capas = useCapas(chaves)
  const revenda = useMapaDesdePorGrupo(chaves)
  return (
    <>
      {grupos.map((g) => (
        <ProductCard
          key={g.grupoModelo}
          entrada={{ ...g, capaUrl: capas?.get(g.grupoModelo) }}
          mostrarFamilia={mostrarFamilia}
          precoRevendaCents={revenda?.get(g.grupoModelo)}
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
          ? "Experimente outro termo ou remova um dos filtros escolhidos."
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

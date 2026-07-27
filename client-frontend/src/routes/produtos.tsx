import { useCallback, useEffect, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react"

import { api } from "@convex/_generated/api"
import { ActiveFilters } from "@/components/catalogo/active-filters"
import { CatalogSearch } from "@/components/catalogo/catalog-search"
import { CatalogToolbar } from "@/components/catalogo/catalog-toolbar"
import { FacetPanel } from "@/components/catalogo/facet-panel"
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/catalogo/product-card"
import {
  ProductRow,
  ProductRowSkeleton,
} from "@/components/catalogo/product-row"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { Button } from "@/components/ui/button"
import { rotuloMarca } from "@/lib/catalogo"
import {
  argsCatalogo,
  contarFiltrosAtivos,
  lerLista,
  semFiltros,
  validarBusca,
} from "@/lib/catalogo-search"
import type { FiltrosCatalogo } from "@/lib/catalogo-search"
import { cn } from "@/lib/utils"

const POR_PAGINA = 24

export const Route = createFileRoute("/produtos")({
  validateSearch: validarBusca,
  component: CatalogoPage,
})

function CatalogoPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <CatalogoConteudo />
      </main>
      <SiteFooter />
    </div>
  )
}

function CatalogoConteudo() {
  const filtros = Route.useSearch()
  const navigate = Route.useNavigate()
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)

  // Every filter change resets pagination — page 7 of the old result set says
  // nothing about the new one.
  const aplicar = useCallback(
    (patch: Partial<FiltrosCatalogo>) => {
      void navigate({
        search: (prev) => ({ ...prev, ...patch, pagina: undefined }),
      })
    },
    [navigate]
  )

  const { data, isFetching, isLoading } = useQuery({
    ...convexQuery(
      api.produtos.listarCatalogo,
      argsCatalogo(filtros, POR_PAGINA)
    ),
    // Keep the previous page on screen while the next one loads instead of
    // flashing skeletons on every filter change.
    placeholderData: keepPreviousData,
  })

  // The server clamps the page when filters shrink the result set; mirror that
  // back into the URL so a shared link never points past the last page.
  useEffect(() => {
    if (!data) return
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
  }, [data, navigate, filtros.pagina])

  useEffect(() => {
    if (filtros.pagina === undefined || filtros.pagina <= 1) return
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [filtros.pagina])

  const numFiltros = contarFiltrosAtivos(filtros)
  const vista = filtros.vista ?? "grelha"
  const ordenar = filtros.ordenar ?? "relevancia"
  const marcasEscolhidas = lerLista(filtros.marca)

  function limpar() {
    void navigate({ search: semFiltros(filtros) })
  }

  const painel = (
    <FacetPanel
      filtros={filtros}
      facetas={data?.facetas}
      limites={data?.limites}
      onFiltrar={aplicar}
    />
  )

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-accent/60 via-background to-background"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14">
        <Cabecalho marcas={marcasEscolhidas} />

        <div className="mt-8">
          <CatalogSearch
            valor={filtros.q ?? ""}
            onBusca={(termo) => aplicar({ q: termo })}
          />
        </div>

        <div className="mt-8 flex gap-8">
          {/* Desktop sidebar; the same panel is reused in the mobile sheet. */}
          <aside className="hidden w-64 shrink-0 lg:block xl:w-72">
            <div className="sticky top-24">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <SlidersHorizontal className="size-4 text-muted-foreground" />
                  Filtros
                </h2>
                {numFiltros > 0 && (
                  <button
                    type="button"
                    onClick={limpar}
                    className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Limpar ({numFiltros})
                  </button>
                )}
              </div>
              <div className="max-h-[calc(100svh-11rem)] overflow-y-auto rounded-2xl border bg-card px-4 py-4">
                {painel}
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <CatalogToolbar
              total={data?.totalFamilias}
              aCarregar={isLoading}
              aAtualizar={isFetching && !isLoading}
              ordenar={ordenar}
              vista={vista}
              numFiltros={numFiltros}
              onOrdenar={(valor) =>
                aplicar({
                  ordenar: valor === "relevancia" ? undefined : valor,
                })
              }
              onVista={(v) =>
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    vista: v === "grelha" ? undefined : v,
                  }),
                })
              }
              onAbrirFiltros={() => setFiltrosAbertos(true)}
            />

            <div className="mt-4">
              <ActiveFilters
                filtros={filtros}
                onFiltrar={aplicar}
                onLimpar={limpar}
              />
            </div>

            <Resultados
              data={data}
              vista={vista}
              aCarregar={isLoading}
              aAtualizar={isFetching && !isLoading}
              temFiltro={numFiltros > 0}
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
      </div>

      <PainelMobile
        aberto={filtrosAbertos}
        total={data?.totalFamilias}
        numFiltros={numFiltros}
        onFechar={() => setFiltrosAbertos(false)}
        onLimpar={limpar}
      >
        {painel}
      </PainelMobile>
    </div>
  )
}

function Cabecalho({ marcas }: { marcas: Array<string> }) {
  // A single-brand filter (the landing marquee links here) deserves a title
  // that says so — it reads like a brand page instead of a filtered list.
  const marcaUnica = marcas.length === 1 ? marcas[0] : undefined

  return (
    <div className="max-w-2xl">
      <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">
        Catálogo
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {marcaUnica
          ? `Equipamentos ${rotuloMarca(marcaUnica)}`
          : "Equipamentos de climatização"}
      </h1>
      <p className="mt-3 leading-relaxed text-pretty text-muted-foreground">
        {marcaUnica
          ? `Toda a gama ${rotuloMarca(marcaUnica)} que distribuímos. Filtre por família, tipo de unidade ou potência. Preços de tabela (PVP), sem IVA.`
          : "Filtre por família, marca, tipo de unidade, potência ou preço, ou pesquise por modelo. Preços de tabela (PVP), sem IVA."}
      </p>
    </div>
  )
}

type Dados = {
  entradas: Array<React.ComponentProps<typeof ProductCard>["entrada"]>
  totalFamilias: number
  numPaginas: number
  pagina: number
}

function Resultados({
  data,
  vista,
  aCarregar,
  aAtualizar,
  temFiltro,
  onLimpar,
  onPagina,
}: {
  data: Dados | undefined
  vista: "grelha" | "lista"
  aCarregar: boolean
  aAtualizar: boolean
  temFiltro: boolean
  onLimpar: () => void
  onPagina: (pagina: number) => void
}) {
  if (aCarregar || data === undefined) {
    return (
      <Grelha vista={vista}>
        {Array.from({ length: 9 }, (_, i) =>
          vista === "grelha" ? (
            <ProductCardSkeleton key={i} />
          ) : (
            <ProductRowSkeleton key={i} />
          )
        )}
      </Grelha>
    )
  }

  if (data.entradas.length === 0) {
    return <SemResultados temFiltro={temFiltro} onLimpar={onLimpar} />
  }

  return (
    <>
      <div className={cn(aAtualizar && "opacity-70 transition-opacity")}>
        <Grelha vista={vista}>
          {data.entradas.map((entrada) =>
            vista === "grelha" ? (
              <ProductCard key={entrada.grupoModelo} entrada={entrada} />
            ) : (
              <ProductRow key={entrada.grupoModelo} entrada={entrada} />
            )
          )}
        </Grelha>
      </div>

      {data.numPaginas > 1 && (
        <Paginacao
          pagina={data.pagina}
          numPaginas={data.numPaginas}
          onPagina={onPagina}
        />
      )}
    </>
  )
}

function Grelha({
  vista,
  children,
}: {
  vista: "grelha" | "lista"
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "mt-6",
        vista === "grelha"
          ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
          : "flex flex-col gap-3"
      )}
    >
      {children}
    </div>
  )
}

/** Full-screen filter sheet for small screens. */
function PainelMobile({
  aberto,
  total,
  numFiltros,
  onFechar,
  onLimpar,
  children,
}: {
  aberto: boolean
  total: number | undefined
  numFiltros: number
  onFechar: () => void
  onLimpar: () => void
  children: React.ReactNode
}) {
  // Lock the page behind the sheet so scrolling the filter list does not scroll
  // the results underneath.
  useEffect(() => {
    if (!aberto) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = anterior
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    function fechar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar()
    }
    window.addEventListener("keydown", fechar)
    return () => window.removeEventListener("keydown", fechar)
  }, [aberto, onFechar])

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] lg:hidden",
        !aberto && "pointer-events-none"
      )}
      aria-hidden={!aberto}
    >
      <div
        onClick={onFechar}
        className={cn(
          "absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300",
          aberto ? "opacity-100" : "opacity-0"
        )}
      />
      <aside
        role="dialog"
        aria-modal={aberto}
        aria-label="Filtros"
        className={cn(
          "absolute inset-y-0 left-0 flex w-full max-w-sm flex-col bg-background shadow-2xl transition-transform duration-300 ease-out",
          aberto ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight">Filtros</h2>
          <div className="flex items-center gap-1">
            {numFiltros > 0 && (
              <button
                type="button"
                onClick={onLimpar}
                className="rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-secondary"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar filtros"
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        <footer className="border-t px-5 py-4">
          <Button className="w-full" size="lg" onClick={onFechar}>
            {total === undefined
              ? "Ver resultados"
              : `Ver ${total} ${total === 1 ? "produto" : "produtos"}`}
          </Button>
        </footer>
      </aside>
    </div>
  )
}

/**
 * Page numbers around the current one, with the first and last always
 * reachable: [1, …, 4, 5, 6, …, 37]. `null` marks an elision.
 */
function paginasVisiveis(
  pagina: number,
  numPaginas: number
): Array<number | null> {
  if (numPaginas <= 7) {
    return Array.from({ length: numPaginas }, (_, i) => i)
  }
  const perto = [pagina - 1, pagina, pagina + 1].filter(
    (p) => p > 0 && p < numPaginas - 1
  )
  const paginas: Array<number | null> = [0]
  if ((perto[0] ?? 1) > 1) paginas.push(null)
  paginas.push(...perto)
  if ((perto[perto.length - 1] ?? numPaginas - 2) < numPaginas - 2) {
    paginas.push(null)
  }
  paginas.push(numPaginas - 1)
  return paginas
}

function Paginacao({
  pagina,
  numPaginas,
  onPagina,
}: {
  pagina: number
  numPaginas: number
  onPagina: (pagina: number) => void
}) {
  return (
    <nav
      aria-label="Paginação"
      className="mt-10 flex items-center justify-between gap-3 border-t pt-6"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={pagina <= 0}
        onClick={() => onPagina(pagina - 1)}
      >
        <ChevronLeft data-icon="inline-start" />
        <span className="hidden sm:inline">Anterior</span>
      </Button>

      <div className="flex items-center gap-1">
        {paginasVisiveis(pagina, numPaginas).map((p, i) =>
          p === null ? (
            <span
              key={`salto-${i}`}
              className="px-1 text-sm text-muted-foreground"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPagina(p)}
              aria-current={p === pagina ? "page" : undefined}
              className={cn(
                "size-9 rounded-lg text-sm font-medium tabular-nums transition-colors",
                p === pagina
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {p + 1}
            </button>
          )
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={pagina >= numPaginas - 1}
        onClick={() => onPagina(pagina + 1)}
      >
        <span className="hidden sm:inline">Seguinte</span>
        <ChevronRight data-icon="inline-end" />
      </Button>
    </nav>
  )
}

function SemResultados({
  temFiltro,
  onLimpar,
}: {
  temFiltro: boolean
  onLimpar: () => void
}) {
  return (
    <div className="mt-16 flex flex-col items-center gap-4 text-center">
      <p className="text-lg font-semibold">Nenhum produto encontrado</p>
      <p className="max-w-md text-sm text-muted-foreground">
        {temFiltro
          ? "Os filtros atuais não devolvem resultados. Remova alguns filtros ou tente outro termo de pesquisa."
          : "O catálogo será publicado em breve. Contacte-nos para conhecer a oferta completa."}
      </p>
      {temFiltro ? (
        <Button variant="outline" onClick={onLimpar}>
          Limpar filtros
        </Button>
      ) : (
        <Button render={<Link to="/" />} nativeButton={false} variant="outline">
          Voltar ao início
        </Button>
      )}
    </div>
  )
}

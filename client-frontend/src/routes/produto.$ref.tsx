import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query"
import type { FunctionReturnType } from "convex/server"
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  Plus,
} from "lucide-react"

import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { Markdown } from "@/components/produto/markdown"
import { ProductGallery } from "@/components/produto/product-gallery"
import {
  VariantTable,
  atributosComuns,
  rotuloChave,
  rotuloValor,
  rotuloVariante,
  type Atributo,
  type Variante,
} from "@/components/produto/variant-table"
import { QuantityStepper } from "@/components/orcamento/quantity-stepper"
import { useOrcamento } from "@/components/orcamento/orcamento-store"
import {
  eurExato,
  rotuloFamilia,
  rotuloMarca,
  type Familia,
} from "@/lib/catalogo"

export const Route = createFileRoute("/produto/$ref")({
  component: ProdutoPage,
})

type Detalhe = NonNullable<FunctionReturnType<typeof api.produtos.obterPorRef>>

function ProdutoPage() {
  const { ref } = Route.useParams()
  const { data: base } = useSuspenseQuery(
    convexQuery(api.produtos.obterPorRef, { ref }),
  )

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        {base === null ? (
          <ProdutoNaoEncontrado />
        ) : (
          <ProdutoConteudo base={base} routeRef={ref} />
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

function ProdutoConteudo({
  base,
  routeRef,
}: {
  base: Detalhe
  routeRef: string
}) {
  if (base.grupoModelo) {
    return (
      <ProdutoFamilia
        base={base}
        routeRef={routeRef}
        grupoModelo={base.grupoModelo}
      />
    )
  }
  return <ProdutoLayout base={base} ativo={base} />
}

function ProdutoFamilia({
  base,
  routeRef,
  grupoModelo,
}: {
  base: Detalhe
  routeRef: string
  grupoModelo: string
}) {
  const { data: grupo } = useSuspenseQuery(
    convexQuery(api.produtos.obterGrupo, { grupoModelo }),
  )
  const [selectedRef, setSelectedRef] = useState(routeRef)

  // The active variant's full detail (price, specs, PDFs). Reuses the cached
  // result for the route ref, and keeps the previous data while switching so
  // the page never blanks.
  const { data: ativoRaw } = useQuery({
    ...convexQuery(api.produtos.obterPorRef, { ref: selectedRef }),
    placeholderData: keepPreviousData,
  })
  const ativo = ativoRaw ?? base

  const variantes = grupo?.variantes ?? []

  return (
    <ProdutoLayout
      base={base}
      ativo={ativo}
      variantes={variantes}
      selectedRef={selectedRef}
      onSelect={setSelectedRef}
    />
  )
}

function ProdutoLayout({
  base,
  ativo,
  variantes,
  selectedRef,
  onSelect,
}: {
  base: Detalhe
  ativo: Detalhe
  variantes?: Array<Variante>
  selectedRef?: string
  onSelect?: (ref: string) => void
}) {
  const temVariantes = variantes !== undefined && variantes.length > 1

  // Shared attributes render as spec chips in the buy box; the keys that vary
  // across the group become columns of the variant table below.
  const especificacoes = temVariantes
    ? atributosComuns(variantes!)
    : ativo.atributos
  const varianteAtiva = variantes?.find((v) => v.ref === ativo.ref)
  const varianteLabel =
    temVariantes && varianteAtiva
      ? rotuloVariante(varianteAtiva, variantes!)
      : ""

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <Breadcrumb familia={base.familia} nome={base.nomeGrupo} />
      </div>

      {/*
        Mobile: gallery → buy → description (`contents` lets order work).
        Desktop: sticky left column (gallery + description), buy on the right.
      */}
      <div className="mx-auto grid max-w-6xl items-start gap-x-12 gap-y-8 px-4 py-8 pb-12 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-10">
        <div className="contents lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-6 lg:self-start">
          <div className="order-1 min-w-0">
            <ProductGallery
              familia={base.familia}
              imagens={ativo.imagensUrls}
              pdfCapaUrl={ativo.fichasCatalogo[0]?.url ?? null}
            />
          </div>
          {ativo.descricao && (
            <div className="order-3 min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">
                Descrição
              </p>
              <div className="mt-2.5">
                <Markdown>{ativo.descricao}</Markdown>
              </div>
            </div>
          )}
        </div>

        <div className="order-2 flex min-w-0 flex-col gap-5 sm:gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium uppercase tracking-[0.15em] text-primary">
                {rotuloMarca(base.marca)}
                {base.gama ? ` · ${base.gama}` : ""}
              </p>
              {/* Page title is nomeGrupo (no capacity); capacity lives in the
                  variant table / SKU `nome` used by the quote list. */}
              <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                {base.nomeGrupo}
              </h1>
            </div>
            {ativo.fichasCatalogo.length > 0 && (
              <FichasCatalogo fichas={ativo.fichasCatalogo} />
            )}
          </div>

          <div className="border-y py-3.5 sm:py-4">
            <span className="text-2xl font-semibold text-primary sm:text-3xl">
              {eurExato.format(ativo.pvpCents / 100)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                s/IVA
              </span>
            </span>
          </div>

          {temVariantes && selectedRef && onSelect && (
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">
                Escolha o modelo
              </p>
              <div className="mt-2.5">
                <VariantTable
                  variantes={variantes!}
                  selectedRef={selectedRef}
                  onSelect={onSelect}
                />
              </div>
            </div>
          )}

          {especificacoes.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">
                Especificações
              </p>
              <div className="mt-2.5">
                <SpecChips atributos={especificacoes} />
              </div>
            </div>
          )}

          <QuoteCta ativo={ativo} varianteLabel={varianteLabel} />
        </div>
      </div>
    </>
  )
}

function Breadcrumb({ familia, nome }: { familia: string; nome: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <Link to="/" className="transition-colors hover:text-foreground">
        Início
      </Link>
      <ChevronRight className="size-3.5" />
      <Link
        to="/produtos"
        search={{ familia: familia as Familia }}
        className="transition-colors hover:text-foreground"
      >
        {rotuloFamilia(familia)}
      </Link>
      <ChevronRight className="size-3.5" />
      <span className="line-clamp-1 text-foreground">{nome}</span>
    </nav>
  )
}

// Spec chips are fully attribute-driven: whatever keys the product carries
// (that don't vary within its group) render as compact label/value pills.
function SpecChips({ atributos }: { atributos: Array<Atributo> }) {
  return (
    <dl className="flex flex-wrap gap-2">
      {atributos.map((a) => (
        <div
          key={a.chave}
          className="flex items-baseline gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-sm shadow-sm"
        >
          <dt className="text-xs text-muted-foreground">
            {rotuloChave(a.chave)}
          </dt>
          <dd className="font-semibold">{rotuloValor(a.valor)}</dd>
        </div>
      ))}
    </dl>
  )
}

function QuoteCta({
  ativo,
  varianteLabel,
}: {
  ativo: Detalhe
  varianteLabel: string
}) {
  const { adicionar, abrir, obter } = useOrcamento()
  const [quantidade, setQuantidade] = useState(1)
  const jaNaLista = obter(ativo.ref)

  function handleAdicionar() {
    adicionar(
      {
        ref: ativo.ref,
        nome: ativo.nome,
        marca: ativo.marca,
        familia: ativo.familia,
        variante: varianteLabel || undefined,
        pvpCents: ativo.pvpCents,
        capaUrl: ativo.imagensUrls[0] ?? null,
        capaPdfUrl: ativo.fichasCatalogo[0]?.url ?? null,
      },
      quantidade,
    )
    setQuantidade(1)
    abrir()
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <QuantityStepper
          value={quantidade}
          onChange={setQuantidade}
          className="w-full sm:w-auto"
        />
        {/*
          Taller tap target on phones; regular lg height on sm+. `flex-1`
          only applies on sm+ — in the mobile column layout it would collapse
          the button's height instead of stretching its width.
        */}
        <Button
          size="lg"
          onClick={handleAdicionar}
          className="h-12 px-6 sm:h-10 sm:flex-1"
        >
          {jaNaLista ? (
            <>
              <Check data-icon="inline-start" />
              Adicionar mais ao orçamento
            </>
          ) : (
            <>
              <Plus data-icon="inline-start" />
              Adicionar ao orçamento
            </>
          )}
        </Button>
      </div>
      {jaNaLista ? (
        <p className="text-sm text-muted-foreground">
          Já tem {jaNaLista.quantidade}{" "}
          {jaNaLista.quantidade === 1 ? "unidade" : "unidades"} na lista.{" "}
          <button
            type="button"
            onClick={abrir}
            className="font-medium text-primary underline underline-offset-4"
          >
            Ver lista de orçamento
          </button>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Junte vários equipamentos e peça um orçamento único à nossa equipa
          comercial.
        </p>
      )}
    </div>
  )
}

function FichasCatalogo({
  fichas,
}: {
  fichas: Detalhe["fichasCatalogo"]
}) {
  const varias = fichas.length > 1
  return (
    <div className="flex flex-wrap items-center gap-2">
      {fichas.map((ficha, i) => (
        <a
          key={ficha.pagina}
          href={ficha.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium shadow-sm transition-colors hover:border-primary/40 hover:bg-secondary/50"
        >
          <Download className="size-3.5 text-primary" />
          {varias ? `Ficha PDF ${i + 1}` : "Ficha do catálogo (PDF)"}
        </a>
      ))}
    </div>
  )
}

function ProdutoNaoEncontrado() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-24 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Produto não encontrado
      </h1>
      <p className="text-muted-foreground">
        O produto que procura pode ter sido removido ou ainda não está
        disponível.
      </p>
      <Button
        render={<Link to="/produtos" />}
        nativeButton={false}
        className="mt-2"
      >
        <ArrowLeft data-icon="inline-start" />
        Voltar ao catálogo
      </Button>
    </div>
  )
}

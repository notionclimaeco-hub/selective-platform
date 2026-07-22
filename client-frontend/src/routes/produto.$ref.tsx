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
import { VariantSelector } from "@/components/produto/variant-selector"
import { QuantityStepper } from "@/components/orcamento/quantity-stepper"
import { useOrcamento } from "@/components/orcamento/orcamento-store"
import { eurExato, rotuloCategoria, rotuloMarca } from "@/lib/catalogo"

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
  const precoDesdeCents =
    variantes.length > 0
      ? Math.min(...variantes.map((v) => v.pvpCents))
      : undefined

  return (
    <ProdutoLayout
      base={base}
      ativo={ativo}
      variantes={variantes}
      selectedRef={selectedRef}
      onSelect={setSelectedRef}
      precoDesdeCents={precoDesdeCents}
    />
  )
}

type Variante = {
  ref: string
  variante?: string
  capacidadeKw?: number
  classeEnergetica?: string
  refrigerante?: string
  pvpCents: number
}

function ProdutoLayout({
  base,
  ativo,
  variantes,
  selectedRef,
  onSelect,
  precoDesdeCents,
}: {
  base: Detalhe
  ativo: Detalhe
  variantes?: Array<Variante>
  selectedRef?: string
  onSelect?: (ref: string) => void
  precoDesdeCents?: number
}) {
  const temVariantes = variantes !== undefined && variantes.length > 1

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <Breadcrumb categoria={base.categoria} nome={base.nome} />
      </div>

      {/*
        Grid places (desktop): gallery top-left, buy box spanning the right
        column, description bottom-left (beside the variant table). DOM order is
        gallery -> buy box -> description, so mobile stacks sensibly
        (image, then title/price/models, then description).
      */}
      <div className="mx-auto grid max-w-6xl gap-x-14 gap-y-10 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:py-10">
        <div className="lg:col-start-1 lg:row-start-1">
          <ProductGallery
            categoria={base.categoria}
            imagens={ativo.imagensUrls}
          />
        </div>

        <div className="flex flex-col gap-6 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-[0.15em] text-primary">
              {rotuloMarca(base.marca)}
              {base.gama ? ` · ${base.gama}` : ""}
            </p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {base.nome}
            </h1>
            <p className="text-sm text-muted-foreground">Ref.: {ativo.ref}</p>
          </div>

          <div className="flex flex-col gap-1 border-y py-5">
            <span className="text-3xl font-semibold text-primary">
              {eurExato.format(ativo.pvpCents / 100)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                s/IVA
              </span>
            </span>
            {temVariantes && precoDesdeCents !== undefined && (
              <span className="text-sm text-muted-foreground">
                A partir de {eurExato.format(precoDesdeCents / 100)} ·{" "}
                {variantes!.length} modelos disponíveis
              </span>
            )}
          </div>

          {temVariantes && selectedRef && onSelect ? (
            <VariantSelector
              variantes={variantes!}
              selectedRef={selectedRef}
              onSelect={onSelect}
            />
          ) : (
            // Standalone products have no variant table, so the specs live here.
            <SpecChips ativo={ativo} categoria={base.categoria} />
          )}

          <QuoteCta ativo={ativo} />
        </div>

        {(ativo.descricao || ativo.fichasCatalogo.length > 0) && (
          <div className="lg:col-start-1 lg:row-start-2">
            <p className="text-sm font-medium uppercase tracking-[0.15em] text-primary">
              Descrição
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              Sobre este equipamento
            </h2>
            {ativo.descricao && (
              <div className="mt-4">
                <Markdown>{ativo.descricao}</Markdown>
              </div>
            )}
            {ativo.fichasCatalogo.length > 0 && (
              <FichasCatalogo fichas={ativo.fichasCatalogo} />
            )}
          </div>
        )}
      </div>
    </>
  )
}

function Breadcrumb({ categoria, nome }: { categoria: string; nome: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <Link to="/" className="transition-colors hover:text-foreground">
        Início
      </Link>
      <ChevronRight className="size-3.5" />
      <Link
        to="/"
        hash="produtos"
        className="transition-colors hover:text-foreground"
      >
        {rotuloCategoria(categoria)}
      </Link>
      <ChevronRight className="size-3.5" />
      <span className="line-clamp-1 text-foreground">{nome}</span>
    </nav>
  )
}

function SpecChips({
  ativo,
  categoria,
}: {
  ativo: Detalhe
  categoria: string
}) {
  const chips: Array<{ rotulo: string; valor: string }> = [
    { rotulo: "Categoria", valor: rotuloCategoria(categoria) },
  ]
  if (ativo.capacidadeKw !== undefined) {
    chips.push({
      rotulo: "Capacidade",
      valor: `${ativo.capacidadeKw.toLocaleString("pt-PT")} kW`,
    })
  }
  if (ativo.classeEnergetica) {
    chips.push({ rotulo: "Classe energética", valor: ativo.classeEnergetica })
  }
  if (ativo.refrigerante) {
    chips.push({ rotulo: "Refrigerante", valor: ativo.refrigerante })
  }

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-2">
      {chips.map((chip) => (
        <div
          key={chip.rotulo}
          className="rounded-xl border bg-card px-4 py-3"
        >
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {chip.rotulo}
          </dt>
          <dd className="mt-0.5 font-semibold">{chip.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

function QuoteCta({ ativo }: { ativo: Detalhe }) {
  const { adicionar, abrir, obter } = useOrcamento()
  const [quantidade, setQuantidade] = useState(1)
  const jaNaLista = obter(ativo.ref)

  function handleAdicionar() {
    adicionar(
      {
        ref: ativo.ref,
        nome: ativo.nome,
        marca: ativo.marca,
        categoria: ativo.categoria,
        variante: ativo.variante,
        pvpCents: ativo.pvpCents,
      },
      quantidade,
    )
    setQuantidade(1)
    abrir()
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <QuantityStepper value={quantidade} onChange={setQuantidade} />
        <Button size="lg" onClick={handleAdicionar} className="flex-1 px-6">
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
    <div className="mt-5 flex flex-wrap items-center gap-2">
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
        render={<a href="/#produtos" />}
        nativeButton={false}
        className="mt-2"
      >
        <ArrowLeft data-icon="inline-start" />
        Voltar ao catálogo
      </Button>
    </div>
  )
}

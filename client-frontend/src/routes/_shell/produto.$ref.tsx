import { useEffect, useRef, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query"
import type { FunctionReturnType } from "convex/server"
import { ArrowLeft, ChevronRight, FileText } from "lucide-react"

import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Markdown } from "@/components/produto/markdown"
import { ProductGallery } from "@/components/produto/product-gallery"
import {
  VariantTable,
  atributosComuns,
  rotuloChave,
  rotuloValor,
  rotuloVariante,
} from "@/components/produto/variant-table"
import type { Atributo, Variante } from "@/components/produto/variant-table"
import { useOrcamento } from "@/components/orcamento/orcamento-store"
import type { ItemOrcamento } from "@/components/orcamento/orcamento-store"
import { ControloQuantidade } from "@/components/produto/controlo-quantidade"
import { eurExato, rotuloFamilia, rotuloMarca } from "@/lib/catalogo"
import { cn } from "@/lib/utils"
import { useMapaPrecosPorRef } from "@/lib/precos-revenda"

export const Route = createFileRoute("/_shell/produto/$ref")({
  component: ProdutoPage,
})

type Detalhe = NonNullable<FunctionReturnType<typeof api.produtos.obterPorRef>>
/** A model of the group, with its own photos when it has any. */
type VarianteGrupo = Variante & { imagensUrls?: Array<string> }

function ProdutoPage() {
  const { ref } = Route.useParams()
  const { data: base } = useSuspenseQuery(
    convexQuery(api.produtos.obterPorRef, { ref })
  )

  return (
    <>
      {base === null ? (
        <ProdutoNaoEncontrado />
      ) : (
        // Keyed by ref: moving to another product starts a fresh visit (no
        // "Ver orçamento" callout until something is added there).
        <ProdutoConteudo key={ref} base={base} routeRef={ref} />
      )}
    </>
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
    convexQuery(api.produtos.obterGrupo, { grupoModelo })
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

// Spec chips under the title stay short; the full list sits further down.
const MAX_CHIPS = 4

function ProdutoLayout({
  base,
  ativo,
  variantes,
  selectedRef,
  onSelect,
}: {
  base: Detalhe
  ativo: Detalhe
  variantes?: Array<VarianteGrupo>
  selectedRef?: string
  onSelect?: (ref: string) => void
}) {
  const temVariantes = variantes !== undefined && variantes.length > 1
  const overlay = useMapaPrecosPorRef([
    ativo.ref,
    ...(variantes ?? []).map((v) => v.ref),
  ])
  const revendaAtivo = overlay?.get(ativo.ref)

  // Shared attributes describe the product (chips + spec list); the keys that
  // vary across the group become the model picker's columns.
  const especificacoes = temVariantes
    ? atributosComuns(variantes)
    : ativo.atributos
  const orcamento = useOrcamentoDaVisita()

  // A group's model as a quote-list line: the page title plus the values that
  // tell it apart from its siblings, priced at PVP (reseller prices are
  // never stored client-side).
  function itemDe(v: VarianteGrupo): ItemNovo {
    return {
      ref: v.ref,
      nome: base.nomeGrupo,
      marca: base.marca,
      familia: base.familia,
      variante: rotuloVariante(v, variantes ?? []) || undefined,
      pvpCents: v.pvpCents,
      capaUrl: v.imagensUrls?.at(0) ?? ativo.imagensUrls.at(0) ?? null,
      capaPdfUrl: ativo.fichasCatalogo[0]?.url ?? null,
    }
  }
  const porRef = new Map((variantes ?? []).map((v) => [v.ref, v]))

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl px-4 pt-4 pb-12 sm:px-6 lg:pt-6",
        // Room for the floating "Ver orçamento" pill under the last row.
        orcamento.mostrarAviso &&
          "pb-[calc(var(--altura-aviso)+var(--folga-fundo)+1rem)]"
      )}
    >
      <Breadcrumb familia={base.familia} nome={base.nomeGrupo} />

      {/*
        One grid, read in source order on phones. Desktop: gallery | buy box,
        then the model picker across the full width (it can have many
        columns), then description | specifications.
      */}
      <div className="mt-4 grid items-start gap-x-12 gap-y-8 lg:mt-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="min-w-0">
          <ProductGallery
            familia={base.familia}
            imagens={ativo.imagensUrls}
            pdfCapaUrl={ativo.fichasCatalogo[0]?.url ?? null}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:pt-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {rotuloMarca(base.marca)}
              {base.gama ? ` · ${base.gama}` : ""}
            </p>
            {/* Page title is nomeGrupo (no capacity); capacity lives in the
                variant rows / SKU `nome` used by the quote list. */}
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {base.nomeGrupo}
            </h1>
            {especificacoes.length > 0 && (
              <SpecChips atributos={especificacoes.slice(0, MAX_CHIPS)} />
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-y py-4">
            <PrecoAtivo pvpCents={ativo.pvpCents} revendaCents={revendaAtivo} />
            <div className="flex flex-wrap items-center gap-2">
              {temVariantes && (
                <span className="text-sm text-muted-foreground">
                  Ref.{" "}
                  <span className="font-medium text-foreground">
                    {ativo.ref}
                  </span>
                </span>
              )}
              {ativo.fichasCatalogo.length > 0 && (
                <FichasCatalogo fichas={ativo.fichasCatalogo} />
              )}
              {!temVariantes &&
                orcamento.controlo({
                  ref: ativo.ref,
                  nome: ativo.nome,
                  marca: ativo.marca,
                  familia: ativo.familia,
                  pvpCents: ativo.pvpCents,
                  capaUrl: ativo.imagensUrls[0] ?? null,
                  capaPdfUrl: ativo.fichasCatalogo[0]?.url ?? null,
                })}
            </div>
          </div>
        </div>

        {temVariantes && selectedRef && onSelect && (
          <section className="min-w-0 lg:col-span-2">
            <h2 className="text-sm font-semibold">
              Modelos{" "}
              <span className="font-normal text-muted-foreground tabular-nums">
                {variantes.length}
              </span>
            </h2>
            <div className="mt-2.5">
              <VariantTable
                variantes={variantes}
                selectedRef={selectedRef}
                onSelect={onSelect}
                precosRevenda={overlay}
                accao={(v) => {
                  const variante = porRef.get(v.ref)
                  if (!variante) return null
                  return orcamento.controlo(itemDe(variante), () =>
                    onSelect(v.ref)
                  )
                }}
              />
            </div>
          </section>
        )}

        {ativo.descricao && (
          <section className="min-w-0">
            <h2 className="text-sm font-semibold">Descrição</h2>
            <div className="mt-2.5">
              <Recolhivel>
                <Markdown>{ativo.descricao}</Markdown>
              </Recolhivel>
            </div>
          </section>
        )}

        {especificacoes.length > MAX_CHIPS && (
          <section className="min-w-0">
            <h2 className="text-sm font-semibold">Especificações</h2>
            <ListaEspecificacoes atributos={especificacoes} />
          </section>
        )}
      </div>

      <AvisoOrcamento
        aberto={orcamento.mostrarAviso}
        totalItens={orcamento.totalItens}
      />
    </div>
  )
}

function Breadcrumb({ familia, nome }: { familia: string; nome: string }) {
  return (
    <nav
      aria-label="Localização"
      className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
    >
      <Link
        to="/produtos"
        className="shrink-0 transition-colors hover:text-foreground"
      >
        Catálogo
      </Link>
      <ChevronRight className="size-3.5 shrink-0" />
      <Link
        to="/produtos"
        search={{ familia: familia }}
        className="shrink-0 transition-colors hover:text-foreground"
      >
        {rotuloFamilia(familia)}
      </Link>
      <ChevronRight className="hidden size-3.5 shrink-0 sm:block" />
      <span className="hidden truncate text-foreground sm:block">{nome}</span>
    </nav>
  )
}

/**
 * The selected model's price. PVP for everyone; approved members see their
 * reseller price first and, when it is lower, the PVP struck through under
 * it.
 */
function PrecoAtivo({
  pvpCents,
  revendaCents,
}: {
  pvpCents: number
  revendaCents: number | undefined
}) {
  if (revendaCents === undefined) {
    return (
      <p className="flex items-baseline gap-1.5 tabular-nums">
        <span className="text-3xl font-semibold tracking-tight">
          {eurExato.format(pvpCents / 100)}
        </span>
        <span className="text-sm text-muted-foreground">PVP s/IVA</span>
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-0.5 tabular-nums">
      <p className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-primary">
          {eurExato.format(revendaCents / 100)}
        </span>
        <span className="text-sm text-muted-foreground">Revenda s/IVA</span>
      </p>
      {revendaCents < pvpCents && (
        <p className="text-sm text-muted-foreground">
          PVP <s>{eurExato.format(pvpCents / 100)}</s>
        </p>
      )}
    </div>
  )
}

// Short spec chips under the title: label/value pills.
function SpecChips({ atributos }: { atributos: Array<Atributo> }) {
  return (
    <dl className="mt-1 flex flex-wrap gap-1.5">
      {atributos.map((a) => (
        <div
          key={a.chave}
          className="flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-[13px]"
        >
          <dt className="text-muted-foreground">{rotuloChave(a.chave)}</dt>
          <dd className="font-medium">{rotuloValor(a.valor)}</dd>
        </div>
      ))}
    </dl>
  )
}

// Every shared attribute, label left / value right.
function ListaEspecificacoes({ atributos }: { atributos: Array<Atributo> }) {
  return (
    <dl className="mt-2.5 divide-y rounded-xl border text-sm">
      {atributos.map((a) => (
        <div
          key={a.chave}
          className="flex items-baseline justify-between gap-4 px-3.5 py-2.5"
        >
          <dt className="text-muted-foreground">{rotuloChave(a.chave)}</dt>
          <dd className="text-right font-medium">{rotuloValor(a.valor)}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Clamps its content on phones behind a "Ver mais" toggle; shows everything
 * from `lg` up. The toggle only appears when the content actually overflows.
 */
function Recolhivel({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const [transborda, setTransborda] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = caixa.current
    if (!el || aberto) return
    const medir = () => setTransborda(el.scrollHeight > el.clientHeight + 1)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [aberto])

  return (
    <div>
      <div
        ref={caixa}
        className={cn(
          "relative",
          !aberto &&
            "max-h-36 overflow-hidden lg:max-h-none lg:overflow-visible"
        )}
      >
        {children}
        {!aberto && transborda && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background lg:hidden" />
        )}
      </div>
      {transborda && (
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="mt-2 text-sm font-medium text-primary lg:hidden"
        >
          {aberto ? "Ver menos" : "Ver mais"}
        </button>
      )}
    </div>
  )
}

type ItemNovo = Omit<ItemOrcamento, "quantidade">

/**
 * The quote list as this product page uses it: one `ControloQuantidade` per
 * model, writing straight to the list, and whether to show the
 * "Ver orçamento" callout. The callout belongs to this visit: it appears
 * after the first add here and is gone when the visitor comes back to the
 * page (they came back to add more, not to leave).
 */
function useOrcamentoDaVisita() {
  const { adicionar, definirQuantidade, remover, obter, totalItens } =
    useOrcamento()
  const [adicionouNestaVisita, setAdicionouNestaVisita] = useState(false)

  function controlo(item: ItemNovo, aoAdicionar?: () => void) {
    return (
      <ControloQuantidade
        quantidade={obter(item.ref)?.quantidade ?? 0}
        rotulo={item.ref}
        onAdicionar={() => {
          adicionar(item, 1)
          setAdicionouNestaVisita(true)
          aoAdicionar?.()
        }}
        onDefinir={(quantidade) => definirQuantidade(item.ref, quantidade)}
        onRemover={() => remover(item.ref)}
      />
    )
  }

  return {
    controlo,
    totalItens,
    mostrarAviso: adicionouNestaVisita && totalItens > 0,
  }
}

/**
 * Floating "Ver orçamento · N" pill, bottom centre, above the phone tab bar.
 * It rises in when opened and sinks out when closed (list emptied): it stays
 * mounted, showing the last count, until the exit animation ends. Reduced
 * motion skips both. `data-aviso-orcamento` lifts toasts over it
 * (styles.css).
 */
function AvisoOrcamento({
  aberto,
  totalItens,
}: {
  aberto: boolean
  totalItens: number
}) {
  const [montado, setMontado] = useState(aberto)
  const [contagem, setContagem] = useState(totalItens)
  // Adjust during render (not in an effect) so the opening frame is already
  // mounted and the count never flashes "· 0" on the way out.
  if (aberto && !montado) setMontado(true)
  if (totalItens > 0 && totalItens !== contagem) setContagem(totalItens)

  if (!montado) return null

  return (
    <div
      data-aviso-orcamento
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--barra-fundo)+var(--folga-fundo)+1rem)] z-30 flex justify-center px-4"
    >
      <Link
        to="/orcamento"
        data-state={aberto ? "open" : "closed"}
        inert={!aberto}
        onAnimationEnd={() => {
          if (!aberto) setMontado(false)
        }}
        className="pointer-events-auto inline-flex h-12 max-w-full items-center gap-2.5 rounded-full bg-foreground pr-5 pl-4 text-[15px] font-medium text-background shadow-lg duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=closed]:fill-mode-forwards data-[state=closed]:fade-out data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-bottom-4 motion-reduce:animate-none data-[state=closed]:motion-reduce:hidden"
      >
        <FileText className="size-4.5 shrink-0" />
        <span className="truncate">Ver orçamento</span>
        <span className="tabular-nums opacity-70">· {contagem}</span>
      </Link>
    </div>
  )
}

function FichasCatalogo({ fichas }: { fichas: Detalhe["fichasCatalogo"] }) {
  const varias = fichas.length > 1
  return (
    <>
      {fichas.map((ficha, i) => (
        <a
          key={ficha.pagina}
          href={ficha.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors hover:border-foreground/25"
        >
          <FileText className="size-3.5 text-muted-foreground" />
          {varias ? `Ficha ${i + 1}` : "Ficha PDF"}
        </a>
      ))}
    </>
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

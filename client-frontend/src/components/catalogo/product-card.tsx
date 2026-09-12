import { Link } from "@tanstack/react-router"
import type { FunctionReturnType } from "convex/server"

import type { api } from "@convex/_generated/api"
import {
  eur,
  iconeFamilia,
  rotuloFamilia,
  rotuloMarca,
  rotuloTipoUnidade,
} from "@/lib/catalogo"
import { cn } from "@/lib/utils"

/** One catalog entry as returned by `api.catalogo.listar`. */
export type CatalogProduct = FunctionReturnType<
  typeof api.catalogo.listar
>["entradas"][number]

const kw = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 })

/** "2,5 kW" for a single capacity, "2,5 – 7,1 kW" for a range. */
export function faixaKw(entrada: CatalogProduct): string | undefined {
  const { frioKwMin, frioKwMax } = entrada
  if (frioKwMin === undefined || frioKwMax === undefined) return undefined
  return frioKwMin === frioKwMax
    ? `${kw.format(frioKwMin)} kW`
    : `${kw.format(frioKwMin)} – ${kw.format(frioKwMax)} kW`
}

/**
 * One product in the grid. The whole card is the link; the visual weight goes
 * to the photo and the price, everything else is quiet metadata.
 *
 * Responsive shape: on phones (< sm) the card is a horizontal row — square
 * photo on the left, text on the right — so the list is one card per row and
 * every title fits without truncation. From `sm` up it becomes the vertical
 * tile used in the multi-column grid.
 */
export function ProductCard({
  entrada,
  mostrarFamilia = true,
  precoRevendaCents,
}: {
  entrada: CatalogProduct
  /** Hide the family tag when the whole grid is already one family. */
  mostrarFamilia?: boolean
  /** Approved installers see their reseller "desde" price instead of PVP. */
  precoRevendaCents?: number
}) {
  const especificacoes = [
    faixaKw(entrada),
    entrada.tipoUnidade ? rotuloTipoUnidade(entrada.tipoUnidade) : undefined,
  ].filter((s): s is string => s !== undefined)

  const revenda = precoRevendaCents !== undefined
  const preco = revenda ? precoRevendaCents : entrada.precoDesdeCents

  const especificacao = especificacoes.join(" · ")
  const variantes =
    entrada.numVariantes > 1 ? `${entrada.numVariantes} modelos` : undefined

  return (
    <Link
      to="/produto/$ref"
      params={{ ref: entrada.ref }}
      className="group flex min-w-0 overflow-hidden rounded-xl border border-primary/10 bg-card transition-[border-color,box-shadow,transform] duration-200 outline-none hover:border-primary/35 hover:shadow-[0_8px_24px_-12px_color-mix(in_oklch,var(--primary),transparent_55%)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 sm:flex-col sm:hover:-translate-y-0.5"
    >
      <CardMedia entrada={entrada} mostrarFamilia={mostrarFamilia} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3 sm:p-3">
        <p className="truncate text-[11px] font-semibold tracking-wider text-primary/80 uppercase">
          {rotuloMarca(entrada.marca)}
          {entrada.gama ? (
            <span className="font-medium tracking-normal text-muted-foreground normal-case">
              {" "}
              · {entrada.gama}
            </span>
          ) : null}
        </p>
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">
          {entrada.nome}
        </h3>
        {(especificacao || variantes) && (
          <p className="truncate text-xs text-muted-foreground">
            {[especificacao, variantes].filter(Boolean).join(" · ")}
          </p>
        )}

        <p className="mt-auto flex flex-wrap items-baseline gap-x-1 pt-2 text-base font-semibold text-primary tabular-nums">
          {entrada.numVariantes > 1 && (
            <span className="text-[11px] font-normal text-muted-foreground">
              {revenda ? "Revenda desde" : "desde"}
            </span>
          )}
          {entrada.numVariantes <= 1 && revenda && (
            <span className="text-[11px] font-normal text-muted-foreground">
              Revenda
            </span>
          )}
          {eur.format(preco / 100)}
          <span className="text-[10px] font-normal text-muted-foreground">
            s/IVA
          </span>
        </p>
      </div>
    </Link>
  )
}

/**
 * Photo area with the brand's gentle green wash: a diagonal accent→leaf
 * gradient and a soft glow behind the product, so white appliances read as
 * "ours" instead of floating on grey.
 */
function CardMedia({
  entrada,
  mostrarFamilia,
}: {
  entrada: CatalogProduct
  mostrarFamilia: boolean
}) {
  const Icon = iconeFamilia(entrada.familia)
  return (
    <div className="relative isolate w-28 shrink-0 self-stretch overflow-hidden bg-gradient-to-br from-accent/80 via-secondary to-brand/10 min-[400px]:w-32 sm:aspect-[4/3] sm:w-auto sm:self-auto">
      <div
        aria-hidden
        className="absolute inset-x-[20%] top-[25%] -z-10 aspect-square rounded-full bg-brand/15 opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
      />
      {entrada.capaUrl ? (
        <img
          src={entrada.capaUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-contain p-2.5 transition-transform duration-300 ease-out group-hover:scale-[1.05] sm:static sm:p-4"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1.5 text-primary/50">
          <Icon className="size-8 sm:size-9" strokeWidth={1.25} />
          <span className="hidden text-[10px] font-medium sm:block">
            Sem fotografia
          </span>
        </div>
      )}

      {mostrarFamilia && (
        <span className="absolute top-2 left-2 hidden max-w-[70%] truncate rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium text-primary backdrop-blur sm:block">
          {rotuloFamilia(entrada.familia)}
        </span>
      )}
      {entrada.classeEnergetica && (
        <span
          title={`Classe energética ${entrada.classeEnergetica}`}
          className="absolute top-1.5 right-1.5 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm sm:top-2 sm:right-2 sm:text-[11px]"
        >
          {entrada.classeEnergetica}
        </span>
      )}
    </div>
  )
}

export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex overflow-hidden rounded-xl border border-primary/10 bg-card sm:flex-col",
        className
      )}
    >
      <div className="w-28 shrink-0 animate-pulse self-stretch bg-gradient-to-br from-accent/80 via-secondary to-brand/10 min-[400px]:w-32 sm:aspect-[4/3] sm:w-auto" />
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-2/5 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

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
 * One product in the grid: a flat tile (hairline border, darker border on
 * hover, no shadow) with the photo on top and quiet metadata under it. The
 * whole card is the link. Same vertical shape at every width, two to a row on
 * phones.
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
  const detalhe = [
    faixaKw(entrada),
    entrada.numVariantes > 1 ? `${entrada.numVariantes} modelos` : undefined,
  ]
    .filter((s): s is string => s !== undefined)
    .join(" · ")

  return (
    <Link
      to="/produto/$ref"
      params={{ ref: entrada.ref }}
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card transition-colors outline-none hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
    >
      <CardMedia entrada={entrada} mostrarFamilia={mostrarFamilia} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3 sm:p-3.5">
        <p className="truncate text-[11px] font-medium text-muted-foreground">
          {rotuloMarca(entrada.marca)}
          {entrada.tipoUnidade
            ? ` · ${rotuloTipoUnidade(entrada.tipoUnidade)}`
            : ""}
        </p>
        <h3 className="line-clamp-2 text-[13px] leading-snug font-medium sm:text-sm">
          {entrada.nome}
        </h3>
        {detalhe && (
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            {detalhe}
          </p>
        )}
        <div className="mt-auto pt-2.5">
          <PrecoCartao
            desdeCents={entrada.precoDesdeCents}
            revendaCents={precoRevendaCents}
            varios={entrada.numVariantes > 1}
          />
        </div>
      </div>
    </Link>
  )
}

/**
 * "desde 1 685 € s/IVA" at PVP; "Revenda desde …" once the visitor is an
 * approved member. Never a discount or a percentage.
 */
export function PrecoCartao({
  desdeCents,
  revendaCents,
  varios,
}: {
  desdeCents: number
  revendaCents?: number
  varios: boolean
}) {
  const revenda = revendaCents !== undefined
  const prefixo = revenda
    ? varios
      ? "Revenda desde"
      : "Revenda"
    : varios
      ? "desde"
      : undefined
  return (
    <p className="flex flex-wrap items-baseline gap-x-1 text-[15px] font-semibold tabular-nums">
      {prefixo && (
        <span
          className={cn(
            "text-[11px] font-medium",
            // "Revenda desde" takes its own line on a two-up phone card.
            revenda
              ? "basis-full text-primary sm:basis-auto"
              : "text-muted-foreground"
          )}
        >
          {prefixo}
        </span>
      )}
      {eur.format((revendaCents ?? desdeCents) / 100)}
      <span className="text-[10px] font-normal text-muted-foreground">
        s/IVA
      </span>
    </p>
  )
}

/**
 * Photo tile: a flat light-grey plate so the white appliance cut-outs read on
 * the page, with the family tag and the best energy class in the corners.
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
    <div className="relative aspect-square overflow-hidden border-b bg-secondary/60 sm:aspect-[4/3]">
      {entrada.capaUrl ? (
        <img
          src={entrada.capaUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-contain p-3 mix-blend-multiply transition-transform duration-300 ease-out group-hover:scale-[1.03] sm:p-5"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground/60">
          <Icon className="size-8 sm:size-9" strokeWidth={1.25} />
        </div>
      )}

      {mostrarFamilia && (
        <span className="absolute top-2 left-2 hidden max-w-[70%] truncate rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:block">
          {rotuloFamilia(entrada.familia)}
        </span>
      )}
      {entrada.classeEnergetica && (
        <span
          title={`Classe energética ${entrada.classeEnergetica}`}
          className="absolute top-2 right-2 rounded-md bg-primary px-1.5 py-0.5 text-[10px] leading-4 font-semibold text-primary-foreground sm:text-[11px]"
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
        "flex flex-col overflow-hidden rounded-2xl border bg-card",
        className
      )}
    >
      <div className="aspect-square animate-pulse border-b bg-secondary sm:aspect-[4/3]" />
      <div className="flex flex-col gap-1.5 p-3 sm:p-3.5">
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-2/5 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

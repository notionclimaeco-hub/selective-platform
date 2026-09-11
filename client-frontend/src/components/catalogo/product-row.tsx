import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

import {
  eur,
  rotuloFamilia,
  rotuloMarca,
  rotuloTipoUnidade,
} from "@/lib/catalogo"
import { CardMedia, SpecChip, faixaKw } from "./product-card"
import type { CatalogProduct } from "./product-card"

/**
 * List-view row: same data as the card but wide, so specs and price line up
 * across results and are easy to compare — which is what the list view is for.
 */
export function ProductRow({ entrada }: { entrada: CatalogProduct }) {
  const capacidade = faixaKw(entrada)

  return (
    <Link
      to="/produto/$ref"
      params={{ ref: entrada.ref }}
      className="group flex gap-4 overflow-hidden rounded-xl border bg-card p-3 transition-all hover:border-foreground/25 sm:gap-5 sm:p-4"
    >
      <CardMedia
        familia={entrada.familia}
        capaUrl={entrada.capaUrl}
        capaPdfUrl={entrada.capaPdfUrl}
        nome={entrada.nome}
        classeEnergetica={entrada.classeEnergetica}
        mostrarFamilia={false}
        className="h-28 w-28 shrink-0 rounded-xl sm:h-32 sm:w-40"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {rotuloMarca(entrada.marca)}
          {entrada.gama ? ` · ${entrada.gama}` : ""}
        </p>
        <h3 className="truncate leading-snug font-semibold">{entrada.nome}</h3>

        <div className="mt-1 flex flex-wrap gap-1.5">
          <SpecChip>{rotuloFamilia(entrada.familia)}</SpecChip>
          {entrada.tipoUnidade && (
            <SpecChip>{rotuloTipoUnidade(entrada.tipoUnidade)}</SpecChip>
          )}
          {capacidade && <SpecChip>{capacidade}</SpecChip>}
          {entrada.numVariantes > 1 && (
            <SpecChip>{entrada.numVariantes} modelos</SpecChip>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-2 text-right">
        <div>
          <span className="block text-xs text-muted-foreground">desde</span>
          <span className="text-lg font-semibold text-primary">
            {eur.format(entrada.precoDesdeCents / 100)}
          </span>
          <span className="block text-xs text-muted-foreground">s/IVA</span>
        </div>
        <span className="hidden items-center gap-1 text-sm font-medium text-primary sm:inline-flex">
          Ver
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}

export function ProductRowSkeleton() {
  return (
    <div className="h-36 animate-pulse rounded-xl border bg-secondary/60" />
  )
}

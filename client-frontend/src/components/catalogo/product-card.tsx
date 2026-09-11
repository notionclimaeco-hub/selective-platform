import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

import {
  eur,
  iconeFamilia,
  rotuloFamilia,
  rotuloMarca,
  rotuloTipoUnidade,
} from "@/lib/catalogo"
import { cn } from "@/lib/utils"

export type CatalogProduct = {
  grupoModelo: string
  ref: string
  nome: string
  marca: string
  familia: string
  gama?: string
  tipoUnidade?: string
  precoDesdeCents: number
  capaUrl: string | null
  capaPdfUrl: string | null
  numVariantes: number
  frioKwMin?: number
  frioKwMax?: number
  classeEnergetica?: string
}

const kw = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 })

/** "2,5 kW" for a single capacity, "2,5 – 7,1 kW" for a range. */
export function faixaKw(entrada: CatalogProduct): string | undefined {
  const { frioKwMin, frioKwMax } = entrada
  if (frioKwMin === undefined || frioKwMax === undefined) return undefined
  return frioKwMin === frioKwMax
    ? `${kw.format(frioKwMin)} kW`
    : `${kw.format(frioKwMin)} – ${kw.format(frioKwMax)} kW`
}

export function ProductCard({
  entrada,
  mostrarFamilia = true,
}: {
  entrada: CatalogProduct
  /** Hide the family badge when the whole grid is already one family. */
  mostrarFamilia?: boolean
}) {
  const capacidade = faixaKw(entrada)

  return (
    <Link
      to="/produto/$ref"
      params={{ ref: entrada.ref }}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <CardMedia
        familia={entrada.familia}
        capaUrl={entrada.capaUrl}
        capaPdfUrl={entrada.capaPdfUrl}
        nome={entrada.nome}
        classeEnergetica={entrada.classeEnergetica}
        mostrarFamilia={mostrarFamilia}
      />

      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {rotuloMarca(entrada.marca)}
          {entrada.gama ? ` · ${entrada.gama}` : ""}
        </p>
        <h3 className="line-clamp-2 leading-snug font-semibold">
          {entrada.nome}
        </h3>

        {(capacidade || entrada.tipoUnidade) && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {capacidade && <SpecChip>{capacidade}</SpecChip>}
            {entrada.tipoUnidade && (
              <SpecChip>{rotuloTipoUnidade(entrada.tipoUnidade)}</SpecChip>
            )}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {entrada.numVariantes > 1
                ? `desde · ${entrada.numVariantes} modelos`
                : "PVP"}
            </span>
            <span className="text-lg font-semibold text-primary">
              {eur.format(entrada.precoDesdeCents / 100)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                s/IVA
              </span>
            </span>
          </div>
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full border text-primary transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"
          >
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}

export function SpecChip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "rounded-md bg-secondary/70 px-2 py-0.5 text-xs text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  )
}

/** Energy label badge — the strongest buying signal on an HVAC listing. */
export function ClasseBadge({ classe }: { classe: string }) {
  return (
    <span
      title={`Classe energética ${classe}`}
      className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-xs font-semibold text-white shadow-sm"
    >
      {classe}
    </span>
  )
}

export function CardMedia({
  familia,
  capaUrl,
  capaPdfUrl,
  nome,
  classeEnergetica,
  mostrarFamilia = true,
  className,
}: {
  familia: string
  capaUrl: string | null
  capaPdfUrl: string | null
  nome: string
  classeEnergetica?: string
  mostrarFamilia?: boolean
  className?: string
}) {
  const Icon = iconeFamilia(familia)

  return (
    <div
      className={cn(
        "relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-accent via-secondary to-brand/15",
        className
      )}
    >
      {capaUrl ? (
        <img
          src={capaUrl}
          alt={nome}
          loading="lazy"
          className="size-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
        />
      ) : capaPdfUrl ? (
        <iframe
          src={`${capaPdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          title={`Catálogo: ${nome}`}
          className="pointer-events-none absolute inset-0 size-full border-0 bg-white"
          loading="lazy"
        />
      ) : (
        <Icon
          className="size-12 text-primary/50 transition-transform duration-300 group-hover:scale-110"
          strokeWidth={1.5}
        />
      )}
      {mostrarFamilia && (
        <span className="absolute top-3 left-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-primary backdrop-blur">
          {rotuloFamilia(familia)}
        </span>
      )}
      {classeEnergetica && (
        <span className="absolute top-3 right-3">
          <ClasseBadge classe={classeEnergetica} />
        </span>
      )}
    </div>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="h-80 animate-pulse rounded-2xl border bg-secondary/60" />
  )
}

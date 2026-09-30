import { Link } from "@tanstack/react-router"
import { X } from "lucide-react"

import { eurExato, iconeFamilia, rotuloMarca } from "@/lib/catalogo"
import { QuantityStepper } from "./quantity-stepper"
import type { ItemOrcamento } from "./orcamento-store"

/**
 * One quote-list line. Phones stack it: photo, name and remove on top, the
 * quantity pill and the prices underneath. From `sm` it is one row: photo,
 * name, quantity, prices, remove.
 */
export function LinhaOrcamento({
  item,
  unitCents,
  onQuantidade,
  onRemover,
}: {
  item: ItemOrcamento
  /** Reseller price for approved members, PVP otherwise. */
  unitCents: number
  onQuantidade: (quantidade: number) => void
  onRemover: () => void
}) {
  return (
    <li className="grid grid-cols-[4rem_minmax(0,1fr)_auto] gap-x-3 gap-y-3 px-4 py-4 sm:grid-cols-[4rem_minmax(0,1fr)_auto_7.5rem_auto] sm:items-center sm:gap-x-5 sm:px-5">
      <Miniatura item={item} />

      <div className="min-w-0 self-center">
        <Link
          to="/produto/$ref"
          params={{ ref: item.ref }}
          className="line-clamp-2 text-sm leading-snug font-medium transition-colors hover:text-primary"
        >
          {item.nome}
        </Link>
        {item.variante && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {item.variante}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {rotuloMarca(item.marca)} ·{" "}
          <span className="font-medium whitespace-nowrap text-foreground/80">
            {item.ref}
          </span>
        </p>
      </div>

      <button
        type="button"
        onClick={onRemover}
        aria-label={`Remover ${item.ref} do orçamento`}
        className="-mt-1.5 -mr-1.5 flex size-8 items-center justify-center self-start rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/25 sm:order-last sm:m-0 sm:self-center"
      >
        <X className="size-4" />
      </button>

      <div className="col-span-2 col-start-2 flex items-center justify-between gap-3 sm:contents">
        <QuantityStepper
          value={item.quantidade}
          onChange={onQuantidade}
          label={`Quantidade de ${item.ref}`}
        />
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums">
            {eurExato.format((unitCents * item.quantidade) / 100)}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {eurExato.format(unitCents / 100)} / un.
          </p>
        </div>
      </div>
    </li>
  )
}

function Miniatura({ item }: { item: ItemOrcamento }) {
  if (item.capaUrl) {
    return (
      <div className="flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-white">
        <img
          src={item.capaUrl}
          alt=""
          loading="lazy"
          className="size-full object-contain p-1.5"
        />
      </div>
    )
  }
  const Icone = iconeFamilia(item.familia)
  return (
    <div className="flex size-16 items-center justify-center rounded-lg bg-secondary/60 text-primary">
      <Icone className="size-6" />
    </div>
  )
}

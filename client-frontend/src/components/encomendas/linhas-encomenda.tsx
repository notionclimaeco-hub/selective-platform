import type { EstadoLinha } from "@convex/lib/encomendaEstados"
import { Check, Clock, PackageCheck, Truck } from "lucide-react"

import { eurExato, rotuloMarca } from "@/lib/catalogo"
import { totaisEncomenda } from "@/lib/encomendas"
import { cn } from "@/lib/utils"

export type LinhaVista = {
  ref: string
  marca: string
  nome: string
  qty: number
  precoRevendaCents: number
  estadoLinha?: EstadoLinha
  qtyPorEnviar?: number
  qtyEmTransito?: number
  qtyAguardaRecolha?: number
  qtyFalhada?: number
}

/**
 * The order's lines with per-line status and the VAT summary underneath.
 * Dropped lines stay visible (struck through) so the installer can see what
 * changed since they submitted.
 */
export function LinhasEncomenda({
  linhas,
  totais,
  mostrarEstado = true,
}: {
  linhas: Array<LinhaVista>
  totais: {
    totalRevendaCents: number
    ivaPercent: number
    totalPagamentoCents?: number
  }
  mostrarEstado?: boolean
}) {
  const { subtotal, iva, total, estimado } = totaisEncomenda(totais)
  const activas = linhas.filter((l) => l.estadoLinha !== "retirada")
  const retiradas = linhas.filter((l) => l.estadoLinha === "retirada")

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-baseline justify-between border-b px-5 py-3.5">
        <h2 className="font-semibold">Equipamentos</h2>
        <span className="text-sm text-muted-foreground">
          {activas.length} {activas.length === 1 ? "referência" : "referências"}
        </span>
      </header>

      <ul className="divide-y">
        {activas.map((linha) => (
          <Linha key={linha.ref} linha={linha} mostrarEstado={mostrarEstado} />
        ))}
        {retiradas.map((linha) => (
          <Linha key={linha.ref} linha={linha} mostrarEstado={mostrarEstado} />
        ))}
      </ul>

      <dl className="space-y-1.5 border-t bg-secondary/30 px-5 py-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <dt>Subtotal (s/IVA)</dt>
          <dd className="tabular-nums">{eurExato.format(subtotal / 100)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>
            IVA ({totais.ivaPercent}%){estimado ? " · estimado" : ""}
          </dt>
          <dd className="tabular-nums">{eurExato.format(iva / 100)}</dd>
        </div>
        <div className="flex items-baseline justify-between pt-1.5">
          <dt className="font-semibold">Total (c/IVA)</dt>
          <dd className="text-lg font-semibold text-primary tabular-nums">
            {eurExato.format(total / 100)}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function Linha({
  linha,
  mostrarEstado,
}: {
  linha: LinhaVista
  mostrarEstado: boolean
}) {
  const retirada = linha.estadoLinha === "retirada"
  const progresso = progressoLinha(linha)

  return (
    <li
      className={cn(
        "flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        retirada && "bg-muted/30",
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-medium leading-snug",
            retirada && "text-muted-foreground line-through",
          )}
        >
          {linha.nome}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {rotuloMarca(linha.marca)} · {linha.ref}
        </p>
        {mostrarEstado && linha.estadoLinha && !progresso && (
          <EstadoLinhaPill estado={linha.estadoLinha} />
        )}
        {progresso && <Progresso partes={progresso} />}
      </div>
      <div className="flex items-baseline justify-between gap-4 sm:flex-col sm:items-end sm:gap-0.5">
        <p className="text-sm text-muted-foreground tabular-nums">
          {linha.qty} × {eurExato.format(linha.precoRevendaCents / 100)}
        </p>
        <p
          className={cn(
            "font-semibold tabular-nums",
            retirada && "text-muted-foreground line-through",
          )}
        >
          {eurExato.format((linha.precoRevendaCents * linha.qty) / 100)}
        </p>
      </div>
    </li>
  )
}

function EstadoLinhaPill({ estado }: { estado: EstadoLinha }) {
  if (estado === "retirada") {
    return (
      <p className="mt-1.5 text-xs text-muted-foreground">
        Retirada pelo escritório — não é cobrada.
      </p>
    )
  }
  const confirmada = estado === "confirmada"
  return (
    <span
      className={cn(
        "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        confirmada
          ? "bg-emerald-50 text-emerald-800 ring-emerald-600/20"
          : "bg-amber-50 text-amber-800 ring-amber-600/20",
      )}
    >
      {confirmada ? (
        <Check className="size-3" strokeWidth={3} />
      ) : (
        <Clock className="size-3" />
      )}
      {confirmada ? "Stock confirmado" : "Stock por confirmar"}
    </span>
  )
}

type ParteProgresso = { rotulo: string; qty: number; icon: typeof Truck; tom: string }

/** Post-payment delivery buckets, only when the office has set them. */
function progressoLinha(l: LinhaVista): Array<ParteProgresso> | null {
  if (l.qtyPorEnviar === undefined) return null
  const partes: Array<ParteProgresso> = [
    {
      rotulo: "no armazém",
      qty: l.qtyAguardaRecolha ?? 0,
      icon: PackageCheck,
      tom: "text-emerald-700",
    },
    {
      rotulo: "em trânsito",
      qty: l.qtyEmTransito ?? 0,
      icon: Truck,
      tom: "text-sky-700",
    },
    {
      rotulo: "por enviar",
      qty: l.qtyPorEnviar,
      icon: Clock,
      tom: "text-muted-foreground",
    },
  ]
  if ((l.qtyFalhada ?? 0) > 0) {
    partes.push({
      rotulo: "reembolsado",
      qty: l.qtyFalhada ?? 0,
      icon: Clock,
      tom: "text-destructive",
    })
  }
  return partes.filter((p) => p.qty > 0)
}

function Progresso({ partes }: { partes: Array<ParteProgresso> }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {partes.map(({ rotulo, qty, icon: Icon, tom }) => (
        <li key={rotulo} className={cn("inline-flex items-center gap-1 font-medium", tom)}>
          <Icon className="size-3.5" />
          {qty} {rotulo}
        </li>
      ))}
    </ul>
  )
}

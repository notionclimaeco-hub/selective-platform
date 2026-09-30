import type { EstadoLinha } from "@convex/lib/encomendaEstados"
import { Check, Clock, PackageCheck, Truck } from "lucide-react"

import { eurExato, rotuloMarca } from "@/lib/catalogo"
import { ESTADO_LINHA_LABELS, totaisEncomenda } from "@/lib/encomendas"
import { cn } from "@/lib/utils"
import { Cartao, Valores } from "./cartao"

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
 * The order's lines with per-line status and the VAT summary underneath:
 * stacked rows on phones, a table from `md`. Dropped lines stay visible
 * (struck through) so the installer can see what changed since submitting.
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
    <Cartao
      titulo="Equipamentos"
      direita={
        <span className="text-muted-foreground">
          {activas.length} {activas.length === 1 ? "referência" : "referências"}
        </span>
      }
      corpo={false}
    >
      <div
        aria-hidden
        className={cn(
          COLUNAS,
          "hidden items-baseline border-b bg-secondary/40 py-2.5 text-xs font-medium text-muted-foreground md:grid"
        )}
      >
        <span>Equipamento</span>
        <span className="text-right">Qtd.</span>
        <span className="text-right">Preço un.</span>
        <span className="text-right">Total</span>
      </div>

      <ul className="divide-y">
        {[...activas, ...retiradas].map((linha) => (
          <Linha key={linha.ref} linha={linha} mostrarEstado={mostrarEstado} />
        ))}
      </ul>

      <div className="border-t bg-secondary/30 px-5 py-4 md:pl-[50%]">
        <Valores
          itens={[
            {
              label: "Subtotal s/IVA",
              valor: (
                <span className="tabular-nums">
                  {eurExato.format(subtotal / 100)}
                </span>
              ),
            },
            {
              label: `IVA ${totais.ivaPercent}%${estimado ? " (estimado)" : ""}`,
              valor: (
                <span className="tabular-nums">
                  {eurExato.format(iva / 100)}
                </span>
              ),
            },
            {
              label: "Total c/IVA",
              valor: (
                <span className="text-base font-semibold text-primary tabular-nums">
                  {eurExato.format(total / 100)}
                </span>
              ),
            },
          ]}
        />
      </div>
    </Cartao>
  )
}

const COLUNAS = "grid-cols-[minmax(0,1fr)_4rem_7.5rem_7.5rem] gap-4 px-5"

function Linha({
  linha,
  mostrarEstado,
}: {
  linha: LinhaVista
  mostrarEstado: boolean
}) {
  const retirada = linha.estadoLinha === "retirada"
  const progresso = progressoLinha(linha)
  const riscado = retirada && "text-muted-foreground line-through"

  return (
    <li
      className={cn(
        COLUNAS,
        "flex flex-col gap-1 py-3.5 md:grid md:items-baseline md:gap-4"
      )}
    >
      <div className="min-w-0">
        <p className={cn("leading-snug font-medium break-words", riscado)}>
          {linha.nome}
        </p>
        <p className="mt-0.5 text-xs break-all text-muted-foreground">
          {rotuloMarca(linha.marca)} · {linha.ref}
        </p>
        {progresso ? (
          <Progresso partes={progresso} />
        ) : (
          mostrarEstado &&
          linha.estadoLinha && <EstadoLinhaPill estado={linha.estadoLinha} />
        )}
      </div>

      {/* Phones: "2 × 450,00 €" left, line total right. */}
      <div className="mt-1 flex items-baseline justify-between gap-4 text-sm md:hidden">
        <span className="text-muted-foreground tabular-nums">
          {linha.qty} × {eurExato.format(linha.precoRevendaCents / 100)}
        </span>
        <span className={cn("font-semibold tabular-nums", riscado)}>
          {eurExato.format((linha.precoRevendaCents * linha.qty) / 100)}
        </span>
      </div>

      <span className="hidden text-right text-sm tabular-nums md:block">
        {linha.qty}
      </span>
      <span className="hidden text-right text-sm text-muted-foreground tabular-nums md:block">
        {eurExato.format(linha.precoRevendaCents / 100)}
      </span>
      <span
        className={cn(
          "hidden text-right text-sm font-semibold tabular-nums md:block",
          riscado
        )}
      >
        {eurExato.format((linha.precoRevendaCents * linha.qty) / 100)}
      </span>
    </li>
  )
}

function EstadoLinhaPill({ estado }: { estado: EstadoLinha }) {
  if (estado === "retirada") {
    return (
      <p className="mt-1.5 text-xs text-muted-foreground">
        Retirada pelo escritório
      </p>
    )
  }
  const confirmada = estado === "confirmada"
  return (
    <p
      className={cn(
        "mt-1.5 inline-flex items-center gap-1 text-xs font-medium",
        confirmada ? "text-primary" : "text-muted-foreground"
      )}
    >
      {confirmada ? (
        <Check className="size-3.5" strokeWidth={2.5} />
      ) : (
        <Clock className="size-3.5" />
      )}
      {ESTADO_LINHA_LABELS[estado]}
    </p>
  )
}

type ParteProgresso = {
  rotulo: string
  qty: number
  icon: typeof Truck
  tom: string
}

/** Post-payment delivery buckets, only when the office has set them. */
function progressoLinha(l: LinhaVista): Array<ParteProgresso> | null {
  if (l.qtyPorEnviar === undefined) return null
  const partes: Array<ParteProgresso> = [
    {
      rotulo: "no armazém",
      qty: l.qtyAguardaRecolha ?? 0,
      icon: PackageCheck,
      tom: "text-primary",
    },
    {
      rotulo: "em trânsito",
      qty: l.qtyEmTransito ?? 0,
      icon: Truck,
      tom: "text-foreground",
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
        <li
          key={rotulo}
          className={cn("inline-flex items-center gap-1 font-medium", tom)}
        >
          <Icon className="size-3.5" />
          {qty} {rotulo}
        </li>
      ))}
    </ul>
  )
}

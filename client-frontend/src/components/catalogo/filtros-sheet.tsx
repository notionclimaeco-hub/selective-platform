import { useState } from "react"
import { Check, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ORDENACOES } from "@/lib/catalogo"
import type { Ordenacao } from "@/lib/catalogo"
import { cn } from "@/lib/utils"
import { Chip } from "./filter-chips"
import type { Opcao } from "./filter-chips"

const numero = new Intl.NumberFormat("pt-PT")

/**
 * Phone-only "Filtros" button and its bottom sheet: sort, families and brands
 * in one place. Every tap applies at once (the grid behind updates live);
 * the footer button just closes with the resulting count.
 */
export function FiltrosSheet({
  familias,
  marcas,
  familia,
  marca,
  ordenar,
  total,
  numAtivos,
  onFamilia,
  onMarca,
  onOrdenar,
  onLimpar,
}: {
  familias: Array<Opcao>
  marcas: Array<Opcao>
  familia: string | undefined
  marca: string | undefined
  ordenar: Ordenacao
  total: number | undefined
  /** Family, brand and a non-default sort. */
  numAtivos: number
  onFamilia: (familia: string | undefined) => void
  onMarca: (marca: string | undefined) => void
  onOrdenar: (ordenar: Ordenacao) => void
  onLimpar: () => void
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25",
              numAtivos > 0
                ? "border-foreground/30 bg-secondary"
                : "bg-background hover:border-foreground/25"
            )}
          />
        }
      >
        <SlidersHorizontal className="size-3.5" />
        Filtros
        {numAtivos > 0 && (
          <span className="flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
            {numAtivos}
          </span>
        )}
      </SheetTrigger>

      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[85svh] gap-0 rounded-t-2xl p-0"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <SheetTitle className="text-base font-semibold">Filtros</SheetTitle>
          <SheetDescription className="sr-only">
            Ordenação, família e marca do catálogo
          </SheetDescription>
          {numAtivos > 0 && (
            <button
              type="button"
              onClick={onLimpar}
              className="text-sm font-medium text-primary"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
          <Grupo titulo="Ordenar">
            <div role="radiogroup" aria-label="Ordenar" className="-mx-1">
              {ORDENACOES.map((o) => {
                const ativo = o.valor === ordenar
                return (
                  <button
                    key={o.valor}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => onOrdenar(o.valor)}
                    className="flex h-10 w-full items-center justify-between rounded-lg px-1 text-left text-[15px]"
                  >
                    <span className={cn(ativo && "font-medium")}>
                      {o.rotulo}
                    </span>
                    {ativo && <Check className="size-4 text-primary" />}
                  </button>
                )
              })}
            </div>
          </Grupo>

          <Grupo titulo="Família">
            <Escolhas
              opcoes={familias}
              escolhida={familia}
              onEscolher={onFamilia}
            />
          </Grupo>

          <Grupo titulo="Marca">
            <Escolhas opcoes={marcas} escolhida={marca} onEscolher={onMarca} />
          </Grupo>
        </div>

        <div className="shrink-0 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            size="lg"
            className="h-11 w-full"
            onClick={() => setAberto(false)}
          >
            {total === undefined
              ? "Ver produtos"
              : `Ver ${numero.format(total)} ${total === 1 ? "produto" : "produtos"}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Grupo({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-xs font-medium text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  )
}

function Escolhas({
  opcoes,
  escolhida,
  onEscolher,
}: {
  opcoes: Array<Opcao>
  escolhida: string | undefined
  onEscolher: (valor: string | undefined) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => (
        <Chip
          key={o.valor}
          ativo={o.valor === escolhida}
          contagem={o.contagem}
          onClick={() =>
            onEscolher(o.valor === escolhida ? undefined : o.valor)
          }
        >
          {o.rotulo}
        </Chip>
      ))}
    </div>
  )
}

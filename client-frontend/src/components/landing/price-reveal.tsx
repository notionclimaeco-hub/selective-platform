import { Suspense } from "react"
import { convexQuery } from "@convex-dev/react-query"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Check, Loader2, LockOpen } from "lucide-react"

import { api } from "@convex/_generated/api"
import type { CatalogProduct } from "@/components/catalogo/product-card"
import { eur, iconeFamilia, rotuloMarca } from "@/lib/catalogo"
import { cn } from "@/lib/utils"
import { useInView, useSequencia } from "./reveal"

// Reseller discounts are per brand and per tier and only visible to approved
// companies, so the landing page uses illustrative percentages.
const DESCONTOS_ILUSTRATIVOS = [18, 22, 25]

/**
 * Three real catalog cards showing list prices. When the stage scrolls into
 * view a sign-in chip appears, then each card flips to reveal the reseller
 * price — the pitch in one motion: table price → sign in → distributor price.
 */
export function PriceReveal() {
  return (
    <Suspense fallback={<Palco produtos={null} />}>
      <PalcoComDados />
    </Suspense>
  )
}

function PalcoComDados() {
  // Same arguments as the showcase below, so both share one cached query.
  const { data } = useSuspenseQuery(
    convexQuery(api.produtos.listarCatalogo, { pagina: 0, porPagina: 8 })
  )
  const comFoto = data.entradas.filter((p) => p.capaUrl)
  const produtos = (comFoto.length >= 3 ? comFoto : data.entradas).slice(0, 3)
  return <Palco produtos={produtos} />
}

function Palco({ produtos }: { produtos: Array<CatalogProduct> | null }) {
  // The trigger is a sentinel under the cards: only once the visitor has
  // scrolled far enough to see the whole cards does the sequence start, so the
  // list prices are what you see first and the flip is always watched.
  const { ref, visivel } = useInView<HTMLParagraphElement>("0px 0px -8% 0px", 0)
  // 0: list prices · 1: signing in · 2: signed in, cards flip
  const fase = useSequencia(visivel && produtos !== null, [600, 1300])

  return (
    <div className="relative">
      <div className="mb-5 flex h-9 justify-center">
        <div
          className={cn(
            "surge inline-flex items-center gap-2 rounded-full border bg-background py-1.5 pr-3.5 pl-2.5 text-xs font-medium shadow-xs",
            fase >= 2 ? "text-foreground" : "text-muted-foreground"
          )}
          data-on={fase >= 1}
          aria-live="polite"
        >
          {fase >= 2 ? (
            <>
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" strokeWidth={3} />
              </span>
              Sessão iniciada · Empresa aprovada
              <span className="mx-0.5 hidden h-3 w-px bg-border sm:inline" />
              <span className="hidden text-primary sm:inline">
                Preços de distribuidor ativos
              </span>
            </>
          ) : (
            <>
              <Loader2 className="size-3.5 animate-spin" />A iniciar sessão…
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
        {(produtos ?? [null, null, null]).map((p, i) => (
          <CartaoFlip
            key={p?.grupoModelo ?? i}
            produto={p}
            desconto={DESCONTOS_ILUSTRATIVOS[i] ?? 20}
            virado={fase >= 2}
            atraso={i * 140}
            className={i === 2 ? "hidden sm:block" : undefined}
          />
        ))}
      </div>

      <p
        ref={ref}
        className="mt-4 text-center text-[11px] text-muted-foreground"
      >
        Descontos ilustrativos. O preço de distribuidor depende da marca e do
        escalão da sua empresa.
      </p>
    </div>
  )
}

function CartaoFlip({
  produto,
  desconto,
  virado,
  atraso,
  className,
}: {
  produto: CatalogProduct | null
  desconto: number
  virado: boolean
  atraso: number
  className?: string
}) {
  const pvp = produto ? produto.precoDesdeCents / 100 : 0
  const revenda = Math.round(pvp * (1 - desconto / 100))
  const Icon = produto ? iconeFamilia(produto.familia) : null

  return (
    <div
      className={cn("flip", className)}
      data-flipped={virado ? "true" : "false"}
      style={{ "--delay": `${atraso}ms` } as React.CSSProperties}
    >
      <div className="flip-inner">
        {/* Front: list price */}
        <div className="flip-face flex flex-col overflow-hidden rounded-xl border bg-card">
          <Media produto={produto} Icon={Icon} />
          <div className="flex flex-1 flex-col gap-1 p-3.5 sm:p-4">
            <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {produto ? rotuloMarca(produto.marca) : "\u00a0"}
            </p>
            <p className="line-clamp-2 min-h-[2.5rem] text-sm leading-snug font-semibold">
              {produto?.nome ?? "\u00a0"}
            </p>
            <div className="mt-2 border-t pt-3">
              <p className="text-[11px] text-muted-foreground">
                Preço de tabela
              </p>
              <p className="text-lg font-semibold">
                {produto ? eur.format(pvp) : "—"}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  s/IVA
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Back: reseller price */}
        <div className="flip-face flip-back flex flex-col overflow-hidden rounded-xl border border-primary/40 bg-card">
          <div className="flex items-center justify-between gap-2 bg-primary/8 px-3.5 py-2 text-[11px] font-medium text-primary sm:px-4">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <LockOpen className="size-3.5" />
              <span className="sm:hidden">Distribuidor</span>
              <span className="hidden sm:inline">Preço de distribuidor</span>
            </span>
            <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-foreground">
              −{desconto}%
            </span>
          </div>
          <Media produto={produto} Icon={Icon} compacta />
          <div className="flex flex-1 flex-col gap-1 p-3.5 sm:p-4">
            <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {produto ? rotuloMarca(produto.marca) : "\u00a0"}
            </p>
            <p className="line-clamp-1 text-sm leading-snug font-semibold">
              {produto?.nome ?? "\u00a0"}
            </p>
            <div className="mt-auto pt-2">
              <p className="text-xs text-muted-foreground line-through">
                {produto ? eur.format(pvp) : "—"}
              </p>
              <p className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
                {produto ? eur.format(revenda) : "—"}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  s/IVA
                </span>
              </p>
              <p className="mt-3 hidden text-[11px] text-muted-foreground sm:block">
                Poupa {produto ? eur.format(pvp - revenda) : "—"} por unidade
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Media({
  produto,
  Icon,
  compacta = false,
}: {
  produto: CatalogProduct | null
  Icon: ReturnType<typeof iconeFamilia> | null
  compacta?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-muted",
        compacta ? "h-20 sm:h-24" : "h-28 sm:h-36"
      )}
    >
      {produto?.capaUrl ? (
        <img
          src={produto.capaUrl}
          alt=""
          loading="eager"
          className="size-full object-contain p-3"
        />
      ) : Icon ? (
        <Icon className="size-10 text-primary/50" strokeWidth={1.5} />
      ) : (
        <div className="size-full animate-pulse" />
      )}
    </div>
  )
}

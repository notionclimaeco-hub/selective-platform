import { Suspense } from "react"
import { convexQuery } from "@convex-dev/react-query"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Check, Loader2, Lock, LockOpen } from "lucide-react"

import { api } from "@convex/_generated/api"
import type { CatalogProduct } from "@/components/catalogo/product-card"
import { eur, iconeFamilia, rotuloMarca } from "@/lib/catalogo"
import { cn } from "@/lib/utils"
import { useInView, useSequencia } from "./reveal"

// Reseller discounts are per brand and per tier and only visible to approved
// companies, so the landing page uses illustrative percentages.
const DESCONTOS_ILUSTRATIVOS = [18, 22, 25]

/**
 * The proposition as one picture: a fanned stack of real catalog cards at
 * list price → a sign-in node → the same cards, fanned again, at reseller
 * price. When the stage scrolls into view the sign-in node runs, the
 * connectors light up left to right and the discounted cards slide out of
 * the node one by one.
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
  // The trigger is a sentinel under the stage: the sequence only starts once
  // the visitor has scrolled far enough to see the whole picture.
  const { ref, visivel } = useInView<HTMLParagraphElement>("0px 0px -8% 0px", 0)
  // 0: list prices only · 1: signing in · 2: signed in · 3: reseller cards out
  const fase = useSequencia(visivel && produtos !== null, [500, 1100, 500])
  const lista = produtos ?? [null, null, null]

  return (
    <div>
      <div className="flex flex-col items-center lg:flex-row lg:justify-center">
        <Pilha
          legenda="Visitante · preço de tabela"
          className={cn(
            "transition-opacity duration-700",
            fase >= 3 && "opacity-60"
          )}
        >
          {lista.map((p, i) => (
            <Cartao key={p?.grupoModelo ?? i} produto={p} indice={i} />
          ))}
        </Pilha>

        <Ligacao ativa={fase >= 1} />
        <NoLogin fase={fase} />
        <Ligacao ativa={fase >= 2} />

        <Pilha legenda="Empresa aprovada · preço de distribuidor">
          {/* Dashed placeholders hold the shape until the cards arrive. */}
          {lista.map((p, i) => (
            <div
              key={`fantasma-${p?.grupoModelo ?? i}`}
              className={cn(
                "absolute flex items-center justify-center rounded-xl border border-dashed border-foreground/20 transition-opacity duration-500",
                LARGURA,
                ALTURA,
                fase >= 3 && "opacity-0"
              )}
              style={{
                left: `${i * PASSO.x}rem`,
                top: `${i * PASSO.y}rem`,
              }}
            >
              {i === lista.length - 1 && (
                <Lock className="size-5 text-foreground/25" />
              )}
            </div>
          ))}
          {lista.map((p, i) => (
            <Cartao
              key={p?.grupoModelo ?? i}
              produto={p}
              indice={i}
              desconto={DESCONTOS_ILUSTRATIVOS[i] ?? 20}
              visivel={fase >= 3}
            />
          ))}
        </Pilha>
      </div>

      <p
        ref={ref}
        className="mt-6 text-center text-[11px] text-muted-foreground"
      >
        Descontos ilustrativos. O preço de distribuidor depende da marca e do
        escalão da sua empresa.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------- pieces --- */

// Card geometry and the diagonal offset between fanned cards. The stack box
// is sized to the card plus two offsets so nothing overflows or reflows.
const LARGURA = "w-40 sm:w-44"
const ALTURA = "h-[13.5rem] sm:h-[14.5rem]"
const PASSO = { x: 5.5, y: 2.25 } // rem

function Pilha({
  legenda,
  className,
  children,
}: {
  legenda: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Card size + two diagonal offsets (see LARGURA/ALTURA/PASSO). */}
      <div className="relative h-[18rem] w-[21rem] sm:h-[19rem] sm:w-[22rem]">
        {children}
      </div>
      <p className="text-xs font-medium text-muted-foreground">{legenda}</p>
    </div>
  )
}

function Cartao({
  produto,
  indice,
  desconto,
  visivel = true,
}: {
  produto: CatalogProduct | null
  indice: number
  /** Present on the reseller-price side. */
  desconto?: number
  /** Reseller cards stay hidden inside the sign-in node until released. */
  visivel?: boolean
}) {
  const pvp = produto ? produto.precoDesdeCents / 100 : 0
  const revenda = desconto ? Math.round(pvp * (1 - desconto / 100)) : pvp
  const Icon = produto ? iconeFamilia(produto.familia) : null
  const revendedor = desconto !== undefined

  return (
    <div
      className={cn(
        "absolute flex flex-col overflow-hidden rounded-xl border bg-card shadow-[0_18px_40px_-28px_rgb(0_0_0/0.45)] transition-all duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)]",
        LARGURA,
        ALTURA,
        revendedor && "border-primary/40",
        !visivel &&
          "-translate-y-6 opacity-0 lg:translate-x-[-3rem] lg:translate-y-0"
      )}
      style={{
        left: `${indice * PASSO.x}rem`,
        top: `${indice * PASSO.y}rem`,
        zIndex: indice + 1,
        transitionDelay: visivel && revendedor ? `${indice * 160}ms` : "0ms",
      }}
    >
      <div className="relative flex h-24 items-center justify-center bg-muted sm:h-28">
        {produto?.capaUrl ? (
          <img
            src={produto.capaUrl}
            alt=""
            loading="eager"
            className="size-full object-contain p-2.5"
          />
        ) : Icon ? (
          <Icon className="size-8 text-primary/50" strokeWidth={1.5} />
        ) : (
          <div className="size-full animate-pulse" />
        )}
        {revendedor && (
          <span className="absolute top-2 right-2 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
            −{desconto}%
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {produto ? rotuloMarca(produto.marca) : "\u00a0"}
        </p>
        <p className="line-clamp-2 min-h-[2rem] text-xs leading-snug font-semibold">
          {produto?.nome ?? "\u00a0"}
        </p>
        <div className="mt-auto pt-1">
          {revendedor ? (
            <p className="text-[10px] text-muted-foreground line-through">
              {produto ? eur.format(pvp) : "—"}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">Preço de tabela</p>
          )}
          <p
            className={cn(
              "text-base font-semibold",
              revendedor && "text-primary"
            )}
          >
            {produto ? eur.format(revenda) : "—"}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
              s/IVA
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

/** Connector between stack and node; horizontal on desktop, vertical below. */
function Ligacao({ ativa }: { ativa: boolean }) {
  return (
    <div className="relative my-3 h-8 w-px bg-border lg:mx-2 lg:my-0 lg:h-px lg:w-12">
      <div
        className={cn(
          "absolute inset-0 origin-top bg-primary transition-transform duration-700 ease-out lg:origin-left",
          ativa ? "scale-y-100 lg:scale-x-100" : "scale-y-0 lg:scale-x-0"
        )}
      />
    </div>
  )
}

function NoLogin({ fase }: { fase: number }) {
  const iniciado = fase >= 2
  return (
    <div
      className={cn(
        "surge flex w-44 flex-col items-center gap-2 rounded-xl border bg-background px-4 py-4 text-center shadow-xs transition-colors duration-500",
        iniciado && "border-primary/50"
      )}
      data-on
      aria-live="polite"
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-full border transition-colors duration-500",
          iniciado
            ? "border-primary bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {fase === 1 ? (
          <Loader2 className="size-4 animate-spin" />
        ) : iniciado ? (
          <Check className="size-4" strokeWidth={3} />
        ) : (
          <Lock className="size-4" />
        )}
      </span>
      <p className="text-sm font-semibold">
        {fase === 1
          ? "A iniciar sessão…"
          : iniciado
            ? "Sessão iniciada"
            : "Login"}
      </p>
      <p className="flex h-4 items-center gap-1 text-[11px] text-muted-foreground">
        {iniciado ? (
          <>
            <LockOpen className="size-3 text-primary" /> Empresa aprovada
          </>
        ) : (
          "Empresa instaladora"
        )}
      </p>
    </div>
  )
}

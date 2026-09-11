import { Suspense } from "react"
import { Link } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react"

import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { eur, rotuloFamilia, rotuloMarca } from "@/lib/catalogo"
import { cn } from "@/lib/utils"

/**
 * Centered hero on plain white. Copy fades up in a stagger on load, then a
 * framed preview of the real catalog rises in below it and fades into the
 * page — the "here is the product" reveal every good product site opens with.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-16 text-center sm:px-6 md:pt-24">
        <Link
          to="/produtos"
          style={{ "--delay": "0ms" } as React.CSSProperties}
          className="animate-rise group inline-flex items-center gap-1.5 rounded-full border bg-background py-1 pr-2 pl-3 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
        >
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
          Top 5% PME Portugal · Certificação CERTIF
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>

        <h1
          style={{ "--delay": "80ms" } as React.CSSProperties}
          className="animate-rise mt-6 text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl md:leading-[1.02]"
        >
          Distribuição seletiva de climatização para profissionais.
        </h1>

        <p
          style={{ "--delay": "160ms" } as React.CSSProperties}
          className="animate-rise mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg"
        >
          Ar condicionado, bombas de calor, ventiloconvetores e ventilação das
          marcas líderes, com preços de revenda e apoio técnico para
          instaladores e projetistas em Portugal.
        </p>

        <div
          style={{ "--delay": "240ms" } as React.CSSProperties}
          className="animate-rise mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            render={<a href="#contactos" />}
            nativeButton={false}
            variant="outline"
            size="lg"
          >
            Falar com a equipa
          </Button>
          <Button
            render={<Link to="/produtos" />}
            nativeButton={false}
            size="lg"
          >
            Ver catálogo
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>

      <div
        style={{ "--delay": "420ms" } as React.CSSProperties}
        className="animate-rise relative mx-auto mt-14 max-w-5xl px-4 sm:px-6 md:mt-20"
      >
        {/* Soft tinted glow that grounds the preview against the white page. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[32rem] bg-[radial-gradient(ellipse_60%_55%_at_50%_40%,color-mix(in_oklch,var(--primary),transparent_88%),transparent)]"
        />
        <div className="max-h-[340px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)] sm:max-h-[380px] md:max-h-[440px]">
          <Suspense fallback={<MockupFrame />}>
            <MockupCatalogo />
          </Suspense>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------------ */
/* Catalog preview: a browser window showing the real catalog, at a glance. */
/* ------------------------------------------------------------------------ */

function MockupCatalogo() {
  // Same arguments as the showcase below, so both share one cached query.
  const { data } = useSuspenseQuery(
    convexQuery(api.produtos.listarCatalogo, { pagina: 0, porPagina: 8 })
  )
  const produtos = data.entradas.slice(0, 6)
  const marcas = data.facetas.marca.slice(0, 5)
  const familias = data.facetas.familia.slice(0, 4)

  return (
    <MockupFrame>
      <div className="grid md:grid-cols-[11rem_minmax(0,1fr)]">
        {/* Filters column, desktop only. */}
        <aside className="hidden border-r p-4 md:block">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="size-3.5" /> Refinar
          </p>
          <p className="mt-4 text-xs font-medium">Marca</p>
          <ul className="mt-2 space-y-1.5">
            {marcas.map((m, i) => (
              <li
                key={m.valor}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-3.5 rounded-[3px] border",
                      i === 0 && "border-primary bg-primary"
                    )}
                  />
                  <span className="truncate">{rotuloMarca(m.valor)}</span>
                </span>
                <span className="text-muted-foreground">{m.contagem}</span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 flex-1 items-center gap-2 rounded-md border bg-background px-2.5 text-xs text-muted-foreground">
              <Search className="size-3.5" /> Pesquisar por nome, referência,
              gama…
            </div>
          </div>
          <div className="mt-3 flex gap-1.5 overflow-hidden">
            <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-primary-foreground">
              Todos
            </span>
            {familias.map((f) => (
              <span
                key={f.valor}
                className="rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap"
              >
                {rotuloFamilia(f.valor)}
                <span className="ml-1 text-muted-foreground">{f.contagem}</span>
              </span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {produtos.map((p) => (
              <div
                key={p.grupoModelo}
                className="overflow-hidden rounded-lg border bg-card"
              >
                <div className="flex h-20 items-center justify-center bg-muted sm:h-24">
                  {p.capaUrl ? (
                    <img
                      src={p.capaUrl}
                      alt=""
                      loading="eager"
                      className="size-full object-contain p-2"
                    />
                  ) : null}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    {rotuloMarca(p.marca)}
                  </p>
                  <p className="truncate text-xs font-semibold">{p.nome}</p>
                  <p className="mt-1 text-xs font-semibold text-primary">
                    {eur.format(p.precoDesdeCents / 100)}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      s/IVA
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupFrame>
  )
}

/** Browser-window chrome around the preview (also the loading skeleton). */
function MockupFrame({ children }: { children?: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-xl border bg-background shadow-[0_30px_80px_-40px_rgb(0_0_0/0.35)] ring-1 ring-black/[0.03]"
    >
      <div className="flex h-10 items-center gap-3 border-b bg-muted/60 px-4">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </span>
        <span className="mx-auto flex h-6 w-56 items-center justify-center rounded-md border bg-background text-[11px] text-muted-foreground">
          climaeco.pt/produtos
        </span>
        <span className="w-[3.25rem]" />
      </div>
      {children ?? <div className="h-[440px] animate-pulse bg-muted/30" />}
    </div>
  )
}

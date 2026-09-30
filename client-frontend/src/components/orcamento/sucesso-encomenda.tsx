import { useEffect, useRef } from "react"
import { flushSync } from "react-dom"
import { Link } from "@tanstack/react-router"

import type { Id } from "@convex/_generated/dataModel"
import { Pagina } from "@/components/shell/pagina"
import { Button } from "@/components/ui/button"
import { eurExato } from "@/lib/catalogo"

export type Submetida = {
  encomendaId: Id<"installerOrders">
  numero: number
  totalCents: number
}

/**
 * Swap the quote list for the success screen inside a view transition: the
 * list lifts away and the phone bar sinks (styles.css, "Orçamento →
 * Encomenda submetida"), while the success card plays its own entrance.
 * Browsers without view transitions, or reduced motion, swap at once.
 */
export function transitarParaSucesso(mudar: () => void) {
  const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const aplicar = () => {
    mudar()
    window.scrollTo({ top: 0, behavior: "instant" })
  }
  if (reduzido || !("startViewTransition" in document)) {
    aplicar()
    return
  }
  // The transition names only exist while this transition runs, so the
  // list never carries a view-transition-name (and its stacking context).
  const raiz = document.documentElement
  raiz.dataset.transicao = "orcamento"
  const transicao = document.startViewTransition(() => flushSync(aplicar))
  void transicao.finished.finally(() => {
    delete raiz.dataset.transicao
  })
}

/** "Encomenda submetida": the seal pops, the check draws, confetti falls. */
export function SucessoEncomenda({
  encomendaId,
  numero,
  totalCents,
}: Submetida) {
  const selo = useRef<HTMLDivElement>(null)
  useConfetes(selo)

  return (
    <Pagina className="orcamento-sucesso justify-center">
      <section className="sucesso-cartao mx-auto flex w-full max-w-sm flex-col items-center rounded-xl border bg-card px-6 py-8 text-center">
        <div
          ref={selo}
          className="sucesso-selo flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-7"
            aria-hidden
          >
            <path
              pathLength={1}
              className="sucesso-visto"
              d="M5 12.5l4.5 4.5L19 7.5"
            />
          </svg>
        </div>
        <h1
          className="animate-rise mt-4 text-xl font-semibold tracking-tight"
          style={{ "--delay": "300ms" } as React.CSSProperties}
        >
          Encomenda submetida
        </h1>
        <p
          className="animate-rise mt-1 text-sm text-muted-foreground tabular-nums"
          style={{ "--delay": "360ms" } as React.CSSProperties}
        >
          ENC-{numero} · {eurExato.format(totalCents / 100)} s/IVA
        </p>
        <div
          className="animate-rise mt-6 flex w-full flex-col gap-2"
          style={{ "--delay": "420ms" } as React.CSSProperties}
        >
          <Button
            render={<Link to="/encomendas/$id" params={{ id: encomendaId }} />}
            nativeButton={false}
            size="lg"
          >
            Ver encomenda
          </Button>
          <Button
            render={<Link to="/produtos" />}
            nativeButton={false}
            variant="outline"
            size="lg"
          >
            Voltar ao catálogo
          </Button>
        </div>
      </section>
    </Pagina>
  )
}

// Brand greens (styles.css --primary, --brand, --chart-2, --chart-5) plus the
// pale accent, as hex because the canvas does not read oklch tokens.
const CORES = ["#1a662d", "#8cc62e", "#479c4d", "#0d4a22", "#e9f5e0"]

/**
 * One celebration when the success screen mounts: a burst out of the seal
 * as it pops, then two side cannons. `canvas-confetti` is loaded on demand
 * and skips itself under reduced motion.
 */
function useConfetes(origem: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    let cancelado = false
    let limpar = () => {}
    const temporizadores: Array<number> = []

    void import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelado) return
      limpar = () => confetti.reset()
      const base = {
        colors: CORES,
        disableForReducedMotion: true,
        ticks: 260,
        scalar: 0.9,
      }
      const depois = (ms: number, disparar: () => void) =>
        temporizadores.push(window.setTimeout(disparar, ms))

      depois(320, () => {
        const caixa = origem.current?.getBoundingClientRect()
        void confetti({
          ...base,
          particleCount: 90,
          spread: 75,
          startVelocity: 38,
          origin: caixa
            ? {
                x: (caixa.left + caixa.width / 2) / window.innerWidth,
                y: (caixa.top + caixa.height / 2) / window.innerHeight,
              }
            : { x: 0.5, y: 0.4 },
        })
      })
      depois(520, () => {
        void confetti({
          ...base,
          particleCount: 45,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.75 },
        })
        void confetti({
          ...base,
          particleCount: 45,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.75 },
        })
      })
    })

    return () => {
      cancelado = true
      temporizadores.forEach((t) => window.clearTimeout(t))
      limpar()
    }
  }, [origem])
}

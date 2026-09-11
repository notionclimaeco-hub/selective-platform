import { useEffect, useRef, useState } from "react"
import type { ElementType } from "react"

import { cn } from "@/lib/utils"

/**
 * Fires once when the element scrolls into view. Elements already on screen
 * at mount resolve on the first observer tick, so above-the-fold content is
 * never left hidden.
 */
export function useInView<T extends HTMLElement>(
  margem = "0px 0px -10% 0px",
  threshold = 0.15
) {
  const ref = useRef<T>(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || visivel) return
    if (typeof IntersectionObserver === "undefined") {
      setVisivel(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisivel(true)
          io.disconnect()
        }
      },
      { rootMargin: margem, threshold }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [margem, threshold, visivel])

  return { ref, visivel }
}

/**
 * Scroll-reveal wrapper: content starts slightly lower and transparent and
 * settles into place when it enters the viewport. `atraso` staggers siblings.
 * Motion is skipped entirely under `prefers-reduced-motion`.
 */
export function Reveal({
  as: Tag = "div",
  atraso = 0,
  className,
  children,
}: {
  as?: ElementType
  /** Milliseconds; use multiples of ~80ms for a stagger. */
  atraso?: number
  className?: string
  children: React.ReactNode
}) {
  const { ref, visivel } = useInView<HTMLDivElement>()
  return (
    <Tag
      ref={ref}
      data-inview={visivel ? "true" : "false"}
      style={{ "--delay": `${atraso}ms` } as React.CSSProperties}
      className={cn("reveal", className)}
    >
      {children}
    </Tag>
  )
}

/**
 * Steps a small state machine forward once `ativo` turns true: returns the
 * current phase (0 before start), advancing after each delay in `passos`
 * (milliseconds, cumulative from the previous phase). Reduced-motion users
 * jump straight to the final phase.
 */
export function useSequencia(ativo: boolean, passos: Array<number>) {
  const [fase, setFase] = useState(0)

  useEffect(() => {
    if (!ativo) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFase(passos.length)
      return
    }
    const timers: Array<ReturnType<typeof setTimeout>> = []
    let acumulado = 0
    passos.forEach((ms, i) => {
      acumulado += ms
      timers.push(setTimeout(() => setFase(i + 1), acumulado))
    })
    return () => timers.forEach(clearTimeout)
    // `passos` is a literal per call site; only its length matters, so the
    // dependency list keys on that instead of the array identity.
  }, [ativo, passos.length])

  return fase
}

/** Counts from 0 to `ate` once in view, with an ease-out curve. */
export function CountUp({
  ate,
  sufixo = "",
  duracao = 1400,
  className,
}: {
  ate: number
  sufixo?: string
  duracao?: number
  className?: string
}) {
  const { ref, visivel } = useInView<HTMLSpanElement>()
  const [valor, setValor] = useState(0)

  useEffect(() => {
    if (!visivel) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValor(ate)
      return
    }
    let frame = 0
    const inicio = performance.now()
    const tick = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracao)
      const eased = 1 - Math.pow(1 - t, 3)
      setValor(Math.round(ate * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [visivel, ate, duracao])

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {valor.toLocaleString("pt-PT")}
      {sufixo}
    </span>
  )
}

/** Small tinted label that opens a section, e.g. "Catálogo". */
export function Etiqueta({ children }: { children: React.ReactNode }) {
  // Wrapped in a block so it keeps its intrinsic width inside flex columns.
  return (
    <p>
      <span className="inline-flex items-center rounded-md bg-primary/8 px-2 py-0.5 text-xs font-medium text-primary">
        {children}
      </span>
    </p>
  )
}

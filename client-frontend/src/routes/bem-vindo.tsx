import { useEffect, useState } from "react"
import { Show } from "@clerk/tanstack-react-start"
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router"

import { caminhoDeEntrada } from "@/lib/auth-gate"

/** How long the animation plays before the destination opens. */
const DURACAO_MS = 2300
const DURACAO_REDUZIDA_MS = 350

/**
 * Welcome interstitial after signing in or registering: a beat with what we
 * sell before the environment appears. `?para=` is the destination, restricted
 * to the environment and the catalog (`caminhoDeEntrada`). Standalone page, no
 * shell. Reduced-motion users see the finished frame for a moment instead.
 */
export const Route = createFileRoute("/bem-vindo")({
  validateSearch: (search: Record<string, unknown>): { para: string } => ({
    para: caminhoDeEntrada(search.para),
  }),
  component: BemVindoPage,
})

function BemVindoPage() {
  const { para } = Route.useSearch()
  const navigate = useNavigate()
  const [saida, setSaida] = useState(false)

  useEffect(() => {
    const reduzido = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    const total = reduzido ? DURACAO_REDUZIDA_MS : DURACAO_MS
    // Fade the frame out just before leaving so the hand-off reads as one motion.
    const fade = window.setTimeout(
      () => setSaida(true),
      Math.max(total - 250, 0)
    )
    const ir = window.setTimeout(() => {
      // `para` is a vetted literal path; the router's typing wants a route
      // literal, so hand it a string it accepts.
      void navigate({ to: para as "/inicio", replace: true })
    }, total)
    return () => {
      window.clearTimeout(fade)
      window.clearTimeout(ir)
    }
  }, [navigate, para])

  return (
    <div
      className="fundo-auth flex min-h-svh flex-col items-center justify-center px-6 transition-opacity duration-300"
      style={{ opacity: saida ? 0 : 1 }}
    >
      <Show when="signed-out">
        <Navigate to="/entrar" />
      </Show>
      <div className="flex flex-col items-center">
        <Clima />
      </div>
    </div>
  )
}

/**
 * The leaf from the mark draws itself and fills, then the three things an
 * installer buys from us appear around it, each drawn as a line: a snowflake
 * (cooling), a sun (heating) and waves (water). Every path carries
 * `pathLength=1` so one dash rule animates them all; timing lives in
 * `styles.css` under "Welcome interstitial".
 */
function Clima() {
  return (
    <svg
      viewBox="0 0 160 120"
      className="clima h-[120px] w-[160px] sm:h-[144px] sm:w-[192px]"
      role="img"
      aria-label="Climatização: frio, calor e água"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Leaf: outline draws, then the fill fades in. */}
      <g transform="translate(55 30) scale(1.55)">
        <path
          className="clima-folha-preencher"
          d="M3 33C3 15 15 3 33 3c0 18-12 30-30 30Z"
          fill="var(--brand)"
          stroke="none"
        />
        <path
          className="clima-traco clima-folha"
          d="M3 33C3 15 15 3 33 3c0 18-12 30-30 30Z"
          pathLength={1}
          stroke="var(--primary)"
          strokeWidth={1.6}
        />
        <path
          className="clima-traco clima-nervura"
          d="M7 29C12.5 22 19.5 14.5 29 7"
          pathLength={1}
          stroke="var(--primary)"
          strokeWidth={1.8}
        />
      </g>

      {/* Snowflake (cooling), left: three arms through the centre, then a
          pair of branch ticks near each of the six tips. */}
      <g
        className="clima-glifo clima-frio"
        stroke="var(--primary)"
        strokeWidth={2}
      >
        <path
          className="clima-traco"
          pathLength={1}
          d="M26.0 74.0L26.0 46.0 M13.9 67.0L38.1 53.0 M13.9 53.0L38.1 67.0"
        />
        <path
          className="clima-traco"
          pathLength={1}
          d="M26.0 69.5l-3.5 2.0 M26.0 69.5l3.5 2.0 M17.8 64.8l-3.5 -2.0 M17.8 64.8l-0.0 4.0 M17.8 55.2l-0.0 -4.0 M17.8 55.2l-3.5 2.0 M26.0 50.5l3.5 -2.0 M26.0 50.5l-3.5 -2.0 M34.2 55.2l3.5 2.0 M34.2 55.2l-0.0 -4.0 M34.2 64.8l0.0 4.0 M34.2 64.8l3.5 -2.0"
        />
      </g>

      {/* Sun (heating), right: disc then eight rays. */}
      <g
        className="clima-glifo clima-calor"
        stroke="var(--primary)"
        strokeWidth={2}
      >
        <circle className="clima-traco" pathLength={1} cx={134} cy={60} r={7} />
        <path
          className="clima-traco"
          pathLength={1}
          d="M134 46v-4M134 78v-4M120 60h-4M152 60h-4M124.1 50.1l-2.8-2.8M146.7 72.7l-2.8-2.8M124.1 69.9l-2.8 2.8M146.7 47.3l-2.8 2.8"
        />
      </g>

      {/* Waves (water), below. */}
      <g
        className="clima-glifo clima-agua"
        stroke="var(--primary)"
        strokeWidth={2}
      >
        <path
          className="clima-traco"
          pathLength={1}
          d="M56 100c6-6 12-6 18 0s12 6 18 0 12-6 18 0"
        />
        <path
          className="clima-traco"
          pathLength={1}
          d="M62 110c6-6 12-6 18 0s12 6 18 0"
        />
      </g>
    </svg>
  )
}

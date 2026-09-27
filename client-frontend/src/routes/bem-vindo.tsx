import { useEffect, useState } from "react"
import { Show, useUser } from "@clerk/tanstack-react-start"
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router"

import { Wordmark } from "@/components/brand/wordmark"
import { caminhoDeEntrada } from "@/lib/auth-gate"

/** How long the animation plays before the destination opens. */
const DURACAO_MS = 1600
const DURACAO_REDUZIDA_MS = 350

/**
 * Welcome interstitial after signing in or registering: a beat with the brand
 * before the environment appears. `?para=` is the destination, restricted to
 * the environment and the catalog (`caminhoDeEntrada`). Standalone page, no
 * shell. Reduced-motion users see a static frame for a moment instead.
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
  const { user } = useUser()
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

  const nome = user?.firstName?.trim()

  return (
    <div
      className="fundo-auth flex min-h-svh flex-col items-center justify-center px-6 transition-opacity duration-300"
      style={{ opacity: saida ? 0 : 1 }}
      aria-live="polite"
    >
      <Show when="signed-out">
        <Navigate to="/entrar" />
      </Show>
      <div className="entrada-marca flex flex-col items-center">
        <Wordmark className="h-12 sm:h-14" />
        <p
          className="animate-rise mt-6 text-center text-lg font-medium tracking-tight text-foreground"
          style={{ "--delay": "350ms" } as React.CSSProperties}
        >
          {nome ? `Bem-vindo, ${nome}.` : "Bem-vindo."}
        </p>
        <div
          className="animate-rise mt-8 h-px w-40 overflow-hidden rounded-full bg-border"
          style={{ "--delay": "350ms" } as React.CSSProperties}
          role="progressbar"
          aria-label="A abrir a sua área"
        >
          <div className="entrada-barra h-full w-full bg-primary" />
        </div>
      </div>
    </div>
  )
}

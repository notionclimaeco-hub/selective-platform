import { Show, SignIn } from "@clerk/tanstack-react-start"
import { createFileRoute, Navigate } from "@tanstack/react-router"

import { CartaoAuth, PaginaAuth } from "@/components/auth/cartao-auth"
import {
  caminhoSeguroDeRegresso,
  comRegresso,
  viaBemVindo,
} from "@/lib/auth-gate"

/**
 * Sign-in for installer members. `?return=` (a safe environment path, see
 * `caminhoSeguroDeRegresso`) is where the member ends up afterwards, via the
 * `/bem-vindo` animation; `/inicio` otherwise. The same return rides along to `/registo` through
 * Clerk's own "Ainda não tem conta?" footer link (`signUpUrl`).
 */
export const Route = createFileRoute("/_minimal/entrar")({
  validateSearch: (search: Record<string, unknown>): { return?: string } => ({
    return: caminhoSeguroDeRegresso(search.return),
  }),
  component: EntrarPage,
})

function EntrarPage() {
  const { return: regresso } = Route.useSearch()
  // Clerk lands on the welcome interstitial, which then opens the destination.
  const depois = viaBemVindo(regresso ?? "/inicio")

  return (
    <PaginaAuth>
      <Show when="signed-in">
        <Navigate to="/inicio" />
      </Show>
      <Show when="signed-out">
        <CartaoAuth>
          <SignIn
            routing="hash"
            withSignUp={false}
            signUpUrl={comRegresso("/registo", regresso)}
            fallbackRedirectUrl={depois}
            forceRedirectUrl={depois}
          />
        </CartaoAuth>
      </Show>
    </PaginaAuth>
  )
}

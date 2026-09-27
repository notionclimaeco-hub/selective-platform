import { Show, SignIn } from "@clerk/tanstack-react-start"
import { createFileRoute, Link, Navigate } from "@tanstack/react-router"

import {
  CartaoAuth,
  LIGACAO_AUTH,
  LinhaAuth,
  PaginaAuth,
} from "@/components/auth/cartao-auth"
import { caminhoSeguroDeRegresso, comRegresso } from "@/lib/auth-gate"

/**
 * Sign-in for installer members. `?return=` (a safe environment path, see
 * `caminhoSeguroDeRegresso`) is where Clerk sends the member afterwards;
 * `/inicio` otherwise. The same return rides along to `/registo`.
 */
export const Route = createFileRoute("/_minimal/entrar")({
  validateSearch: (search: Record<string, unknown>): { return?: string } => ({
    return: caminhoSeguroDeRegresso(search.return),
  }),
  component: EntrarPage,
})

function EntrarPage() {
  const { return: regresso } = Route.useSearch()
  const depois = regresso ?? "/inicio"

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
        <LinhaAuth>
          Ainda não tem conta?{" "}
          <Link
            to="/registo"
            search={regresso ? { return: regresso } : {}}
            className={LIGACAO_AUTH}
          >
            Registar empresa
          </Link>
        </LinhaAuth>
      </Show>
    </PaginaAuth>
  )
}

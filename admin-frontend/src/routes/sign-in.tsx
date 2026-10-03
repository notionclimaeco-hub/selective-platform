import { Show, SignIn } from "@clerk/tanstack-react-start"
import { createFileRoute, Navigate } from "@tanstack/react-router"

import { CartaoAuth, PaginaAuth } from "@/components/auth/cartao-auth"
import { Wordmark } from "@/components/brand/wordmark"

export const Route = createFileRoute("/sign-in")({ component: SignInPage })

/**
 * Staff sign-in, shaped like the client app's Entrar page: tinted page,
 * wordmark above, Clerk's form inside the one white card. Clerk's look comes
 * from `clerkAppearance` on the provider.
 */
function SignInPage() {
  return (
    <div className="fundo-auth flex min-h-svh flex-col">
      <div className="flex justify-center pt-10 sm:pt-16">
        <Wordmark className="h-8" />
      </div>
      <main className="flex flex-1 flex-col">
        <PaginaAuth>
          <Show when="signed-in">
            <Navigate to="/" />
          </Show>
          <Show when="signed-out">
            <CartaoAuth>
              <SignIn
                routing="hash"
                withSignUp={false}
                fallbackRedirectUrl="/"
                forceRedirectUrl="/"
                // Staff accounts are created by hand: no sign-up link.
                appearance={{
                  elements: { footerAction: { "&&": { display: "none" } } },
                }}
              />
            </CartaoAuth>
          </Show>
        </PaginaAuth>
      </main>
    </div>
  )
}

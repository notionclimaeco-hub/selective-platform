import { Show, SignIn } from "@clerk/tanstack-react-start"
import { createFileRoute, Link, Navigate } from "@tanstack/react-router"

import { caminhoSeguroDeRegresso } from "@/lib/auth-gate"

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
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-12">
      <div className="mb-8 max-w-md text-center">
        <p className="text-sm font-medium text-primary">Área de Cliente</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Aceda aos preços de revenda da sua empresa instaladora.
        </p>
      </div>
      <Show when="signed-in">
        <Navigate to="/inicio" />
      </Show>
      <Show when="signed-out">
        <SignIn
          routing="hash"
          withSignUp={false}
          signUpUrl="/registo"
          fallbackRedirectUrl={depois}
          forceRedirectUrl={depois}
          appearance={{ elements: { footerAction: { display: "none" } } }}
        />
      </Show>
      <p className="mt-6 text-sm text-muted-foreground">
        Ainda sem conta?{" "}
        <Link
          to="/registo"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Registe a sua empresa
        </Link>
      </p>
    </div>
  )
}

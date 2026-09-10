import { Show, SignIn } from "@clerk/tanstack-react-start"
import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/sign-in")({ component: SignInPage })

function SignInPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Show when="signed-in">
        <Navigate to="/" />
      </Show>
      <Show when="signed-out">
        <SignIn
          routing="hash"
          withSignUp={false}
          fallbackRedirectUrl="/"
          forceRedirectUrl="/"
          appearance={{ elements: { footerAction: { display: "none" } } }}
        />
      </Show>
    </main>
  )
}

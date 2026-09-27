import { Link } from "@tanstack/react-router"

import { Wordmark } from "@/components/brand/wordmark"

/**
 * Wordmark-only chrome for the focused pages (Entrar, Registo, payment link):
 * nothing to navigate to, nothing competing with the form.
 */
export function MinimalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-center border-b">
        <Link to="/" aria-label="Início">
          <Wordmark className="h-7" />
        </Link>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}

import { Link } from "@tanstack/react-router"

import { Wordmark } from "@/components/brand/wordmark"
import { LINKS_LEGAIS } from "./nav"

const LINKS_RODAPE = LINKS_LEGAIS.filter(
  (l) => l.href === "/privacidade" || l.href === "/termos"
)

/**
 * Chrome for the focused pages (Entrar, Registo, payment link): the wordmark
 * on top, the page's single card in the middle, and only the legal links
 * underneath. Nothing to navigate to, nothing competing with the form.
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
      <footer className="flex items-center justify-center gap-5 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {LINKS_RODAPE.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {l.label}
          </a>
        ))}
      </footer>
    </div>
  )
}

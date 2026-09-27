import { Link } from "@tanstack/react-router"

import { Wordmark } from "@/components/brand/wordmark"
import { LINKS_LEGAIS } from "./nav"

const LINKS_RODAPE = LINKS_LEGAIS.filter(
  (l) => l.href === "/privacidade" || l.href === "/termos"
)

/**
 * Chrome for the focused pages (Entrar, Registo, payment link), in the shape
 * modern sign-in pages share (T3 Chat, Linear, Resend, Cal.com; see
 * `docs/research/login-page-patterns.md`): no top bar, a tinted page, the
 * mark in a small tile above the content, and only the legal links below.
 */
export function MinimalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fundo-auth flex min-h-svh flex-col">
      <div className="flex justify-center pt-10 sm:pt-16">
        <Link
          to="/"
          aria-label="Início"
          className="flex size-12 items-center justify-center rounded-xl border bg-card shadow-xs transition-colors hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_15%)]"
        >
          <Wordmark variant="mark" className="h-7" />
        </Link>
      </div>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="flex items-center justify-center gap-5 px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
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

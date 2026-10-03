import { cn } from "@/lib/utils"

/**
 * Column for the auth pages: one 400px card, centered, with 16px gutters on
 * phones (the card keeps its border there, like T3 Chat and Cal.com).
 */
export function PaginaAuth({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col px-4 pt-6 pb-8 sm:px-0 sm:pt-8">
      {children}
    </div>
  )
}

/** The single white card: hairline ring, soft lift, 16px radius. */
export function CartaoAuth({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.16)] sm:p-6",
        className
      )}
    >
      {children}
    </section>
  )
}

/** Centered 24px title + muted line at the top of a card step. */
export function TituloAuth({
  titulo,
  children,
}: {
  titulo: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      {children && (
        <p className="mt-1.5 text-sm text-muted-foreground">{children}</p>
      )}
    </div>
  )
}

/** One-line helper inside the card ("Ainda não tem conta? …"). */
export function LinhaAuth({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 text-center text-sm text-muted-foreground">{children}</p>
  )
}

export const LIGACAO_AUTH =
  "font-medium text-primary underline-offset-4 hover:underline"

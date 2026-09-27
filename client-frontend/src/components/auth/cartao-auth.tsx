import { cn } from "@/lib/utils"

/**
 * Column for the auth pages: full width on phones, a 400px column on larger
 * screens. `CartaoAuth` is the single card inside it; on phones it drops the
 * border and padding so the form runs edge to edge inside the page gutter.
 */
export function PaginaAuth({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col px-4 py-8 sm:px-0 sm:py-12">
      {children}
    </div>
  )
}

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
        "flex flex-col sm:rounded-xl sm:border sm:bg-card sm:p-6",
        className
      )}
    >
      {children}
    </section>
  )
}

/** Centered helper line under the card ("Ainda não tem conta? …"). */
export function LinhaAuth({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 text-center text-sm text-muted-foreground">{children}</p>
  )
}

export const LIGACAO_AUTH =
  "font-medium text-primary underline-offset-4 hover:underline"

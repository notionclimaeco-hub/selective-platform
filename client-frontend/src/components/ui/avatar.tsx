import { cn } from "@/lib/utils"
import { iniciais } from "@/lib/iniciais"

/**
 * Photo when the person uploaded one, otherwise their initials on the accent
 * tint. Clerk hands every user a generated purple gradient as `imageUrl`, so
 * the choice keys on `hasImage`, not on the URL. Circle for people, rounded
 * square for companies.
 */
export function Avatar({
  src,
  hasImage,
  nome,
  forma = "circulo",
  className,
}: {
  src?: string | null
  hasImage?: boolean | null
  nome: string | null | undefined
  forma?: "circulo" | "quadrado"
  className?: string
}) {
  const raio = forma === "circulo" ? "rounded-full" : "rounded-md"
  if (hasImage && src) {
    return (
      <img
        src={src}
        alt=""
        className={cn("size-8 shrink-0 object-cover", raio, className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 select-none place-items-center bg-accent text-[0.6875rem] font-semibold tracking-wide text-accent-foreground",
        raio,
        className
      )}
    >
      {iniciais(nome)}
    </span>
  )
}

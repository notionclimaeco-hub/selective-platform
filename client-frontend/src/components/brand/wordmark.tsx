import { cn } from "@/lib/utils"

/**
 * "climaeco PRO" wordmark, drawn from `public/logo-climaeco.png`: a leaf mark
 * in the lime brand green, "clima" in lime, "eco" in forest green, and the
 * subtitle right-aligned under "eco". Colours come from the theme tokens so the
 * mark always matches the UI. `mark` is the leaf alone (phone top bar).
 */
export function Wordmark({
  variant = "full",
  className,
}: {
  variant?: "full" | "mark"
  className?: string
}) {
  if (variant === "mark") {
    return (
      <svg
        viewBox="0 0 36 36"
        role="img"
        aria-label="Climaeco Pro"
        className={cn("h-7 w-auto shrink-0", className)}
      >
        <Folha />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 168 44"
      role="img"
      aria-label="Climaeco Pro"
      className={cn("h-8 w-auto shrink-0", className)}
    >
      <g transform="translate(0 4)">
        <Folha />
      </g>
      <text
        x="40"
        y="30"
        fontFamily="var(--font-sans)"
        fontSize="27"
        fontWeight="700"
        letterSpacing="-0.6"
        textLength="122"
        lengthAdjust="spacingAndGlyphs"
      >
        <tspan fill="var(--brand)">clima</tspan>
        <tspan fill="var(--primary)">eco</tspan>
      </text>
      <text
        x="163"
        y="42"
        textAnchor="end"
        fontFamily="var(--font-sans)"
        fontSize="10.5"
        fontWeight="700"
        letterSpacing="2.6"
        fill="var(--primary)"
      >
        PRO
      </text>
    </svg>
  )
}

/** Leaf mark inside a 36×36 box. Shared by the wordmark and `favicon.svg`. */
function Folha() {
  return (
    <>
      <path d="M3 33C3 15 15 3 33 3c0 18-12 30-30 30Z" fill="var(--brand)" />
      <path
        d="M7 29C12.5 22 19.5 14.5 29 7"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </>
  )
}

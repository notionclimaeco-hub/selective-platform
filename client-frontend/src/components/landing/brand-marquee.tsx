import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"

// Official brand logos default to a single page-matching tone via a CSS mask
// (the SVG provides the shape, `currentColor`/bg-current the color). On hover
// the real full-color logo cross-fades in. Nipon has no SVG yet, so it stays a
// styled wordmark; add `logo` when the asset arrives.
export type Marca = {
  nome: string
  // Catalog `marca` slug — the logo links to the brand's filtered catalog.
  slug: string
  logo?: string
  className?: string
  wordmark?: React.ReactNode
}

export const MARCAS: Array<Marca> = [
  {
    nome: "Mitsubishi Electric",
    slug: "mitsubishi",
    logo: "/brands/mitsubishi.svg",
    className: "h-6 w-44",
  },
  {
    nome: "Daikin",
    slug: "daikin",
    logo: "/brands/daikin.svg",
    className: "h-7 w-40",
  },
  {
    nome: "Nipon",
    slug: "nipon",
    wordmark: (
      <span className="text-2xl font-semibold tracking-tight italic">
        nipon
      </span>
    ),
  },
  {
    nome: "Hisense",
    slug: "hisense",
    logo: "/brands/hisense.svg",
    className: "h-6 w-44",
  },
  {
    nome: "Midea",
    slug: "midea",
    logo: "/brands/midea.svg",
    className: "h-9 w-36",
  },
]

export function LogoMascara({ src, className }: { src: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block bg-current", className)}
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  )
}

function BrandLogo({ marca }: { marca: Marca }) {
  if (!marca.logo) return marca.wordmark

  return (
    <div className={cn("group/logo relative", marca.className)}>
      {/* Default: page-matching monochrome mask. */}
      <LogoMascara
        src={marca.logo}
        className="absolute inset-0 h-full w-full transition-opacity duration-300 group-hover/logo:opacity-0"
      />
      {/* Hover: real full-color logo fades in. */}
      <img
        src={marca.logo}
        alt={marca.nome}
        // Eager: a lazily-loaded image would decode on first hover and flash.
        className="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity duration-300 group-hover/logo:opacity-100"
      />
    </div>
  )
}

export function BrandMarquee() {
  // Two copies of the list; the CSS animation slides exactly one copy's width.
  const itens = [...MARCAS, ...MARCAS]

  return (
    <section id="marcas" className="scroll-mt-20 border-b pb-10 md:pb-12">
      <div className="marquee relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="marquee-track flex w-max items-center">
          {itens.map((marca, i) => {
            const duplicado = i >= MARCAS.length
            return (
              <div
                key={`${marca.nome}-${i}`}
                className="flex w-40 shrink-0 items-center justify-center px-2 text-muted-foreground/70 sm:w-64 sm:px-4"
                aria-hidden={duplicado}
              >
                <Link
                  to="/produtos"
                  search={{ marca: marca.slug }}
                  aria-label={`Ver produtos ${marca.nome}`}
                  // The second copy exists only to make the marquee loop
                  // seamlessly, so keep it out of the tab order.
                  tabIndex={duplicado ? -1 : undefined}
                  className={cn(
                    // Logos keep their desktop geometry and scale down on
                    // phones, where the belt shows about two and a half.
                    "flex scale-75 items-center justify-center rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none sm:scale-100",
                    // Masked logos cross-fade to full color on hover; darkening
                    // the mask at the same time reads as a black flash, so only
                    // the plain wordmark gets the hover tint.
                    !marca.logo && "transition-colors hover:text-foreground"
                  )}
                >
                  <BrandLogo marca={marca} />
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

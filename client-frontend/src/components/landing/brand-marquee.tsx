import { cn } from "@/lib/utils"

// Official brand logos default to a single page-matching tone via a CSS mask
// (the SVG provides the shape, `currentColor`/bg-current the color). On hover
// the real full-color logo cross-fades in. Nipon has no SVG yet, so it stays a
// styled wordmark; add `logo` when the asset arrives.
type Marca = {
  nome: string
  logo?: string
  className?: string
  wordmark?: React.ReactNode
}

const MARCAS: Array<Marca> = [
  {
    nome: "Mitsubishi Electric",
    logo: "/brands/mitsubishi.svg",
    className: "h-6 w-44",
  },
  { nome: "Daikin", logo: "/brands/daikin.svg", className: "h-7 w-40" },
  {
    nome: "Nipon",
    wordmark: (
      <span className="text-2xl font-semibold italic tracking-tight">
        nipon
      </span>
    ),
  },
  { nome: "Hisense", logo: "/brands/hisense.svg", className: "h-6 w-44" },
  { nome: "Midea", logo: "/brands/midea.svg", className: "h-9 w-36" },
]

function LogoMascara({ src, className }: { src: string; className?: string }) {
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
        loading="lazy"
        className="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity duration-300 group-hover/logo:opacity-100"
      />
    </div>
  )
}

export function BrandMarquee() {
  // Two copies of the list; the CSS animation slides exactly one copy's width.
  const itens = [...MARCAS, ...MARCAS]

  return (
    <section id="marcas" className="scroll-mt-20 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Parceiro oficial das marcas líderes
        </p>
      </div>

      <div className="marquee relative mt-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="marquee-track flex w-max items-center">
          {itens.map((marca, i) => (
            <div
              key={`${marca.nome}-${i}`}
              className="flex w-56 shrink-0 items-center justify-center px-4 text-muted-foreground/70 sm:w-64"
              aria-hidden={i >= MARCAS.length}
            >
              <BrandLogo marca={marca} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

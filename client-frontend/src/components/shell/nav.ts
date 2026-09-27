import {
  Building2,
  ClipboardList,
  FileText,
  House,
  LayoutGrid,
} from "lucide-react"

export const EMAIL_GERAL = "geral@climaeco.pt"
export const MAILTO_GERAL = `mailto:${EMAIL_GERAL}`
// Provisional inbox for landing-page enquiries; expected to change.
export const EMAIL_CONTACTO = "selectivedistribui@gmail.com"
export const MAILTO_CONTACTO = `mailto:${EMAIL_CONTACTO}`
export const LIVRO_RECLAMACOES = "https://www.livroreclamacoes.pt/"

/** The five environment destinations, in sidebar / tab-bar order. */
export const NAV_APP = [
  { to: "/inicio", label: "Início", icon: House },
  { to: "/produtos", label: "Catálogo", icon: LayoutGrid },
  { to: "/orcamento", label: "Orçamento", icon: FileText },
  { to: "/encomendas", label: "Encomendas", icon: ClipboardList },
  { to: "/empresa", label: "Empresa", icon: Building2 },
] as const

export type DestinoApp = (typeof NAV_APP)[number]["to"]

/**
 * Which environment item is lit for a pathname. Catálogo also owns the product
 * pages (`/produto/$ref`), which do not share its prefix.
 */
export function destinoActivo(pathname: string): DestinoApp | null {
  if (pathname.startsWith("/produto/")) return "/produtos"
  for (const item of NAV_APP) {
    if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
      return item.to
    }
  }
  return null
}

/**
 * Marketing links that exist only as plain paths until their pages land
 * (Sobre and the legal stubs are ticket work); rendered as `<a href>` rather
 * than typed `<Link>`s so the route tree does not have to know them yet.
 */
export const NAV_MARKETING = [
  { to: "/produtos", label: "Produtos", kind: "route" },
  { href: "/sobre", label: "Sobre", kind: "path" },
] as const

export const LINKS_LEGAIS = [
  { href: "/privacidade", label: "Privacidade" },
  { href: "/termos", label: "Termos" },
  { href: "/cookies", label: "Cookies" },
] as const

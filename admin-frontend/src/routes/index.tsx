import { createFileRoute, Link } from "@tanstack/react-router"
import { Authenticated, AuthLoading } from "convex/react"
import { convexQuery } from "@convex-dev/react-query"
import { useSuspenseQuery } from "@tanstack/react-query"
import { CheckCircle2, Building2, FileText, Images, Import, Package, Percent } from "lucide-react"
import { api } from "@convex/_generated/api"

export const Route = createFileRoute("/")({ component: App })

function HealthCheck() {
  // Query is staff-gated and returns { ok: true }; reaching here means healthy.
  useSuspenseQuery(convexQuery(api.admin.health.get, {}))
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-medium text-brand-foreground">
      <CheckCircle2 className="size-3.5" />
      Backend operacional
    </span>
  )
}

const CARDS = [
  {
    to: "/empresas",
    icon: Building2,
    title: "Empresas",
    desc: "Aprovar, rejeitar ou suspender empresas instaladoras e fixar o tier.",
    cta: "Gerir empresas",
  },
  {
    to: "/comercial",
    icon: Percent,
    title: "Comercial",
    desc: "Tiers e grelha de desconto marca × tier para os preços de revenda.",
    cta: "Gerir comercial",
  },
  {
    to: "/produtos",
    icon: Package,
    title: "Produtos",
    desc: "Gerir imagens dos produtos. Variantes da mesma família partilham as fotografias.",
    cta: "Gerir produtos",
  },
  {
    to: "/paginas-catalogo",
    icon: FileText,
    title: "Páginas do catálogo",
    desc: "Carregar os PDFs de cada página da tabela de preços e associá-los aos produtos.",
    cta: "Gerir páginas",
  },
  {
    to: "/importacoes",
    icon: Import,
    title: "Importações",
    desc: "Rever a extração de uma tabela de preços e aprová-la para o catálogo.",
    cta: "Rever importações",
  },
] as const

function App() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-foreground">
          Administração
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Painel de administração
          </h1>
          <AuthLoading>
            <span className="text-sm text-muted-foreground">
              A verificar sessão…
            </span>
          </AuthLoading>
          <Authenticated>
            <HealthCheck />
          </Authenticated>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Gestão de contas instaladoras e conteúdos da loja Clima Eco
          Selective. Escolhe uma área para começar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-brand/15 text-primary">
              <card.icon className="size-5" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="font-medium">{card.title}</h2>
              <p className="text-sm text-muted-foreground">{card.desc}</p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
              {card.cta}
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Images className="size-3.5" />
        Dica: nas variantes da mesma família, ativa “aplicar ao grupo” para
        partilhar imagens.
      </div>
    </main>
  )
}

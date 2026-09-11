import {
  OrganizationSwitcher,
  Show,
  SignOutButton,
  UserButton,
} from "@clerk/tanstack-react-start"
import { createFileRoute, Link } from "@tanstack/react-router"
import { CheckCircle2 } from "lucide-react"

import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { Button } from "@/components/ui/button"
import { useEmpresaActiva } from "@/lib/empresa-activa"

type ContaSearch = {
  pedido?: "enviado"
}

export const Route = createFileRoute("/conta")({
  validateSearch: (search: Record<string, unknown>): ContaSearch => ({
    pedido: search.pedido === "enviado" ? "enviado" : undefined,
  }),
  component: ContaPage,
})

const ESTADO_COPY: Record<
  string,
  { titulo: string; texto: string; classe: string }
> = {
  pendente: {
    titulo: "Empresa em aprovação",
    texto:
      "A nossa equipa comercial está a analisar o pedido. Até lá, o catálogo mostra o PVP.",
    classe: "bg-amber-100 text-amber-800",
  },
  aprovada: {
    titulo: "Empresa aprovada",
    texto:
      "Já vê os preços de revenda no catálogo e pode submeter encomendas a partir da lista de orçamento.",
    classe: "bg-green-100 text-green-800",
  },
  rejeitada: {
    titulo: "Pedido rejeitado",
    texto:
      "Não há re-candidatura automática. Contacte o escritório se precisar de esclarecimentos.",
    classe: "bg-destructive/10 text-destructive",
  },
  suspensa: {
    titulo: "Conta suspensa",
    texto:
      "Mantém o acesso a esta página, mas os preços de revenda estão bloqueados. Contacte o escritório.",
    classe: "bg-muted text-muted-foreground",
  },
}

function ContaPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
        <Show when="signed-out">
          <p className="text-sm text-muted-foreground">A redirecionar…</p>
        </Show>
        <Show when="signed-in">
          <ContaAutenticada />
        </Show>
      </main>
      <SiteFooter />
    </div>
  )
}

function ContaAutenticada() {
  const { pedido } = Route.useSearch()
  const { vista } = useEmpresaActiva()

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Área de Cliente
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Conta</h1>
        </div>
        <div className="flex items-center gap-3">
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/conta"
          />
          <UserButton />
        </div>
      </div>

      {vista === undefined && (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      )}
      {vista === null && (
        <p className="text-sm text-muted-foreground">Sessão indisponível.</p>
      )}
      {vista?.kind === "sem-org" && <SemEmpresa />}
      {vista?.kind === "sem-empresa" && <Orfao orgId={vista.orgId} />}
      {vista?.kind === "empresa" && (
        <PerfilEmpresa
          empresa={vista.empresa}
          pedidoRecemEnviado={pedido === "enviado"}
        />
      )}
    </>
  )
}

function SemEmpresa() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="font-medium">Ainda sem empresa</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Esta conta ainda não está ligada a uma empresa instaladora. Complete o
        registo para pedirmos a aprovação comercial.
      </p>
      <Button render={<Link to="/registo" />} nativeButton={false} className="mt-4">
        Registar empresa
      </Button>
    </section>
  )
}

function Orfao({ orgId }: { orgId: string }) {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="font-medium">Empresa não encontrada</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        A organização Clerk ({orgId}) não tem um registo correspondente. Contacte
        o escritório.
      </p>
      <p className="mt-4">
        <a
          href="mailto:geral@climaeco.pt"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          geral@climaeco.pt
        </a>
      </p>
    </section>
  )
}

function PerfilEmpresa({
  empresa,
  pedidoRecemEnviado,
}: {
  empresa: {
    clerkOrgId: string
    nomeLegal: string
    nif: string
    morada: string
    email: string
    telefone: string
    certifNumero?: string
    estadoAprovacao: string
    tierNome: string | null
  }
  pedidoRecemEnviado: boolean
}) {
  const estado = ESTADO_COPY[empresa.estadoAprovacao] ?? {
    titulo: empresa.estadoAprovacao,
    texto: "",
    classe: "bg-muted text-muted-foreground",
  }
  const recemPendente =
    pedidoRecemEnviado && empresa.estadoAprovacao === "pendente"

  return (
    <>
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        {recemPendente ? (
          <div className="flex gap-3">
            <CheckCircle2
              className="mt-0.5 size-6 shrink-0 text-primary"
              aria-hidden
            />
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Pedido enviado
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Recebemos o pedido de{" "}
                <span className="font-medium text-foreground">
                  {empresa.nomeLegal}
                </span>{" "}
                (NIF {empresa.nif}). A nossa equipa comercial vai analisar. Até
                haver uma decisão, o catálogo continua a mostrar o PVP.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Não precisa de voltar a submeter. O estado deste pedido fica
                sempre nesta página.
              </p>
            </div>
          </div>
        ) : (
          <>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${estado.classe}`}
            >
              {estado.titulo}
            </span>
            <p className="mt-3 text-sm text-muted-foreground">{estado.texto}</p>
          </>
        )}
        {empresa.estadoAprovacao === "pendente" && !recemPendente && (
          <p className="mt-3 text-sm text-muted-foreground">
            Quando houver uma decisão, o estado nesta página actualiza-se. Até
            lá não é preciso voltar a registar.
          </p>
        )}
      </section>

      <section className="grid gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:grid-cols-2">
        <Campo label="Nome legal" valor={empresa.nomeLegal} />
        <Campo label="NIF" valor={empresa.nif} />
        <Campo label="Morada" valor={empresa.morada} className="sm:col-span-2" />
        <Campo label="Email" valor={empresa.email} />
        <Campo label="Telefone" valor={empresa.telefone} />
        <Campo label="CERTIF" valor={empresa.certifNumero ?? "—"} />
        <Campo
          label="Condições comerciais"
          valor={
            empresa.estadoAprovacao === "aprovada"
              ? empresa.tierNome ?? "Base"
              : "—"
          }
        />
      </section>

      {empresa.estadoAprovacao === "aprovada" && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-6 shadow-sm">
          <div>
            <h2 className="font-medium">Encomendas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe o estado de cada encomenda submetida a partir da lista
              de orçamento.
            </p>
          </div>
          <Button render={<Link to="/conta/encomendas" />} nativeButton={false}>
            Ver encomendas
          </Button>
        </section>
      )}

      <p className="text-sm text-muted-foreground">
        Alterações aos dados da empresa fazem-se através do escritório. A gestão
        de membros usa o menu da organização acima.
      </p>

      <SignOutButton>
        <button className="self-start text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Terminar sessão
        </button>
      </SignOutButton>
    </>
  )
}

function Campo({
  label,
  valor,
  className,
}: {
  label: string
  valor: string
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm break-all">{valor}</p>
    </div>
  )
}

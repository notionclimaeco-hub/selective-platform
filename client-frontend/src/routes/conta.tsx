import { SignOutButton } from "@clerk/tanstack-react-start"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, CheckCircle2, ClipboardList, Search } from "lucide-react"

import {
  AreaCliente,
  Aviso,
  CabecalhoPagina,
} from "@/components/conta/area-cliente"
import { Button } from "@/components/ui/button"
import { useEmpresaActiva } from "@/lib/empresa-activa"
import { cn } from "@/lib/utils"

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
  { titulo: string; texto: string; classe: string; ponto: string }
> = {
  pendente: {
    titulo: "Empresa em aprovação",
    texto:
      "A nossa equipa comercial está a analisar o pedido. Até lá, o catálogo mostra o PVP.",
    classe: "bg-amber-50 text-amber-800 ring-amber-600/20",
    ponto: "bg-amber-500",
  },
  aprovada: {
    titulo: "Empresa aprovada",
    texto:
      "Vê os preços de revenda no catálogo e pode submeter encomendas a partir da lista de orçamento.",
    classe: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
    ponto: "bg-emerald-500",
  },
  rejeitada: {
    titulo: "Pedido rejeitado",
    texto:
      "Não há re-candidatura automática. Contacte o escritório se precisar de esclarecimentos.",
    classe: "bg-destructive/10 text-destructive ring-destructive/20",
    ponto: "bg-destructive",
  },
  suspensa: {
    titulo: "Conta suspensa",
    texto:
      "Mantém o acesso a esta página, mas os preços de revenda estão bloqueados. Contacte o escritório.",
    classe: "bg-muted text-muted-foreground ring-border",
    ponto: "bg-muted-foreground/50",
  },
}

function ContaPage() {
  return (
    <AreaCliente>
      <ContaAutenticada />
    </AreaCliente>
  )
}

function ContaAutenticada() {
  const { pedido } = Route.useSearch()
  const { vista } = useEmpresaActiva()

  return (
    <>
      <CabecalhoPagina
        titulo="A sua empresa"
        descricao="Dados da empresa instaladora, estado da aprovação e condições comerciais."
      />

      {vista === undefined && (
        <div
          className="h-40 animate-pulse rounded-xl border bg-secondary/60"
          aria-busy
        />
      )}
      {vista === null && <Aviso>Sessão indisponível.</Aviso>}
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
    <Aviso
      titulo="Ainda sem empresa"
      accao={
        <Button render={<Link to="/registo" />} nativeButton={false}>
          Registar empresa
        </Button>
      }
    >
      Esta conta ainda não está ligada a uma empresa instaladora. Complete o
      registo para pedirmos a aprovação comercial.
    </Aviso>
  )
}

function Orfao({ orgId }: { orgId: string }) {
  return (
    <Aviso
      titulo="Empresa não encontrada"
      accao={
        <a
          href="mailto:geral@climaeco.pt"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          geral@climaeco.pt
        </a>
      }
    >
      A organização Clerk (<span className="break-all">{orgId}</span>) não tem
      um registo correspondente. Contacte o escritório.
    </Aviso>
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
    classe: "bg-muted text-muted-foreground ring-border",
    ponto: "bg-muted-foreground/50",
  }
  const recemPendente =
    pedidoRecemEnviado && empresa.estadoAprovacao === "pendente"
  const aprovada = empresa.estadoAprovacao === "aprovada"

  return (
    <>
      {recemPendente && (
        <section className="flex gap-3 rounded-xl border border-primary/30 bg-primary/5 p-5">
          <CheckCircle2
            className="mt-0.5 size-6 shrink-0 text-primary"
            aria-hidden
          />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Pedido enviado
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Recebemos o pedido de{" "}
              <span className="font-medium text-foreground">
                {empresa.nomeLegal}
              </span>{" "}
              (NIF {empresa.nif}). A nossa equipa comercial vai analisar. Não
              precisa de voltar a submeter — o estado fica sempre nesta página.
            </p>
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">
              {empresa.nomeLegal}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              NIF {empresa.nif}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset",
              estado.classe
            )}
          >
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", estado.ponto)}
            />
            {estado.titulo}
          </span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{estado.texto}</p>

        <dl className="mt-6 grid gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-2">
          <Campo
            label="Morada"
            valor={empresa.morada}
            className="sm:col-span-2"
          />
          <Campo label="Email" valor={empresa.email} />
          <Campo label="Telefone" valor={empresa.telefone} />
          <Campo label="N.º CERTIF" valor={empresa.certifNumero ?? "—"} />
          <Campo
            label="Condições comerciais"
            valor={aprovada ? (empresa.tierNome ?? "Base") : "Após aprovação"}
          />
        </dl>
        <p className="mt-5 text-xs text-muted-foreground">
          Alterações aos dados fazem-se através do escritório. A gestão de
          membros usa o menu da organização no topo.
        </p>
      </section>

      {aprovada && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Atalho
            to="/conta/encomendas"
            icon={ClipboardList}
            titulo="Encomendas"
            texto="Estado de cada encomenda, pagamentos e levantamentos."
          />
          <Atalho
            to="/produtos"
            icon={Search}
            titulo="Catálogo com preços de revenda"
            texto="Junte equipamentos à lista de orçamento e submeta."
          />
        </div>
      )}

      <SignOutButton>
        <button className="self-start text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Terminar sessão
        </button>
      </SignOutButton>
    </>
  )
}

function Atalho({
  to,
  icon: Icon,
  titulo,
  texto,
}: {
  to: "/conta/encomendas" | "/produtos"
  icon: typeof ClipboardList
  titulo: string
  texto: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 rounded-xl border bg-card p-5 transition-all hover:border-foreground/25"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 font-semibold">
          {titulo}
          <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {texto}
        </span>
      </span>
    </Link>
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
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm break-words">{valor}</dd>
    </div>
  )
}

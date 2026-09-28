import { createFileRoute, Link } from "@tanstack/react-router"
import { Authenticated, useQuery } from "convex/react"

import { api } from "@convex/_generated/api"
import { SeccaoConta } from "@/components/empresa/conta"
import { SeccaoDados } from "@/components/empresa/dados"
import { SeccaoEstado } from "@/components/empresa/estado"
import { SeccaoMembros } from "@/components/empresa/membros"
import { SeccaoNivel } from "@/components/empresa/nivel"
import { NavSeccoes, SECCOES_EMPRESA } from "@/components/empresa/seccao"
import { EMAIL_GERAL, MAILTO_GERAL } from "@/components/shell/nav"
import { Aviso, CabecalhoPagina, Pagina } from "@/components/shell/pagina"
import { Button } from "@/components/ui/button"
import { useEmpresaActiva } from "@/lib/empresa-activa"

type EmpresaSearch = {
  // Carried by the old `/conta?pedido=enviado` redirect after registration.
  pedido?: "enviado"
  // Opens the account editor (user menu › "Configurar conta").
  conta?: true
}

export const Route = createFileRoute("/_shell/empresa")({
  validateSearch: (search: Record<string, unknown>): EmpresaSearch => ({
    pedido: search.pedido === "enviado" ? "enviado" : undefined,
    // Clerk navigates to the literal `?conta=true`; the router may hand it
    // over as a boolean or a string depending on who parsed it.
    conta: String(search.conta) === "true" ? true : undefined,
  }),
  component: EmpresaPage,
})

const TODAS = SECCOES_EMPRESA.map((s) => s.id)

function EmpresaPage() {
  return (
    <Pagina>
      <CabecalhoPagina titulo="Empresa" />
      <Authenticated>
        <Conteudo />
      </Authenticated>
    </Pagina>
  )
}

function Conteudo() {
  const { pedido } = Route.useSearch()
  const { vista, orgActiva, activacaoFalhou } = useEmpresaActiva()
  const resumo = useQuery(
    api.empresas.resumoTier,
    vista?.kind === "empresa" ? {} : "skip"
  )

  if (vista === undefined) {
    return (
      <div
        className="h-40 animate-pulse rounded-xl border bg-secondary/60"
        aria-busy
      />
    )
  }
  if (vista === null) {
    return <Aviso>Sessão indisponível.</Aviso>
  }

  if (vista.kind !== "empresa") {
    return (
      <Disposicao ids={["conta"]}>
        {vista.kind === "sem-org" ? (
          <SemEmpresa />
        ) : (
          <Orfao orgId={vista.orgId} />
        )}
        <SeccaoConta />
      </Disposicao>
    )
  }

  const { empresa } = vista
  return (
    <Disposicao ids={TODAS}>
      {pedido === "enviado" && empresa.estadoAprovacao === "pendente" && (
        <Aviso titulo="Pedido recebido">
          O estado da aprovação fica sempre nesta página.
        </Aviso>
      )}
      <SeccaoEstado estado={empresa.estadoAprovacao} />
      <SeccaoNivel resumo={resumo} estado={empresa.estadoAprovacao} />
      <SeccaoDados empresa={empresa} />
      {activacaoFalhou ? (
        <Aviso titulo="Membros">
          Não foi possível activar a organização da empresa nesta sessão.
        </Aviso>
      ) : (
        <SeccaoMembros pronto={orgActiva} />
      )}
      <SeccaoConta />
    </Disposicao>
  )
}

/** Phones: sections stacked. Desktop (`lg`): sticky section nav on the left. */
function Disposicao({
  ids,
  children,
}: {
  ids: ReadonlyArray<(typeof TODAS)[number]>
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
      <NavSeccoes ids={ids} />
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
    </div>
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
          href={MAILTO_GERAL}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {EMAIL_GERAL}
        </a>
      }
    >
      A organização (<span className="break-all">{orgId}</span>) não tem um
      registo de empresa correspondente. Contacte o escritório.
    </Aviso>
  )
}

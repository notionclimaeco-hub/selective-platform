import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Authenticated, useMutation, useQuery } from "convex/react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { AreaCliente, Aviso } from "@/components/conta/area-cliente"
import { EncomendaDetalhe } from "@/components/encomendas/encomenda-detalhe"
import { Button } from "@/components/ui/button"
import { useEmpresaActiva } from "@/lib/empresa-activa"

export const Route = createFileRoute("/conta_/encomendas_/$id")({
  component: EncomendaPage,
})

function EncomendaPage() {
  const { id } = Route.useParams()

  return (
    <AreaCliente>
      <Authenticated>
        {/* Convex validates the id; a malformed one yields null → "não encontrada". */}
        <Detalhe id={id as Id<"installerOrders">} />
      </Authenticated>
    </AreaCliente>
  )
}

function Detalhe({ id }: { id: Id<"installerOrders"> }) {
  const { vista, orgActiva, activacaoFalhou } = useEmpresaActiva()
  // `obter` returns null without the org in the JWT — don't show "não
  // encontrada" while the active org is still being switched.
  const encomenda = useQuery(
    api.encomendas.obter,
    orgActiva ? { encomendaId: id } : "skip"
  )
  const cancelar = useMutation(api.encomendas.cancelar)
  const [agora] = useState(() => Date.now())
  const [aCancelar, setACancelar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (vista !== undefined && vista?.kind !== "empresa") {
    return (
      <Aviso
        titulo="Ainda sem empresa"
        accao={
          <Button render={<Link to="/registo" />} nativeButton={false}>
            Registar empresa
          </Button>
        }
      >
        Complete o registo da empresa para ver encomendas.
      </Aviso>
    )
  }
  if (!orgActiva && activacaoFalhou) {
    return (
      <Aviso titulo="Empresa não activa nesta sessão">
        Não foi possível activar a organização da empresa. Use o seletor de
        organização no topo da página e tente de novo.
      </Aviso>
    )
  }
  if (encomenda === undefined) return <Esqueleto />
  if (encomenda === null) {
    return (
      <Aviso
        titulo="Encomenda não encontrada"
        accao={
          <Button
            render={<Link to="/conta/encomendas" />}
            nativeButton={false}
            variant="outline"
          >
            Voltar às encomendas
          </Button>
        }
      >
        Esta encomenda não existe ou não pertence à sua empresa.
      </Aviso>
    )
  }

  async function onCancelar() {
    setErro(null)
    setACancelar(true)
    try {
      await cancelar({ encomendaId: id })
    } catch {
      setErro("Não foi possível cancelar a encomenda. Tente novamente.")
    } finally {
      setACancelar(false)
    }
  }

  return (
    <EncomendaDetalhe
      encomenda={encomenda}
      agora={agora}
      onCancelar={() => void onCancelar()}
      aCancelar={aCancelar}
      erro={erro}
    />
  )
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="h-16 w-64 animate-pulse rounded-xl bg-secondary/60" />
      <div className="h-32 animate-pulse rounded-xl border bg-secondary/60" />
      <div className="h-72 animate-pulse rounded-xl border bg-secondary/60" />
    </div>
  )
}

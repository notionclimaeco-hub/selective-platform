import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Authenticated, useMutation, useQuery } from "convex/react"
import { toast } from "sonner"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { Aviso, Pagina } from "@/components/shell/pagina"
import { EncomendaDetalhe } from "@/components/encomendas/encomenda-detalhe"
import { Button } from "@/components/ui/button"
import { useEmpresaActiva } from "@/lib/empresa-activa"

export const Route = createFileRoute("/_shell/encomendas_/$id")({
  component: EncomendaPage,
})

function EncomendaPage() {
  const { id } = Route.useParams()

  return (
    <Pagina>
      <Authenticated>
        {/* Convex validates the id; a malformed one yields null → "não encontrada". */}
        <Detalhe id={id as Id<"installerOrders">} />
      </Authenticated>
    </Pagina>
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
        titulo="Sem empresa"
        accao={
          <Button render={<Link to="/registo" />} nativeButton={false}>
            Registar empresa
          </Button>
        }
      />
    )
  }
  if (!orgActiva && activacaoFalhou) {
    return (
      <Aviso titulo="Empresa não activa nesta sessão">
        Escolha a empresa no seletor de organização e tente de novo.
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
            render={<Link to="/encomendas" />}
            nativeButton={false}
            variant="outline"
          >
            Voltar às encomendas
          </Button>
        }
      />
    )
  }

  async function onCancelar(): Promise<boolean> {
    setErro(null)
    setACancelar(true)
    try {
      const cancelada = await cancelar({ encomendaId: id })
      toast.success(`ENC-${cancelada.numero} cancelada.`)
      return true
    } catch {
      setErro("Não foi possível cancelar. Tente de novo.")
      return false
    } finally {
      setACancelar(false)
    }
  }

  return (
    <EncomendaDetalhe
      encomenda={encomenda}
      agora={agora}
      onCancelar={onCancelar}
      aCancelar={aCancelar}
      erro={erro}
    />
  )
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <div className="h-16 w-56 animate-pulse rounded-xl bg-secondary/60" />
      <div className="h-24 animate-pulse rounded-xl border bg-secondary/60" />
      <div className="h-72 animate-pulse rounded-xl border bg-secondary/60" />
    </div>
  )
}

import { useEffect, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react"
import { ChevronLeft } from "lucide-react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { ConfirmDialog } from "@/components/produtos/confirm-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  ESTADO_APROVACAO_CLASSES,
  ESTADO_APROVACAO_LABELS,
  TRANSICOES_APROVACAO,
  eurosDeCents,
  type EstadoAprovacao,
} from "@/lib/labels"

export const Route = createFileRoute("/empresas_/$empresaId")({
  component: EmpresaDetalhePage,
})

function EmpresaDetalhePage() {
  const { empresaId } = Route.useParams()

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Link
        to="/empresas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Empresas
      </Link>

      <AuthLoading>
        <p className="text-sm text-muted-foreground">A verificar sessão…</p>
      </AuthLoading>
      <Unauthenticated>
        <p className="text-sm text-destructive">
          Sessão não autenticada com o Convex.
        </p>
      </Unauthenticated>
      <Authenticated>
        <Detalhe empresaId={empresaId as Id<"installerCompanies">} />
      </Authenticated>
    </main>
  )
}

function Detalhe({ empresaId }: { empresaId: Id<"installerCompanies"> }) {
  const empresa = useQuery(api.empresas.obter, { empresaId })
  const tiers = useQuery(api.comercial.listarTiers, {})
  const transitar = useMutation(api.empresas.transitar)
  const definirNotas = useMutation(api.empresas.definirNotas)
  const definirPin = useMutation(api.empresas.definirPin)
  const limparPin = useMutation(api.empresas.limparPin)

  const [notas, setNotas] = useState("")
  const [pinEscolhido, setPinEscolhido] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<{
    titulo: string
    descricao: string
    confirmarLabel: string
    variante: "destructive" | "default"
    onConfirmar: () => Promise<void>
  } | null>(null)

  useEffect(() => {
    if (empresa === undefined || empresa === null) return
    setNotas(empresa.notas ?? "")
    setPinEscolhido(empresa.tierPin ?? empresa.tierId ?? "")
  }, [empresa])

  if (empresa === undefined) {
    return <p className="text-sm text-muted-foreground">A carregar…</p>
  }
  if (empresa === null) {
    return (
      <p className="text-sm text-muted-foreground">Empresa não encontrada.</p>
    )
  }

  const transicoes = TRANSICOES_APROVACAO[empresa.estadoAprovacao]
  const tierAtual = tiers?.find((t) => t._id === empresa.tierId)
  const pinAtual = tiers?.find((t) => t._id === empresa.tierPin)
  const nomeLegal = empresa.nomeLegal
  const estadoActual = empresa.estadoAprovacao

  function pedirTransicao(
    para: EstadoAprovacao,
    label: string,
    destructive?: boolean,
  ) {
    setConfirmar({
      titulo: `${label} empresa`,
      descricao:
        para === "aprovada" && estadoActual === "suspensa"
          ? `Repor a aprovação de “${nomeLegal}”? Volta a ver preços de revenda.`
          : para === "aprovada"
            ? `Aprovar “${nomeLegal}”? Passa a ver preços de revenda. Se ainda não tiver tier, é-lhe atribuído o Base.`
            : para === "rejeitada"
              ? `Rejeitar o pedido de “${nomeLegal}”? Não há re-candidatura automática.`
              : `Suspender “${nomeLegal}”? Os membros mantêm o acesso, mas os preços de revenda ficam bloqueados.`,
      confirmarLabel: label,
      variante: destructive ? "destructive" : "default",
      onConfirmar: async () => {
        await transitar({ empresaId, para })
        setConfirmar(null)
      },
    })
  }

  async function gravarNotas() {
    setErro(null)
    try {
      await definirNotas({
        empresaId,
        notas: notas.trim() === "" ? undefined : notas.trim(),
      })
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao gravar notas.")
    }
  }

  async function gravarPin() {
    setErro(null)
    try {
      if (pinEscolhido === "") {
        await limparPin({ empresaId })
      } else {
        await definirPin({
          empresaId,
          tierId: pinEscolhido as Id<"tiers">,
        })
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao gravar o pin.")
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            {empresa.nomeLegal}
          </h1>
          <p className="text-sm text-muted-foreground">NIF {empresa.nif}</p>
        </div>
        <span
          className={cn(
            "self-start rounded-full px-3 py-1 text-xs font-medium",
            ESTADO_APROVACAO_CLASSES[empresa.estadoAprovacao],
          )}
        >
          {ESTADO_APROVACAO_LABELS[empresa.estadoAprovacao]}
        </span>
      </div>

      {erro && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <section className="grid gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:grid-cols-2">
        <Campo label="Morada" valor={empresa.morada} />
        <Campo label="Email" valor={empresa.email} />
        <Campo label="Telefone" valor={empresa.telefone} />
        <Campo
          label="CERTIF"
          valor={empresa.certifNumero ?? "—"}
        />
        <Campo
          label="Registado"
          valor={new Date(empresa.registadoEm).toLocaleString("pt-PT")}
        />
        <Campo
          label="Decidido"
          valor={
            empresa.decididoEm
              ? new Date(empresa.decididoEm).toLocaleString("pt-PT")
              : "—"
          }
        />
        <Campo label="Volume pago" valor={eurosDeCents(empresa.volumeCents)} />
        <Campo
          label="Tier actual"
          valor={
            tierAtual
              ? `${tierAtual.nome}${pinAtual ? " (pin)" : ""}`
              : "—"
          }
        />
        <Campo
          label="Clerk org"
          valor={empresa.clerkOrgId}
          className="sm:col-span-2"
        />
      </section>

      {transicoes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {transicoes.map((t) => (
            <Button
              key={t.para}
              variant={t.destructive ? "destructive" : "default"}
              onClick={() =>
                pedirTransicao(t.para, t.label, t.destructive)
              }
            >
              {t.label}
            </Button>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-medium">Pin de tier</h2>
        <p className="text-sm text-muted-foreground">
          O pin segura a empresa neste tier até o staff o alterar ou limpar.
          Limpar devolve ao tier derivado do volume (hoje, Base).
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Tier</span>
            <select
              className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              value={pinEscolhido}
              onChange={(e) => setPinEscolhido(e.target.value)}
              disabled={!tiers}
            >
              <option value="">Sem pin (volume)</option>
              {(tiers ?? [])
                .filter((t) => t.ativa)
                .map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.nome} · limiar {eurosDeCents(t.limiarCents)}
                  </option>
                ))}
            </select>
          </label>
          <Button variant="outline" onClick={() => void gravarPin()}>
            Guardar pin
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-medium">Notas (só staff)</h2>
        <textarea
          className="min-h-28 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
        <div>
          <Button variant="outline" onClick={() => void gravarNotas()}>
            Guardar notas
          </Button>
        </div>
      </section>

      {confirmar && (
        <ConfirmDialog
          titulo={confirmar.titulo}
          descricao={confirmar.descricao}
          confirmarLabel={confirmar.confirmarLabel}
          variante={confirmar.variante}
          onConfirmar={confirmar.onConfirmar}
          onCancelar={() => setConfirmar(null)}
        />
      )}
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
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm break-all">{valor}</span>
    </div>
  )
}

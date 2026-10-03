import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react"
import { ChevronLeft } from "lucide-react"
import { Seletor } from "@/components/ui/seletor"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { ConfirmDialog } from "@/components/produtos/confirm-dialog"
import { Button } from "@/components/ui/button"
import { CampoEditavel } from "@/components/ui/campo-editavel"
import { CabecalhoEsqueleto, FichaEsqueleto } from "@/components/ui/skeleton"
import {
  Cabecalho,
  Ficha,
  Marcador,
  Seccao,
  campoCls,
} from "@/components/ui/tabela"
import {
  ESTADO_APROVACAO_LABELS,
  ESTADO_APROVACAO_TOM,
  TRANSICOES_APROVACAO,
  dataHora,
  eurosDeCents,
} from "@/lib/labels"
import type { EstadoAprovacao } from "@/lib/labels"

export const Route = createFileRoute("/empresas_/$empresaId")({
  component: EmpresaDetalhePage,
})

function EmpresaDetalhePage() {
  const { empresaId } = Route.useParams()

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
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

const voltar = (
  <Link
    to="/empresas"
    className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
  >
    <ChevronLeft className="size-4" />
    Empresas
  </Link>
)

function Detalhe({ empresaId }: { empresaId: Id<"installerCompanies"> }) {
  const empresa = useQuery(api.empresas.obter, { empresaId })
  const tiers = useQuery(api.comercial.listarTiers, {})
  const transitar = useMutation(api.empresas.transitar)
  const definirNotas = useMutation(api.empresas.definirNotas)
  const definirPin = useMutation(api.empresas.definirPin)
  const limparPin = useMutation(api.empresas.limparPin)

  const [confirmar, setConfirmar] = useState<{
    titulo: string
    descricao: string
    confirmarLabel: string
    variante: "destructive" | "default"
    onConfirmar: () => Promise<void>
  } | null>(null)

  if (empresa === undefined) {
    return (
      <>
        {voltar}
        <CabecalhoEsqueleto />
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Seccao titulo="Empresa">
            <FichaEsqueleto linhas={7} />
          </Seccao>
          <Seccao titulo="Comercial">
            <FichaEsqueleto linhas={3} />
          </Seccao>
        </div>
      </>
    )
  }
  if (empresa === null) {
    return (
      <>
        {voltar}
        <p className="text-sm text-muted-foreground">Empresa não encontrada.</p>
      </>
    )
  }

  const transicoes = TRANSICOES_APROVACAO[empresa.estadoAprovacao]
  const tierAtual = tiers?.find((t) => t._id === empresa.tierId)
  const nomeLegal = empresa.nomeLegal
  const estadoActual = empresa.estadoAprovacao

  function pedirTransicao(
    para: EstadoAprovacao,
    label: string,
    destructive?: boolean
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

  return (
    <>
      <Cabecalho
        voltar={voltar}
        titulo={empresa.nomeLegal}
        meta={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Marcador tom={ESTADO_APROVACAO_TOM[empresa.estadoAprovacao]}>
              {ESTADO_APROVACAO_LABELS[empresa.estadoAprovacao]}
            </Marcador>
            <span>NIF {empresa.nif}</span>
          </span>
        }
      >
        {transicoes.map((t) => (
          <Button
            key={t.para}
            variant={t.destructive ? "destructive" : "default"}
            onClick={() => pedirTransicao(t.para, t.label, t.destructive)}
          >
            {t.label}
          </Button>
        ))}
      </Cabecalho>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Seccao titulo="Empresa">
          <Ficha
            linhas={[
              { rotulo: "Morada", valor: empresa.morada },
              { rotulo: "Email", valor: empresa.email },
              { rotulo: "Telefone", valor: empresa.telefone },
              { rotulo: "CERTIF", valor: empresa.certifNumero ?? "—" },
              { rotulo: "Registada", valor: dataHora(empresa.registadoEm) },
              {
                rotulo: "Decidida",
                valor: empresa.decididoEm ? dataHora(empresa.decididoEm) : "—",
              },
              {
                rotulo: "Clerk org",
                valor: (
                  <span className="text-xs text-muted-foreground">
                    {empresa.clerkOrgId}
                  </span>
                ),
              },
            ]}
          />
        </Seccao>

        <div className="flex flex-col gap-6">
          <Seccao titulo="Comercial">
            <Ficha
              linhas={[
                {
                  rotulo: "Volume pago",
                  valor: eurosDeCents(empresa.volumeCents),
                },
                {
                  rotulo: "Tier actual",
                  valor: tierAtual?.nome ?? "—",
                },
              ]}
            >
              <CampoEditavel
                rotulo="Pin de tier"
                valor={empresa.tierPin ?? ""}
                mensagem="Pin guardado."
                mostrar={(v) =>
                  v === "" ? (
                    <span className="text-muted-foreground">
                      Sem pin (volume)
                    </span>
                  ) : (
                    (tiers?.find((t) => t._id === v)?.nome ?? "…")
                  )
                }
                editor={(v, set) => (
                  <Seletor
                    autoFocus
                    className="flex w-full"
                    value={v}
                    onChange={(e) => set(e.target.value)}
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
                  </Seletor>
                )}
                onGuardar={(v) =>
                  v === ""
                    ? limparPin({ empresaId })
                    : definirPin({ empresaId, tierId: v as Id<"tiers"> })
                }
              />
            </Ficha>
          </Seccao>

          <Seccao titulo="Notas">
            <dl className="text-sm">
              <CampoEditavel
                bloco
                rotulo="Só staff"
                valor={empresa.notas ?? ""}
                mensagem="Notas guardadas."
                mostrar={(v) =>
                  v === "" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="block text-left whitespace-pre-wrap">
                      {v}
                    </span>
                  )
                }
                editor={(v, set) => (
                  <textarea
                    autoFocus
                    className={`${campoCls} h-auto min-h-28 w-full py-2`}
                    value={v}
                    onChange={(e) => set(e.target.value)}
                  />
                )}
                onGuardar={(v) =>
                  definirNotas({
                    empresaId,
                    notas: v.trim() === "" ? undefined : v.trim(),
                  })
                }
              />
            </dl>
          </Seccao>
        </div>
      </div>

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

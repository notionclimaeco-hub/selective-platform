import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useAuth } from "@clerk/tanstack-react-start"
import { useMutation } from "convex/react"
import { FileText, Trash2, X } from "lucide-react"

import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { eurExato, iconeFamilia, rotuloMarca } from "@/lib/catalogo"
import { useEmpresaActiva } from "@/lib/empresa-activa"
import { mensagemErroSubmeter } from "@/lib/encomendas"
import { useMapaPrecosPorRef } from "@/lib/precos-revenda"
import { QuantityStepper } from "./quantity-stepper"
import { useOrcamento, type ItemOrcamento } from "./orcamento-store"

export function OrcamentoDrawer() {
  const { aberto, fechar, itens, totalItens, totalCents, limpar } =
    useOrcamento()
  const overlay = useMapaPrecosPorRef(itens.map((i) => i.ref))
  const totalVista = overlay
    ? itens.reduce(
        (acc, i) => acc + (overlay.get(i.ref) ?? i.pvpCents) * i.quantidade,
        0,
      )
    : totalCents

  return (
    <div
      className={`fixed inset-0 z-[60] ${aberto ? "" : "pointer-events-none"}`}
      aria-hidden={!aberto}
    >
      <div
        onClick={fechar}
        className={`absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 ${
          aberto ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-label="Lista de orçamento"
        aria-modal={aberto}
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-background shadow-2xl transition-transform duration-300 ease-out ${
          aberto ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Lista de orçamento
            </h2>
            <p className="text-sm text-muted-foreground">
              {totalItens === 0
                ? "Ainda sem equipamentos"
                : `${totalItens} ${totalItens === 1 ? "equipamento" : "equipamentos"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </header>

        {itens.length === 0 ? (
          <EmptyState onFechar={fechar} />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="flex flex-col gap-3">
                {itens.map((item) => (
                  <LinhaOrcamento
                    key={item.ref}
                    ref_={item.ref}
                    unitCents={overlay?.get(item.ref) ?? item.pvpCents}
                  />
                ))}
              </ul>
              <button
                type="button"
                onClick={limpar}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="size-4" />
                Limpar lista
              </button>
            </div>

            <RodapeLista
              totalCents={totalVista}
              eRevenda={overlay !== null}
              onFechar={fechar}
            />
          </>
        )}
      </aside>
    </div>
  )
}

function RodapeLista({
  totalCents,
  eRevenda,
  onFechar,
}: {
  totalCents: number
  eRevenda: boolean
  onFechar: () => void
}) {
  const { isSignedIn } = useAuth()
  const { vista, orgActiva } = useEmpresaActiva(Boolean(isSignedIn))
  const estado =
    vista?.kind === "empresa" ? vista.empresa.estadoAprovacao : undefined

  return (
    <footer className="border-t px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">
          {eRevenda ? "Total revenda (s/IVA)" : "Total indicativo (PVP s/IVA)"}
        </span>
        <span className="text-xl font-semibold text-primary">
          {eurExato.format(totalCents / 100)}
        </span>
      </div>
      <CtaLista
        isSignedIn={Boolean(isSignedIn)}
        kind={vista === undefined && isSignedIn ? "a-carregar" : vista?.kind}
        estado={estado}
        orgActiva={orgActiva}
        onFechar={onFechar}
      />
    </footer>
  )
}

function CtaLista({
  isSignedIn,
  kind,
  estado,
  orgActiva,
  onFechar,
}: {
  isSignedIn: boolean
  kind: "sem-org" | "sem-empresa" | "empresa" | "a-carregar" | undefined
  estado: string | undefined
  orgActiva: boolean
  onFechar: () => void
}) {
  if (!isSignedIn) {
    return (
      <>
        <Button
          render={<Link to="/entrar" />}
          nativeButton={false}
          size="lg"
          className="w-full"
          onClick={onFechar}
        >
          Entre ou registe a sua empresa
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          A lista mantém-se depois de entrar. Empresas aprovadas submetem a
          encomenda aqui.
        </p>
      </>
    )
  }

  if (kind === "sem-org" || kind === "sem-empresa") {
    return (
      <>
        <Button
          render={<Link to={kind === "sem-org" ? "/registo" : "/conta"} />}
          nativeButton={false}
          size="lg"
          className="w-full"
          onClick={onFechar}
        >
          Completar o registo da empresa
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Precisamos do perfil da empresa para avançar.
        </p>
      </>
    )
  }

  if (estado === "pendente") {
    return (
      <>
        <Button size="lg" disabled className="w-full">
          Empresa em aprovação
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Quando a equipa comercial aprovar, passa a ver os preços de revenda.
        </p>
      </>
    )
  }

  if (estado === "rejeitada" || estado === "suspensa") {
    return (
      <>
        <Button
          render={<a href="mailto:geral@climaeco.pt" />}
          nativeButton={false}
          size="lg"
          className="w-full"
        >
          Contactar o escritório
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {estado === "rejeitada"
            ? "O pedido foi rejeitado. Fale connosco para esclarecer."
            : "A conta está suspensa. Os preços de revenda estão bloqueados."}
        </p>
      </>
    )
  }

  return <SubmeterEncomenda orgActiva={orgActiva} onFechar={onFechar} />
}

/** Approved member: turn the quote list into an installer order (#5). */
function SubmeterEncomenda({
  orgActiva,
  onFechar,
}: {
  // `submeter` needs the company org in the Convex JWT; disabled until then.
  orgActiva: boolean
  onFechar: () => void
}) {
  const { itens, limpar } = useOrcamento()
  const submeter = useMutation(api.encomendas.submeter)
  const navigate = useNavigate()
  const [aSubmeter, setASubmeter] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function onSubmeter() {
    setErro(null)
    setASubmeter(true)
    try {
      const { encomendaId } = await submeter({
        linhas: itens.map((i) => ({ ref: i.ref, qty: i.quantidade })),
      })
      limpar()
      onFechar()
      await navigate({
        to: "/conta/encomendas/$id",
        params: { id: encomendaId },
      })
    } catch (error) {
      setErro(mensagemErroSubmeter(error))
    } finally {
      setASubmeter(false)
    }
  }

  return (
    <>
      <Button
        size="lg"
        className="w-full"
        disabled={aSubmeter || !orgActiva || itens.length === 0}
        onClick={() => void onSubmeter()}
      >
        {aSubmeter
          ? "A submeter…"
          : orgActiva
            ? "Submeter encomenda"
            : "A activar a empresa…"}
      </Button>
      {erro ? (
        <p className="mt-2 text-center text-xs text-destructive">{erro}</p>
      ) : (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Os preços de revenda ficam congelados. O escritório confirma stock e
          depois envia o pedido de pagamento. Acompanhe em{" "}
          <Link
            to="/conta/encomendas"
            onClick={onFechar}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Encomendas
          </Link>
          .
        </p>
      )}
    </>
  )
}

function LinhaOrcamento({
  ref_,
  unitCents,
}: {
  ref_: string
  unitCents: number
}) {
  const { obter, definirQuantidade, remover, fechar } = useOrcamento()
  const item = obter(ref_)
  if (!item) return null

  return (
    <li className="flex gap-3 rounded-xl border bg-card p-3">
      <ThumbOrcamento item={item} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to="/produto/$ref"
              params={{ ref: item.ref }}
              onClick={fechar}
              className="line-clamp-2 text-sm font-semibold leading-snug transition-colors hover:text-primary"
            >
              {item.nome}
            </Link>
            <p className="text-xs text-muted-foreground">
              {rotuloMarca(item.marca)}
              {item.variante ? ` · ${item.variante}` : ""} · {item.ref}
            </p>
          </div>
          <button
            type="button"
            onClick={() => remover(item.ref)}
            aria-label={`Remover ${item.nome}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <QuantityStepper
            size="sm"
            value={item.quantidade}
            onChange={(q) => definirQuantidade(item.ref, q)}
          />
          <span className="text-sm font-semibold tabular-nums">
            {eurExato.format((unitCents * item.quantidade) / 100)}
          </span>
        </div>
      </div>
    </li>
  )
}

function ThumbOrcamento({ item }: { item: ItemOrcamento }) {
  const Icone = iconeFamilia(item.familia)

  if (item.capaUrl) {
    return (
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border bg-secondary/40">
        <img
          src={item.capaUrl}
          alt=""
          className="size-full object-contain p-1"
        />
      </div>
    )
  }

  if (item.capaPdfUrl) {
    return (
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border bg-white">
        <iframe
          src={`${item.capaPdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          title=""
          className="pointer-events-none absolute inset-0 size-full scale-[1.35] border-0"
          tabIndex={-1}
        />
      </div>
    )
  }

  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-primary">
      <Icone className="size-6" />
    </div>
  )
}

function EmptyState({ onFechar }: { onFechar: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
        <FileText className="size-6" />
      </div>
      <div>
        <p className="font-semibold">A sua lista está vazia</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore o catálogo e adicione os equipamentos que quer incluir no seu
          pedido de orçamento.
        </p>
      </div>
      <Button
        render={<Link to="/produtos" />}
        nativeButton={false}
        variant="outline"
        onClick={onFechar}
      >
        Ver produtos
      </Button>
    </div>
  )
}

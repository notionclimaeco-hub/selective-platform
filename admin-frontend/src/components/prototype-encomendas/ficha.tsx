// PROTOTYPE (#86) — the ticket page an order opens into from the board. It
// leads with "Próximo passo": either our move (with everything needed to make
// it right there) or exactly what the order waits on outside Climaeco (the
// installer or a supplier), since when, and how to reach them. Below it, the
// working area for the current state, then the rest of the record folded.

import { Fragment, useRef, useState } from "react"
import type { ReactNode } from "react"
import {
  Check,
  ChevronDown,
  ChevronLeft,
  CircleX,
  CircleAlert,
  CreditCard,
  Clock,
  Download,
  FileUp,
  HandCoins,
  Copy,
  Mail,
  Minus,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Link } from "@tanstack/react-router"

import { ConfirmDialog } from "@/components/produtos/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { QuantityStepper } from "@/components/ui/quantity-stepper"
import { Seletor } from "@/components/ui/seletor"
import { Destaque, Marcador, Seccao, campoCls } from "@/components/ui/tabela"
import { cn } from "@/lib/utils"
import {
  CopiarBotao,
  ProvedorEntradas,
  Valores,
  useEntrada,
  voltarCls,
} from "./comum"
import {
  CATALOGO,
  DOCUMENTO_LABELS,
  IVA,
  MARCA_LABELS,
  MOTIVO_LABELS,
  accoes,
  accoesValidas,
  custoCents,
  custoMarcaCents,
  emailEncomendaFornecedor,
  ETAPA_LABELS,
  ETAPAS_QUADRO,
  FASE_LABELS,
  ETAPA_TOM,
  etapa,
  marcasSemFatura,
  dataCurta,
  dataHoraCurta,
  emailFornecedor,
  enc,
  esperaPor,
  eur,
  excecoesAbertas,
  ha,
  linkPagamento,
  linhasDaMarca,
  marcas,
  reembolsoAberto,
  restantes,
  somaBuckets,
  totalCents,
  totalComIvaCents,
} from "./fixtures"
import type {
  Encomenda,
  Espera,
  Etapa,
  FaturaFornecedor,
  Linha,
} from "./fixtures"

// --- small helpers ---

/** "Expira em 5 dias" / "Expira amanhã" / "Expira hoje" / "Expirado". */
function expiraEm(fim: number, agora = Date.now()): string {
  if (fim < agora) return "Expirado"
  const dia = (ms: number) => new Date(ms).setHours(0, 0, 0, 0)
  const dias = Math.round((dia(fim) - dia(agora)) / 86_400_000)
  if (dias === 0) return "Expira hoje"
  if (dias === 1) return "Expira amanhã"
  return `Expira em ${dias} dias`
}

/** Run an in-memory action; toast with "Anular" (restores the order). */
function agir(msg: string, f: () => Encomenda, anular = true) {
  try {
    const antes = f()
    toast(
      msg,
      anular
        ? {
            action: { label: "Anular", onClick: () => accoes.restaurar(antes) },
          }
        : undefined
    )
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Não foi possível.")
  }
}

function nomeMarca(m: string) {
  return MARCA_LABELS[m] ?? m
}

type Confirmar = {
  titulo: string
  descricao: string
  confirmarLabel: string
  onConfirmar: () => void
}

// --- the screen -----------------------------------------------------------------

export function FichaEncomenda({ e }: { e: Encomenda }) {
  return (
    <ProvedorEntradas>
      <Ficha e={e} />
    </ProvedorEntradas>
  )
}

function Ficha({ e }: { e: Encomenda }) {
  const s = esperaPor(e)
  const entrada = useEntrada()
  const [confirmar, setConfirmar] = useState<Confirmar | null>(null)
  const [aCancelar, setACancelar] = useState(false)
  const podeCancelar = accoesValidas(e).cancelar

  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <Link to="/prototype/encomendas" className={voltarCls}>
        <ChevronLeft className="size-4" />
        Encomendas
      </Link>
      <Topo
        e={e}
        botoes={
          podeCancelar && (
            <Button variant="outline" onClick={() => setACancelar(true)}>
              <CircleX data-icon="inline-start" />
              Cancelar encomenda
            </Button>
          )
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Keyed by the step, so a new step card fades in instead of the
              old one's text changing under the reader. */}
          <div
            key={`${etapa(e)}·${s.vez}·${s.titulo}·${excecoesAbertas(e).length}`}
            className={entrada}
          >
            <ProximoPasso e={e} s={s} />
          </div>
          <AreaDeTrabalho e={e} pedirConfirmacao={setConfirmar} />
          {/* Lines show here only where no other block on the page lists them. */}
          {![
            "recebida",
            "aguardando_stock",
            "paga",
            "pronta_a_levantar",
          ].includes(e.estado) && <LinhasLeitura e={e} />}
        </div>
        <Lateral e={e} pedirConfirmacao={setConfirmar} />
      </div>
      {confirmar && (
        <ConfirmDialog
          titulo={confirmar.titulo}
          descricao={confirmar.descricao}
          confirmarLabel={confirmar.confirmarLabel}
          onConfirmar={() => {
            confirmar.onConfirmar()
            setConfirmar(null)
          }}
          onCancelar={() => setConfirmar(null)}
        />
      )}
      {aCancelar && (
        <CancelarEncomenda e={e} onFechar={() => setACancelar(false)} />
      )}
    </main>
  )
}

// --- header + progress ------------------------------------------------------------

const PASSOS = ETAPAS_QUADRO.map((f) => FASE_LABELS[f])

function indicePasso(e: Encomenda): number {
  const ordem: Record<Etapa, number> = {
    recebida: 0,
    aguardando_stock: 1,
    aguardando_pagamento: 2,
    por_encomendar: 3,
    em_transito: 4,
    em_armazem: 5,
    concluida: 6,
    cancelada: 0,
  }
  if (e.estado !== "cancelada") return ordem[etapa(e)]
  return e.paidAt ? 3 : e.paymentRequestedAt ? 2 : e.stockRequestedAt ? 1 : 0
}

function Topo({ e, botoes }: { e: Encomenda; botoes?: ReactNode }) {
  const actual = indicePasso(e)
  const cancelada = e.estado === "cancelada"
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {enc(e.numero)}
            </h1>
            <Marcador tom={ETAPA_TOM[etapa(e)]}>
              {ETAPA_LABELS[etapa(e)]}
            </Marcador>
          </div>
          <p className="mt-1.5 truncate text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {e.empresa.nome}
            </span>{" "}
            · {e.colocadaPor.nome} · {ha(e.placedAt)}
          </p>
        </div>
        {botoes && (
          <div className="flex shrink-0 items-center gap-2">{botoes}</div>
        )}
      </div>
      <ol className="grid grid-cols-6 gap-2" aria-label="Progresso">
        {PASSOS.map((p, i) => {
          const feito = i < actual
          const agora = i === actual && !cancelada
          const parou = i === actual && cancelada
          return (
            <li key={p} className="flex flex-col gap-1.5">
              {/* The fill grows from the left when the order advances; on
                  first paint it is already in place (transitions only). */}
              <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <span
                  className={cn(
                    "block h-full origin-left rounded-full transition-[scale,background-color] duration-300 ease-in-out",
                    feito
                      ? "bg-primary"
                      : agora
                        ? "bg-brand"
                        : parou
                          ? "bg-destructive"
                          : "scale-x-0 bg-secondary"
                  )}
                />
              </span>
              <span
                className={cn(
                  "truncate text-xs",
                  agora || parou
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {p}
              </span>
            </li>
          )
        })}
      </ol>
    </header>
  )
}

/**
 * Cancel confirmation, shaped like the client app's `CancelarEncomenda`:
 * the irreversibility warning, an optional reason (kept on the order and in
 * the log), then the destructive action. The X, Escape and the backdrop close it.
 */
function CancelarEncomenda({
  e,
  onFechar,
}: {
  e: Encomenda
  onFechar: () => void
}) {
  const [motivo, setMotivo] = useState("")
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col gap-1.5 pr-8">
          <DialogTitle className="text-lg font-semibold">
            Cancelar {enc(e.numero)}?
          </DialogTitle>
          <DialogDescription>Não é possível desfazer.</DialogDescription>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Motivo (opcional)</span>
          <textarea
            autoFocus
            rows={2}
            value={motivo}
            onChange={(ev) => setMotivo(ev.target.value)}
            placeholder="Ex.: instalador pediu por telefone"
            className={cn(campoCls, "h-auto resize-none py-2")}
          />
        </label>
        <div className="flex flex-col gap-2">
          <Button
            variant="destructive"
            size="lg"
            className="h-11"
            onClick={() => {
              agir(`${enc(e.numero)} cancelada`, () =>
                accoes.cancelar(e.numero, motivo.trim())
              )
              onFechar()
            }}
          >
            Cancelar encomenda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- "Próximo passo" --------------------------------------------------------------

function ProximoPasso({ e, s }: { e: Encomenda; s: Espera }) {
  // Exceptions and failed documents first: they are always ours.
  const docErro = e.documentos.find((d) => d.estado === "erro")
  if (docErro) {
    return (
      <AMinhaVez
        titulo={`Emitir ${DOCUMENTO_LABELS[docErro.tipo].toLowerCase()}`}
        meta="O InvoiceXpress recusou o documento"
      >
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {docErro.erro}
        </p>
        <Accoes>
          <Button
            onClick={() =>
              agir(
                "Documento emitido",
                () => accoes.repetirDocumento(e.numero, docErro.id),
                false
              )
            }
          >
            Tentar de novo
          </Button>
        </Accoes>
      </AMinhaVez>
    )
  }
  const excecao = excecoesAbertas(e).at(0)
  if (excecao) {
    // Contact and amounts are in Cliente and Valores; the credit note is
    // issued on resolve, so the card only needs what and how much.
    return (
      <AMinhaVezCompacta
        icone={HandCoins}
        titulo={
          excecao.tipo === "reembolso"
            ? `Reembolsar ${eur(excecao.valorCents ?? 0)}`
            : "Resolver faturação"
        }
        desde={{ rotulo: "aberto", em: excecao.criadaEm }}
        detalhes={[excecao.descricao.replace(" pelo fornecedor", "")]}
        botao={
          <Button
            onClick={() =>
              agir("Reembolso resolvido · nota de crédito emitida", () =>
                accoes.resolverExcecao(e.numero, excecao.id)
              )
            }
          >
            <Check data-icon="inline-start" />
            Marcar reembolsado
          </Button>
        }
      />
    )
  }

  switch (e.estado) {
    case "recebida":
      return <PedirStock e={e} />

    case "aguardando_stock": {
      if (s.vez === "nos") {
        // Amounts live in Valores and the products below; this only says
        // what the next move is and what the installer gets.
        return (
          <AMinhaVezCompacta
            icone={CreditCard}
            titulo="Pedir pagamento"
            detalhes={["stock confirmado", "link válido 7 dias"]}
            botao={
              <Button
                onClick={() =>
                  agir("Pagamento pedido · link enviado ao instalador", () =>
                    accoes.pedirPagamento(e.numero)
                  )
                }
              >
                Pedir pagamento
              </Button>
            }
          />
        )
      }
      const linhas = restantes(e)
      const confirmadas = linhas.filter(
        (l) => l.estadoLinha === "confirmada"
      ).length
      return (
        <AEsperaDe
          s={s}
          titulo={`Confirmação de stock · ${(s.marcas ?? []).map(nomeMarca).join(", ")}`}
          detalhes={[
            e.stockRequestedAt && `Pedido ${dataCurta(e.stockRequestedAt)}`,
            `${confirmadas} de ${linhas.length} confirmados`,
          ]}
        />
      )
    }

    case "aguardando_pagamento": {
      const fim = e.paymentExpiresAt ?? Date.now()
      const tentativas = e.eventos.filter(
        (ev) => ev.actor === "revolut" && /recusad|falh/i.test(ev.texto)
      )
      const link = linkPagamento(e)
      return (
        <AEsperaDe
          s={s}
          titulo="Pagamento"
          pilula={{
            texto: expiraEm(fim),
            aviso: s.atrasada,
            titulo: `Expira ${dataHoraCurta(fim)}`,
          }}
          detalhes={[
            e.paymentRequestedAt && `Pedido ${dataCurta(e.paymentRequestedAt)}`,
            tentativas.length > 0 &&
              `${tentativas.length} tentativa${tentativas.length === 1 ? "" : "s"} recusada${tentativas.length === 1 ? "" : "s"}`,
          ]}
          botoes={
            <>
              {link && (
                <BotaoCopiar texto={link} rotulo="Copiar link de pagamento" />
              )}
              <Button
                variant="outline"
                onClick={() =>
                  agir("Voltou a editar · ordem de pagamento cancelada", () =>
                    accoes.voltarAEditar(e.numero)
                  )
                }
              >
                Voltar a editar
              </Button>
              <Button
                variant="ghost"
                className="ml-auto text-muted-foreground"
                onClick={() =>
                  agir("Pagamento recebido (simulado)", () =>
                    accoes.simularPagamento(e.numero)
                  )
                }
              >
                Simular pagamento recebido · protótipo
              </Button>
            </>
          }
        />
      )
    }

    case "paga": {
      const b = somaBuckets(e)
      const todas = marcas(e)
      const faltam = marcasSemFatura(e)
      if (faltam.length > 0) {
        // The supplier cards below hold the products, cost and invoice
        // upload; this only says whose move it is and what is missing.
        const feitas = todas.length - faltam.length
        return (
          <AMinhaVezCompacta
            icone={PackagePlus}
            titulo={
              faltam.length === 1
                ? `Encomendar à ${nomeMarca(faltam[0])}`
                : `Encomendar a ${faltam.length} fornecedores`
            }
            desde={{ rotulo: "paga", em: e.paidAt }}
            detalhes={[
              faltam.length > 1 && faltam.map(nomeMarca).join(", "),
              todas.length === 1
                ? "falta a fatura"
                : `${feitas} de ${todas.length} faturas`,
            ]}
          />
        )
      }
      return (
        <AEsperaDe
          s={s}
          titulo={`${s.titulo} · ${(s.marcas ?? []).map(nomeMarca).join(", ")}`}
          detalhes={[
            `${b.emTransito} em trânsito`,
            b.noArmazem > 0 && `${b.noArmazem} no armazém`,
            b.falhada > 0 && `${b.falhada} falhadas`,
          ]}
        />
      )
    }

    case "pronta_a_levantar":
      return <Levantamento e={e} />

    case "concluida":
      return (
        <Resumo
          icone={<Check className="size-4" />}
          titulo={
            e.levantadaAt
              ? `Levantada ${ha(e.levantadaAt)}`
              : "Concluída sem levantamento"
          }
          meta={
            e.levantadaAt
              ? dataHoraCurta(e.levantadaAt)
              : "Todas as quantidades falharam"
          }
        />
      )

    case "cancelada":
      return (
        <Resumo
          icone={<CircleAlert className="size-4" />}
          perigo
          titulo={`Cancelada · ${e.cancelReason ? MOTIVO_LABELS[e.cancelReason] : ""}`}
          meta={[
            e.motivoCancelamento,
            e.cancelledAt
              ? `${dataHoraCurta(e.cancelledAt)} · ${ha(e.cancelledAt)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      )
  }
}

/**
 * A step with its checklist and action inside: accent card and lime dot when
 * it is our move; plain card and grey dot when `espera` says who we wait on
 * (the pickup: the installer comes, then we act).
 */
function AMinhaVez({
  titulo,
  meta,
  espera,
  children,
}: {
  titulo: string
  meta?: string
  espera?: "cliente" | "fornecedor"
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-5",
        espera ? "bg-card" : "border-primary/20 bg-accent/50"
      )}
    >
      <div>
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            espera ? "text-muted-foreground" : "text-accent-foreground"
          )}
        >
          {espera ? (
            <>
              <span className="size-1.5 rounded-full bg-muted-foreground/50" />À
              espera do {espera}
            </>
          ) : (
            <>
              <Destaque className="size-1.5" /> A tua vez
            </>
          )}
        </p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight">{titulo}</h3>
        {meta && <p className="mt-0.5 text-sm text-muted-foreground">{meta}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * Our move when the work happens in the cards below: the same one-glance
 * header as `AEsperaDe`, on the accent surface. No pill: how long it has
 * been ours goes in the line ("aberto há 5 dias"), next to the facts.
 */
function AMinhaVezCompacta({
  icone: Icone,
  titulo,
  desde,
  detalhes,
  botao,
}: {
  icone: typeof Truck
  titulo: string
  /** When it became our move, with its verb: `{ rotulo: "paga", em }`. */
  desde?: { rotulo: string; em?: number }
  detalhes: Array<ReactNode>
  /** The one action, on the right (under the text on phones). */
  botao?: ReactNode
}) {
  const linha = [
    "A tua vez",
    desde?.em && `${desde.rotulo} ${ha(desde.em)}`,
    ...detalhes,
  ].filter(Boolean)
  return (
    <section className="flex flex-wrap items-center gap-x-3.5 gap-y-3 rounded-xl border border-primary/20 bg-accent/50 px-5 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center self-start rounded-full bg-primary/10 text-primary">
        <Icone className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <h3 className="text-base font-semibold tracking-tight">{titulo}</h3>
        <LinhaFactos itens={linha} />
      </div>
      {botao && (
        <div className="w-full shrink-0 sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
          {botao}
        </div>
      )}
    </section>
  )
}

/**
 * The muted facts line under a card title, "a · b · c". Each dot is glued to
 * the fact before it, so a wrapped line never starts with "·".
 */
function LinhaFactos({ itens }: { itens: Array<ReactNode> }) {
  return (
    <p className="mt-1 text-sm text-muted-foreground">
      {itens.map((d, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden>{"\u00a0· "}</span>}
          <span className="whitespace-nowrap">{d}</span>
        </Fragment>
      ))}
    </p>
  )
}

/**
 * Waiting outside Climaeco, in one glance: who we wait on and what (title),
 * the few facts that matter on one muted line, how long in the pill, and the
 * actions in a footer. Same shape in every waiting stage.
 */
function AEsperaDe({
  s,
  titulo,
  detalhes,
  pilula,
  botoes,
  children,
}: {
  s: Espera
  titulo: string
  detalhes: Array<ReactNode>
  /** Replaces the default "how long we've waited" pill (e.g. a deadline). */
  pilula?: { texto: string; aviso?: boolean; titulo?: string }
  botoes?: ReactNode
  children?: ReactNode
}) {
  const Icone = s.vez === "cliente" ? UserRound : Truck
  const linha = [
    s.vez === "cliente" ? "À espera do cliente" : "À espera do fornecedor",
    ...detalhes.filter(Boolean),
  ]
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-start gap-3.5 px-5 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Icone className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold tracking-tight">{titulo}</h3>
            {(pilula ?? s.desde) && (
              <span
                title={pilula?.titulo}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                  (pilula ? pilula.aviso : s.atrasada)
                    ? "bg-warning text-warning-foreground ring-warning-foreground/20"
                    : "bg-secondary text-secondary-foreground ring-border"
                )}
              >
                <Clock className="size-3" />
                {pilula
                  ? pilula.texto
                  : ha(s.desde ?? Date.now()).replace("há ", "")}
              </span>
            )}
          </div>
          <LinhaFactos itens={linha} />
        </div>
      </div>
      {children && <div className="border-t px-5 py-4">{children}</div>}
      {botoes && (
        <footer className="flex flex-wrap items-center gap-2 border-t bg-secondary/30 px-5 py-3">
          {botoes}
        </footer>
      )}
    </section>
  )
}

/** Copies a value; reads "Copiado" for a moment. Button-sized for footers. */
function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <Button
      variant="outline"
      onClick={() => {
        void navigator.clipboard.writeText(texto)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1500)
      }}
    >
      {copiado ? (
        <Check data-icon="inline-start" className="text-primary" />
      ) : (
        <Copy data-icon="inline-start" />
      )}
      {copiado ? "Copiado" : rotulo}
    </Button>
  )
}

function Resumo({
  icone,
  titulo,
  meta,
  perigo,
}: {
  icone: ReactNode
  titulo: string
  meta?: string
  perigo?: boolean
}) {
  return (
    <section className="flex items-start gap-3 rounded-xl border bg-card p-5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          perigo
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary"
        )}
      >
        {icone}
      </span>
      <div>
        <h3 className="text-base font-semibold">{titulo}</h3>
        {meta && <p className="mt-0.5 text-sm text-muted-foreground">{meta}</p>}
      </div>
    </section>
  )
}

function Accoes({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

// --- recebida: request stock --------------------------------------------------------

function PedirStock({ e }: { e: Encomenda }) {
  const lista = marcas(e)
  const [enviados, setEnviados] = useState<Array<string>>([])
  return (
    <AMinhaVez
      titulo="Pedir stock aos fornecedores"
      meta={`Recebida ${ha(e.placedAt)} · ${lista.length} fornecedor${lista.length === 1 ? "" : "es"}`}
    >
      <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card">
        {lista.map((m) => {
          const email = emailFornecedor(e, m)
          const n = linhasDaMarca(e, m).filter(
            (l) => l.estadoLinha !== "retirada"
          ).length
          const feito = enviados.includes(m)
          return (
            <li key={m} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Visto
                feito={feito}
                rotulo={`Email para ${nomeMarca(m)} enviado`}
                onClick={() =>
                  setEnviados((v) =>
                    feito ? v.filter((x) => x !== m) : [...v, m]
                  )
                }
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors duration-150",
                    feito && "text-muted-foreground line-through"
                  )}
                >
                  {nomeMarca(m)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {n} produto{n === 1 ? "" : "s"}
                </p>
              </div>
              <CopiarBotao
                texto={`${email.assunto}\n\n${email.corpo}`}
                rotulo="Copiar email"
              />
              <Button
                variant="outline"
                size="sm"
                render={
                  <a
                    href={`mailto:?subject=${encodeURIComponent(email.assunto)}&body=${encodeURIComponent(email.corpo)}`}
                  />
                }
                nativeButton={false}
                onClick={() =>
                  setEnviados((v) => (v.includes(m) ? v : [...v, m]))
                }
              >
                <Mail data-icon="inline-start" />
                Abrir no email
              </Button>
            </li>
          )
        })}
      </ul>
      <Accoes>
        <Button
          onClick={() =>
            agir("Stock pedido", () => accoes.pedirStock(e.numero))
          }
        >
          Marcar stock pedido
          <span className="text-xs tabular-nums opacity-75">
            {enviados.length}/{lista.length}
          </span>
        </Button>
      </Accoes>
    </AMinhaVez>
  )
}

// --- pronta a levantar ----------------------------------------------------------------

function Levantamento({ e }: { e: Encomenda }) {
  const itens = restantes(e).filter((l) => (l.buckets?.noArmazem ?? 0) > 0)
  const [entregues, setEntregues] = useState<Array<string>>([])
  return (
    <AMinhaVez
      espera="cliente"
      titulo="Levantamento no armazém"
      meta={[
        e.prontaAt && `Pronta ${ha(e.prontaAt)}`,
        "Armazém Belas",
        "instalador avisado",
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card">
        {itens.map((l) => {
          const ok = entregues.includes(l.id)
          const alternar = () =>
            setEntregues((v) =>
              ok ? v.filter((x) => x !== l.id) : [...v, l.id]
            )
          return (
            <li key={l.id} className="flex items-center gap-3 px-4 py-3">
              <Visto
                feito={ok}
                rotulo={`${l.ref} entregue`}
                onClick={alternar}
              />
              <button
                type="button"
                onClick={alternar}
                className="min-w-0 flex-1 text-left"
              >
                <p
                  className={cn(
                    "text-sm font-medium transition-colors duration-150",
                    ok && "text-muted-foreground line-through"
                  )}
                >
                  {l.nome}
                </p>
                <p className="text-xs text-muted-foreground">{l.ref}</p>
              </button>
              <span className="text-sm font-semibold tabular-nums">
                × {l.buckets?.noArmazem}
              </span>
            </li>
          )
        })}
      </ul>
      <Accoes>
        <Button
          onClick={() =>
            agir("Levantamento registado · guia de transporte emitida", () =>
              accoes.registarLevantamento(e.numero)
            )
          }
        >
          Registar levantamento
          <span className="text-xs tabular-nums opacity-75">
            {entregues.length}/{itens.length}
          </span>
        </Button>
      </Accoes>
    </AMinhaVez>
  )
}

/** The tick used by the step checklists (stock emails, pickup). */
function Visto({
  feito,
  rotulo,
  onClick,
}: {
  feito: boolean
  rotulo: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={feito}
      aria-label={rotulo}
      onClick={onClick}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-[background-color,border-color,scale] duration-150 ease-out active:scale-90",
        feito
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:border-foreground/30"
      )}
    >
      <Check
        className={cn(
          "size-3.5 transition-[opacity,scale] duration-150 ease-out",
          feito ? "scale-100 opacity-100" : "scale-50 opacity-0"
        )}
        strokeWidth={2.5}
      />
    </button>
  )
}

// --- working area per state -------------------------------------------------------------

function AreaDeTrabalho({
  e,
  pedirConfirmacao,
}: {
  e: Encomenda
  pedirConfirmacao: (c: Confirmar) => void
}) {
  if (e.estado === "recebida" || e.estado === "aguardando_stock") {
    return (
      <LinhasEditaveis
        e={e}
        confirmar={e.estado === "aguardando_stock"}
        pedirConfirmacao={pedirConfirmacao}
      />
    )
  }
  if (e.estado === "paga") {
    const faltam = marcasSemFatura(e)
    return (
      <div className="flex flex-col gap-4">
        {marcas(e).map((m) =>
          faltam.includes(m) ? (
            <EncomendarMarca
              key={m}
              e={e}
              marca={m}
              pedirConfirmacao={pedirConfirmacao}
            />
          ) : (
            <Fornecimento key={m} e={e} marca={m} />
          )
        )}
      </div>
    )
  }
  return null
}

/** Pre-pay lines, grouped by supplier: qty, cost confirmation, drop, add. */
function LinhasEditaveis({
  e,
  confirmar,
  pedirConfirmacao,
}: {
  e: Encomenda
  confirmar: boolean
  pedirConfirmacao: (c: Confirmar) => void
}) {
  const grupos = [...new Set(e.linhas.map((l) => l.marca))]
  const [aAdicionar, setAAdicionar] = useState(false)
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex min-h-14 items-center justify-between gap-4 border-b px-5">
        <h3 className="text-sm font-semibold">
          Produtos{" "}
          <span className="font-normal text-muted-foreground tabular-nums">
            {restantes(e).length}
          </span>
        </h3>
        {!aAdicionar && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAAdicionar(true)}
          >
            <Plus data-icon="inline-start" />
            Adicionar produto
          </Button>
        )}
      </div>
      {aAdicionar && (
        <AdicionarProduto e={e} onFechar={() => setAAdicionar(false)} />
      )}
      <div className="@container">
        {grupos.map((m) => {
          const email = emailFornecedor(e, m)
          const linhas = linhasDaMarca(e, m)
          const pendentes = linhas.filter(
            (l) => l.estadoLinha === "por_confirmar"
          ).length
          return (
            <div key={m} className="border-b last:border-b-0">
              <div
                className={cn(
                  "flex items-center gap-x-4 bg-secondary/40 px-5 py-2 text-xs @min-[44rem]:grid",
                  confirmar ? COLS_CONFIRMAR : COLS_SIMPLES
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="font-medium">{nomeMarca(m)}</span>
                  {confirmar && (
                    <span className="text-muted-foreground">
                      {pendentes > 0
                        ? `${pendentes} por confirmar`
                        : "tudo confirmado"}
                    </span>
                  )}
                  {confirmar && pendentes > 0 && (
                    <CopiarBotao
                      size="xs"
                      className="ml-auto @min-[44rem]:ml-1"
                      texto={`${email.assunto}\n\n${email.corpo}`}
                      rotulo="Copiar email"
                    />
                  )}
                </div>
                <span className="hidden text-center text-muted-foreground @min-[44rem]:block">
                  Qtd
                </span>
                {confirmar && (
                  <span className="hidden text-right text-muted-foreground @min-[44rem]:block">
                    Custo un.
                  </span>
                )}
                <span className="hidden text-right text-muted-foreground @min-[44rem]:block">
                  Total
                </span>
              </div>
              <ul className="divide-y">
                {linhas.map((l) => (
                  <LinhaEditavel
                    key={l.id}
                    e={e}
                    l={l}
                    confirmar={confirmar}
                    pedirConfirmacao={pedirConfirmacao}
                  />
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function LinhaEditavel({
  e,
  l,
  confirmar,
  pedirConfirmacao,
}: {
  e: Encomenda
  l: Linha
  confirmar: boolean
  pedirConfirmacao: (c: Confirmar) => void
}) {
  const [custo, setCusto] = useState("")
  const entrada = useEntrada()
  const retirada = l.estadoLinha === "retirada"
  const margem =
    l.custoCents !== undefined
      ? Math.round(
          ((l.precoRevendaCents - l.custoCents) / l.precoRevendaCents) * 100
        )
      : null

  function mudarQty(n: number) {
    if (!Number.isInteger(n) || n < 1 || n === l.qty) return
    agir(`${l.ref}: quantidade ${l.qty} → ${n}`, () =>
      accoes.alterarQty(e.numero, l.id, n)
    )
  }
  function confirmarCusto() {
    const cents = Math.round(Number(custo.replace(",", ".")) * 100)
    if (!Number.isFinite(cents) || cents <= 0)
      return toast.error("Custo inválido.")
    agir(`${l.ref} confirmado · custo ${eur(cents)}`, () =>
      accoes.confirmarLinha(e.numero, l.id, cents)
    )
    setCusto("")
  }

  return (
    <li
      className={cn(
        // A grid row when the card is wide enough; otherwise the name takes
        // its own line and the controls wrap under it (the card, not the
        // window, decides: the side column eats width at desktop sizes too).
        "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm @min-[44rem]:grid",
        confirmar ? COLS_CONFIRMAR : COLS_SIMPLES,
        entrada,
        retirada && "text-muted-foreground"
      )}
    >
      <div className="min-w-0 basis-full">
        <p
          className={cn(
            "font-medium @min-[44rem]:truncate",
            retirada && "line-through"
          )}
        >
          {l.nome}
        </p>
        <p className="text-xs text-muted-foreground">
          {l.ref} · {eur(l.precoRevendaCents)} un.
        </p>
      </div>
      {retirada ? (
        <span className="@min-[44rem]:justify-self-center">
          <Marcador tom="inativo">Retirado</Marcador>
        </span>
      ) : (
        <>
          <span className="@min-[44rem]:justify-self-center">
            <QuantityStepper
              value={l.qty}
              onChange={mudarQty}
              label={`Quantidade de ${l.ref}`}
            />
          </span>
          {confirmar && (
            <div className="order-last flex basis-full items-center gap-2 @min-[30rem]:order-none @min-[30rem]:basis-auto @min-[44rem]:justify-end">
              <span className="text-xs text-muted-foreground @min-[44rem]:hidden">
                Custo un.
              </span>
              {l.estadoLinha === "por_confirmar" ? (
                <span
                  key="pendente"
                  className="relative w-36 @min-[44rem]:w-full"
                >
                  <input
                    inputMode="decimal"
                    value={custo}
                    onChange={(ev) => setCusto(ev.target.value)}
                    onKeyDown={(ev) => ev.key === "Enter" && confirmarCusto()}
                    placeholder="0,00 €"
                    className={cn(
                      campoCls,
                      "h-8 w-full pr-10 text-right tabular-nums"
                    )}
                    aria-label={`Custo de ${l.ref}`}
                  />
                  <button
                    type="button"
                    onClick={confirmarCusto}
                    disabled={custo.trim() === ""}
                    aria-label={`Confirmar ${l.ref}`}
                    title="Confirmar stock e custo"
                    className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground transition-[opacity,transform] duration-150 ease-out active:scale-[0.92] disabled:bg-muted disabled:text-muted-foreground"
                  >
                    <Check className="size-3.5" />
                  </button>
                </span>
              ) : (
                <span
                  key="confirmado"
                  className={cn(
                    "inline-flex items-center gap-1.5 tabular-nums",
                    entrada
                  )}
                  title="Stock e custo confirmados"
                >
                  <Check className="size-3.5 text-primary" />
                  <span className="font-medium">{eur(l.custoCents ?? 0)}</span>
                  {margem !== null && (
                    <span className="text-xs text-muted-foreground">
                      {margem}%
                    </span>
                  )}
                </span>
              )}
            </div>
          )}
          <span className="ml-auto text-right font-medium tabular-nums @min-[44rem]:ml-0">
            {eur(l.precoRevendaCents * l.qty)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Retirar ${l.ref}`}
            className="text-muted-foreground hover:text-destructive"
            onClick={() =>
              pedirConfirmacao({
                titulo: `Retirar ${l.ref}?`,
                descricao:
                  restantes(e).length === 1
                    ? "É o último produto: a encomenda fica cancelada."
                    : "O produto sai da encomenda e do total.",
                confirmarLabel: "Retirar",
                onConfirmar: () =>
                  agir(`${l.ref} retirada`, () =>
                    accoes.retirarLinha(e.numero, l.id)
                  ),
              })
            }
          >
            <Trash2 />
          </Button>
        </>
      )}
    </li>
  )
}

/** Produto | Qtd | (Custo un.) | Total | remove, shared by group headers and
 *  rows of the Produtos card. */
const COLS_CONFIRMAR =
  "@min-[44rem]:grid-cols-[minmax(0,1fr)_7rem_9rem_6rem_2rem]"
const COLS_SIMPLES = "@min-[44rem]:grid-cols-[minmax(0,1fr)_7rem_6rem_2rem]"

/** Add a product to the order: search the catalog by ref or name, set the
 *  quantity, add. The price is snapshotted at the installer's reseller price. */
function AdicionarProduto({
  e,
  onFechar,
}: {
  e: Encomenda
  onFechar: () => void
}) {
  const entrada = useEntrada()
  const [pesquisa, setPesquisa] = useState("")
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const q = pesquisa.trim().toLowerCase()
  const naEncomenda = new Set(
    e.linhas.filter((l) => l.estadoLinha !== "retirada").map((l) => l.ref)
  )
  const resultados = CATALOGO.filter(
    (c) =>
      !q ||
      c.ref.toLowerCase().includes(q) ||
      c.nome.toLowerCase().includes(q) ||
      nomeMarca(c.marca).toLowerCase().includes(q)
  ).slice(0, 8)

  return (
    <div
      className={cn("border-b bg-secondary/30 px-5 py-4", entrada)}
      onKeyDown={(ev) => ev.key === "Escape" && onFechar()}
    >
      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={pesquisa}
            onChange={(ev) => setPesquisa(ev.target.value)}
            placeholder="Procurar por referência, nome ou marca"
            className={cn(campoCls, "w-full pl-9")}
            aria-label="Procurar produto"
          />
        </label>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Fechar"
          onClick={onFechar}
        >
          <X />
        </Button>
      </div>
      <ul className="mt-3 flex flex-col divide-y overflow-hidden rounded-lg border bg-card">
        {resultados.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            Sem produtos para “{pesquisa}”
          </li>
        )}
        {resultados.map((c) => {
          const ja = naEncomenda.has(c.ref)
          const qty = qtys[c.ref] ?? 1
          return (
            <li
              key={c.ref}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm"
            >
              <span className="min-w-40 flex-1 basis-0">
                <span className="block truncate font-medium">{c.nome}</span>
                <span className="text-xs text-muted-foreground">
                  {nomeMarca(c.marca)} · {c.ref} · {eur(c.precoRevendaCents)}{" "}
                  un.
                </span>
              </span>
              {ja ? (
                <span className="text-xs text-muted-foreground">
                  Já na encomenda
                </span>
              ) : (
                <>
                  <QuantityStepper
                    value={qty}
                    onChange={(n) =>
                      setQtys((v) => ({ ...v, [c.ref]: Math.max(1, n) }))
                    }
                    label={`Quantidade de ${c.ref}`}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      agir(`${c.ref} × ${qty} adicionado`, () =>
                        accoes.adicionarLinha(e.numero, c.ref, qty)
                      )
                      onFechar()
                    }}
                  >
                    Adicionar
                  </Button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** One supplier still to be ordered: what to buy, how, and its invoice. */
function EncomendarMarca({
  e,
  marca,
  pedirConfirmacao,
}: {
  e: Encomenda
  marca: string
  pedirConfirmacao: (c: Confirmar) => void
}) {
  const linhas = linhasDaMarca(e, marca).filter(
    (l) => l.estadoLinha !== "retirada" && l.buckets
  )
  const esperado = custoMarcaCents(e, marca)
  const email = emailEncomendaFornecedor(e, marca)

  const [aArrastar, setAArrastar] = useState(false)
  const entrada = useEntrada()
  // dragenter/dragleave fire per child element; count them so the overlay
  // stays until the pointer really leaves the card.
  const profundidade = useRef(0)

  // Dropping or picking the supplier's invoice PDF is the whole step: that
  // brand is ordered and its quantity moves to em trânsito.
  function adicionarFatura(ficheiro: File | undefined) {
    if (!ficheiro) return
    if (
      ficheiro.type !== "application/pdf" &&
      !ficheiro.name.toLowerCase().endsWith(".pdf")
    ) {
      toast.error("A fatura tem de ser um PDF.")
      return
    }
    agir(`Fatura da ${nomeMarca(marca)} adicionada · em trânsito`, () =>
      accoes.adicionarFaturaFornecedor(
        e.numero,
        marca,
        ficheiro.name,
        URL.createObjectURL(ficheiro)
      )
    )
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card",
        entrada
      )}
      onDragEnter={(ev) => {
        if (!Array.from(ev.dataTransfer.types).includes("Files")) return
        profundidade.current += 1
        setAArrastar(true)
      }}
      onDragOver={(ev) => ev.preventDefault()}
      onDragLeave={() => {
        profundidade.current = Math.max(0, profundidade.current - 1)
        if (profundidade.current === 0) setAArrastar(false)
      }}
      onDrop={(ev) => {
        ev.preventDefault()
        profundidade.current = 0
        setAArrastar(false)
        adicionarFatura(ev.dataTransfer.files[0])
      }}
    >
      {aArrastar && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary bg-background/90 text-primary backdrop-blur-[2px] transition-opacity duration-150 ease-out starting:opacity-0">
          <FileUp className="size-7" />
          <p className="text-sm font-medium">
            Larga para adicionar a fatura da {nomeMarca(marca)}
          </p>
        </div>
      )}
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-5 py-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Destaque className="size-1.5" />
            {nomeMarca(marca)}
          </h3>
          <p className="text-xs text-muted-foreground">{eur(esperado)} s/IVA</p>
        </div>
        <div className="flex gap-1.5">
          <CopiarBotao
            texto={`${email.assunto}\n\n${email.corpo}`}
            rotulo="Copiar encomenda"
          />
          <Button
            variant="outline"
            size="sm"
            render={
              <a
                href={`mailto:?subject=${encodeURIComponent(email.assunto)}&body=${encodeURIComponent(email.corpo)}`}
              />
            }
            nativeButton={false}
          >
            <Mail data-icon="inline-start" />
            Abrir no email
          </Button>
        </div>
      </div>

      <ul className="divide-y">
        {linhas.map((l) => (
          <li
            key={l.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm sm:flex-nowrap"
          >
            {/* Phone: name on its own row, numbers and Falhar under it. */}
            <span className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
              <span className="block font-medium sm:truncate">{l.nome}</span>
              <span className="text-xs text-muted-foreground">{l.ref}</span>
            </span>
            <span className="tabular-nums sm:w-12 sm:text-right">
              × {l.buckets!.porEnviar}
            </span>
            <span className="text-muted-foreground tabular-nums sm:w-28 sm:text-right">
              {eur(l.custoCents ?? 0)} un.
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-muted-foreground hover:text-destructive sm:ml-0"
              onClick={() =>
                pedirConfirmacao({
                  titulo: `${nomeMarca(marca)} não tem ${l.ref}?`,
                  descricao: `Falha ${l.buckets!.porEnviar} un.: abre um reembolso de ${eur(Math.round(l.buckets!.porEnviar * l.precoRevendaCents * (1 + IVA / 100)))} ao instalador.`,
                  confirmarLabel: "Falhar quantidade",
                  onConfirmar: () =>
                    agir(`${l.ref} falhada · reembolso aberto`, () =>
                      accoes.falharQty(e.numero, l.id, null)
                    ),
                })
              }
            >
              Falhar
            </Button>
          </li>
        ))}
      </ul>

      <div className="border-t bg-secondary/30 p-4">
        <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-foreground/15 bg-background px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/25">
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <FileUp className="size-5" />
          </span>
          <span className="text-sm font-medium transition-colors group-hover:text-primary">
            Adicionar fatura
          </span>
          <span className="-mt-1 text-xs text-muted-foreground">
            Arrasta o PDF para aqui
          </span>
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(ev) => {
              adicionarFatura(ev.target.files?.[0])
              ev.target.value = ""
            }}
          />
        </label>
      </div>
    </section>
  )
}

/** One supplier already ordered (invoice recorded): arrival at the warehouse. */
function Fornecimento({ e, marca }: { e: Encomenda; marca: string }) {
  const entrada = useEntrada()
  const linhas = linhasDaMarca(e, marca).filter(
    (l) => l.estadoLinha !== "retirada" && l.buckets
  )
  const emTransito = linhas.filter((l) => (l.buckets?.emTransito ?? 0) > 0)
  const n = emTransito.reduce((a, l) => a + l.buckets!.emTransito, 0)

  function rececaoTotal() {
    try {
      const antes = e
      for (const l of emTransito) accoes.registarRececao(e.numero, l.id, null)
      toast(`Receção ${nomeMarca(marca)} · ${n} un. no armazém`, {
        action: { label: "Anular", onClick: () => accoes.restaurar(antes) },
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível.")
    }
  }

  return (
    <section
      className={cn("overflow-hidden rounded-xl border bg-card", entrada)}
    >
      <div
        className={cn(
          "grid min-h-14 grid-cols-1 items-center gap-x-4 border-b px-5 py-2",
          COLUNAS
        )}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{nomeMarca(marca)}</h3>
          <p className="text-xs text-muted-foreground">
            {n > 0
              ? `${n} em trânsito`
              : linhas.some((l) => l.buckets!.falhada > 0)
                ? "Nada em trânsito"
                : "Tudo no armazém"}{" "}
            · {linhas.length} produto{linhas.length === 1 ? "" : "s"}
          </p>
        </div>
        {["Em trânsito", "Chegou", "Falhou"].map((c) => (
          <span
            key={c}
            className="hidden text-center text-xs font-medium text-muted-foreground sm:block"
          >
            {c}
          </span>
        ))}
      </div>
      <ul className="divide-y">
        {linhas.map((l) => (
          <LinhaFornecimento key={l.id} e={e} l={l} />
        ))}
      </ul>
      <footer className="flex justify-end border-t bg-secondary/30 px-5 py-2.5">
        <Button
          size="sm"
          variant="outline"
          disabled={n === 0}
          onClick={rececaoTotal}
        >
          <Check data-icon="inline-start" />
          Chegou tudo
        </Button>
      </footer>
    </section>
  )
}

/**
 * One product at the supplier stage: what is still in transit, then
 * "Chegou" and "Falhou" as small counters, like the client's product page. Every tap applies at once;
 * taps in a row share one toast whose "Anular" undoes the whole burst.
 */
function LinhaFornecimento({ e, l }: { e: Encomenda; l: Linha }) {
  const b = l.buckets!
  const rajada = useRef<{ antes: Encomenda; fim: number } | null>(null)
  const aberto = reembolsoAberto(e, l.id)

  function mover(f: () => Encomenda, texto: string) {
    try {
      const antes = f()
      const r = rajada.current
      if (!r || Date.now() > r.fim) rajada.current = { antes, fim: 0 }
      rajada.current!.fim = Date.now() + 4000
      const inicial = rajada.current!.antes
      toast(texto, {
        id: `mov-${l.id}`,
        action: {
          label: "Anular",
          onClick: () => {
            accoes.restaurar(inicial)
            rajada.current = null
          },
        },
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível.")
    }
  }

  const resumo = (chegou: number, falhou: number) =>
    `${l.ref} · ${chegou} no armazém${falhou > 0 ? ` · ${falhou} falhada${falhou === 1 ? "" : "s"}` : ""}`

  return (
    <li
      className={cn(
        "grid grid-cols-1 items-center gap-x-4 gap-y-2.5 px-5 py-3 text-sm",
        COLUNAS
      )}
    >
      <div className="min-w-0">
        <p className="font-medium sm:truncate">{l.nome}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {l.ref} · {l.qty} un.
          {b.porEnviar > 0 && ` · ${b.porEnviar} por enviar`}
        </p>
      </div>
      {/* Phone: three labelled cells in a row; sm+: the card header labels
          the columns. */}
      <div className="grid grid-cols-3 gap-2 sm:contents">
        <Celula rotulo="Em trânsito">
          <span
            className={cn(
              "flex h-8 items-center text-sm font-semibold tabular-nums",
              b.emTransito === 0 && "text-muted-foreground"
            )}
          >
            {b.emTransito}
          </span>
        </Celula>
        <Contador
          rotulo="Chegou"
          valor={b.noArmazem}
          tom="feito"
          podeMenos={e.estado === "paga" && b.noArmazem > 0}
          podeMais={b.emTransito > 0}
          onMenos={() =>
            mover(
              () => accoes.desfazerRececao(e.numero, l.id),
              resumo(b.noArmazem - 1, b.falhada)
            )
          }
          onMais={() =>
            mover(
              () => accoes.registarRececao(e.numero, l.id, 1),
              resumo(b.noArmazem + 1, b.falhada)
            )
          }
        />
        <Contador
          rotulo="Falhou"
          valor={b.falhada}
          tom="perigo"
          podeMenos={e.estado === "paga" && (aberto?.qty ?? 0) > 0}
          podeMais={b.porEnviar + b.emTransito > 0}
          onMenos={() =>
            mover(
              () => accoes.desfazerFalha(e.numero, l.id),
              resumo(b.noArmazem, b.falhada - 1)
            )
          }
          onMais={() =>
            mover(
              () => accoes.falharQty(e.numero, l.id, 1),
              `${resumo(b.noArmazem, b.falhada + 1)} · reembolso ao instalador`
            )
          }
        />
      </div>
    </li>
  )
}

/**
 * Small − n + pill, the client's `ControloQuantidade` shape. The number
 * takes the column's colour once it is above zero.
 */
function Contador({
  rotulo,
  valor,
  tom,
  podeMenos,
  podeMais,
  onMenos,
  onMais,
}: {
  rotulo: string
  valor: number
  tom: "feito" | "perigo"
  podeMenos: boolean
  podeMais: boolean
  onMenos: () => void
  onMais: () => void
}) {
  return (
    <Celula rotulo={rotulo}>
      <div
        role="group"
        aria-label={rotulo}
        className="inline-flex h-8 items-center rounded-full border bg-background"
      >
        <button
          type="button"
          onClick={onMenos}
          disabled={!podeMenos}
          aria-label={`${rotulo}: menos um`}
          className={CONTADOR_BOTAO}
        >
          <Minus className="size-3.5" />
        </button>
        <span
          aria-live="polite"
          className={cn(
            "min-w-6 text-center text-sm font-semibold tabular-nums transition-colors duration-150",
            valor === 0 && "text-muted-foreground",
            valor > 0 && tom === "feito" && "text-primary",
            valor > 0 && tom === "perigo" && "text-destructive"
          )}
        >
          {valor}
        </span>
        <button
          type="button"
          onClick={onMais}
          disabled={!podeMais}
          aria-label={`${rotulo}: mais um`}
          className={CONTADOR_BOTAO}
        >
          <Plus className="size-3.5" strokeWidth={2.25} />
        </button>
      </div>
    </Celula>
  )
}

/** Product | Em trânsito | Chegou | Falhou, shared by header and rows. */
const COLUNAS = "sm:grid-cols-[minmax(0,1fr)_6rem_6.5rem_6.5rem]"

/** One column cell: labelled on phones, centred under the header on sm+. */
function Celula({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1 sm:items-center">
      <span className="text-xs text-muted-foreground sm:hidden">{rotulo}</span>
      {children}
    </div>
  )
}

const CONTADOR_BOTAO =
  "flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-[background-color,transform] duration-150 ease-out outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/25 active:scale-[0.92] disabled:pointer-events-none disabled:opacity-30"

// --- the rest of the record, folded --------------------------------------------------

/** Lines, read only, for states where the work area doesn't show them. */
function LinhasLeitura({ e }: { e: Encomenda }) {
  return (
    <Seccao titulo="Produtos" contagem={restantes(e).length}>
      <ul className="divide-y text-sm">
        {e.linhas.map((l) => (
          <li
            key={l.id}
            className={cn(
              "flex items-center gap-4 px-5 py-3",
              l.estadoLinha === "retirada" &&
                "text-muted-foreground line-through"
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{l.nome}</span>
              <span className="text-xs text-muted-foreground">
                {nomeMarca(l.marca)} · {l.ref}
              </span>
            </span>
            {l.buckets && l.buckets.falhada > 0 && (
              <Marcador tom="perigo">{l.buckets.falhada} falhada</Marcador>
            )}
            <span className="w-12 text-right tabular-nums">× {l.qty}</span>
            <span className="w-24 text-right font-medium tabular-nums">
              {eur(l.precoRevendaCents * l.qty)}
            </span>
          </li>
        ))}
      </ul>
    </Seccao>
  )
}

/** A tiny valid PDF for prototype invoices that have no uploaded file. */
function pdfDeExemplo(nome: string): Blob {
  const texto = `Fatura de fornecedor (exemplo do protótipo): ${nome}`
  const stream = `BT /F1 12 Tf 72 720 Td (${texto.replace(/[()\\]/g, "")}) Tj ET`
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let pdf = "%PDF-1.4\n"
  const offsets: Array<number> = []
  objs.forEach((o, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((o) => (pdf += `${String(o).padStart(10, "0")} 00000 n \n`))
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([pdf], { type: "application/pdf" })
}

function descarregar(f: FaturaFornecedor) {
  const url = f.url ?? URL.createObjectURL(pdfDeExemplo(f.ficheiro))
  const a = document.createElement("a")
  a.href = url
  a.download = f.ficheiro
  a.click()
  if (!f.url) setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Supplier invoices of a paid order: download, replace or delete each PDF,
 * and add more (picking the supplier first when the order has several).
 */
function FaturasFornecedor({
  e,
  pedirConfirmacao,
}: {
  e: Encomenda
  pedirConfirmacao: (c: Confirmar) => void
}) {
  const entrada = useEntrada()
  const faturas = e.faturasFornecedor ?? []
  const fornecedores = marcas(e)
  const [aAdicionar, setAAdicionar] = useState(false)
  const [marca, setMarca] = useState(fornecedores[0] ?? "")

  function adicionar(ficheiro: File | undefined) {
    if (!ficheiro || !marca) return
    agir(`Fatura da ${nomeMarca(marca)} adicionada`, () =>
      accoes.adicionarFaturaFornecedor(
        e.numero,
        marca,
        ficheiro.name,
        URL.createObjectURL(ficheiro)
      )
    )
    setAAdicionar(false)
  }

  return (
    <Seccao
      titulo="Faturas de fornecedores"
      contagem={faturas.length}
      accoes={
        !aAdicionar && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAAdicionar(true)}
          >
            <Plus data-icon="inline-start" />
            Adicionar
          </Button>
        )
      }
    >
      {aAdicionar && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-secondary/30 px-5 py-3">
          {fornecedores.length > 1 && (
            <Seletor
              value={marca}
              onChange={(ev) => setMarca(ev.target.value)}
              className="min-w-0 flex-1"
              aria-label="Fornecedor"
            >
              {fornecedores.map((m) => (
                <option key={m} value={m}>
                  {nomeMarca(m)}
                </option>
              ))}
            </Seletor>
          )}
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-[color-mix(in_oklch,var(--primary),black_10%)] has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/25">
            <Plus className="size-4" />
            {fornecedores.length > 1
              ? "Escolher PDF"
              : `PDF da ${nomeMarca(marca)}`}
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(ev) => adicionar(ev.target.files?.[0])}
            />
          </label>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cancelar"
            onClick={() => setAAdicionar(false)}
          >
            <X />
          </Button>
        </div>
      )}
      {faturas.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">Sem faturas</p>
      ) : (
        <ul className="divide-y text-sm">
          {faturas.map((f) => {
            const ultima =
              e.estado === "paga" &&
              faturas.filter((x) => x.marca === f.marca).length === 1
            return (
              <li
                key={f.id}
                className={cn(
                  "flex items-center gap-2 py-2.5 pr-3 pl-5",
                  entrada
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {nomeMarca(f.marca)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {f.ficheiro} · {dataCurta(f.em)}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Descarregar ${f.ficheiro}`}
                  title="Descarregar"
                  onClick={() => descarregar(f)}
                >
                  <Download />
                </Button>
                <label
                  title="Substituir ficheiro"
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/25"
                >
                  <Pencil className="size-4" />
                  <span className="sr-only">Substituir {f.ficheiro}</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={(ev) => {
                      const novo = ev.target.files?.[0]
                      if (!novo) return
                      agir(`Fatura da ${nomeMarca(f.marca)} substituída`, () =>
                        accoes.substituirFaturaFornecedor(
                          e.numero,
                          f.id,
                          novo.name,
                          URL.createObjectURL(novo)
                        )
                      )
                    }}
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Apagar ${f.ficheiro}`}
                  title="Apagar"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    pedirConfirmacao({
                      titulo: "Apagar fatura?",
                      descricao: ultima
                        ? `É a única fatura da ${nomeMarca(f.marca)}: os produtos voltam a "por encomendar".`
                        : f.ficheiro,
                      confirmarLabel: "Apagar fatura",
                      onConfirmar: () =>
                        agir(`Fatura da ${nomeMarca(f.marca)} apagada`, () =>
                          accoes.removerFaturaFornecedor(e.numero, f.id)
                        ),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </Seccao>
  )
}

/** The record beside the work: money, contacts, documents, history. */
function Lateral({
  e,
  pedirConfirmacao,
}: {
  e: Encomenda
  pedirConfirmacao: (c: Confirmar) => void
}) {
  const entrada = useEntrada()
  const custo = custoCents(e)
  const total = totalCents(e)
  const [registoTodo, setRegistoTodo] = useState(false)
  const eventos = [...e.eventos].reverse()
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
      <Seccao titulo="Valores">
        <Valores
          itens={[
            { rotulo: "Total s/IVA", valor: eur(total) },
            { rotulo: `IVA ${IVA}%`, valor: eur(totalComIvaCents(e) - total) },
            {
              rotulo: "Total c/IVA",
              valor: <strong>{eur(totalComIvaCents(e))}</strong>,
            },
            custo !== null && {
              rotulo: "Margem",
              valor: `${eur(total - custo)} · ${Math.round(((total - custo) / total) * 100)}%`,
            },
            e.paidAt !== undefined && {
              rotulo: "Pago",
              valor: dataHoraCurta(e.paidAt),
            },
          ]}
        />
      </Seccao>

      <Seccao titulo="Cliente">
        <Valores
          itens={[
            { rotulo: "Empresa", valor: e.empresa.nome },
            { rotulo: "NIF", valor: e.empresa.nif },
            {
              rotulo: "Email",
              valor: (
                <a
                  href={`mailto:${e.empresa.email}`}
                  className="text-primary hover:underline"
                >
                  {e.empresa.email}
                </a>
              ),
            },
            {
              rotulo: "Telefone",
              valor: (
                <a
                  href={`tel:${e.empresa.telefone.replace(/\s/g, "")}`}
                  className="text-primary hover:underline"
                >
                  {e.empresa.telefone}
                </a>
              ),
            },
            { rotulo: "Colocada por", valor: e.colocadaPor.nome },
          ]}
        />
      </Seccao>

      {["paga", "pronta_a_levantar", "concluida"].includes(e.estado) && (
        <FaturasFornecedor e={e} pedirConfirmacao={pedirConfirmacao} />
      )}

      <Seccao titulo="Documentos" contagem={e.documentos.length}>
        {e.documentos.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            Fatura-recibo no pagamento · guia de transporte no levantamento
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {e.documentos.map((d) => (
              <li
                key={d.id}
                className={cn("flex items-center gap-3 px-5 py-3", entrada)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block">{DOCUMENTO_LABELS[d.tipo]}</span>
                  {d.numero && (
                    <span className="text-xs text-muted-foreground">
                      {d.numero}
                    </span>
                  )}
                </span>
                <Marcador
                  tom={
                    d.estado === "emitido"
                      ? "feito"
                      : d.estado === "erro"
                        ? "perigo"
                        : "aviso"
                  }
                >
                  {d.estado === "emitido"
                    ? "Emitido"
                    : d.estado === "erro"
                      ? "Erro"
                      : "A emitir"}
                </Marcador>
              </li>
            ))}
          </ul>
        )}
      </Seccao>

      <Seccao titulo="Registo" contagem={e.eventos.length}>
        <ol className="flex flex-col gap-3 px-5 py-4 text-sm">
          {(registoTodo ? eventos : eventos.slice(0, 5)).map((ev, i) => (
            <li
              key={e.eventos.length - 1 - i}
              className={cn("flex gap-3", entrada)}
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  ev.actor === "staff"
                    ? "bg-primary"
                    : ev.actor === "instalador"
                      ? "bg-brand"
                      : "bg-muted-foreground/40"
                )}
              />
              <span className="min-w-0">
                <span className="block">{ev.texto}</span>
                <span className="text-xs text-muted-foreground">
                  {ev.por} · {dataHoraCurta(ev.em)}
                </span>
              </span>
            </li>
          ))}
        </ol>
        {eventos.length > 5 && (
          <button
            type="button"
            onClick={() => setRegistoTodo((v) => !v)}
            className="flex w-full items-center justify-center gap-1 border-t py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
          >
            {registoTodo ? "Mostrar menos" : `Ver tudo (${eventos.length})`}
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                registoTodo && "rotate-180"
              )}
            />
          </button>
        )}
      </Seccao>
    </aside>
  )
}

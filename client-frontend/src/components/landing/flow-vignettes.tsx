import { Suspense } from "react"
import { convexQuery } from "@convex-dev/react-query"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Bell,
  Check,
  Landmark,
  Lock,
  MapPin,
  Plus,
  ShoppingBag,
} from "lucide-react"

import { api } from "@convex/_generated/api"
import type { CatalogProduct } from "@/components/catalogo/product-card"
import { EstadoBadge } from "@/components/encomendas/estado-badge"
import { eur, rotuloMarca } from "@/lib/catalogo"
import { cn } from "@/lib/utils"
import { useInView, useSequencia } from "./reveal"

/*
 * Each vignette is a small, self-animating rendering of the real screen for
 * that step, built from the same components and tokens as the app (badges,
 * cards, buttons) so it never drifts from the product. They play once when
 * scrolled into view.
 */

const EMPRESA = "Instalações Norte, Lda"
const ENCOMENDA = "ENC-0142"

// ---------------------------------------------------------------- frame ---

export function Janela({
  caminho,
  children,
  className,
}: {
  caminho: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "overflow-hidden rounded-xl border bg-background shadow-[0_24px_60px_-36px_rgb(0_0_0/0.35)]",
        className
      )}
    >
      <div className="flex h-9 items-center gap-3 border-b bg-muted/60 px-3.5">
        <span className="flex gap-1.5">
          <span className="size-2 rounded-full bg-border" />
          <span className="size-2 rounded-full bg-border" />
          <span className="size-2 rounded-full bg-border" />
        </span>
        <span className="mx-auto flex h-5 max-w-[16rem] flex-1 items-center justify-center truncate rounded-md border bg-background px-2 text-[10px] text-muted-foreground">
          climaeco.pt/{caminho}
        </span>
        <span className="w-9" />
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  )
}

function Campo({
  rotulo,
  valor,
  className,
}: {
  rotulo: string
  valor: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-medium text-muted-foreground">
        {rotulo}
      </span>
      <span className="flex h-8 items-center rounded-md border bg-background px-2.5 text-xs">
        {valor}
      </span>
    </div>
  )
}

function Botao({
  children,
  variante = "primario",
  className,
}: {
  children: React.ReactNode
  variante?: "primario" | "contorno"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap",
        variante === "primario"
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background",
        className
      )}
    >
      {children}
    </span>
  )
}

function Passo({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className="surge" data-on={on}>
      {children}
    </span>
  )
}

// ------------------------------------------------------------ 1. registo ---

export function VinhetaRegisto() {
  const { ref, visivel } = useInView<HTMLDivElement>()
  const fase = useSequencia(visivel, [900, 1300])

  return (
    <div ref={ref}>
      <Janela caminho="registo">
        <div className="mx-auto max-w-sm">
          <p className="text-sm font-semibold">Registar empresa</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Conta reservada a empresas instaladoras e projetistas.
          </p>
          <div className="mt-4 grid gap-3">
            <Campo rotulo="Nome da empresa" valor={EMPRESA} />
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="NIF" valor="510 123 456" />
              <Campo rotulo="Telefone" valor="+351 912 345 678" />
            </div>
            <Campo rotulo="Morada" valor="Rua da Indústria 12, 4470 Maia" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Botao>{fase >= 1 ? "Pedido enviado" : "Enviar pedido"}</Botao>
            <div className="relative h-6 min-w-[9rem] text-right">
              <span
                className="surge absolute inset-y-0 right-0 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 text-xs font-medium text-amber-800 ring-1 ring-amber-600/20 ring-inset"
                data-on={fase === 1}
              >
                <span className="size-1.5 rounded-full bg-amber-500" /> Em
                análise
              </span>
              <span
                className="surge absolute inset-y-0 right-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-600/20 ring-inset"
                data-on={fase >= 2}
              >
                <Check className="size-3" strokeWidth={3} /> Empresa aprovada
              </span>
            </div>
          </div>
        </div>
      </Janela>
    </div>
  )
}

// ------------------------------------------------------------- 2. preços ---

export function VinhetaPrecos() {
  return (
    <Suspense
      fallback={
        <Janela caminho="produtos">
          <div className="h-56" />
        </Janela>
      }
    >
      <VinhetaPrecosComDados />
    </Suspense>
  )
}

function VinhetaPrecosComDados() {
  const { data } = useSuspenseQuery(
    convexQuery(api.produtos.listarCatalogo, { pagina: 0, porPagina: 8 })
  )
  const produtos = data.entradas.filter((p) => p.capaUrl).slice(0, 3)
  const { ref, visivel } = useInView<HTMLDivElement>()
  const fase = useSequencia(visivel, [900, 700])

  return (
    <div ref={ref}>
      <Janela caminho="produtos">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium">
            <Lock className="size-3 text-primary" /> {EMPRESA} · preços de
            distribuidor
          </span>
          <span className="relative inline-flex size-8 items-center justify-center rounded-lg border">
            <ShoppingBag className="size-4" />
            <span
              className="surge absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
              data-on={fase >= 1}
            >
              {fase >= 2 ? 2 : 1}
            </span>
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {produtos.map((p, i) => (
            <MiniProduto
              key={p.grupoModelo}
              produto={p}
              desconto={[18, 22, 25][i] ?? 20}
              adicionado={(i === 0 && fase >= 1) || (i === 1 && fase >= 2)}
              className={i === 2 ? "hidden sm:flex" : undefined}
            />
          ))}
        </div>
      </Janela>
    </div>
  )
}

function MiniProduto({
  produto,
  desconto,
  adicionado,
  className,
}: {
  produto: CatalogProduct
  desconto: number
  adicionado: boolean
  className?: string
}) {
  const pvp = produto.precoDesdeCents / 100
  const revenda = Math.round(pvp * (1 - desconto / 100))
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border bg-card",
        className
      )}
    >
      <div className="flex h-20 items-center justify-center bg-muted">
        <img
          src={produto.capaUrl ?? ""}
          alt=""
          className="size-full object-contain p-2"
        />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {rotuloMarca(produto.marca)}
        </p>
        <p className="line-clamp-2 text-xs leading-snug font-semibold">
          {produto.nome}
        </p>
        <p className="mt-1.5 text-[10px] text-muted-foreground line-through">
          {eur.format(pvp)}
        </p>
        <p className="text-sm font-semibold text-primary">
          {eur.format(revenda)}
        </p>
        <span
          className={cn(
            "mt-2 inline-flex h-7 items-center justify-center gap-1 rounded-md border text-[11px] font-medium transition-colors",
            adicionado
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background"
          )}
        >
          {adicionado ? (
            <>
              <Check className="size-3" strokeWidth={3} /> Adicionado
            </>
          ) : (
            <>
              <Plus className="size-3" /> Adicionar
            </>
          )}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------- 3. encomenda ---

const LINHAS = [
  {
    nome: "Armário Vertical FVA-A 10 kW",
    marca: "Daikin",
    qtd: 2,
    preco: 1365,
  },
  {
    nome: "Hi-Therma R32 Split 8 kW · Ext.",
    marca: "Hisense",
    qtd: 1,
    preco: 1323,
  },
  { nome: "Armário Magnum 9,5 kW", marca: "Nipon", qtd: 1, preco: 1382 },
]
const SUBTOTAL = LINHAS.reduce((s, l) => s + l.qtd * l.preco, 0)

function TabelaLinhas({
  estadoLinha,
}: {
  /** Number of lines shown as "Stock confirmado" (from the top). */
  estadoLinha?: number
}) {
  return (
    <div className="divide-y rounded-lg border">
      {LINHAS.map((l, i) => (
        <div
          key={l.nome}
          className="flex items-center gap-3 px-3 py-2.5 text-xs"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{l.nome}</p>
            <p className="text-[11px] text-muted-foreground">
              {l.marca} · {l.qtd} un.
            </p>
          </div>
          {estadoLinha !== undefined ? (
            <span className="relative h-5 w-32 text-right">
              <span
                className="surge absolute inset-y-0 right-0 inline-flex items-center gap-1 rounded-full bg-muted px-2 text-[11px] font-medium whitespace-nowrap text-muted-foreground"
                data-on={i >= estadoLinha}
              >
                Por confirmar
              </span>
              <span
                className="surge absolute inset-y-0 right-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 text-[11px] font-medium whitespace-nowrap text-emerald-800 ring-1 ring-emerald-600/20 ring-inset"
                data-on={i < estadoLinha}
              >
                <Check className="size-3" strokeWidth={3} /> Stock confirmado
              </span>
            </span>
          ) : (
            <span className="font-semibold tabular-nums">
              {eur.format(l.qtd * l.preco)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

export function VinhetaEncomenda() {
  const { ref, visivel } = useInView<HTMLDivElement>()
  const fase = useSequencia(visivel, [1100])

  return (
    <div ref={ref}>
      <Janela caminho="conta/encomendas">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Nova encomenda</p>
          <Passo on={fase >= 1}>
            <EstadoBadge estado="recebida" />
          </Passo>
        </div>
        <div className="mt-3">
          <TabelaLinhas />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0 text-[11px] text-muted-foreground">
            <p>
              Subtotal s/IVA{" "}
              <span className="font-medium text-foreground tabular-nums">
                {eur.format(SUBTOTAL)}
              </span>
            </p>
            <p>Preços congelados após submissão</p>
          </div>
          <Botao
            className={cn(fase >= 1 && "border-emerald-700 bg-emerald-700")}
          >
            {fase >= 1 ? (
              <>
                <Check className="size-3.5" strokeWidth={3} /> Encomenda{" "}
                {ENCOMENDA}
              </>
            ) : (
              "Submeter encomenda"
            )}
          </Botao>
        </div>
      </Janela>
    </div>
  )
}

// -------------------------------------------------------------- 4. stock ---

export function VinhetaStock() {
  const { ref, visivel } = useInView<HTMLDivElement>()
  const fase = useSequencia(visivel, [800, 600, 600, 700])
  const confirmadas = Math.min(fase, 3)

  return (
    <div ref={ref}>
      <Janela caminho={`conta/encomendas/${ENCOMENDA}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Encomenda {ENCOMENDA}</p>
          <span className="relative h-6 w-36 text-right">
            <span
              className="surge absolute inset-y-0 right-0"
              data-on={fase < 4}
            >
              <EstadoBadge estado="aguardando_stock" />
            </span>
            <span
              className="surge absolute inset-y-0 right-0"
              data-on={fase >= 4}
            >
              <EstadoBadge estado="aguardando_pagamento" />
            </span>
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Confirmamos a disponibilidade de cada linha junto dos fornecedores.
        </p>
        <div className="mt-3">
          <TabelaLinhas estadoLinha={confirmadas} />
        </div>
        <p className="surge mt-3 text-xs text-emerald-800" data-on={fase >= 4}>
          <Check className="mr-1 inline size-3.5" strokeWidth={3} />
          Stock confirmado em todas as linhas — enviámos o pedido de pagamento.
        </p>
      </Janela>
    </div>
  )
}

// ---------------------------------------------------------- 5. pagamento ---

export function VinhetaPagamento() {
  const { ref, visivel } = useInView<HTMLDivElement>()
  const fase = useSequencia(visivel, [1000, 1200])
  const total = SUBTOTAL * 1.23

  return (
    <div ref={ref}>
      <Janela caminho="pagamento">
        <div className="mx-auto max-w-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Pagamento · {ENCOMENDA}</p>
            <span className="relative h-6 w-32 text-right">
              <span
                className="surge absolute inset-y-0 right-0"
                data-on={fase < 2}
              >
                <EstadoBadge estado="aguardando_pagamento" />
              </span>
              <span
                className="surge absolute inset-y-0 right-0"
                data-on={fase >= 2}
              >
                <EstadoBadge estado="paga" />
              </span>
            </span>
          </div>
          <div className="mt-4 rounded-lg border bg-muted/40 p-4">
            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span>Subtotal s/IVA</span>
              <span className="tabular-nums">{eur.format(SUBTOTAL)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between text-xs text-muted-foreground">
              <span>IVA 23%</span>
              <span className="tabular-nums">
                {eur.format(SUBTOTAL * 0.23)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t pt-2">
              <span className="text-xs font-medium">Total a pagar</span>
              <span className="text-lg font-semibold tabular-nums">
                {eur.format(total)}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Botao
              className={cn(
                "flex-1 transition-colors",
                fase >= 2 && "border-emerald-700 bg-emerald-700"
              )}
            >
              {fase >= 2 ? (
                <>
                  <Check className="size-3.5" strokeWidth={3} /> Pagamento
                  recebido
                </>
              ) : fase >= 1 ? (
                "A confirmar transferência…"
              ) : (
                <>
                  <Landmark className="size-3.5" /> Pagar por transferência
                </>
              )}
            </Botao>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Link de pagamento válido 7 dias. Fatura-recibo emitida após o
            pagamento.
          </p>
        </div>
      </Janela>
    </div>
  )
}

// ------------------------------------------------------- 6. levantamento ---

export function VinhetaLevantamento() {
  const { ref, visivel } = useInView<HTMLDivElement>()
  const fase = useSequencia(visivel, [800])

  return (
    <div ref={ref}>
      <Janela caminho={`conta/encomendas/${ENCOMENDA}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Encomenda {ENCOMENDA}</p>
          <EstadoBadge estado="concluida" />
        </div>
        <div
          className="surge mt-4 flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
          data-on={fase >= 1}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bell className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              Equipamentos disponíveis para levantamento
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              4 de 4 unidades já estão no nosso armazém. Traga a referência da
              encomenda.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium">
              <MapPin className="size-3.5 text-primary" /> Armazém Clima Eco ·
              Lisboa
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          {[
            ["Pagas", "4"],
            ["Disponíveis", "4"],
            ["Levantadas", "0"],
          ].map(([r, v]) => (
            <div key={r} className="rounded-lg border p-2.5">
              <p className="text-lg font-semibold tabular-nums">{v}</p>
              <p className="text-[11px] text-muted-foreground">{r}</p>
            </div>
          ))}
        </div>
      </Janela>
    </div>
  )
}

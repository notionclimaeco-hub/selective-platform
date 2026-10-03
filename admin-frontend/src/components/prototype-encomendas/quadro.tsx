// PROTOTYPE (#86) — the chosen direction: orders as a kanban board by state;
// a card opens the order's ticket page (`/prototype/encomendas/<n>`), built
// around whose move it is.

import { useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { ChevronDown, Search, Truck, UserRound } from "lucide-react"

import {
  Cabecalho,
  Cartao,
  Destaque,
  Marcador,
  Tabela,
  Td,
  Th,
  campoCls,
  linhaCls,
} from "@/components/ui/tabela"
import { cn } from "@/lib/utils"
import { chipCls } from "./comum"
import {
  ETAPAS_QUADRO,
  ETAPA_LABELS,
  FASE_LABELS,
  ETAPA_TOM,
  etapa,
  MARCA_LABELS,
  dataCurta,
  enc,
  esperaPor,
  eur,
  ha,
  totalCents,
  useEncomendas,
} from "./fixtures"
import type { Encomenda, Espera, Vez } from "./fixtures"

type Filtro = "todas" | "nos" | "cliente" | "fornecedor"

const FILTROS: Array<{ chave: Filtro; nome: string }> = [
  { chave: "todas", nome: "Todas" },
  { chave: "nos", nome: "A minha vez" },
  { chave: "cliente", nome: "À espera do cliente" },
  { chave: "fornecedor", nome: "À espera do fornecedor" },
]

/** Our move first, then late waits, then the longest wait. */
function ordenar(
  a: { e: Encomenda; s: Espera },
  b: { e: Encomenda; s: Espera }
) {
  const peso = (x: Espera) => (x.vez === "nos" ? 0 : x.atrasada ? 1 : 2)
  return peso(a.s) - peso(b.s) || (a.s.desde ?? 0) - (b.s.desde ?? 0)
}

export function Quadro() {
  const todas = useEncomendas()
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState<Filtro>("todas")
  const [pesquisa, setPesquisa] = useState("")
  const [fechadasAbertas, setFechadasAbertas] = useState(false)

  const comEspera = useMemo(() => {
    const q = pesquisa.trim().toLowerCase()
    return todas
      .filter(
        (e) =>
          !q ||
          enc(e.numero).toLowerCase().includes(q) ||
          String(e.numero).includes(q) ||
          e.empresa.nome.toLowerCase().includes(q)
      )
      .map((e) => ({ e, s: esperaPor(e) }))
  }, [todas, pesquisa])

  const abertas = comEspera.filter(
    (x) => x.e.estado !== "concluida" && x.e.estado !== "cancelada"
  )
  const contagem = (v: Vez) => comEspera.filter((x) => x.s.vez === v).length
  const visiveis = abertas.filter(
    (x) => filtro === "todas" || x.s.vez === filtro
  )
  const fechadas = comEspera
    .filter((x) => x.e.estado === "concluida" || x.e.estado === "cancelada")
    .sort((a, b) => b.e.placedAt - a.e.placedAt)
  const fechadasComAccao = fechadas.filter((x) => x.s.vez === "nos").length

  function abrir(numero: number) {
    void navigate({
      to: "/prototype/encomendas/$numero",
      params: { numero: String(numero) },
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <Cabecalho
        titulo="Encomendas"
        meta={`${abertas.length} em curso · ${contagem("nos")} à tua espera`}
      >
        <label className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={cn(campoCls, "w-full pl-9")}
            value={pesquisa}
            onChange={(ev) => setPesquisa(ev.target.value)}
            placeholder="Nº ou empresa"
          />
        </label>
      </Cabecalho>

      <div className="sem-scrollbar -mx-4 -mt-2 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTROS.map((f) => {
          const n = f.chave === "todas" ? abertas.length : contagem(f.chave)
          return (
            <button
              key={f.chave}
              type="button"
              aria-pressed={filtro === f.chave}
              onClick={() => setFiltro(f.chave)}
              className={chipCls(filtro === f.chave)}
            >
              {f.chave === "nos" && n > 0 && <Destaque />}
              {f.nome}
              <span className="tabular-nums opacity-70">{n}</span>
            </button>
          )
        })}
      </div>

      {/* The board: one lane per open state; scrolls sideways on small screens. */}
      <div className="sem-scrollbar -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[60rem] grid-cols-6 gap-2.5">
          {ETAPAS_QUADRO.map((estado) => {
            const cartoes = visiveis
              .filter((x) => etapa(x.e) === estado)
              .sort(ordenar)
            return (
              <section
                key={estado}
                aria-label={FASE_LABELS[estado]}
                className="flex min-h-64 flex-col gap-2 rounded-xl bg-secondary/60 p-2"
              >
                <header className="flex items-center justify-between px-2 pt-1 pb-0.5">
                  <Marcador tom={ETAPA_TOM[estado]}>
                    {FASE_LABELS[estado]}
                  </Marcador>
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    {cartoes.length}
                  </span>
                </header>
                {cartoes.map(({ e, s }) => (
                  <CartaoEncomenda key={e.numero} e={e} s={s} />
                ))}
                {cartoes.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    —
                  </p>
                )}
              </section>
            )
          })}
        </div>
      </div>

      {/* Closed orders stay out of the board, one click away. */}
      <Cartao>
        <button
          type="button"
          onClick={() => setFechadasAbertas((v) => !v)}
          aria-expanded={fechadasAbertas}
          className="flex min-h-14 w-full items-center justify-between gap-4 px-5 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            Fechadas
            <span className="font-normal text-muted-foreground tabular-nums">
              {fechadas.length}
            </span>
            {fechadasComAccao > 0 && <Destaque />}
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              fechadasAbertas && "rotate-180"
            )}
          />
        </button>
        {fechadasAbertas && (
          <div className="border-t">
            <Tabela>
              <thead>
                <tr>
                  <Th>Encomenda</Th>
                  <Th>Empresa</Th>
                  <Th>Estado</Th>
                  <Th className="hidden sm:table-cell">Colocada</Th>
                  <Th num>Total s/IVA</Th>
                </tr>
              </thead>
              <tbody>
                {fechadas.map(({ e, s }) => (
                  <tr
                    key={e.numero}
                    onClick={() => abrir(e.numero)}
                    className={cn(linhaCls, "cursor-pointer")}
                  >
                    <Td className="font-semibold whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        {s.vez === "nos" && <Destaque />}
                        {enc(e.numero)}
                      </span>
                    </Td>
                    <Td className="max-w-0 min-w-40 truncate">
                      {e.empresa.nome}
                    </Td>
                    <Td>
                      <Marcador tom={ETAPA_TOM[etapa(e)]}>
                        {ETAPA_LABELS[etapa(e)]}
                      </Marcador>
                    </Td>
                    <Td className="hidden text-muted-foreground sm:table-cell">
                      {dataCurta(e.placedAt)}
                    </Td>
                    <Td num>{eur(totalCents(e))}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          </div>
        )}
      </Cartao>
    </main>
  )
}

function CartaoEncomenda({ e, s }: { e: Encomenda; s: Espera }) {
  return (
    <Link
      to="/prototype/encomendas/$numero"
      params={{ numero: String(e.numero) }}
      className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 text-left shadow-xs transition-[border-color,box-shadow,scale] duration-150 ease-out outline-none hover:border-foreground/20 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/25 active:scale-[0.98]"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{enc(e.numero)}</span>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {eur(totalCents(e))}
        </span>
      </span>
      <span className="truncate text-sm">{e.empresa.nome}</span>
      <EsperaChip s={s} />
    </Link>
  )
}

/** Whose move: green when it's ours (the action), grey when it waits on the
 *  installer or a supplier (who, and for how long). */
export function EsperaChip({
  s,
  className,
}: {
  s: Espera
  className?: string
}) {
  if (s.vez === "ninguem") return null
  if (s.vez === "nos") {
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-start gap-1.5 self-start rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/20 ring-inset",
          className
        )}
      >
        <span
          aria-hidden
          className="mt-[5px] size-1.5 shrink-0 rounded-full bg-primary"
        />
        <span>{s.titulo}</span>
      </span>
    )
  }
  const Icone = s.vez === "cliente" ? UserRound : Truck
  const quem =
    s.vez === "cliente"
      ? "Cliente"
      : (s.marcas ?? []).map((m) => MARCA_LABELS[m] ?? m).join(", ") ||
        "Fornecedor"
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-start gap-1.5 self-start rounded-lg bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border ring-inset",
        className
      )}
    >
      <Icone className="mt-0.5 size-3 shrink-0" />
      <span>
        {quem}
        {s.desde ? ` · ${ha(s.desde)}` : ""}
      </span>
    </span>
  )
}

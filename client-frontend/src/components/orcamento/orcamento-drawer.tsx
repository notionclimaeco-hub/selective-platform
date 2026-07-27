import { Link } from "@tanstack/react-router"
import { FileText, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { eurExato, iconeFamilia, rotuloMarca } from "@/lib/catalogo"
import { QuantityStepper } from "./quantity-stepper"
import { useOrcamento, type ItemOrcamento } from "./orcamento-store"

// Right-side slide-over listing the products the client has gathered for a
// quote request. Building the list needs no login; submitting will (once the
// client area exists), so the submit action is intentionally stubbed for now.
export function OrcamentoDrawer() {
  const { aberto, fechar, itens, totalItens, totalCents, limpar } =
    useOrcamento()

  return (
    <div
      className={`fixed inset-0 z-[60] ${aberto ? "" : "pointer-events-none"}`}
      aria-hidden={!aberto}
    >
      {/* Overlay */}
      <div
        onClick={fechar}
        className={`absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 ${
          aberto ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
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
                  <LinhaOrcamento key={item.ref} ref_={item.ref} />
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

            <footer className="border-t px-5 py-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  Total indicativo (PVP s/IVA)
                </span>
                <span className="text-xl font-semibold text-primary">
                  {eurExato.format(totalCents / 100)}
                </span>
              </div>
              <Button size="lg" disabled className="w-full">
                Pedir orçamento
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Área de cliente em breve: inicie sessão para enviar o pedido e
                receber o seu preço de revenda.
              </p>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}

function LinhaOrcamento({ ref_ }: { ref_: string }) {
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
            {eurExato.format((item.pvpCents * item.quantidade) / 100)}
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

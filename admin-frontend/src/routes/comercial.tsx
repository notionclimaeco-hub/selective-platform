import { useState } from "react"
import type { FormEvent } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react"
import { toast } from "sonner"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { CelulaEditavel } from "@/components/comercial/celula-editavel"
import { Button } from "@/components/ui/button"
import { LinhasEsqueleto } from "@/components/ui/skeleton"
import {
  Cabecalho,
  Seccao,
  Tabela,
  Td,
  Th,
  Vazio,
  campoCls,
  linhaCls,
} from "@/components/ui/tabela"
import { eurosDeCents } from "@/lib/labels"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/comercial")({ component: ComercialPage })

const PERCENT = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 })

/** The table header tint, opaque, for the sticky Marca column. */
const FUNDO_CABECALHO =
  "bg-[color-mix(in_oklch,var(--secondary)_40%,var(--card))]"

function mensagemErro(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

/** "12,5" / "12.5" / "" (= 0) → number, the way the old inputs parsed. */
function numero(texto: string) {
  return Number(texto.replace(",", "."))
}

function ComercialPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <Cabecalho titulo="Comercial" />

      <AuthLoading>
        <p className="text-sm text-muted-foreground">A verificar sessão…</p>
      </AuthLoading>
      <Unauthenticated>
        <p className="text-sm text-destructive">
          Sessão não autenticada com o Convex.
        </p>
      </Unauthenticated>
      <Authenticated>
        <Tiers />
        <Matriz />
      </Authenticated>
    </main>
  )
}

function Tiers() {
  const tiers = useQuery(api.comercial.listarTiers, {})
  const criar = useMutation(api.comercial.criarTier)
  const atualizar = useMutation(api.comercial.atualizarTier)
  const [nome, setNome] = useState("")
  const [limiarEuros, setLimiarEuros] = useState("")
  const [erro, setErro] = useState<string | null>(null)

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const euros = numero(limiarEuros)
    if (!Number.isFinite(euros) || euros < 0) {
      setErro("Limiar inválido.")
      return
    }
    try {
      await criar({
        nome,
        limiarCents: Math.round(euros * 100),
      })
      setNome("")
      setLimiarEuros("")
      toast("Tier criado.")
    } catch (err) {
      setErro(mensagemErro(err, "Erro ao criar tier."))
    }
  }

  async function alternarAtiva(
    tierId: Id<"tiers">,
    nomeTier: string,
    ativa: boolean
  ) {
    try {
      await atualizar({ tierId, ativa })
      toast(`${nomeTier} ${ativa ? "activado" : "desactivado"}.`, {
        action: {
          label: "Reverter",
          onClick: () => {
            atualizar({ tierId, ativa: !ativa }).catch((err: unknown) =>
              toast.error(mensagemErro(err, "Não foi possível reverter."))
            )
          },
        },
      })
    } catch (err) {
      toast.error(mensagemErro(err, "Erro ao actualizar tier."))
    }
  }

  return (
    <Seccao titulo="Tiers" contagem={tiers?.length ?? "…"}>
      {tiers === undefined ? (
        <LinhasEsqueleto
          colunas={["w-24", "ml-auto w-20", "h-5 w-9 rounded-full"]}
        />
      ) : (
        <Tabela>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th num className="pr-12">
                Limiar
              </Th>
              <Th className="w-px text-center">Activo</Th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <tr
                key={tier._id}
                className={cn(linhaCls, !tier.ativa && "text-muted-foreground")}
              >
                <Td className="py-1.5">
                  <CelulaEditavel
                    alinhar="esquerda"
                    inputMode="text"
                    larguraEditor="w-full min-w-28 sm:w-56"
                    rotulo={`nome do tier ${tier.nome}`}
                    valor={tier.nome}
                    mostrar={<span className="font-medium">{tier.nome}</span>}
                    paraRascunho={(v) => v}
                    ler={(t) =>
                      t.trim() === ""
                        ? { erro: "O nome não pode ficar vazio." }
                        : { valor: t.trim() }
                    }
                    mensagem={(v) => `Tier renomeado para ${v}.`}
                    onGuardar={(v) => atualizar({ tierId: tier._id, nome: v })}
                  />
                </Td>
                <Td num className="py-1.5">
                  <CelulaEditavel
                    sufixo="€"
                    larguraEditor="w-24"
                    rotulo={`limiar do tier ${tier.nome}`}
                    valor={tier.limiarCents}
                    mostrar={eurosDeCents(tier.limiarCents)}
                    bloqueado={
                      tier.slug === "base"
                        ? "O tier Base fica sempre com limiar 0"
                        : undefined
                    }
                    paraRascunho={(c) => (c / 100).toString().replace(".", ",")}
                    ler={(t) => {
                      const euros = numero(t)
                      return !Number.isFinite(euros) || euros < 0
                        ? { erro: "Limiar inválido." }
                        : { valor: Math.round(euros * 100) }
                    }}
                    mensagem={(c) =>
                      `Limiar de ${tier.nome}: ${eurosDeCents(c)}.`
                    }
                    onGuardar={(c) =>
                      atualizar({ tierId: tier._id, limiarCents: c })
                    }
                  />
                </Td>
                <Td className="py-1.5 text-center">
                  <input
                    type="checkbox"
                    aria-label={`${tier.nome} activo`}
                    className="size-4 align-middle accent-primary disabled:opacity-50"
                    checked={tier.ativa}
                    disabled={tier.slug === "base"}
                    title={
                      tier.slug === "base"
                        ? "O tier Base está sempre activo"
                        : undefined
                    }
                    onChange={(e) =>
                      void alternarAtiva(tier._id, tier.nome, e.target.checked)
                    }
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}

      <form
        onSubmit={(e) => void adicionar(e)}
        className="flex flex-wrap items-end gap-x-3 gap-y-3 border-t px-5 py-4"
      >
        <label className="flex min-w-0 basis-full flex-col gap-1.5 sm:basis-auto">
          <span className="text-sm font-medium">Novo tier</span>
          <input
            className={cn(campoCls, "w-full min-w-0 sm:w-56")}
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Limiar (€)</span>
          <input
            className={cn(campoCls, "w-32 text-right tabular-nums")}
            inputMode="decimal"
            placeholder="10000"
            value={limiarEuros}
            onChange={(e) => setLimiarEuros(e.target.value)}
            required
          />
        </label>
        <Button type="submit" variant="outline">
          Adicionar
        </Button>
        {erro && (
          <p role="alert" className="basis-full text-sm text-destructive">
            {erro}
          </p>
        )}
      </form>
    </Seccao>
  )
}

function Matriz() {
  const data = useQuery(api.comercial.listarMatriz, {})
  const definir = useMutation(api.comercial.definirDesconto)

  const porPar = new Map<string, number>()
  for (const c of data?.celulas ?? []) {
    porPar.set(`${c.marca}:${c.tierId}`, c.descontoPercent)
  }

  return (
    <Seccao
      titulo="Desconto marca × tier"
      contagem={data ? `${data.marcas.length} × ${data.tiers.length}` : "…"}
      accoes={<span className="tabular-nums">0 % = PVP</span>}
    >
      {data === undefined ? (
        <LinhasEsqueleto colunas={["w-24", "ml-auto w-14", "w-14", "w-14"]} />
      ) : data.marcas.length === 0 ? (
        <Vazio>
          Não há marcas activas. Importa o catálogo para preencher a grelha.
        </Vazio>
      ) : (
        <Tabela>
          <thead>
            <tr>
              <Th
                className={cn("sticky left-0 z-10 border-r", FUNDO_CABECALHO)}
              >
                Marca
              </Th>
              {data.tiers.map((tier) => (
                <Th
                  key={tier._id}
                  num
                  className={cn(
                    "w-36 pr-12",
                    !tier.ativa && "text-muted-foreground/70"
                  )}
                >
                  {tier.nome}
                  <span className="block font-normal">
                    ≥ {eurosDeCents(tier.limiarCents)}
                    {!tier.ativa && " · inactivo"}
                  </span>
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.marcas.map((marca) => (
              <tr key={marca.slug} className={linhaCls}>
                <Td className="sticky left-0 z-10 border-r bg-card font-medium whitespace-nowrap transition-colors [tr:hover>&]:bg-[color-mix(in_oklch,var(--secondary)_40%,var(--card))]">
                  {marca.nome}
                </Td>
                {data.tiers.map((tier) => {
                  const desconto = porPar.get(`${marca.slug}:${tier._id}`) ?? 0
                  return (
                    <Td
                      key={tier._id}
                      num
                      className={cn(
                        "py-1.5",
                        !tier.ativa && "text-muted-foreground"
                      )}
                    >
                      <CelulaEditavel
                        discreto
                        sufixo="%"
                        rotulo={`desconto ${marca.nome}, ${tier.nome}`}
                        valor={desconto}
                        mostrar={
                          <span
                            className={cn(
                              desconto === 0
                                ? "text-muted-foreground"
                                : "font-medium"
                            )}
                          >
                            {PERCENT.format(desconto)} %
                          </span>
                        }
                        paraRascunho={(n) => String(n).replace(".", ",")}
                        ler={(t) => {
                          const n = numero(t)
                          return !Number.isFinite(n) || n < 0 || n > 100
                            ? { erro: "O desconto tem de estar entre 0 e 100." }
                            : { valor: n }
                        }}
                        mensagem={(n) =>
                          `${marca.nome} · ${tier.nome}: ${PERCENT.format(n)} %.`
                        }
                        onGuardar={(n) =>
                          definir({
                            marca: marca.slug,
                            tierId: tier._id,
                            descontoPercent: n,
                          })
                        }
                      />
                    </Td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </Seccao>
  )
}

import { useEffect, useState, type FormEvent } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/comercial")({ component: ComercialPage })

const inputCls =
  "h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

function ComercialPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-foreground">
          Contas
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Comercial</h1>
        <p className="text-sm text-muted-foreground">
          Tiers e grelha de desconto marca × tier. Célula vazia = 0% (revenda =
          PVP). Independente do desconto de fornecedor em Marcas.
        </p>
      </div>

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
    const euros = Number(limiarEuros.replace(",", "."))
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
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar tier.")
    }
  }

  async function gravar(
    tierId: Id<"tiers">,
    patch: { nome?: string; limiarCents?: number; ativa?: boolean },
  ) {
    setErro(null)
    try {
      await atualizar({ tierId, ...patch })
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao actualizar tier.")
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-medium">Tiers</h2>
      {erro && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      <div className="overflow-x-auto rounded-2xl border bg-card">
        {/* Three narrow columns: no min-width so it fits a 320px phone. */}
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium sm:px-4">Nome</th>
              <th className="px-3 py-2.5 font-medium sm:px-4">Limiar</th>
              <th className="px-3 py-2.5 font-medium sm:px-4">Activo</th>
            </tr>
          </thead>
          <tbody>
            {(tiers ?? []).map((tier) => (
              <tr key={tier._id} className="border-b last:border-0">
                <td className="px-3 py-2 sm:px-4">
                  <input
                    className={cn(inputCls, "w-full min-w-24")}
                    defaultValue={tier.nome}
                    onBlur={(e) => {
                      const next = e.target.value.trim()
                      if (next !== "" && next !== tier.nome) {
                        void gravar(tier._id, { nome: next })
                      }
                    }}
                  />
                </td>
                <td className="px-3 py-2 sm:px-4">
                  <input
                    className={cn(inputCls, "w-20 sm:w-36")}
                    inputMode="decimal"
                    defaultValue={(tier.limiarCents / 100).toString()}
                    disabled={tier.slug === "base"}
                    title={
                      tier.slug === "base"
                        ? "O tier Base fica sempre com limiar 0"
                        : undefined
                    }
                    onBlur={(e) => {
                      const euros = Number(e.target.value.replace(",", "."))
                      if (!Number.isFinite(euros) || euros < 0) return
                      const cents = Math.round(euros * 100)
                      if (cents !== tier.limiarCents) {
                        void gravar(tier._id, { limiarCents: cents })
                      }
                    }}
                  />
                </td>
                <td className="px-3 py-2 sm:px-4">
                  <input
                    type="checkbox"
                    checked={tier.ativa}
                    disabled={tier.slug === "base"}
                    onChange={(e) =>
                      void gravar(tier._id, { ativa: e.target.checked })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={(e) => void adicionar(e)}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm sm:flex-none">
          <span className="text-muted-foreground">Novo tier</span>
          <input
            className={cn(inputCls, "w-full min-w-0 sm:w-48")}
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Limiar (€)</span>
          <input
            className={cn(inputCls, "w-32")}
            placeholder="10000"
            value={limiarEuros}
            onChange={(e) => setLimiarEuros(e.target.value)}
            required
          />
        </label>
        <Button type="submit" variant="outline">
          Adicionar
        </Button>
      </form>
    </section>
  )
}

function Matriz() {
  const data = useQuery(api.comercial.listarMatriz, {})
  const definir = useMutation(api.comercial.definirDesconto)
  const [rascunho, setRascunho] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    const next: Record<string, string> = {}
    for (const c of data.celulas) {
      next[`${c.marca}:${c.tierId}`] = String(c.descontoPercent)
    }
    setRascunho(next)
  }, [data])

  if (data === undefined) {
    return <p className="text-sm text-muted-foreground">A carregar matriz…</p>
  }

  if (data.marcas.length === 0) {
    return (
      <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
        Não há marcas activas. Importa o catálogo para preencher a grelha.
      </p>
    )
  }

  async function gravarCelula(
    marca: string,
    tierId: Id<"tiers">,
    valor: string,
  ) {
    setErro(null)
    const n = Number(valor.replace(",", "."))
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setErro("O desconto tem de estar entre 0 e 100.")
      return
    }
    try {
      await definir({ marca, tierId, descontoPercent: n })
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao gravar desconto.")
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Grelha de desconto (marca × tier)</h2>
      {erro && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      {/* One column per tier: this grid is legitimately wider than a phone,
          so it scrolls inside this wrapper rather than stretching the page. */}
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">
                Marca
              </th>
              {data.tiers.map((tier) => (
                <th
                  key={tier._id}
                  className="px-4 py-2.5 font-medium whitespace-nowrap"
                >
                  {tier.nome}
                  {!tier.ativa && (
                    <span className="ml-1 font-normal normal-case">
                      (inactivo)
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.marcas.map((marca) => (
              <tr key={marca.slug} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium whitespace-nowrap">
                  {marca.nome}
                </td>
                {data.tiers.map((tier) => {
                  const key = `${marca.slug}:${tier._id}`
                  return (
                    <td key={tier._id} className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          className={cn(inputCls, "w-20")}
                          value={rascunho[key] ?? "0"}
                          onChange={(e) =>
                            setRascunho((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          onBlur={(e) =>
                            void gravarCelula(
                              marca.slug,
                              tier._id,
                              e.target.value,
                            )
                          }
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Os valores gravam-se ao sair da célula. Célula a 0% = revenda igual ao
        PVP.
      </p>
    </section>
  )
}

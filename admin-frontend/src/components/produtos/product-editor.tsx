import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { ExternalLink, FileText, Loader2, Plus, Trash2, X } from "lucide-react"

import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { FAMILIAS, rotuloFamilia, rotuloMarca } from "@/lib/labels"
import type { Familia } from "@/lib/labels"

type Atributo = { chave: string; valor: string }

type FormState = {
  nome: string
  familia: Familia
  precoEuros: string
  gama: string
  pdfPaginas: string
  descricao: string
  atributos: Array<Atributo>
}

// Parse the comma-separated page field into a deduped, ascending number[].
// Non-integer / non-positive tokens are dropped.
function parsePaginasCsv(s: string): Array<number> {
  const vistos = new Set<number>()
  for (const token of s.split(",")) {
    const n = Number(token.trim())
    if (Number.isInteger(n) && n > 0) vistos.add(n)
  }
  return [...vistos].sort((a, b) => a - b)
}

// Modal editor for a single product's presentation/pricing fields. Loads the
// full document via api.produtos.obterAdmin and commits with api.produtos.atualizar.
export function ProductEditor({
  refProduto,
  onClose,
}: {
  refProduto: string
  onClose: () => void
}) {
  const produto = useQuery(api.produtos.obterAdmin, { ref: refProduto })
  const atualizar = useMutation(api.produtos.atualizar)

  const [form, setForm] = useState<FormState | null>(null)
  const [aGuardar, setAGuardar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const inicializado = useRef(false)

  useEffect(() => {
    if (inicializado.current || produto === undefined) return
    if (produto === null) {
      inicializado.current = true
      return
    }
    setForm({
      nome: produto.nome,
      familia: produto.familia as Familia,
      precoEuros: (produto.pvpCents / 100).toFixed(2),
      gama: produto.gama ?? "",
      pdfPaginas: produto.pdfPaginas.join(", "),
      descricao: produto.descricao ?? "",
      atributos: produto.atributos.map((a) => ({ ...a })),
    })
    inicializado.current = true
  }, [produto])

  function set<TCampo extends keyof FormState>(
    campo: TCampo,
    valor: FormState[TCampo],
  ) {
    setForm((prev) => (prev ? { ...prev, [campo]: valor } : prev))
  }

  function setAtributo(idx: number, patch: Partial<Atributo>) {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            atributos: prev.atributos.map((a, i) =>
              i === idx ? { ...a, ...patch } : a,
            ),
          }
        : prev,
    )
  }

  function adicionarAtributo() {
    setForm((prev) =>
      prev
        ? { ...prev, atributos: [...prev.atributos, { chave: "", valor: "" }] }
        : prev,
    )
  }

  function removerAtributo(idx: number) {
    setForm((prev) =>
      prev
        ? { ...prev, atributos: prev.atributos.filter((_, i) => i !== idx) }
        : prev,
    )
  }

  async function guardar() {
    if (!form) return
    setErro(null)

    const preco = Number(form.precoEuros.replace(",", "."))
    if (!Number.isFinite(preco) || preco < 0) {
      setErro("Preço inválido.")
      return
    }
    if (form.nome.trim() === "") {
      setErro("O nome é obrigatório.")
      return
    }

    // Drop attribute rows with an empty key or value.
    const atributos = form.atributos
      .map((a) => ({ chave: a.chave.trim(), valor: a.valor.trim() }))
      .filter((a) => a.chave !== "" && a.valor !== "")

    setAGuardar(true)
    try {
      await atualizar({
        ref: refProduto,
        nome: form.nome,
        familia: form.familia,
        pvpCents: Math.round(preco * 100),
        gama: form.gama,
        descricao: form.descricao,
        atributos,
        pdfPaginas: parsePaginasCsv(form.pdfPaginas),
      })
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao guardar.")
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={aGuardar ? undefined : onClose}
      />

      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-medium">Editar produto</h2>
            <p className="text-sm break-words text-muted-foreground">
              {produto ? rotuloMarca(produto.marca) : ""}
              {produto?.grupoModelo ? ` · ${produto.grupoModelo}` : ""}
            </p>
            <p className="text-xs break-all text-muted-foreground">
              Ref.: {refProduto}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            disabled={aGuardar}
            aria-label="Fechar"
          >
            <X />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {produto === undefined ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : produto === null || form === null ? (
            <p className="text-sm text-destructive">Produto não encontrado.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <Campo label="Nome">
                <input
                  className={inputCls}
                  value={form.nome}
                  onChange={(e) => set("nome", e.target.value)}
                />
              </Campo>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Família">
                  <select
                    className={inputCls}
                    value={form.familia}
                    onChange={(e) =>
                      set("familia", e.target.value as Familia)
                    }
                  >
                    {FAMILIAS.map((f) => (
                      <option key={f} value={f}>
                        {rotuloFamilia(f)}
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo label="Preço PVP s/IVA (€)">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={form.precoEuros}
                    onChange={(e) => set("precoEuros", e.target.value)}
                  />
                </Campo>

                <Campo label="Gama">
                  <input
                    className={inputCls}
                    value={form.gama}
                    onChange={(e) => set("gama", e.target.value)}
                    placeholder="opcional"
                  />
                </Campo>

                <Campo label="Páginas do catálogo (PDF)">
                  <input
                    className={inputCls}
                    value={form.pdfPaginas}
                    onChange={(e) => set("pdfPaginas", e.target.value)}
                    placeholder="ex.: 15, 54, 55"
                  />
                  {produto.fichasCatalogo.length > 0 && (
                    <span className="flex flex-wrap gap-1.5">
                      {produto.fichasCatalogo.map((ficha) => (
                        <a
                          key={ficha.pagina}
                          href={ficha.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/70"
                        >
                          <FileText className="size-3.5" />
                          Página {ficha.pagina}
                          <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </span>
                  )}
                </Campo>
              </div>

              <Campo label="Atributos">
                <span className="text-xs text-muted-foreground">
                  Um par chave/valor por linha (ex.: frio-kw = 3.5). Chaves que
                  variam entre os modelos do grupo aparecem como colunas da
                  tabela de modelos; chaves iguais em todos aparecem como
                  especificações. A ordem define a ordem de apresentação.
                </span>
                <div className="flex flex-col gap-2">
                  {form.atributos.map((atributo, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {/* `min-w-0` lets inputs shrink below their intrinsic
                          width so the row fits a phone-sized dialog. */}
                      <input
                        className={`${inputCls} min-w-0 flex-1`}
                        value={atributo.chave}
                        onChange={(e) =>
                          setAtributo(idx, { chave: e.target.value })
                        }
                        placeholder="chave"
                        aria-label={`Chave do atributo ${idx + 1}`}
                      />
                      <span className="shrink-0 text-muted-foreground">=</span>
                      <input
                        className={`${inputCls} min-w-0 flex-1`}
                        value={atributo.valor}
                        onChange={(e) =>
                          setAtributo(idx, { valor: e.target.value })
                        }
                        placeholder="valor"
                        aria-label={`Valor do atributo ${idx + 1}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removerAtributo(idx)}
                        aria-label={`Remover atributo ${idx + 1}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={adicionarAtributo}
                    >
                      <Plus />
                      Adicionar atributo
                    </Button>
                  </div>
                </div>
              </Campo>

              <Campo label="Descrição (Markdown)">
                <textarea
                  className={`${inputCls} min-h-32 resize-y font-mono text-xs`}
                  value={form.descricao}
                  onChange={(e) => set("descricao", e.target.value)}
                  placeholder="opcional"
                />
              </Campo>

              {erro && <p className="text-sm text-destructive">{erro}</p>}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={aGuardar}>
            Cancelar
          </Button>
          <Button
            onClick={() => void guardar()}
            disabled={aGuardar || produto === null || form === null}
          >
            {aGuardar && <Loader2 className="animate-spin" />}
            {aGuardar ? "A guardar…" : "Guardar"}
          </Button>
        </footer>
      </div>
    </div>
  )
}

const inputCls =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

function Campo({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

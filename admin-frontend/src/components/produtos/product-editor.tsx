import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { ExternalLink, FileText, Loader2, X } from "lucide-react"

import { api } from "@convex/_generated/api"
import { Button } from "@/components/ui/button"
import { CATEGORIAS, rotuloCategoria, rotuloMarca } from "@/lib/labels"
import type { Categoria } from "@/lib/labels"

type FormState = {
  nome: string
  categoria: Categoria
  precoEuros: string
  gama: string
  variante: string
  capacidadeKw: string
  classeEnergetica: string
  refrigerante: string
  pdfPaginas: string
  descricao: string
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
      categoria: produto.categoria,
      precoEuros: (produto.pvpCents / 100).toFixed(2),
      gama: produto.gama ?? "",
      variante: produto.variante ?? "",
      capacidadeKw:
        produto.capacidadeKw !== undefined ? String(produto.capacidadeKw) : "",
      classeEnergetica: produto.classeEnergetica ?? "",
      refrigerante: produto.refrigerante ?? "",
      pdfPaginas: produto.pdfPaginas ?? "",
      descricao: produto.descricao ?? "",
    })
    inicializado.current = true
  }, [produto])

  const ehGrupo = produto?.grupoModelo !== undefined

  function set<TCampo extends keyof FormState>(
    campo: TCampo,
    valor: FormState[TCampo],
  ) {
    setForm((prev) => (prev ? { ...prev, [campo]: valor } : prev))
  }

  async function guardar() {
    if (!form) return
    setErro(null)

    const preco = Number(form.precoEuros.replace(",", "."))
    if (!Number.isFinite(preco) || preco < 0) {
      setErro("Preço inválido.")
      return
    }
    const capacidade =
      form.capacidadeKw.trim() === ""
        ? undefined
        : Number(form.capacidadeKw.replace(",", "."))
    if (capacidade !== undefined && (!Number.isFinite(capacidade) || capacidade < 0)) {
      setErro("Capacidade inválida.")
      return
    }
    if (form.nome.trim() === "") {
      setErro("O nome é obrigatório.")
      return
    }

    setAGuardar(true)
    try {
      await atualizar({
        ref: refProduto,
        nome: form.nome,
        categoria: form.categoria,
        pvpCents: Math.round(preco * 100),
        gama: form.gama,
        descricao: form.descricao,
        capacidadeKw: capacidade,
        classeEnergetica: form.classeEnergetica,
        refrigerante: form.refrigerante,
        variante: form.variante,
        pdfPaginas: form.pdfPaginas,
      })
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao guardar.")
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
          <div>
            <h2 className="font-medium">Editar produto</h2>
            <p className="text-sm text-muted-foreground">
              {produto ? rotuloMarca(produto.marca) : ""}
              {produto?.grupoModelo ? ` · ${produto.grupoModelo}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">Ref.: {refProduto}</p>
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
            <p className="text-sm text-destructive">
              Produto não encontrado.
            </p>
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
                <Campo label="Categoria">
                  <select
                    className={inputCls}
                    value={form.categoria}
                    onChange={(e) =>
                      set("categoria", e.target.value as Categoria)
                    }
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>
                        {rotuloCategoria(c)}
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

                {ehGrupo && (
                  <Campo label="Variante (rótulo)">
                    <input
                      className={inputCls}
                      value={form.variante}
                      onChange={(e) => set("variante", e.target.value)}
                      placeholder="ex.: 9.000 BTU · 2,5 kW"
                    />
                  </Campo>
                )}

                <Campo label="Capacidade (kW)">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={form.capacidadeKw}
                    onChange={(e) => set("capacidadeKw", e.target.value)}
                    placeholder="opcional"
                  />
                </Campo>

                <Campo label="Classe energética">
                  <input
                    className={inputCls}
                    value={form.classeEnergetica}
                    onChange={(e) => set("classeEnergetica", e.target.value)}
                    placeholder="ex.: A++"
                  />
                </Campo>

                <Campo label="Refrigerante">
                  <input
                    className={inputCls}
                    value={form.refrigerante}
                    onChange={(e) => set("refrigerante", e.target.value)}
                    placeholder="ex.: R-32"
                  />
                </Campo>

                <Campo label="Páginas do catálogo (PDF)">
                  <input
                    className={inputCls}
                    value={form.pdfPaginas}
                    onChange={(e) => set("pdfPaginas", e.target.value)}
                    placeholder="ex.: 15 ou 54-55"
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

import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useMutation, useQuery } from "convex/react"
import { ExternalLink, FileText, Loader2, Plus, Trash2 } from "lucide-react"

import { api } from "@convex/_generated/api"
import { Janela, JanelaMeta } from "@/components/produtos/janela"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Banda, campoCls, fichaRotuloCls } from "@/components/ui/tabela"
import { cn } from "@/lib/utils"
import { Seletor } from "@/components/ui/seletor"
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
    valor: FormState[TCampo]
  ) {
    setForm((prev) => (prev ? { ...prev, [campo]: valor } : prev))
  }

  function setAtributo(idx: number, patch: Partial<Atributo>) {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            atributos: prev.atributos.map((a, i) =>
              i === idx ? { ...a, ...patch } : a
            ),
          }
        : prev
    )
  }

  function adicionarAtributo() {
    setForm((prev) =>
      prev
        ? { ...prev, atributos: [...prev.atributos, { chave: "", valor: "" }] }
        : prev
    )
  }

  function removerAtributo(idx: number) {
    setForm((prev) =>
      prev
        ? { ...prev, atributos: prev.atributos.filter((_, i) => i !== idx) }
        : prev
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
    <Janela
      titulo="Editar produto"
      onFechar={onClose}
      bloqueada={aGuardar}
      rodape={
        <div className="flex items-center justify-end gap-2">
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
        </div>
      }
    >
      <JanelaMeta>
        {produto && (
          <span className="font-medium">{rotuloMarca(produto.marca)}</span>
        )}
        {produto?.grupoModelo && (
          <span className="break-words text-muted-foreground">
            {produto.grupoModelo}
          </span>
        )}
        <span className="break-all text-muted-foreground">
          Ref. {refProduto}
        </span>
      </JanelaMeta>

      <div className="flex-1 overflow-y-auto">
        {produto === undefined ? (
          // The form's label / field rows (`Linha`), as bars.
          <div role="status">
            <span className="sr-only">A carregar…</span>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                aria-hidden
                className="grid min-h-14 items-center gap-x-4 gap-y-1.5 border-b px-5 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)]"
              >
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : produto === null || form === null ? (
          <p className="px-5 py-6 text-sm text-destructive">
            Produto não encontrado.
          </p>
        ) : (
          <div className="flex flex-col">
            <Linha rotulo="Nome">
              <input
                className={cn(campoCls, "w-full")}
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
              />
            </Linha>
            <Linha rotulo="Família">
              <Seletor
                className="flex"
                value={form.familia}
                onChange={(e) => set("familia", e.target.value as Familia)}
              >
                {FAMILIAS.map((f) => (
                  <option key={f} value={f}>
                    {rotuloFamilia(f)}
                  </option>
                ))}
              </Seletor>
            </Linha>
            <Linha rotulo="PVP s/IVA (€)">
              <input
                className={cn(
                  campoCls,
                  "w-full text-right tabular-nums sm:w-40"
                )}
                inputMode="decimal"
                value={form.precoEuros}
                onChange={(e) => set("precoEuros", e.target.value)}
              />
            </Linha>
            <Linha rotulo="Gama">
              <input
                className={cn(campoCls, "w-full")}
                value={form.gama}
                onChange={(e) => set("gama", e.target.value)}
                placeholder="opcional"
              />
            </Linha>
            <Linha rotulo="Páginas do catálogo">
              <span className="flex flex-col gap-1.5">
                <input
                  className={cn(campoCls, "w-full tabular-nums")}
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
                        className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-background px-2.5 text-xs font-medium tabular-nums transition-colors outline-none hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
                      >
                        <FileText className="size-3.5 text-muted-foreground" />
                        Página {ficha.pagina}
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </a>
                    ))}
                  </span>
                )}
              </span>
            </Linha>

            <Banda titulo="Atributos" contagem={form.atributos.length} />
            {form.atributos.map((atributo, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 border-b py-2 pr-3 pl-4"
              >
                <span className="text-right text-xs text-muted-foreground tabular-nums">
                  {idx + 1}
                </span>
                {/* `minmax(0,1fr)` lets inputs shrink below their intrinsic
                    width so the row fits a phone-sized dialog. */}
                <input
                  className={cn(campoCls, "w-full min-w-0")}
                  value={atributo.chave}
                  onChange={(e) => setAtributo(idx, { chave: e.target.value })}
                  placeholder="chave"
                  aria-label={`Chave do atributo ${idx + 1}`}
                />
                <span className="text-muted-foreground">=</span>
                <input
                  className={cn(campoCls, "w-full min-w-0")}
                  value={atributo.valor}
                  onChange={(e) => setAtributo(idx, { valor: e.target.value })}
                  placeholder="valor"
                  aria-label={`Valor do atributo ${idx + 1}`}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removerAtributo(idx)}
                  aria-label={`Remover atributo ${idx + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b px-5 py-4">
              <span className="text-xs text-muted-foreground">
                Chave = valor, ex.: frio-kw = 3.5. Chaves que variam no grupo
                são colunas da tabela de modelos; iguais em todos, são
                especificações. A ordem é a de apresentação.
              </span>
              <Button variant="outline" size="sm" onClick={adicionarAtributo}>
                <Plus />
                Adicionar atributo
              </Button>
            </div>

            <Banda titulo="Descrição" contagem="Markdown" />
            <div className="px-5 py-4">
              <textarea
                aria-label="Descrição (Markdown)"
                className={cn(
                  campoCls,
                  "h-auto min-h-32 w-full resize-y py-2 font-mono text-xs"
                )}
                value={form.descricao}
                onChange={(e) => set("descricao", e.target.value)}
                placeholder="opcional"
              />
            </div>

            {erro && (
              <p
                role="alert"
                className="border-t px-5 py-3 text-sm text-destructive"
              >
                {erro}
              </p>
            )}
          </div>
        )}
      </div>
    </Janela>
  )
}

/** One form row laid out like a `Ficha` row: label column, control column. */
function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="grid min-h-14 items-center gap-x-4 gap-y-1.5 border-b px-5 py-2.5 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
      <span className={fichaRotuloCls}>{rotulo}</span>
      {children}
    </label>
  )
}

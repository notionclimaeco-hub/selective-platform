import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Images,
  Pencil,
  Search,
  Trash2,
} from "lucide-react"

import { api } from "@convex/_generated/api"
import type { FunctionReturnType } from "convex/server"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ImageManager
  
} from "@/components/produtos/image-manager"
import type {ManagerAlvo} from "@/components/produtos/image-manager";
import { ProductEditor } from "@/components/produtos/product-editor"
import { ConfirmDialog } from "@/components/produtos/confirm-dialog"
import {
  FAMILIAS,
  ESTADO_CLASSES,
  ESTADO_LABELS,
  ESTADOS,
  MARCA_LABELS,
  rotuloFamilia,
  rotuloMarca,
} from "@/lib/labels"
import type { Estado } from "@/lib/labels"

export const Route = createFileRoute("/produtos")({ component: ProdutosPage })

type AdminEntry =
  FunctionReturnType<typeof api.produtos.listarAdmin>["entradas"][number]
type AdminVariante = AdminEntry["variantes"][number]

const MARCAS = Object.keys(MARCA_LABELS)

// Human label for a variant = the values of the attribute keys that actually
// vary within its group (specs shared by every variant are omitted); falls
// back to the manufacturer ref when nothing distinguishes it.
function rotuloVariante(
  v: AdminVariante,
  grupo: Array<AdminVariante>,
): string {
  const valoresPorChave = new Map<string, Set<string>>()
  for (const variante of grupo) {
    for (const a of variante.atributos) {
      const valores = valoresPorChave.get(a.chave) ?? new Set<string>()
      valores.add(a.valor)
      valoresPorChave.set(a.chave, valores)
    }
  }
  const label = v.atributos
    .filter((a) => (valoresPorChave.get(a.chave)?.size ?? 0) > 1)
    .map((a) => a.valor)
    .join(" · ")
  return label || v.ref
}

// Families per page in the admin listing.
const POR_PAGINA = 20

type ConfirmState = {
  titulo: string
  descricao: string
  confirmarLabel: string
  onConfirmar: () => Promise<void>
}

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
})

function EstadoSelect({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: Estado
  onChange: (estado: Estado) => void
  disabled?: boolean
  ariaLabel: string
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Estado)}
      className={cn(
        "h-8 rounded-full border px-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50",
        ESTADO_CLASSES[value],
      )}
    >
      {ESTADOS.map((e) => (
        <option key={e} value={e}>
          {ESTADO_LABELS[e]}
        </option>
      ))}
    </select>
  )
}

function ProdutosPage() {
  const [alvoImagens, setAlvoImagens] = useState<ManagerAlvo | null>(null)
  const [editarRef, setEditarRef] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<ConfirmState | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  const [busca, setBusca] = useState("")
  const [marcaFiltro, setMarcaFiltro] = useState("")
  const [familiaFiltro, setFamiliaFiltro] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("")

  const definirEstado = useMutation(api.produtos.definirEstado)
  const remover = useMutation(api.produtos.remover)

  async function mudarEstado(
    ref: string,
    estado: Estado,
    aplicarAoGrupo?: boolean,
  ) {
    setErroAcao(null)
    try {
      await definirEstado({ ref, estado, aplicarAoGrupo })
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : "Erro ao mudar estado.")
    }
  }

  function pedirRemover(alvo: {
    ref: string
    nome: string
    removerGrupo?: boolean
    numVariantes?: number
  }) {
    setConfirmar({
      titulo: alvo.removerGrupo ? "Eliminar família" : "Eliminar produto",
      descricao: alvo.removerGrupo
        ? `Eliminar “${alvo.nome}” e as suas ${alvo.numVariantes} variantes? As imagens não usadas por outros produtos são apagadas. Esta ação é irreversível.`
        : `Eliminar “${alvo.nome}” (${alvo.ref})? Esta ação é irreversível.`,
      confirmarLabel: "Eliminar",
      onConfirmar: async () => {
        await remover({ ref: alvo.ref, removerGrupo: alvo.removerGrupo })
        setConfirmar(null)
      },
    })
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-foreground">
          Catálogo
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
        <p className="text-sm text-muted-foreground">
          Publicar, editar e gerir imagens dos produtos. Variantes da mesma
          família partilham as fotografias.
        </p>
      </div>

      {erroAcao && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {erroAcao}
        </p>
      )}

      <AuthLoading>
        <p className="text-sm text-muted-foreground">A verificar sessão…</p>
      </AuthLoading>
      <Unauthenticated>
        <p className="text-sm text-destructive">
          Sessão não autenticada com o Convex. Verifica a configuração do token
          Clerk (ver consola do navegador).
        </p>
      </Unauthenticated>
      <Authenticated>
        <Lista
          busca={busca}
          setBusca={setBusca}
          marcaFiltro={marcaFiltro}
          setMarcaFiltro={setMarcaFiltro}
          familiaFiltro={familiaFiltro}
          setFamiliaFiltro={setFamiliaFiltro}
          estadoFiltro={estadoFiltro}
          setEstadoFiltro={setEstadoFiltro}
          onGerir={setAlvoImagens}
          onEditar={setEditarRef}
          onEstado={mudarEstado}
          onRemover={pedirRemover}
        />
      </Authenticated>

      {alvoImagens && (
        <ImageManager alvo={alvoImagens} onClose={() => setAlvoImagens(null)} />
      )}
      {editarRef && (
        <ProductEditor
          refProduto={editarRef}
          onClose={() => setEditarRef(null)}
        />
      )}
      {confirmar && (
        <ConfirmDialog
          titulo={confirmar.titulo}
          descricao={confirmar.descricao}
          confirmarLabel={confirmar.confirmarLabel}
          onConfirmar={confirmar.onConfirmar}
          onCancelar={() => setConfirmar(null)}
        />
      )}
    </main>
  )
}

type ListaProps = {
  busca: string
  setBusca: (v: string) => void
  marcaFiltro: string
  setMarcaFiltro: (v: string) => void
  familiaFiltro: string
  setFamiliaFiltro: (v: string) => void
  estadoFiltro: string
  setEstadoFiltro: (v: string) => void
  onGerir: (alvo: ManagerAlvo) => void
  onEditar: (ref: string) => void
  onEstado: (ref: string, estado: Estado, aplicarAoGrupo?: boolean) => void
  onRemover: (alvo: {
    ref: string
    nome: string
    removerGrupo?: boolean
    numVariantes?: number
  }) => void
}

const filtroCls =
  "h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

// Debounce free-text search so each keystroke doesn't re-run the paginated
// query (dropdown filters apply immediately).
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

function Lista({
  busca,
  setBusca,
  marcaFiltro,
  setMarcaFiltro,
  familiaFiltro,
  setFamiliaFiltro,
  estadoFiltro,
  setEstadoFiltro,
  onGerir,
  onEditar,
  onEstado,
  onRemover,
}: ListaProps) {
  const [pagina, setPagina] = useState(0)
  const buscaDebounced = useDebounced(busca, 300)

  const marca = marcaFiltro || undefined
  const familia = familiaFiltro || undefined
  const estado = estadoFiltro ? (estadoFiltro as Estado) : undefined
  const termo = buscaDebounced.trim()
  const temFiltro =
    termo !== "" ||
    marca !== undefined ||
    familia !== undefined ||
    estado !== undefined

  // Any filter change resets to the first page so the user never lands on an
  // empty/stale page (the backend also clamps, this keeps the URL/UI honest).
  useEffect(() => {
    setPagina(0)
  }, [termo, marca, familia, estado])

  const resultado = useQuery(api.produtos.listarAdmin, {
    pagina,
    porPagina: POR_PAGINA,
    marca,
    familia,
    estado,
    busca: termo || undefined,
  })

  // Keep local page in sync with the clamped value from the server.
  useEffect(() => {
    if (resultado && resultado.pagina !== pagina) {
      setPagina(resultado.pagina)
    }
  }, [resultado, pagina])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar por nome ou referência…"
            className={cn(filtroCls, "w-full pl-9")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filtrar por marca"
            value={marcaFiltro}
            onChange={(e) => setMarcaFiltro(e.target.value)}
            className={filtroCls}
          >
            <option value="">Todas as marcas</option>
            {MARCAS.map((m) => (
              <option key={m} value={m}>
                {MARCA_LABELS[m]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por família"
            value={familiaFiltro}
            onChange={(e) => setFamiliaFiltro(e.target.value)}
            className={filtroCls}
          >
            <option value="">Todas as famílias</option>
            {FAMILIAS.map((f) => (
              <option key={f} value={f}>
                {rotuloFamilia(f)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por estado"
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className={filtroCls}
          >
            <option value="">Todos os estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_LABELS[e]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {resultado === undefined ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : resultado.totalFamilias === 0 ? (
        <p className="text-sm text-muted-foreground">
          {temFiltro
            ? "Nenhum produto corresponde aos filtros."
            : "Sem produtos importados."}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {resultado.totalFamilias}{" "}
            {resultado.totalFamilias === 1 ? "família" : "famílias"} ·{" "}
            {resultado.totalProdutos}{" "}
            {resultado.totalProdutos === 1 ? "produto" : "produtos"}
          </p>
          <ul className="flex flex-col gap-2">
            {resultado.entradas.map((entrada) => (
              <EntradaRow
                key={entrada.grupoModelo ?? entrada.ref}
                entrada={entrada}
                onGerir={onGerir}
                onEditar={onEditar}
                onEstado={onEstado}
                onRemover={onRemover}
              />
            ))}
          </ul>
          <Paginacao
            pagina={resultado.pagina}
            numPaginas={resultado.numPaginas}
            onPagina={setPagina}
          />
        </>
      )}
    </div>
  )
}

function Paginacao({
  pagina,
  numPaginas,
  onPagina,
}: {
  pagina: number
  numPaginas: number
  onPagina: (pagina: number) => void
}) {
  if (numPaginas <= 1) return null
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pagina <= 0}
        onClick={() => onPagina(pagina - 1)}
      >
        <ChevronLeft data-icon="inline-start" />
        Anterior
      </Button>
      <span className="text-xs text-muted-foreground">
        Página {pagina + 1} de {numPaginas}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={pagina >= numPaginas - 1}
        onClick={() => onPagina(pagina + 1)}
      >
        Seguinte
        <ChevronRight data-icon="inline-end" />
      </Button>
    </div>
  )
}

type RowCallbacks = Pick<
  ListaProps,
  "onGerir" | "onEditar" | "onEstado" | "onRemover"
>

function EstadoResumo({ variantes }: { variantes: Array<AdminVariante> }) {
  const contagem = ESTADOS.map((e) => ({
    estado: e,
    n: variantes.filter((v) => v.estado === e).length,
  })).filter((c) => c.n > 0)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {contagem.map((c) => (
        <span
          key={c.estado}
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
            ESTADO_CLASSES[c.estado],
          )}
        >
          {c.n} {ESTADO_LABELS[c.estado]}
        </span>
      ))}
    </div>
  )
}

function EntradaRow({
  entrada,
  onGerir,
  onEditar,
  onEstado,
  onRemover,
}: { entrada: AdminEntry } & RowCallbacks) {
  const [aberto, setAberto] = useState(false)
  // Every product belongs to a group; treat a group of one like a standalone
  // product (inline actions, no expand/collapse).
  const temGrupo = entrada.numVariantes > 1
  const variante0 = entrada.variantes[0]

  // Standalone product: the family row *is* the product; show inline actions.
  if (!temGrupo) {
    return (
      <li className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-4 p-3">
          <Thumb url={entrada.capaUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{entrada.nome}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {rotuloMarca(entrada.marca)}
              {entrada.gama ? ` · ${entrada.gama}` : ""} ·{" "}
              {rotuloFamilia(entrada.familia)} · {entrada.ref}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium">
                {eur.format(variante0.pvpCents / 100)}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Images className="size-3.5" />
                {variante0.numImagens}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <EstadoSelect
              value={variante0.estado}
              ariaLabel={`Estado de ${entrada.nome}`}
              onChange={(estado) => onEstado(entrada.ref, estado)}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Editar"
              onClick={() => onEditar(entrada.ref)}
            >
              <Pencil />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onGerir({
                  ref: entrada.ref,
                  nome: entrada.nome,
                  temGrupo: false,
                  aplicarAoGrupo: false,
                })
              }
            >
              <Images data-icon="inline-start" />
              Imagens
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Eliminar"
              className="text-destructive hover:bg-destructive/10"
              onClick={() =>
                onRemover({ ref: entrada.ref, nome: entrada.nome })
              }
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </li>
    )
  }

  // Grouped family: same action cluster as a standalone row (estado, imagens,
  // eliminar) plus an expand toggle to reach the per-variant actions.
  return (
    <li className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-4 p-3">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-4 text-left"
          aria-expanded={aberto}
          aria-label={aberto ? "Fechar variantes" : "Abrir variantes"}
        >
          <Thumb url={entrada.capaUrl} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              {aberto ? (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate font-medium">{entrada.nome}</span>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {entrada.numVariantes} variantes
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {rotuloMarca(entrada.marca)}
              {entrada.gama ? ` · ${entrada.gama}` : ""} ·{" "}
              {rotuloFamilia(entrada.familia)}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-2">
              <EstadoResumo variantes={entrada.variantes} />
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Images className="size-3.5" />
                {entrada.numComImagens}/{entrada.numVariantes} com imagens
              </span>
            </span>
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Definir estado de todas as variantes"
            value=""
            onChange={(e) => {
              const estado = e.target.value as Estado | ""
              if (estado) onEstado(entrada.ref, estado, true)
              e.currentTarget.value = ""
            }}
            className="h-8 rounded-full border bg-background px-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="" disabled>
              Estado do grupo…
            </option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_LABELS[e]} (todas)
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onGerir({
                ref: entrada.ref,
                nome: entrada.nome,
                temGrupo: true,
                aplicarAoGrupo: true,
              })
            }
          >
            <Images data-icon="inline-start" />
            Imagens
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Eliminar família"
            className="text-destructive hover:bg-destructive/10"
            onClick={() =>
              onRemover({
                ref: entrada.ref,
                nome: entrada.nome,
                removerGrupo: true,
                numVariantes: entrada.numVariantes,
              })
            }
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {aberto && (
        <ul className="flex flex-col divide-y border-t">
          {entrada.variantes.map((variante) => (
            <VarianteRow
              key={variante._id}
              variante={variante}
              grupo={entrada.variantes}
              nomeFamilia={entrada.nome}
              onGerir={onGerir}
              onEditar={onEditar}
              onEstado={onEstado}
              onRemover={onRemover}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function VarianteRow({
  variante,
  grupo,
  nomeFamilia,
  onGerir,
  onEditar,
  onEstado,
  onRemover,
}: {
  variante: AdminVariante
  grupo: Array<AdminVariante>
  nomeFamilia: string
} & RowCallbacks) {
  const nome = rotuloVariante(variante, grupo)
  return (
    <li className="flex flex-wrap items-center gap-3 py-2 pl-6 pr-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{nome}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{variante.ref}</span>
          <span className="text-xs font-medium">
            {eur.format(variante.pvpCents / 100)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Images className="size-3.5" />
            {variante.numImagens}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <EstadoSelect
          value={variante.estado}
          ariaLabel={`Estado de ${nome}`}
          onChange={(estado) => onEstado(variante.ref, estado)}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Editar"
          onClick={() => onEditar(variante.ref)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Gerir imagens"
          onClick={() =>
            onGerir({
              ref: variante.ref,
              nome: `${nomeFamilia} — ${nome}`,
              temGrupo: true,
              aplicarAoGrupo: false,
            })
          }
        >
          <Images />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Eliminar"
          className="text-destructive hover:bg-destructive/10"
          onClick={() =>
            onRemover({ ref: variante.ref, nome: `${nomeFamilia} — ${nome}` })
          }
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}

function Thumb({ url }: { url: string | null }) {
  return (
    <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <ImageOff className="size-6 text-muted-foreground" />
      )}
    </span>
  )
}

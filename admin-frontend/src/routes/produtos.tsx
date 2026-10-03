import { useEffect, useState } from "react"
import type { ComponentProps, ReactNode } from "react"
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
import { Paginacao } from "@/components/ui/paginacao"
import { LinhasEsqueleto } from "@/components/ui/skeleton"
import { Seletor } from "@/components/ui/seletor"
import { BOTAO_EDITAR } from "@/components/ui/campo-editavel"
import {
  Cabecalho,
  Filtros,
  Marcador,
  Seccao,
  Tabela,
  Td,
  Th,
  Vazio,
  campoCls,
  linhaCls,
} from "@/components/ui/tabela"
import { useDebounced } from "@/lib/use-debounced"
import { ImageManager } from "@/components/produtos/image-manager"
import type { ManagerAlvo } from "@/components/produtos/image-manager"
import { ProductEditor } from "@/components/produtos/product-editor"
import { ConfirmDialog } from "@/components/produtos/confirm-dialog"
import {
  FAMILIAS,
  ESTADO_LABELS,
  ESTADO_TOM,
  ESTADOS,
  MARCA_LABELS,
  eurosDeCents,
  rotuloFamilia,
  rotuloMarca,
} from "@/lib/labels"
import type { Estado } from "@/lib/labels"

export const Route = createFileRoute("/produtos")({ component: ProdutosPage })

type AdminEntry = FunctionReturnType<
  typeof api.produtos.listarAdmin
>["entradas"][number]
type AdminVariante = AdminEntry["variantes"][number]

const MARCAS = Object.keys(MARCA_LABELS)

// Human label for a variant = the values of the attribute keys that actually
// vary within its group (specs shared by every variant are omitted); falls
// back to the manufacturer ref when nothing distinguishes it.
function rotuloVariante(v: AdminVariante, grupo: Array<AdminVariante>): string {
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

/** A native select laid invisibly over its own face, so the control reads
 *  like the table (a `Marcador`, a word) but keeps the platform picker. */
function SeletorSobreposto({
  rosto,
  children,
  ...props
}: { rosto: ReactNode } & ComponentProps<"select">) {
  return (
    <span className="relative -mx-1.5 inline-flex h-7 items-center gap-1 rounded-lg px-1.5 transition-colors duration-150 ease-out hover:bg-secondary has-[select:disabled]:opacity-50 has-[select:focus-visible]:ring-3 has-[select:focus-visible]:ring-ring/25">
      {rosto}
      <ChevronDown
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <select
        {...props}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-default"
      >
        {children}
      </select>
    </span>
  )
}

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
    <SeletorSobreposto
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Estado)}
      rosto={
        <Marcador tom={ESTADO_TOM[value]}>{ESTADO_LABELS[value]}</Marcador>
      }
    >
      {ESTADOS.map((e) => (
        <option key={e} value={e}>
          {ESTADO_LABELS[e]}
        </option>
      ))}
    </SeletorSobreposto>
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
    aplicarAoGrupo?: boolean
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <Cabecalho titulo="Produtos" />

      {erroAcao && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Filtros
          valor={estado}
          onChange={(v) => setEstadoFiltro(v ?? "")}
          opcoes={[
            { valor: undefined, rotulo: "Todos" },
            ...ESTADOS.map((e) => ({ valor: e, rotulo: ESTADO_LABELS[e] })),
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Seletor
            aria-label="Filtrar por marca"
            value={marcaFiltro}
            onChange={(e) => setMarcaFiltro(e.target.value)}
            className="min-w-0 flex-1 sm:w-40 sm:flex-none"
          >
            <option value="">Todas as marcas</option>
            {MARCAS.map((m) => (
              <option key={m} value={m}>
                {MARCA_LABELS[m]}
              </option>
            ))}
          </Seletor>
          <Seletor
            aria-label="Filtrar por família"
            value={familiaFiltro}
            onChange={(e) => setFamiliaFiltro(e.target.value)}
            className="min-w-0 flex-1 sm:w-48 sm:flex-none"
          >
            <option value="">Todas as famílias</option>
            {FAMILIAS.map((f) => (
              <option key={f} value={f}>
                {rotuloFamilia(f)}
              </option>
            ))}
          </Seletor>
          <div className="relative basis-full sm:basis-auto">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Procurar"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Procurar por nome ou referência…"
              className={cn(campoCls, "w-full pl-8 sm:w-64")}
            />
          </div>
        </div>
      </div>

      <Seccao
        titulo={
          <span className="whitespace-nowrap">
            {estado ? ESTADO_LABELS[estado] : "Todos os produtos"}
          </span>
        }
        contagem={
          resultado === undefined ? (
            "…"
          ) : (
            <>
              {resultado.totalFamilias}{" "}
              {resultado.totalFamilias === 1 ? "família" : "famílias"}
              <span className="hidden sm:inline">
                {" · "}
                {resultado.totalProdutos}{" "}
                {resultado.totalProdutos === 1 ? "produto" : "produtos"}
              </span>
            </>
          )
        }
      >
        {resultado === undefined ? (
          <LinhasEsqueleto
            linhas={8}
            colunas={[
              "size-10 rounded-lg",
              "w-2/5",
              "ml-auto hidden w-16 sm:block",
              "hidden h-5 w-20 rounded-full sm:block",
            ]}
          />
        ) : resultado.totalFamilias === 0 ? (
          <Vazio>
            {temFiltro
              ? "Nenhum produto corresponde aos filtros."
              : "Sem produtos importados."}
          </Vazio>
        ) : (
          // One `<tbody>` per family: rule every family's last row except
          // the table's very last (`Td` only drops the border on a last row).
          <Tabela className="sm:[&_td]:px-3 sm:[&_th]:px-3 [&>tbody:not(:last-child)>tr:last-child>td]:border-b">
            {/* Phones get stacked rows (thumb, name, facts, badge) with no
                column heads, like the client's order cards. */}
            <thead className="hidden sm:table-header-group">
              <tr>
                <Th className="w-14">
                  <span className="sr-only">Imagem</span>
                </Th>
                <Th className="hidden md:table-cell">Ref.</Th>
                <Th className="sm:w-full">Nome</Th>
                <Th className="hidden sm:table-cell">Marca</Th>
                <Th className="hidden lg:table-cell">Família</Th>
                <Th num className="hidden lg:table-cell" title="Imagens">
                  <Images aria-hidden className="ml-auto size-3.5" />
                  <span className="sr-only">Imagens</span>
                </Th>
                <Th num className="hidden sm:table-cell">
                  PVP
                </Th>
                <Th className="hidden sm:table-cell">Estado</Th>
                <Th className="w-0">
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            {resultado.entradas.map((entrada) => (
              <EntradaLinhas
                key={entrada.grupoModelo}
                entrada={entrada}
                onGerir={onGerir}
                onEditar={onEditar}
                onEstado={onEstado}
                onRemover={onRemover}
              />
            ))}
          </Tabela>
        )}
      </Seccao>

      {resultado && (
        <Paginacao
          pagina={resultado.pagina}
          numPaginas={resultado.numPaginas}
          onPagina={setPagina}
        />
      )}
    </div>
  )
}

type RowCallbacks = Pick<
  ListaProps,
  "onGerir" | "onEditar" | "onEstado" | "onRemover"
>

/** Secondary facts under a name; pieces shown here only while their own
 *  column is hidden at the current width. */
function SubLinha({ children }: { children: ReactNode }) {
  return (
    <span className="mt-0.5 flex flex-wrap gap-x-2.5 text-xs text-muted-foreground empty:hidden sm:flex-nowrap sm:overflow-hidden sm:whitespace-nowrap">
      {children}
    </span>
  )
}

function ContagemImagens({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Images aria-hidden className="size-3" />
      {children}
    </span>
  )
}

/** Ref. column: one line, never cut — the reference is how staff find a SKU. */
const refCls = "hidden whitespace-nowrap md:table-cell"
/** Nome takes the spare width; from sm up it truncates instead of wrapping. */
const nomeCls = "sm:w-full sm:max-w-0 sm:min-w-48"

const accaoCls = "text-muted-foreground hover:text-foreground"

/** Edit / images / delete, in fixed slots so the icons line up down the
 *  table (a family row leaves the edit slot empty). */
function Accoes({
  onEditar,
  onImagens,
  onEliminar,
  rotuloEliminar = "Eliminar",
}: {
  onEditar?: () => void
  onImagens: () => void
  onEliminar: () => void
  rotuloEliminar?: string
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {onEditar ? (
        <span className="flex size-8 shrink-0 items-center justify-center">
          <button
            type="button"
            aria-label="Editar"
            title="Editar"
            className={BOTAO_EDITAR}
            onClick={onEditar}
          >
            <Pencil className="size-3" />
          </button>
        </span>
      ) : (
        <span aria-hidden className="size-8 shrink-0" />
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Gerir imagens"
        title="Imagens"
        className={accaoCls}
        onClick={onImagens}
      >
        <Images />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={rotuloEliminar}
        title={rotuloEliminar}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={onEliminar}
      >
        <Trash2 />
      </Button>
    </div>
  )
}

function EstadoGrupo({
  entrada,
  onEstado,
}: {
  entrada: AdminEntry
  onEstado: RowCallbacks["onEstado"]
}) {
  const contagem = ESTADOS.map((e) => ({
    estado: e,
    n: entrada.variantes.filter((v) => v.estado === e).length,
  })).filter((c) => c.n > 0)

  return (
    <span className="flex flex-col items-start gap-0.5">
      {contagem.map((c) => (
        <Marcador key={c.estado} tom={ESTADO_TOM[c.estado]}>
          <span className="tabular-nums">{c.n}</span> {ESTADO_LABELS[c.estado]}
        </Marcador>
      ))}
      <SeletorSobreposto
        aria-label="Definir estado de todas as variantes"
        value=""
        onChange={(e) => {
          const estado = e.target.value as Estado | ""
          if (estado) onEstado(entrada.ref, estado, true)
          e.currentTarget.value = ""
        }}
        rosto={
          <span className="text-xs font-medium text-primary">
            Definir todas
          </span>
        }
      >
        <option value="" disabled>
          Estado do grupo…
        </option>
        {ESTADOS.map((e) => (
          <option key={e} value={e}>
            {ESTADO_LABELS[e]} (todas)
          </option>
        ))}
      </SeletorSobreposto>
    </span>
  )
}

function Pvp({ variantes }: { variantes: Array<AdminVariante> }) {
  const precos = variantes.map((v) => v.pvpCents)
  const min = Math.min(...precos)
  const max = Math.max(...precos)
  if (min === max) return <>{eurosDeCents(min)}</>
  return (
    <>
      <span className="text-xs text-muted-foreground">desde </span>
      {eurosDeCents(min)}
    </>
  )
}

// One family: its row, then (when open) one row per variant, in a `<tbody>`
// of its own so the group stays together.
function EntradaLinhas({
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

  const estadoNode = temGrupo ? (
    <EstadoGrupo entrada={entrada} onEstado={onEstado} />
  ) : (
    <EstadoSelect
      value={variante0.estado}
      ariaLabel={`Estado de ${entrada.nome}`}
      onChange={(estado) => onEstado(entrada.ref, estado)}
    />
  )

  const imagens = temGrupo
    ? `${entrada.numComImagens}/${entrada.numVariantes}`
    : String(variante0.numImagens)

  return (
    <tbody>
      <tr className={linhaCls}>
        <Td className="hidden py-2 sm:table-cell">
          <Thumb url={entrada.capaUrl} />
        </Td>
        <Td
          className={cn(refCls, "font-medium")}
          title={temGrupo ? undefined : entrada.ref}
        >
          {temGrupo ? (
            <span className="font-normal text-muted-foreground tabular-nums">
              {entrada.numVariantes} variantes
            </span>
          ) : (
            entrada.ref
          )}
        </Td>
        <Td className={cn(nomeCls, "min-w-52 py-3 sm:py-2.5")}>
          <div className="flex items-start gap-3">
            <Thumb url={entrada.capaUrl} className="sm:hidden" />
            <div className="min-w-0 flex-1">
              {temGrupo ? (
                <button
                  type="button"
                  onClick={() => setAberto((v) => !v)}
                  aria-expanded={aberto}
                  aria-label={aberto ? "Fechar variantes" : "Abrir variantes"}
                  title={entrada.nome}
                  className="group/abrir -ml-1 flex max-w-full items-start gap-0.5 rounded-lg px-1 text-left"
                >
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out",
                      aberto && "rotate-90"
                    )}
                  />
                  <span className="min-w-0 font-medium group-hover/abrir:underline sm:truncate">
                    {entrada.nome}
                  </span>
                </button>
              ) : (
                <span
                  title={entrada.nome}
                  className="block font-medium sm:truncate"
                >
                  {entrada.nome}
                </span>
              )}
              <SubLinha>
                {temGrupo && (
                  <span className="tabular-nums md:hidden">
                    {entrada.numVariantes} variantes
                  </span>
                )}
                {!temGrupo && (
                  <span className="break-all md:hidden">{entrada.ref}</span>
                )}
                {entrada.gama && <span>{entrada.gama}</span>}
                <span className="sm:hidden">{rotuloMarca(entrada.marca)}</span>
                <span className="lg:hidden">
                  {rotuloFamilia(entrada.familia)}
                </span>
                <span className="text-foreground tabular-nums sm:hidden">
                  <Pvp variantes={entrada.variantes} />
                </span>
                <span className="lg:hidden">
                  <ContagemImagens>
                    {temGrupo ? `${imagens} com imagens` : imagens}
                  </ContagemImagens>
                </span>
              </SubLinha>
              <div className="mt-1.5 sm:hidden">{estadoNode}</div>
            </div>
          </div>
        </Td>
        <Td className="hidden whitespace-nowrap sm:table-cell">
          {rotuloMarca(entrada.marca)}
        </Td>
        <Td className="hidden max-w-40 truncate text-muted-foreground lg:table-cell">
          <span title={rotuloFamilia(entrada.familia)}>
            {rotuloFamilia(entrada.familia)}
          </span>
        </Td>
        <Td
          num
          className="hidden text-muted-foreground lg:table-cell"
          title={
            temGrupo
              ? `${entrada.numComImagens} de ${entrada.numVariantes} variantes com imagens`
              : undefined
          }
        >
          {imagens}
        </Td>
        <Td num className="hidden sm:table-cell">
          <Pvp variantes={entrada.variantes} />
        </Td>
        <Td className="hidden sm:table-cell">{estadoNode}</Td>
        <Td>
          <Accoes
            onEditar={temGrupo ? undefined : () => onEditar(entrada.ref)}
            onImagens={() =>
              onGerir({
                ref: entrada.ref,
                nome: entrada.nome,
                temGrupo,
                aplicarAoGrupo: temGrupo,
              })
            }
            rotuloEliminar={temGrupo ? "Eliminar família" : "Eliminar"}
            onEliminar={() =>
              onRemover(
                temGrupo
                  ? {
                      ref: entrada.ref,
                      nome: entrada.nome,
                      removerGrupo: true,
                      numVariantes: entrada.numVariantes,
                    }
                  : { ref: entrada.ref, nome: entrada.nome }
              )
            }
          />
        </Td>
      </tr>

      {temGrupo &&
        aberto &&
        entrada.variantes.map((variante) => (
          <VarianteLinha
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
    </tbody>
  )
}

function VarianteLinha({
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
  const estado = (
    <EstadoSelect
      value={variante.estado}
      ariaLabel={`Estado de ${nome}`}
      onChange={(e) => onEstado(variante.ref, e)}
    />
  )
  return (
    <tr className="bg-secondary/25 text-[0.8125rem] transition-colors hover:bg-secondary/60">
      <Td className="hidden sm:table-cell" />
      <Td className={refCls} title={variante.ref}>
        {variante.ref}
      </Td>
      <Td className={cn(nomeCls, "min-w-44")}>
        <span className="block pl-[3.25rem] sm:pl-5">
          <span title={nome} className="block sm:truncate">
            {nome}
          </span>
          <SubLinha>
            <span className="break-all md:hidden">{variante.ref}</span>
            <span className="text-foreground tabular-nums sm:hidden">
              {eurosDeCents(variante.pvpCents)}
            </span>
            <span className="lg:hidden">
              <ContagemImagens>{variante.numImagens}</ContagemImagens>
            </span>
          </SubLinha>
          <span className="mt-1 block sm:hidden">{estado}</span>
        </span>
      </Td>
      <Td className="hidden sm:table-cell" />
      <Td className="hidden lg:table-cell" />
      <Td num className="hidden text-muted-foreground lg:table-cell">
        {variante.numImagens}
      </Td>
      <Td num className="hidden sm:table-cell">
        {eurosDeCents(variante.pvpCents)}
      </Td>
      <Td className="hidden sm:table-cell">{estado}</Td>
      <Td>
        <Accoes
          onEditar={() => onEditar(variante.ref)}
          onImagens={() =>
            onGerir({
              ref: variante.ref,
              nome: `${nomeFamilia} — ${nome}`,
              temGrupo: true,
              aplicarAoGrupo: false,
            })
          }
          onEliminar={() =>
            onRemover({ ref: variante.ref, nome: `${nomeFamilia} — ${nome}` })
          }
        />
      </Td>
    </tr>
  )
}

function Thumb({ url, className }: { url: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background",
        !url && "bg-secondary/40",
        className
      )}
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="size-full object-contain"
        />
      ) : (
        <ImageOff aria-hidden className="size-4 text-muted-foreground/60" />
      )}
    </span>
  )
}

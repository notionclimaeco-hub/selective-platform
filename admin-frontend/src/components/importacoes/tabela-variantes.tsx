import { FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DIFF_CLASSES, DIFF_LABELS, eurosDeCents } from "@/lib/labels"
import type { Diff } from "@/lib/labels"
import {
  chavesVariaveis,
  rotuloChave,
  rotuloValor,
  valorDe,
} from "@/lib/revisao"
import type { Atributo } from "@/lib/revisao"
import { cn } from "@/lib/utils"

export type SkuRevisao = {
  ref: string
  atributos: Array<Atributo>
  pvpCents: number
  diff: Diff
  precoAnteriorCents?: number
  avisos: Array<string>
  pdfPaginas: Array<number>
}

function DiffBadge({ sku }: { sku: SkuRevisao }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        DIFF_CLASSES[sku.diff]
      )}
    >
      {sku.diff === "alterado" && sku.precoAnteriorCents !== undefined
        ? `${eurosDeCents(sku.precoAnteriorCents)} → ${eurosDeCents(sku.pvpCents)}`
        : DIFF_LABELS[sku.diff]}
    </span>
  )
}

function PaginaBotoes({
  paginas,
  onVerPagina,
}: {
  paginas: Array<number>
  onVerPagina: (pagina: number) => void
}) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {paginas.map((p) => (
        <Button
          key={p}
          variant="outline"
          size="xs"
          aria-label={`Ver página ${p}`}
          onClick={() => onVerPagina(p)}
        >
          <FileText data-icon="inline-start" />
          {p}
        </Button>
      ))}
    </span>
  )
}

/**
 * The staged group's variant table: one row per SKU, one column per attribute
 * key that varies within the group (hero specs first), price with the diff
 * against the live catalog, and the price-table pages the SKU cites.
 * Stacked cards under `md`, a table from `md` up.
 */
export function TabelaVariantes({
  skus,
  familia,
  onVerPagina,
}: {
  skus: Array<SkuRevisao>
  familia: string
  onVerPagina: (pagina: number) => void
}) {
  const chaves = chavesVariaveis(skus, familia)

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {skus.map((s) => (
          <li
            key={s.ref}
            className="rounded-lg border bg-background px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm font-medium break-all">{s.ref}</p>
              <p className="shrink-0 text-sm font-semibold">
                {eurosDeCents(s.pvpCents)}
              </p>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <DiffBadge sku={s} />
              {s.avisos.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {s.avisos.length} {s.avisos.length === 1 ? "aviso" : "avisos"}
                </span>
              )}
            </div>
            {chaves.length > 0 && (
              <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {chaves.map((chave) => {
                  const valor = valorDe(s, chave)
                  return (
                    <div key={chave} className="flex gap-1">
                      <dt>{rotuloChave(chave)}</dt>
                      <dd className="font-medium text-foreground">
                        {valor !== undefined ? rotuloValor(valor) : "—"}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            )}
            {s.pdfPaginas.length > 0 && (
              <div className="mt-2">
                <PaginaBotoes
                  paginas={s.pdfPaginas}
                  onVerPagina={onVerPagina}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border bg-background md:block">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b bg-secondary/40 text-left">
              <th className="px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Ref.
              </th>
              {chaves.map((chave) => (
                <th
                  key={chave}
                  className="px-2.5 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {rotuloChave(chave)}
                </th>
              ))}
              <th className="px-2.5 py-2 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
                PVP s/IVA
              </th>
              <th className="px-2.5 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Diferença
              </th>
              <th className="px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Pág.
              </th>
            </tr>
          </thead>
          <tbody>
            {skus.map((s) => (
              <tr key={s.ref} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-medium whitespace-nowrap">
                  {s.ref}
                  {s.avisos.length > 0 && (
                    <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                      {s.avisos.length}
                    </span>
                  )}
                </td>
                {chaves.map((chave) => {
                  const valor = valorDe(s, chave)
                  return (
                    <td
                      key={chave}
                      className={cn(
                        "px-2.5 py-2 whitespace-nowrap",
                        valor === undefined && "text-muted-foreground"
                      )}
                    >
                      {valor !== undefined ? rotuloValor(valor) : "—"}
                    </td>
                  )
                })}
                <td className="px-2.5 py-2 text-right font-semibold whitespace-nowrap">
                  {eurosDeCents(s.pvpCents)}
                </td>
                <td className="px-2.5 py-2">
                  <DiffBadge sku={s} />
                </td>
                <td className="px-3 py-2">
                  <PaginaBotoes
                    paginas={s.pdfPaginas}
                    onVerPagina={onVerPagina}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

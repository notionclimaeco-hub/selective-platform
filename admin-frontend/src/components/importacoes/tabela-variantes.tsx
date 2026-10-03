import { FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Marcador, Tabela, Td, Th, linhaCls } from "@/components/ui/tabela"
import { DIFF_LABELS, DIFF_TOM, eurosDeCents } from "@/lib/labels"
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

/** The diff against the live catalog; a changed price shows old → new. */
function Diferenca({ sku }: { sku: SkuRevisao }) {
  return (
    <Marcador tom={DIFF_TOM[sku.diff]}>
      {sku.diff === "alterado" && sku.precoAnteriorCents !== undefined ? (
        <span className="tabular-nums">
          <span className="text-muted-foreground line-through decoration-1">
            {eurosDeCents(sku.precoAnteriorCents)}
          </span>{" "}
          → {eurosDeCents(sku.pvpCents)}
        </span>
      ) : (
        DIFF_LABELS[sku.diff]
      )}
    </Marcador>
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
          className="tabular-nums"
        >
          <FileText data-icon="inline-start" />
          {p}
        </Button>
      ))}
    </span>
  )
}

/**
 * The staged group's variant table in a bordered frame (like the page
 * viewer beside it): one row per SKU, one column per attribute key that varies within the
 * group (hero specs first), the price with its diff against the live
 * catalog, and the price-table pages the SKU cites. Under `md` the spec
 * columns, the diff and the pages fold into the ref cell.
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
    <div className="overflow-hidden rounded-lg border">
      <Tabela>
        <thead>
          <tr>
            <Th>Ref.</Th>
            {chaves.map((chave) => (
              <Th key={chave} className="hidden md:table-cell">
                {rotuloChave(chave)}
              </Th>
            ))}
            <Th num>PVP s/IVA</Th>
            <Th className="hidden md:table-cell">Diferença</Th>
            <Th className="hidden md:table-cell">Pág.</Th>
          </tr>
        </thead>
        <tbody>
          {skus.map((s) => (
            <tr key={s.ref} className={linhaCls}>
              <Td className="align-top md:align-middle">
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="font-semibold break-all md:break-normal md:whitespace-nowrap">
                    {s.ref}
                  </span>
                  {s.avisos.length > 0 && (
                    <Marcador tom="aviso">
                      <span className="tabular-nums">{s.avisos.length}</span>
                      <span className="sr-only">
                        {s.avisos.length === 1 ? " aviso" : " avisos"}
                      </span>
                    </Marcador>
                  )}
                </span>
                {chaves.length > 0 && (
                  <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground md:hidden">
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
                <div className="mt-1.5 md:hidden">
                  <Diferenca sku={s} />
                </div>
                {s.pdfPaginas.length > 0 && (
                  <div className="mt-1.5 md:hidden">
                    <PaginaBotoes
                      paginas={s.pdfPaginas}
                      onVerPagina={onVerPagina}
                    />
                  </div>
                )}
              </Td>
              {chaves.map((chave) => {
                const valor = valorDe(s, chave)
                return (
                  <Td
                    key={chave}
                    className={cn(
                      "hidden whitespace-nowrap md:table-cell",
                      valor === undefined && "text-muted-foreground"
                    )}
                  >
                    {valor !== undefined ? rotuloValor(valor) : "—"}
                  </Td>
                )
              })}
              <Td num className="align-top font-medium md:align-middle">
                {eurosDeCents(s.pvpCents)}
              </Td>
              <Td className="hidden md:table-cell">
                <Diferenca sku={s} />
              </Td>
              <Td className="hidden md:table-cell">
                <PaginaBotoes
                  paginas={s.pdfPaginas}
                  onVerPagina={onVerPagina}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </Tabela>
    </div>
  )
}

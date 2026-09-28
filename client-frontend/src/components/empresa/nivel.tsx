import { eur } from "@/lib/catalogo"
import { progressoNivel } from "@/lib/nivel"
import type { ResumoTier } from "@/lib/nivel"
import { Seccao } from "./seccao"

/**
 * Current tier on the header row; progress bar to the next threshold below.
 * Tiers are named, never given as percentages; a pinned tier reads
 * "Definido pela Climaeco".
 */
export function SeccaoNivel({
  resumo,
  estado,
}: {
  resumo: ResumoTier | null | undefined
  estado: string
}) {
  if (resumo === undefined) {
    return (
      <Seccao
        id="nivel"
        titulo="Nível"
        direita={
          <span className="h-5 w-16 animate-pulse rounded bg-secondary" />
        }
      />
    )
  }
  if (resumo === null) {
    return (
      <Seccao
        id="nivel"
        titulo="Nível"
        direita={
          <span className="text-sm text-muted-foreground">
            {estado === "pendente" ? "Após aprovação" : "—"}
          </span>
        }
      />
    )
  }

  const { nivel, definidoPelaClimaeco, volumeCents, proximo } = resumo
  const percent = proximo
    ? progressoNivel(volumeCents, proximo.limiarCents)
    : 100

  return (
    <Seccao
      id="nivel"
      titulo="Nível"
      direita={
        <>
          {definidoPelaClimaeco && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              Definido pela Climaeco
            </span>
          )}
          <span className="text-sm font-semibold">{nivel}</span>
        </>
      }
    >
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={
          proximo ? `Progresso para ${proximo.nivel}` : "Nível máximo"
        }
        className="h-2 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between gap-4 text-sm">
        <span>
          <span className="font-medium">{eur.format(volumeCents / 100)}</span>{" "}
          <span className="text-muted-foreground">pagos s/ IVA</span>
        </span>
        <span className="text-right">
          {proximo ? (
            <>
              <span className="font-medium">
                {eur.format(proximo.limiarCents / 100)}
              </span>{" "}
              <span className="text-muted-foreground">· {proximo.nivel}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Nível máximo</span>
          )}
        </span>
      </div>
    </Seccao>
  )
}

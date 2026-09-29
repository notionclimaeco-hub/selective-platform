import { Loader2, Scissors } from "lucide-react"

import type { Candidata } from "@/lib/imagens-estado"

const ESTILO_BOTAO =
  "rounded-md bg-background/85 text-foreground backdrop-blur hover:bg-background disabled:pointer-events-none disabled:opacity-50"

// The cutout and its original are one pair: a recorte points at its original
// (`origem`), the original at its recorte (`recorteId`).
function contraparte(
  candidata: Candidata,
  candidatas: Array<Candidata>
): { candidata: Candidata; rotulo: string } | null {
  if (candidata.fonte === "recorte") {
    const original = candidata.origem
      ? candidatas.find((c) => c._id === candidata.origem)
      : undefined
    return original ? { candidata: original, rotulo: "Ver original" } : null
  }
  const recorte = candidata.recorteId
    ? candidatas.find((c) => c._id === candidata.recorteId)
    : undefined
  return recorte ? { candidata: recorte, rotulo: "Ver recorte" } : null
}

/**
 * Per-image action in the strip: "Recortar fundo", or the before/after
 * toggle when the image already has a cutout (or is one). Nothing for a
 * recorte without its original, or when the counterpart is already in the
 * list (swapping would duplicate it).
 */
export function BotaoRecorte({
  candidata,
  candidatas,
  escolhidos,
  aRecortar,
  podeRecortar,
  desativado,
  onRecortar,
  onTrocar,
}: {
  candidata: Candidata
  candidatas: Array<Candidata>
  escolhidos: Set<string>
  aRecortar: boolean
  podeRecortar: boolean
  desativado: boolean
  onRecortar: () => void
  onTrocar: (para: Candidata) => void
}) {
  const par = contraparte(candidata, candidatas)
  if (par) {
    if (escolhidos.has(par.candidata.ficheiro)) return null
    return (
      <button
        type="button"
        onClick={() => onTrocar(par.candidata)}
        disabled={desativado}
        className={`${ESTILO_BOTAO} min-w-0 truncate px-2 py-1 text-xs font-medium`}
      >
        {par.rotulo}
      </button>
    )
  }
  if (candidata.fonte === "recorte" || !podeRecortar) return null
  return (
    <button
      type="button"
      onClick={onRecortar}
      disabled={desativado}
      aria-label="Recortar fundo"
      title="Recortar fundo"
      className={`${ESTILO_BOTAO} flex size-7 shrink-0 items-center justify-center`}
    >
      {aRecortar ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Scissors className="size-4" />
      )}
    </button>
  )
}

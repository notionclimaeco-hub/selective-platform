import { EMAIL_GERAL, MAILTO_GERAL } from "@/components/shell/nav"
import { cn } from "@/lib/utils"
import { Seccao } from "./seccao"

type InfoEstado = { rotulo: string; classe: string; ponto: string }

// Keyed by `estadoAprovacao`; unknown values fall back to a neutral badge.
const ESTADO: Record<string, InfoEstado> = {
  pendente: {
    rotulo: "Em aprovação",
    classe: "bg-amber-50 text-amber-800 ring-amber-600/20",
    ponto: "bg-amber-500",
  },
  aprovada: {
    rotulo: "Aprovada",
    classe: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
    ponto: "bg-emerald-500",
  },
  rejeitada: {
    rotulo: "Rejeitada",
    classe: "bg-destructive/10 text-destructive ring-destructive/20",
    ponto: "bg-destructive",
  },
  suspensa: {
    rotulo: "Suspensa",
    classe: "bg-muted text-muted-foreground ring-border",
    ponto: "bg-muted-foreground/50",
  },
}

/** Approval state as a badge. Rejeitada/suspensa add the office contact. */
export function SeccaoEstado({ estado }: { estado: string }) {
  const info: InfoEstado = ESTADO[estado] ?? {
    rotulo: estado,
    classe: "bg-muted text-muted-foreground ring-border",
    ponto: "bg-muted-foreground/50",
  }
  const contacto = estado === "rejeitada" || estado === "suspensa"

  return (
    <Seccao
      id="estado"
      titulo="Estado"
      direita={
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset",
            info.classe
          )}
        >
          <span
            aria-hidden
            className={cn("size-1.5 rounded-full", info.ponto)}
          />
          {info.rotulo}
        </span>
      }
    >
      {contacto ? (
        <a
          href={MAILTO_GERAL}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {EMAIL_GERAL}
        </a>
      ) : undefined}
    </Seccao>
  )
}

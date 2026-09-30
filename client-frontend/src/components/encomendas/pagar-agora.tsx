import { useState } from "react"
import { LoaderCircle, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { eurExato } from "@/lib/catalogo"
import { usePagarPorBanco } from "@/lib/pagar-por-banco"

/**
 * Floating "Pagar agora" pill on a payable order, bottom centre above the
 * phone tab bar (same place and motion as the product page's "Ver
 * orçamento"). Tapping it opens Revolut's Pay by Bank window over the page;
 * once the webhook marks the order `paga` the parent closes it and it sinks
 * out. `data-aviso-pagar` lifts toasts over it (styles.css).
 */
export function PagarAgora({
  aberto,
  revolutToken,
  totalCents,
}: {
  aberto: boolean
  revolutToken: string | undefined
  totalCents: number
}) {
  const { fase, pagar } = usePagarPorBanco({
    aoErro: (mensagem) => toast.error(`Pagamento não iniciado: ${mensagem}`),
  })
  const [montado, setMontado] = useState(aberto)
  const [token, setToken] = useState(revolutToken)
  // Adjust during render so the opening frame is already mounted, and keep
  // the last token for the exit animation.
  if (aberto && !montado) setMontado(true)
  if (revolutToken && revolutToken !== token) setToken(revolutToken)

  if (!montado || !token) return null

  const ocupado = fase === "a_abrir" || fase === "a_confirmar"

  return (
    <div
      data-aviso-pagar
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--barra-fundo)+var(--folga-fundo)+1rem)] z-30 flex justify-center px-4"
    >
      <button
        type="button"
        data-state={aberto ? "open" : "closed"}
        inert={!aberto}
        disabled={ocupado}
        onClick={() => void pagar(token)}
        onAnimationEnd={() => {
          if (!aberto) setMontado(false)
        }}
        className="pointer-events-auto inline-flex h-12 max-w-full items-center gap-2.5 rounded-full bg-primary pr-5 pl-4 text-[15px] font-medium text-primary-foreground shadow-lg duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-90 data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=closed]:fill-mode-forwards data-[state=closed]:fade-out data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-bottom-4 motion-reduce:animate-none data-[state=closed]:motion-reduce:hidden"
      >
        {ocupado ? (
          <LoaderCircle className="size-4.5 shrink-0 animate-spin" />
        ) : (
          <ShieldCheck className="size-4.5 shrink-0" />
        )}
        <span className="truncate">
          {fase === "a_abrir"
            ? "A abrir…"
            : fase === "a_confirmar"
              ? "A confirmar pagamento…"
              : "Pagar agora"}
        </span>
        {!ocupado && (
          <span className="tabular-nums opacity-75">
            · {eurExato.format(totalCents / 100)}
          </span>
        )}
      </button>
    </div>
  )
}

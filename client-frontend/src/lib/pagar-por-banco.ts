import { useEffect, useRef, useState } from "react"
import type { PaymentsModulePayByBankInstance } from "@revolut/checkout/types/types"

/**
 * - `pronto`: nothing open.
 * - `a_abrir`: loading the Revolut module.
 * - `janela`: the bank picker is open over the page.
 * - `a_confirmar`: the bank authorised; waiting for the webhook to mark the
 *   order `paga` (the page's reactive query shows it).
 * - `cancelado` / `erro`: closed without paying.
 */
export type FasePagamento =
  "pronto" | "a_abrir" | "janela" | "a_confirmar" | "cancelado" | "erro"

/**
 * Opens Revolut's Pay by Bank window for an order that already has a Revolut
 * order (created when the office asked for payment). Used by the order page,
 * the orders list and the public payment page.
 */
export function usePagarPorBanco({
  aoErro,
}: { aoErro?: (mensagem: string) => void } = {}) {
  const [fase, setFase] = useState<FasePagamento>("pronto")
  const [erro, setErro] = useState<string | null>(null)
  const instancia = useRef<PaymentsModulePayByBankInstance | null>(null)

  useEffect(() => () => instancia.current?.destroy(), [])

  function falhou(mensagem: string) {
    setErro(mensagem)
    setFase("erro")
    aoErro?.(mensagem)
  }

  async function pagar(revolutToken: string) {
    setErro(null)
    setFase("a_abrir")
    try {
      const publicToken = import.meta.env.VITE_REVOLUT_PUBLIC_KEY as
        string | undefined
      if (!publicToken) throw new Error("VITE_REVOLUT_PUBLIC_KEY em falta")
      const mode =
        import.meta.env.VITE_REVOLUT_MODE === "sandbox" ? "sandbox" : "prod"
      const { default: RevolutCheckout } = await import("@revolut/checkout")
      const { payByBank } = await RevolutCheckout.payments({
        publicToken,
        mode,
        locale: "pt",
      })
      instancia.current?.destroy()
      instancia.current = payByBank({
        // The widget only needs the existing Revolut order's public token.
        createOrder: async () => ({ publicId: revolutToken }),
        location: "PT",
        onSuccess: () => setFase("a_confirmar"),
        onError: ({ error }) => falhou(error.message),
        onCancel: () => setFase("cancelado"),
      })
      instancia.current.show()
      setFase("janela")
    } catch (e) {
      falhou(
        e instanceof Error ? e.message : "Não foi possível abrir o pagamento."
      )
    }
  }

  return { fase, erro, pagar }
}

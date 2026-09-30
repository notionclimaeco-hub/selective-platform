import { useSyncExternalStore } from "react"

const TELEMOVEL = "(width < 48rem)"

/**
 * Below `md` (48rem, where the app shell switches to the tab bar). False on
 * the server; callers only use it for overlays opened after a tap, long after
 * hydration.
 */
export function useTelemovel(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(TELEMOVEL)
      mq.addEventListener("change", avisar)
      return () => mq.removeEventListener("change", avisar)
    },
    () => window.matchMedia(TELEMOVEL).matches,
    () => false
  )
}

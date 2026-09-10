import type { Plugin } from "vite"

const CLERK_DEV_KEY_WARN = "Clerk has been loaded with development keys"
const VITE_CLIENT_CONSOLE = "[vite] (client) [console."

let patched = false

function stringifyArgs(args: unknown[]): string {
  return args.map((value) => (typeof value === "string" ? value : "")).join(" ")
}

function shouldDrop(text: string): boolean {
  if (text.includes(CLERK_DEV_KEY_WARN)) return true
  // Vite forwards browser console to the server, SSR logs that line, Vite
  // forwards it again. The `[Server]` prefix grows until `vite dev` aborts.
  return text.includes("[Server]") && text.includes(VITE_CLIENT_CONSOLE)
}

function patchConsole(): void {
  if (patched) return
  patched = true
  const warn = console.warn.bind(console)
  const error = console.error.bind(console)
  console.warn = (...args: unknown[]) => {
    if (shouldDrop(stringifyArgs(args))) return
    warn(...args)
  }
  console.error = (...args: unknown[]) => {
    if (shouldDrop(stringifyArgs(args))) return
    error(...args)
  }
}

/**
 * Stops Vite SSR from amplifying `console.warn` / `console.error` until
 * SIGABRT. Dev-only. Production does not use this forwarding loop.
 */
export function muteClerkDevKeyWarn(): Plugin {
  patchConsole()
  return {
    name: "mute-clerk-dev-key-warn",
    apply: "serve",
    configResolved() {
      patchConsole()
    },
  }
}

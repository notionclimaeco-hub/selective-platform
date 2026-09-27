import { defineConfig, loadEnv } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

import { muteClerkDevKeyWarn } from "../vite-plugins/mute-clerk-dev-warn"

export default defineConfig(({ mode }) => {
  // Single shared .env at the workspace root. Vite exposes VITE_* via envDir;
  // also surface server-only secrets (CLERK_SECRET_KEY) to the SSR runtime.
  const rootEnv = loadEnv(mode, "..", "")
  for (const [key, value] of Object.entries(rootEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }

  return {
    envDir: "..",
    resolve: { tsconfigPaths: true },
    server: {
      // Listen on every interface and accept Tailscale MagicDNS hostnames so
      // the dev servers can be opened from a phone on the tailnet
      // (http://<tailscale-ip>:<port> or http://<machine>.<tailnet>.ts.net:<port>).
      host: true,
      allowedHosts: [".ts.net"],
      fs: { allow: [".."] },
    },
    plugins: [
      muteClerkDevKeyWarn(),
      // Console piping is off: it echoes server logs back into the browser as
      // "[Server] …", Vite's own forwardConsole ships them to the terminal
      // again, and the two feed each other until the dev server pegs a CPU
      // core and streams gigabytes over loopback. Vite already forwards
      // browser console output to the terminal on its own.
      devtools({ consolePiping: { enabled: false } }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

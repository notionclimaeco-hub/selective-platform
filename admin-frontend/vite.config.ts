import { defineConfig, loadEnv } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

import { muteClerkDevKeyWarn } from "../vite-plugins/mute-clerk-dev-warn"

export default defineConfig(({ mode }) => {
  // Single shared .env lives at the workspace root. Vite exposes VITE_* vars to
  // the client via `envDir`; here we also surface server-only secrets (e.g.
  // CLERK_SECRET_KEY) to the SSR runtime through process.env, without ever
  // exposing them to the client bundle.
  const rootEnv = loadEnv(mode, "..", "")
  for (const [key, value] of Object.entries(rootEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }

  return {
    // Load the single shared .env from the workspace root (one file for both apps).
    envDir: "..",
    resolve: { tsconfigPaths: true },
    server: {
      // Allow importing the shared Convex backend that lives one level up.
      fs: { allow: [".."] },
    },
    plugins: [
      muteClerkDevKeyWarn(),
      devtools(),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

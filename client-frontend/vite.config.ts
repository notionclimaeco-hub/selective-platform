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

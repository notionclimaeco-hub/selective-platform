import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const config = defineConfig({
  // Load the single shared .env from the workspace root (one file for both apps).
  envDir: "..",
  resolve: { tsconfigPaths: true },
  server: {
    // Allow importing the shared Convex backend that lives one level up.
    fs: { allow: [".."] },
  },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config

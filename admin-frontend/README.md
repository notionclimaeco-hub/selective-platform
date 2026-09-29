# TanStack Start + shadcn/ui

This is a template for a new TanStack Start project with React, TypeScript, and shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```

## Background-removal assets

"Recortar fundo" runs `@imgly/background-removal` in the browser and loads its
ONNX runtime and model (~96 MB) from this app's own `/imgly/` path. `pnpm build`
mirrors them first (`prebuild` → `scripts/imgly-assets.mjs`) from IMG.LY's CDN
into `public/imgly/` (git-ignored; only chunks missing on disk are fetched). In
dev the button falls back to the CDN until you run the script once:

```bash
node scripts/imgly-assets.mjs
```

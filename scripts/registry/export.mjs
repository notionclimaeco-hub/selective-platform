// Exports the spec registry to JSON for the Python extraction scripts.
//   pnpm registry:json  ->  product-scaffold/spec-registry.json (gitignored)
// Runs the TypeScript source directly via Node's type stripping, so the JSON
// can never drift from `convex/lib/specRegistry.ts`.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PADRAO_NUMERO,
  REGISTO_SPECS,
  heroSpecs,
} from "../../convex/lib/specRegistry.ts";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const destino = path.join(raiz, "product-scaffold", "spec-registry.json");

const categorias = Object.fromEntries(
  Object.entries(REGISTO_SPECS).map(([familia, cat]) => [
    familia,
    { hero: heroSpecs(familia), chaves: cat.chaves },
  ]),
);

const json = {
  versao: 4,
  geradoEm: new Date().toISOString(),
  padraoNumero: PADRAO_NUMERO,
  booleano: ["sim", "nao"],
  categorias,
};

await mkdir(path.dirname(destino), { recursive: true });
await writeFile(destino, JSON.stringify(json, null, 2) + "\n");
console.log(
  `spec-registry.json: ${Object.keys(categorias).length} famílias → ${path.relative(raiz, destino)}`,
);

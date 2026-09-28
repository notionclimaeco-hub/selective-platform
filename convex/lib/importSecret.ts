// Shared secret for the trusted local import scripts (no browser, no Clerk).
// Every secret-guarded function in `importData.ts` and `importacoes.ts` calls
// this first. Set with `npx convex env set IMPORT_SECRET ...`.
export function conferirSegredo(secret: string): void {
  const esperado = process.env.IMPORT_SECRET;
  if (!esperado) {
    throw new Error(
      "IMPORT_SECRET não está configurado no deployment (npx convex env set IMPORT_SECRET ...).",
    );
  }
  if (secret !== esperado) {
    throw new Error("Segredo de importação inválido.");
  }
}

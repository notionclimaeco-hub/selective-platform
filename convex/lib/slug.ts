/**
 * Clerk organization slugs: lowercase alphanumeric + hyphen, unique per instance.
 * Empty input becomes "empresa".
 */
export function slugifyNome(nome: string): string {
  const ascii = nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return ascii.length > 0 ? ascii : "empresa";
}

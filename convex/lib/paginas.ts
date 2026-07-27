// Shared, pure helpers for catalog page references.

/**
 * Matches the `pdfPaginas` field / CSV column format: a single page ("15") or an
 * inclusive range ("54-55"). Exported so the import row schema (zod) and the
 * upsert mutation validate against the exact same rule.
 */
export const PDF_PAGINAS_REGEX = /^\d+(-\d+)?$/;

/**
 * Expand a `pdfPaginas` string into the list of page numbers it references.
 *
 *   parsePaginas("15")    -> [15]
 *   parsePaginas("54-55") -> [54, 55]
 *   parsePaginas("54-56") -> [54, 55, 56]
 *
 * Pure and total: unrecognized or empty input returns []. A descending range
 * ("56-54") is normalized to ascending. Never throws.
 */
export function parsePaginas(s: string): number[] {
  const texto = s.trim();
  const match = texto.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) {
    return [];
  }

  const inicio = Number(match[1]);
  if (match[2] === undefined) {
    return [inicio];
  }

  const fim = Number(match[2]);
  const lo = Math.min(inicio, fim);
  const hi = Math.max(inicio, fim);

  const paginas: number[] = [];
  for (let p = lo; p <= hi; p++) {
    paginas.push(p);
  }
  return paginas;
}

/**
 * Parse the admin edit form's page field (comma-separated positive integers)
 * into a deduped, ascending `number[]`. Non-integer / non-positive tokens are
 * dropped. Pure and total: "" -> [].
 *
 *   parsePaginasCsv("15")       -> [15]
 *   parsePaginasCsv("26, 30,36") -> [26, 30, 36]
 */
export function parsePaginasCsv(s: string): number[] {
  const vistos = new Set<number>();
  for (const token of s.split(",")) {
    const n = Number(token.trim());
    if (!Number.isInteger(n) || n <= 0) continue;
    vistos.add(n);
  }
  return [...vistos].sort((a, b) => a - b);
}

/** Render a `number[]` of pages back into the comma-separated edit string. */
export function formatPaginas(paginas: number[]): string {
  return paginas.join(", ");
}

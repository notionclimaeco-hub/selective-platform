/**
 * Notion page-property builders and readers (API version 2025-09-03). Pure:
 * no fetch, no database. Readers are lenient — the office edits these pages
 * by hand, so anything can be missing or of the wrong type.
 */

export type Rich = { type: "text"; text: { content: string } };

const MAX_RICH_TEXT = 2000;

function rich(texto: string): Array<Rich> {
  if (texto.length === 0) return [];
  const partes: Array<Rich> = [];
  for (let i = 0; i < texto.length; i += MAX_RICH_TEXT) {
    partes.push({
      type: "text",
      text: { content: texto.slice(i, i + MAX_RICH_TEXT) },
    });
  }
  return partes;
}

// --- writers ----------------------------------------------------------------

export const prop = {
  titulo: (texto: string) => ({ title: rich(texto) }),
  texto: (texto: string | null | undefined) => ({
    rich_text: rich(texto ?? ""),
  }),
  numero: (n: number | null | undefined) => ({ number: n ?? null }),
  selecao: (nome: string | null | undefined) => ({
    select: nome ? { name: nome } : null,
  }),
  multiSelecao: (nomes: ReadonlyArray<string>) => ({
    multi_select: nomes.map((name) => ({ name })),
  }),
  relacao: (pageIds: ReadonlyArray<string>) => ({
    relation: pageIds.map((id) => ({ id })),
  }),
  url: (u: string | null | undefined) => ({ url: u ?? null }),
  data: (ms: number | null | undefined) => ({
    date: ms === null || ms === undefined ? null : { start: new Date(ms).toISOString() },
  }),
  checkbox: (v: boolean) => ({ checkbox: v }),
};

/** Blocks for a page body. */
export const bloco = {
  h2: (texto: string) => ({
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: rich(texto) },
  }),
  h3: (texto: string) => ({
    object: "block",
    type: "heading_3",
    heading_3: { rich_text: rich(texto) },
  }),
  paragrafo: (texto: string) => ({
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: rich(texto) },
  }),
  divisor: () => ({ object: "block", type: "divider", divider: {} }),
};

// --- readers ----------------------------------------------------------------

type Props = Record<string, unknown>;

function propriedade(props: Props, nome: string): Record<string, unknown> | null {
  const p = props[nome];
  return typeof p === "object" && p !== null ? (p as Record<string, unknown>) : null;
}

function textoDe(rich: unknown): string {
  if (!Array.isArray(rich)) return "";
  return rich
    .map((r) => {
      const plain = (r as { plain_text?: unknown }).plain_text;
      return typeof plain === "string" ? plain : "";
    })
    .join("")
    .trim();
}

export const ler = {
  titulo: (props: Props, nome: string): string =>
    textoDe(propriedade(props, nome)?.title),
  texto: (props: Props, nome: string): string =>
    textoDe(propriedade(props, nome)?.rich_text),
  numero: (props: Props, nome: string): number | null => {
    const n = propriedade(props, nome)?.number;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  },
  selecao: (props: Props, nome: string): string | null => {
    const s = propriedade(props, nome)?.select;
    const name = (s as { name?: unknown } | null)?.name;
    return typeof name === "string" && name.length > 0 ? name : null;
  },
  relacao: (props: Props, nome: string): Array<string> => {
    const r = propriedade(props, nome)?.relation;
    if (!Array.isArray(r)) return [];
    return r
      .map((x) => (x as { id?: unknown }).id)
      .filter((id): id is string => typeof id === "string");
  },
  checkbox: (props: Props, nome: string): boolean =>
    propriedade(props, nome)?.checkbox === true,
};

/** Notion ids come with or without dashes; compare on the bare hex form. */
export function idNormalizado(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

export function euros(cents: number): number {
  return Math.round(cents) / 100;
}

/** Office types euros with `,` or `.`; store integer cents. */
export function cents(euros: number): number {
  return Math.round(euros * 100);
}

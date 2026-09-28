// Staged-SKU JSON contract (product schema v4). Plain TypeScript with no Convex
// imports: the extraction toolkit writes this shape, the import-run tables
// (#40) store it and the admin review page (#41) renders it.
//
// One JSON file per import run: `{ marca, ano, tabelaOrigem, ficheiro, skus }`.
// Each SKU carries the 18 v3 import fields as JSON plus `compativelCom` and
// the extractor's `avisos`. `estado` and `imagens` are app-managed and never
// appear here.

import type { Atributo, Componente } from "./specRegistry";

export type Segmento = "domestico" | "comercial" | "industrial";

export type StagedSkuJson = {
  ref: string;
  ean?: string;
  nome: string;
  nomeGrupo: string;
  marca: string;
  familia: string;
  segmento?: Segmento;
  sistema?: string;
  tipoUnidade?: string;
  componente: Componente;
  gama?: string;
  // Ordered: variant axes first, specs after. Keys per `specRegistry`.
  atributos: Array<Atributo>;
  descricao?: string;
  // Integer cents, VAT-exclusive.
  pvpCents: number;
  ivaIncluido: boolean;
  tabelaOrigem: string;
  // Deterministic: see `grupoModeloDeterministico`.
  grupoModelo: string;
  pdfPaginas: Array<number>;
  // Refs or series codes this unit accepts (multi-split UE, comandos).
  compativelCom?: Array<string>;
  // Extractor warnings the reviewer must read (registry avisos, pairing
  // doubts, broken series…). Empty when clean.
  avisos: Array<string>;
};

export type ImportRunJson = {
  marca: string;
  ano: number;
  // `{marca}-{ano}`, matches `produtos.tabelaOrigem`.
  tabelaOrigem: string;
  // Price-table PDF file name the run was extracted from.
  ficheiro: string;
  skus: Array<StagedSkuJson>;
};

/** Slug for a gama/series name: ascii, lowercase, single hyphens. */
export function slugGama(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * `{marca}-{gama-slug}` for conjuntos, `{marca}-{gama-slug}-{componente}`
 * otherwise, so a group keeps its slug (and its photos) across reloads. A SKU
 * without a gama uses its ref as the series (group of one).
 */
export function grupoModeloDeterministico(
  marca: string,
  gama: string | undefined,
  componente: Componente,
  ref?: string,
): string {
  const serie = slugGama(gama ?? "") || slugGama(ref ?? "");
  if (!serie) {
    throw new Error(
      `grupoModelo: SKU sem gama nem ref utilizável (marca ${marca}).`,
    );
  }
  const base = `${slugGama(marca)}-${serie}`;
  return componente === "conjunto" ? base : `${base}-${componente}`;
}

// How a product page lays out its SKUs' attributes: which keys become the
// model table's columns, which are shared specs, and in what order. Shared by
// the shop's product page and the admin review page, so both read a group the
// same way. Plain TypeScript with no Convex imports.

import { ordemChaves } from "./specRegistry";

export type Atributo = { chave: string; valor: string };

type ComAtributos = { atributos: ReadonlyArray<Atributo> };

export function valorDe(s: ComAtributos, chave: string): string | undefined {
  return s.atributos.find((a) => a.chave === chave)?.valor;
}

/**
 * Display order of attribute keys within a familia: its hero specs first,
 * then the rest of its registry keys, both in registry order; keys the
 * registry does not know (pre-registry catalog rows) keep their given order
 * at the end.
 */
export function ordenarChaves(
  familia: string,
  chaves: ReadonlyArray<string>,
): Array<string> {
  const registo = ordemChaves(familia);
  const posicao = (chave: string) => {
    const i = registo.indexOf(chave);
    return i === -1 ? registo.length : i;
  };
  // Array.prototype.sort is stable, so unknown keys keep their order.
  return [...new Set(chaves)].sort((a, b) => posicao(a) - posicao(b));
}

// Distinct keys across the SKUs, by first appearance.
function chavesPresentes(skus: ReadonlyArray<ComAtributos>): Array<string> {
  return [...new Set(skus.flatMap((s) => s.atributos.map((a) => a.chave)))];
}

/**
 * Keys that distinguish SKUs within the group: present with ≥2 distinct
 * values, or missing on some SKUs. These become the model table's columns,
 * in registry order (hero specs first).
 */
export function chavesVariaveis(
  skus: ReadonlyArray<ComAtributos>,
  familia: string,
): Array<string> {
  if (skus.length < 2) return [];
  const variaveis = chavesPresentes(skus).filter(
    (chave) => new Set(skus.map((s) => valorDe(s, chave))).size > 1,
  );
  return ordenarChaves(familia, variaveis);
}

/**
 * Attributes every SKU of the group has with the same value, in registry
 * order. These describe the product (spec chips and list) instead of being
 * table columns. For a single SKU this is all of its attributes.
 */
export function atributosComuns(
  skus: ReadonlyArray<ComAtributos>,
  familia: string,
): Array<Atributo> {
  const primeiro = skus[0];
  if (primeiro === undefined) return [];
  const comuns = primeiro.atributos.filter((a) =>
    skus.every((s) => valorDe(s, a.chave) === a.valor),
  );
  const ordem = ordenarChaves(
    familia,
    comuns.map((a) => a.chave),
  );
  return ordem.map((chave) => comuns.find((a) => a.chave === chave)!);
}

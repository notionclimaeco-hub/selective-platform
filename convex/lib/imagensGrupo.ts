// Pure helpers over a group's image decision (no Convex imports).
import type { Id } from "../_generated/dataModel";

export type DecisaoImagens = {
  imagens: Array<Id<"_storage">>;
  porRef?: Array<{ ref: string; imagens: Array<Id<"_storage">> }>;
};

/** The list a given SKU receives: its override, else the group list. */
export function listaParaRef(
  d: DecisaoImagens,
  ref: string,
): Array<Id<"_storage">> {
  return d.porRef?.find((p) => p.ref === ref)?.imagens ?? d.imagens;
}

/** Every file the decision keeps (group list plus all overrides). */
export function ficheirosEscolhidos(
  d: DecisaoImagens | null,
): Set<Id<"_storage">> {
  const out = new Set<Id<"_storage">>();
  if (!d) return out;
  for (const f of d.imagens) out.add(f);
  for (const p of d.porRef ?? []) for (const f of p.imagens) out.add(f);
  return out;
}

/** Candidates whose file is not in the kept set. */
export function candidatasARemover<T extends { ficheiro: Id<"_storage"> }>(
  candidatas: ReadonlyArray<T>,
  mantidos: ReadonlySet<Id<"_storage">>,
): Array<T> {
  return candidatas.filter((c) => !mantidos.has(c.ficheiro));
}

/** Error message when a porRef entry names a ref outside the group or twice. */
export function validarPorRef(
  porRef: ReadonlyArray<{ ref: string }>,
  refsDoGrupo: ReadonlySet<string>,
): string | null {
  const vistas = new Set<string>();
  for (const { ref } of porRef) {
    if (!refsDoGrupo.has(ref)) return `porRef: ref "${ref}" não pertence ao grupo.`;
    if (vistas.has(ref)) return `porRef: ref "${ref}" repetida.`;
    vistas.add(ref);
  }
  return null;
}

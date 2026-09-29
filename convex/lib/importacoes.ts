// Pure review logic for import runs (#40). No Convex imports so it can be
// unit-tested and reused by the admin review page for client-side grouping.

import type { Atributo } from "./specRegistry";

export type Diff = "novo" | "alterado" | "igual";

/** Staged SKU against the live catalog: price change or not. */
export function classificarDiff(
  atual: { pvpCents: number } | null,
  pvpCents: number,
): { diff: Diff; precoAnteriorCents?: number } {
  if (atual === null) return { diff: "novo" };
  return {
    diff: atual.pvpCents === pvpCents ? "igual" : "alterado",
    precoAnteriorCents: atual.pvpCents,
  };
}

export const CHAVE_COMPATIVEL = "compativel-com";

/**
 * The extractor sends `compativelCom` as an array; the catalog stores it as
 * the registry's `compativel-com` comma list. An existing attribute wins.
 */
export function dobrarCompatibilidade(
  atributos: ReadonlyArray<Atributo>,
  compativelCom: ReadonlyArray<string> | undefined,
): Array<Atributo> {
  const base = [...atributos];
  if (!compativelCom || base.some((a) => a.chave === CHAVE_COMPATIVEL)) {
    return base;
  }
  const valor = compativelCom
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .join(",");
  if (valor === "") return base;
  return [...base, { chave: CHAVE_COMPATIVEL, valor }];
}

// The fields a group summary needs; `Doc<"skusEmRevisao">` satisfies it.
export type LinhaRevisao = {
  grupoModelo: string;
  nomeGrupo: string;
  marca: string;
  familia: string;
  componente: string;
  gama?: string;
  sistema?: string;
  tipoUnidade?: string;
  segmento?: string;
  avisos: ReadonlyArray<string>;
  diff: Diff;
  grupoRevisto: boolean;
};

export type ResumoGrupo = {
  grupoModelo: string;
  nomeGrupo: string;
  marca: string;
  familia: string;
  componente: string;
  // Taxonomy of the first row, for the review card's badges.
  gama?: string;
  sistema?: string;
  tipoUnidade?: string;
  segmento?: string;
  numSkus: number;
  numAvisos: number;
  numNovos: number;
  numAlterados: number;
  numIguais: number;
  revisto: boolean;
  // A warning or a price change: the reviewer must open this group.
  precisaRevisao: boolean;
  // A staff image decision or a live product with images exists.
  temImagens: boolean;
};

/** One summary per grupoModelo, sorted by nomeGrupo then grupoModelo. */
export function resumirGrupos(
  linhas: ReadonlyArray<LinhaRevisao>,
): Array<ResumoGrupo> {
  const grupos = new Map<string, ResumoGrupo>();
  for (const l of linhas) {
    let r = grupos.get(l.grupoModelo);
    if (!r) {
      r = {
        grupoModelo: l.grupoModelo,
        nomeGrupo: l.nomeGrupo,
        marca: l.marca,
        familia: l.familia,
        componente: l.componente,
        ...(l.gama !== undefined ? { gama: l.gama } : {}),
        ...(l.sistema !== undefined ? { sistema: l.sistema } : {}),
        ...(l.tipoUnidade !== undefined ? { tipoUnidade: l.tipoUnidade } : {}),
        ...(l.segmento !== undefined ? { segmento: l.segmento } : {}),
        numSkus: 0,
        numAvisos: 0,
        numNovos: 0,
        numAlterados: 0,
        numIguais: 0,
        revisto: true,
        precisaRevisao: false,
        temImagens: false,
      };
      grupos.set(l.grupoModelo, r);
    }
    r.numSkus++;
    r.numAvisos += l.avisos.length;
    if (l.diff === "novo") r.numNovos++;
    else if (l.diff === "alterado") r.numAlterados++;
    else r.numIguais++;
    if (!l.grupoRevisto) r.revisto = false;
    r.precisaRevisao = r.numAvisos > 0 || r.numAlterados > 0;
  }
  return [...grupos.values()].sort(
    (a, b) =>
      a.nomeGrupo.localeCompare(b.nomeGrupo) ||
      a.grupoModelo.localeCompare(b.grupoModelo),
  );
}

/** Groups that block approval. */
export function gruposPorRever(
  resumos: ReadonlyArray<ResumoGrupo>,
): Array<string> {
  return resumos
    .filter((r) => r.precisaRevisao && !r.revisto)
    .map((r) => r.grupoModelo);
}

export type FiltroGrupos =
  | "todos"
  | "por-rever"
  | "com-avisos"
  | "alterados"
  | "novos";

export function filtrarGrupos(
  resumos: ReadonlyArray<ResumoGrupo>,
  filtro: FiltroGrupos,
): Array<ResumoGrupo> {
  switch (filtro) {
    case "por-rever":
      return resumos.filter((r) => r.precisaRevisao && !r.revisto);
    case "com-avisos":
      return resumos.filter((r) => r.numAvisos > 0);
    case "alterados":
      return resumos.filter((r) => r.numAlterados > 0);
    case "novos":
      return resumos.filter((r) => r.numNovos > 0);
    case "todos":
      return [...resumos];
  }
}

export type CriteriosGrupos = {
  busca?: string;
  familia?: string;
  soAvisos?: boolean;
  soAlterados?: boolean;
  soPorRever?: boolean;
  soSemImagens?: boolean;
};

/**
 * The review page's combinable filters (AND). `busca` is a case-insensitive
 * substring of `nomeGrupo` or `grupoModelo`.
 */
export function filtrarPorCriterios(
  resumos: ReadonlyArray<ResumoGrupo>,
  c: CriteriosGrupos,
): Array<ResumoGrupo> {
  const termo = c.busca?.trim().toLowerCase() ?? "";
  return resumos.filter((r) => {
    if (
      termo !== "" &&
      !r.nomeGrupo.toLowerCase().includes(termo) &&
      !r.grupoModelo.toLowerCase().includes(termo)
    ) {
      return false;
    }
    if (c.familia !== undefined && c.familia !== "" && r.familia !== c.familia) {
      return false;
    }
    if (c.soAvisos && r.numAvisos === 0) return false;
    if (c.soAlterados && r.numAlterados === 0) return false;
    if (c.soPorRever && !(r.precisaRevisao && !r.revisto)) return false;
    if (c.soSemImagens && r.temImagens) return false;
    return true;
  });
}

export type ContagensRun = {
  numSkus: number;
  numGrupos: number;
  numNovos: number;
  numAlterados: number;
  numIguais: number;
  numComAvisos: number;
};

export function contarRun(linhas: ReadonlyArray<LinhaRevisao>): ContagensRun {
  const grupos = new Set<string>();
  const c: ContagensRun = {
    numSkus: 0,
    numGrupos: 0,
    numNovos: 0,
    numAlterados: 0,
    numIguais: 0,
    numComAvisos: 0,
  };
  for (const l of linhas) {
    grupos.add(l.grupoModelo);
    c.numSkus++;
    if (l.diff === "novo") c.numNovos++;
    else if (l.diff === "alterado") c.numAlterados++;
    else c.numIguais++;
    if (l.avisos.length > 0) c.numComAvisos++;
  }
  c.numGrupos = grupos.size;
  return c;
}

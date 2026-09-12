import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// The public catalog lists product pages (groups of SKUs sharing
// `grupoModelo`), not SKUs. Deriving a page from its SKUs — cheapest variant,
// price span, capacity span, best energy class, cover — is cheap for one group
// but was being done for *every* group on *every* listing request. This module
// materialises that derivation into `catalogoGrupos`, one row per group with
// published variants, so listing reads a few hundred small rows instead of
// every SKU with its attribute list.
//
// Invariant: after any write to `produtos`, `sincronizarGrupo` runs for every
// grupoModelo the write touched (old and new when a SKU changes group).

// Attribute keys the listing surfaces. `classe-energetica` holds a
// "cooling/heating" pair; the catalog shows the cooling side.
const CHAVE_CLASSE = "classe-energetica";
const CHAVE_FRIO_KW = "frio-kw";

// Accessories and spare parts outnumber the actual equipment in every brand's
// price table, so they sink to the bottom of the default ordering — someone
// browsing the catalog wants to see units first, not condensate pumps.
const FAMILIAS_SECUNDARIAS = new Set(["acessorios-e-controlo", "outros"]);

/**
 * Search normalisation shared by the stored blob and the typed term: lower
 * case, no diacritics ("águas" and "aguas" must meet), single spaces.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Attribute lookup on a SKU; attributes are an ordered {chave,valor} list. */
export function atributo(
  p: Doc<"produtos">,
  chave: string,
): string | undefined {
  return p.atributos.find((a) => a.chave === chave)?.valor;
}

function numeroAtributo(p: Doc<"produtos">, chave: string): number | undefined {
  const bruto = atributo(p, chave);
  if (bruto === undefined) return undefined;
  // The importer normalises decimals to dots, but tolerate commas.
  const n = Number.parseFloat(bruto.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** "A+++/A++" → "A+++"; "-/A+" → "A+". Undefined when neither side is a class. */
export function classePrincipal(valor: string): string | undefined {
  for (const lado of valor.split("/")) {
    const limpo = lado.trim();
    if (/^[A-G]\+*$/.test(limpo)) return limpo;
  }
  return undefined;
}

/** Energy classes sort best-first (A+++ before A++ before B). */
export function ordemClasse(c: string): number {
  const letra = c.charCodeAt(0) - 65; // A = 0
  return letra * 10 - (c.length - 1);
}

/**
 * Canonical variant of a group = the cheapest one (price correlates with
 * capacity, so this is the "entry" model), tie-broken by ref for stability.
 */
export function escolherCanonica(
  variantes: Array<Doc<"produtos">>,
): Doc<"produtos"> {
  return variantes.reduce((melhor, atual) => {
    if (atual.pvpCents < melhor.pvpCents) return atual;
    if (atual.pvpCents === melhor.pvpCents && atual.ref < melhor.ref) {
      return atual;
    }
    return melhor;
  });
}

type GrupoCampos = Omit<Doc<"catalogoGrupos">, "_id" | "_creationTime">;

/** Derive the listing row for a group from its PUBLISHED variants. */
export function derivarGrupo(
  grupoModelo: string,
  publicadas: Array<Doc<"produtos">>,
): GrupoCampos {
  const canonica = escolherCanonica(publicadas);
  const precos = publicadas.map((p) => p.pvpCents);

  // Prefer the canonical variant's own cover; otherwise any variant's.
  const comImagem =
    canonica.imagens.length > 0
      ? canonica
      : publicadas.find((p) => p.imagens.length > 0);
  const capa = comImagem?.imagens[0] ?? null;

  const kws: Array<number> = [];
  const classes = new Set<string>();
  for (const p of publicadas) {
    const kw = numeroAtributo(p, CHAVE_FRIO_KW);
    if (kw !== undefined) kws.push(kw);
    const classe = atributo(p, CHAVE_CLASSE);
    const principal = classe ? classePrincipal(classe) : undefined;
    if (principal) classes.add(principal);
  }
  const classeEnergetica = [...classes].sort(
    (a, b) => ordemClasse(a) - ordemClasse(b),
  )[0];
  const frioKwMin = kws.length > 0 ? Math.min(...kws) : undefined;
  const frioKwMax = kws.length > 0 ? Math.max(...kws) : undefined;

  // A group with a photo and published capacity/energy data is a real unit
  // someone can shop for; spec-less rows are almost always valve kits and spare
  // parts, which belong further down even when filed under a main family.
  const temEspecificacoes =
    frioKwMin !== undefined || classeEnergetica !== undefined;
  const peso =
    (capa === null ? 4 : 0) +
    (temEspecificacoes ? 0 : 2) +
    (FAMILIAS_SECUNDARIAS.has(canonica.familia) ? 1 : 0);

  const refs = publicadas.map((p) => p.ref).join(" ");
  const textoBusca = normalizarTexto(
    `${canonica.nomeGrupo} ${refs} ${canonica.gama ?? ""} ${canonica.marca} ${grupoModelo}`,
  );

  return {
    grupoModelo,
    ref: canonica.ref,
    nome: canonica.nomeGrupo,
    marca: canonica.marca,
    familia: canonica.familia,
    gama: canonica.gama,
    tipoUnidade: canonica.tipoUnidade,
    precoDesdeCents: Math.min(...precos),
    precoAteCents: Math.max(...precos),
    numVariantes: publicadas.length,
    frioKwMin,
    frioKwMax,
    classeEnergetica,
    capa,
    textoBusca,
    peso,
    criadoEm: Math.max(...publicadas.map((p) => p._creationTime)),
  };
}

/**
 * Bring the `catalogoGrupos` row for one group in line with its SKUs: upsert
 * when the group has published variants, delete otherwise. Idempotent; skips
 * the write when nothing changed so callers can run it liberally.
 */
export async function sincronizarGrupo(
  ctx: MutationCtx,
  grupoModelo: string,
): Promise<void> {
  const variantes = await ctx.db
    .query("produtos")
    .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", grupoModelo))
    .collect();
  const publicadas = variantes.filter((p) => p.estado === "publicado");

  const existente = await ctx.db
    .query("catalogoGrupos")
    .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", grupoModelo))
    .unique();

  if (publicadas.length === 0) {
    if (existente) await ctx.db.delete(existente._id);
    return;
  }

  const campos = derivarGrupo(grupoModelo, publicadas);
  if (existente) {
    if (!igual(existente, campos)) await ctx.db.replace(existente._id, campos);
  } else {
    await ctx.db.insert("catalogoGrupos", campos);
  }
}

/** Sync every group in the set — the usual tail of a bulk mutation. */
export async function sincronizarGrupos(
  ctx: MutationCtx,
  grupos: Iterable<string>,
): Promise<void> {
  for (const grupoModelo of new Set(grupos)) {
    await sincronizarGrupo(ctx, grupoModelo);
  }
}

function igual(atual: Doc<"catalogoGrupos">, novo: GrupoCampos): boolean {
  const { _id: _i, _creationTime: _t, ...camposAtuais } = atual;
  // Field order is fixed by `derivarGrupo`, and undefined optionals are absent
  // on stored docs, so a JSON comparison over the same key order is exact.
  return (
    JSON.stringify(normalizar(camposAtuais)) ===
    JSON.stringify(normalizar(novo))
  );
}

function normalizar(campos: GrupoCampos): Array<[string, unknown]> {
  return Object.entries(campos)
    .filter(([, valor]) => valor !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
}

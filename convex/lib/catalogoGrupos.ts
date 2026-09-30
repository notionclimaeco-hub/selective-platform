import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  normalizarTexto,
  ordenarValores,
  type Destaque,
} from "./catalogoFiltros";
import { definicoesHero, PADRAO_LISTA, type ChaveSpec } from "./specRegistry";

// The public catalog lists product pages (groups of SKUs sharing
// `grupoModelo`), not SKUs. Deriving a page from its SKUs — cheapest variant,
// price span, hero specs, cover — is cheap for one group but was being done
// for *every* group on *every* listing request. This module materialises that
// derivation into `catalogoGrupos`, one row per group with published
// variants, which `catalogo.indice` ships to the browser in one payload.
//
// Invariant: after any write to `produtos`, `sincronizarGrupo` runs for every
// grupoModelo the write touched (old and new when a SKU changes group). Import
// promotion is the one deferral: it collects the groups its batches touch and
// syncs them before the run closes (`importacoes:sincronizarCatalogoDaRun`).

// Accessories and spare parts outnumber the actual equipment in every brand's
// price table, so they sink to the bottom of the default ordering — someone
// browsing the catalog wants to see units first, not condensate pumps.
const FAMILIAS_SECUNDARIAS = new Set(["acessorios-e-controlo", "outros"]);

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

/**
 * The values a SKU holds for a non-numeric hero key. List keys
 * (`compativel-com`) hold one value per listed ref or series, so a filter on
 * "FTXJ" finds every accessory that lists it.
 */
function valoresAtributo(p: Doc<"produtos">, def: ChaveSpec): Array<string> {
  const bruto = atributo(p, def.chave);
  if (bruto === undefined) return [];
  const partes = def.padrao === PADRAO_LISTA ? bruto.split(",") : [bruto];
  return partes.map((v) => v.trim()).filter((v) => v !== "");
}

/**
 * Hero specs of a group, from the registry entry of its familia, over its
 * published variants: min–max for `numero` keys, distinct values otherwise.
 * A key no variant carries is left out.
 */
export function derivarDestaques(
  familia: string,
  publicadas: Array<Doc<"produtos">>,
): Array<Destaque> {
  const destaques: Array<Destaque> = [];
  for (const def of definicoesHero(familia)) {
    if (def.tipo === "numero") {
      const numeros = publicadas
        .map((p) => numeroAtributo(p, def.chave))
        .filter((n) => n !== undefined);
      if (numeros.length > 0) {
        destaques.push({
          chave: def.chave,
          tipo: "intervalo",
          min: Math.min(...numeros),
          max: Math.max(...numeros),
        });
      }
    } else {
      const valores = new Set(
        publicadas.flatMap((p) => valoresAtributo(p, def)),
      );
      if (valores.size > 0) {
        destaques.push({
          chave: def.chave,
          tipo: "valores",
          valores: ordenarValores(def, valores),
        });
      }
    }
  }
  return destaques;
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

  const destaques = derivarDestaques(canonica.familia, publicadas);

  // A group with a photo and published hero specs is a real unit someone can
  // shop for; spec-less rows are almost always valve kits and spare parts,
  // which belong further down even when filed under a main family.
  const peso =
    (capa === null ? 4 : 0) +
    (destaques.length > 0 ? 0 : 2) +
    (FAMILIAS_SECUNDARIAS.has(canonica.familia) ? 1 : 0);

  // The canonical ref, name, gama, brand and group are fields of their own;
  // the other variants' refs are what search still needs.
  const textoBusca = normalizarTexto(
    publicadas
      .filter((p) => p.ref !== canonica.ref)
      .map((p) => p.ref)
      .join(" "),
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
    destaques,
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
  // Undefined optionals are absent on stored docs and JSON drops them too;
  // keys are sorted at every level (`destaques` holds objects), so the
  // comparison does not depend on how the stored doc orders its fields.
  return (
    JSON.stringify(camposAtuais, chavesOrdenadas) ===
    JSON.stringify(novo, chavesOrdenadas)
  );
}

function chavesOrdenadas(_chave: string, valor: unknown): unknown {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
    return valor;
  }
  return Object.fromEntries(
    Object.entries(valor).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

import { v, type Infer } from "convex/values";
import { internalMutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  normalizarTexto,
  ordenarValores,
  sincronizarGrupos,
  type Destaque,
} from "./lib/catalogoGrupos";
import { definicoesHero, type ChaveSpec } from "./lib/specRegistry";
import { destaqueValidator } from "./schema";

// Public catalog listing, served from the denormalised `catalogoGrupos` table
// (see lib/catalogoGrupos.ts). One row per product page, already reduced to
// what the grid shows, so a request reads a few hundred ~300-byte rows and
// resolves cover URLs for the current page only. Results are cached by Convex
// per argument set and shared by every visitor asking the same thing.
//
// Never returns reseller/discount pricing — only the "desde" PVP.

const PAGINA_PADRAO = 24;
const PAGINA_MAX = 48;

export const ordenacaoValidator = v.union(
  v.literal("relevancia"),
  v.literal("preco-asc"),
  v.literal("preco-desc"),
  v.literal("nome"),
  v.literal("recentes"),
);
export type Ordenacao = Infer<typeof ordenacaoValidator>;

// One catalog entry = one product page (group of SKUs sharing grupoModelo).
export const catalogoEntryValidator = v.object({
  grupoModelo: v.string(),
  // Canonical variant's ref (drives the product-page link).
  ref: v.string(),
  nome: v.string(),
  marca: v.string(),
  familia: v.string(),
  gama: v.optional(v.string()),
  tipoUnidade: v.optional(v.string()),
  // Lowest / highest PVP among published variants (integer cents).
  precoDesdeCents: v.number(),
  precoAteCents: v.number(),
  numVariantes: v.number(),
  // Cooling capacity span across the group's variants (kW), when published.
  frioKwMin: v.optional(v.number()),
  frioKwMax: v.optional(v.number()),
  // Best energy class in the group.
  classeEnergetica: v.optional(v.string()),
  // Hero specs of the familia, in registry order (see catalogoGrupos).
  destaques: v.array(destaqueValidator),
  // Resolved URL of the cover image, or null when the group has no photo.
  capaUrl: v.union(v.string(), v.null()),
});
export type CatalogoEntry = Infer<typeof catalogoEntryValidator>;

const contagemValidator = v.object({
  valor: v.string(),
  contagem: v.number(),
});

// A hero-spec filter: a range for `numero` keys (either end open), a set of
// values for the others. Empty ranges and empty sets filter nothing.
const filtroDestaqueValidator = v.union(
  v.object({ min: v.optional(v.number()), max: v.optional(v.number()) }),
  v.object({ valores: v.array(v.string()) }),
);
type FiltroDestaque = Infer<typeof filtroDestaqueValidator>;

// What the Filtros sheet offers for one hero key: the span of a numeric key,
// or each value with the number of product pages carrying it.
const facetaValidator = v.union(
  v.object({
    chave: v.string(),
    tipo: v.literal("intervalo"),
    min: v.number(),
    max: v.number(),
  }),
  v.object({
    chave: v.string(),
    tipo: v.literal("valores"),
    valores: v.array(contagemValidator),
  }),
);
type Faceta = Infer<typeof facetaValidator>;

const listaValidator = v.object({
  entradas: v.array(catalogoEntryValidator),
  // Product pages matching every filter (not just this page's slice).
  total: v.number(),
  numPaginas: v.number(),
  // Echoed back clamped so the client can self-correct after filters shrink.
  pagina: v.number(),
  // Families available given marca+busca (familia filter lifted) and brands
  // available given familia+busca (marca filter lifted), so picking one never
  // hides the alternatives.
  familias: v.array(contagemValidator),
  marcas: v.array(contagemValidator),
  // Hero-spec facets of the selected familia, in registry order, each over
  // the pages passing every other filter (its own lifted). Empty without a
  // familia; a key no remaining page carries is left out.
  facetas: v.array(facetaValidator),
});

/**
 * How well a group matches the typed term, lower = better: an exact reference
 * match beats a name that starts with the term, which beats a name merely
 * containing it, which beats a hit on gama/marca/grupoModelo.
 */
function grauCorrespondencia(g: Doc<"catalogoGrupos">, termo: string): number {
  if (g.textoBusca.split(" ").includes(termo)) return 0;
  const nome = normalizarTexto(g.nome);
  if (nome.startsWith(termo)) return 1;
  if (nome.includes(` ${termo}`)) return 2;
  if (nome.includes(termo)) return 3;
  return 4;
}

function contar(
  grupos: Array<Doc<"catalogoGrupos">>,
  campo: "familia" | "marca",
): Array<Infer<typeof contagemValidator>> {
  const contagens = new Map<string, number>();
  for (const g of grupos) {
    contagens.set(g[campo], (contagens.get(g[campo]) ?? 0) + 1);
  }
  return [...contagens]
    .map(([valor, contagem]) => ({ valor, contagem }))
    .sort((a, b) => b.contagem - a.contagem || a.valor.localeCompare(b.valor));
}

function filtroAtivo(f: FiltroDestaque): boolean {
  return "valores" in f
    ? f.valores.length > 0
    : f.min !== undefined || f.max !== undefined;
}

/**
 * A range matches when the group's min–max overlaps it; a value set matches
 * when the group has any of the values. A group without the key never matches.
 */
function passaFiltro(
  destaque: Destaque | undefined,
  f: FiltroDestaque,
): boolean {
  if ("valores" in f) {
    return (
      destaque?.tipo === "valores" &&
      destaque.valores.some((valor) => f.valores.includes(valor))
    );
  }
  return (
    destaque?.tipo === "intervalo" &&
    (f.min === undefined || destaque.max >= f.min) &&
    (f.max === undefined || destaque.min <= f.max)
  );
}

function destaqueDe(
  g: Doc<"catalogoGrupos">,
  chave: string,
): Destaque | undefined {
  return g.destaques?.find((d) => d.chave === chave);
}

function faceta(
  grupos: Array<Doc<"catalogoGrupos">>,
  def: ChaveSpec,
): Faceta | undefined {
  const destaques = grupos
    .map((g) => destaqueDe(g, def.chave))
    .filter((d) => d !== undefined);
  if (def.tipo === "numero") {
    const intervalos = destaques.filter((d) => d.tipo === "intervalo");
    if (intervalos.length === 0) return undefined;
    return {
      chave: def.chave,
      tipo: "intervalo",
      min: Math.min(...intervalos.map((d) => d.min)),
      max: Math.max(...intervalos.map((d) => d.max)),
    };
  }
  const contagens = new Map<string, number>();
  for (const d of destaques) {
    if (d.tipo !== "valores") continue;
    for (const valor of d.valores) {
      contagens.set(valor, (contagens.get(valor) ?? 0) + 1);
    }
  }
  if (contagens.size === 0) return undefined;
  return {
    chave: def.chave,
    tipo: "valores",
    valores: ordenarValores(def, contagens.keys()).map((valor) => ({
      valor,
      contagem: contagens.get(valor) ?? 0,
    })),
  };
}

async function paraEntrada(
  ctx: QueryCtx,
  g: Doc<"catalogoGrupos">,
): Promise<CatalogoEntry> {
  return {
    grupoModelo: g.grupoModelo,
    ref: g.ref,
    nome: g.nome,
    marca: g.marca,
    familia: g.familia,
    gama: g.gama,
    tipoUnidade: g.tipoUnidade,
    precoDesdeCents: g.precoDesdeCents,
    precoAteCents: g.precoAteCents,
    numVariantes: g.numVariantes,
    frioKwMin: g.frioKwMin,
    frioKwMax: g.frioKwMax,
    classeEnergetica: g.classeEnergetica,
    destaques: g.destaques ?? [],
    capaUrl: g.capa === null ? null : await ctx.storage.getUrl(g.capa),
  };
}

export const listar = query({
  args: {
    busca: v.optional(v.string()),
    familia: v.optional(v.string()),
    marca: v.optional(v.string()),
    // Hero-spec filters keyed by hero key, e.g. {"frio-kw": {min: 2, max: 4}}.
    // Only applied with a `familia`, and only for that familia's hero keys.
    filtros: v.optional(v.record(v.string(), filtroDestaqueValidator)),
    ordenar: v.optional(ordenacaoValidator),
    // 0-based.
    pagina: v.optional(v.number()),
    porPagina: v.optional(v.number()),
  },
  returns: listaValidator,
  handler: async (ctx, args) => {
    // The whole table is one row per product page (~1k rows of a few hundred
    // bytes) — a deliberate summary table, so reading it in full is the cheap
    // path and lets us compute the "other options" counts in the same pass.
    const todos = await ctx.db.query("catalogoGrupos").collect();

    const termo = normalizarTexto(args.busca ?? "");
    // Every word must appear somewhere in the blob, in any order — "daikin
    // mural" and "mural daikin" find the same products.
    const palavras = termo === "" ? [] : termo.split(" ");
    const passaBusca = (g: Doc<"catalogoGrupos">) =>
      palavras.every((p) => g.textoBusca.includes(p));
    const passaFamilia = (g: Doc<"catalogoGrupos">) =>
      args.familia === undefined || g.familia === args.familia;
    const passaMarca = (g: Doc<"catalogoGrupos">) =>
      args.marca === undefined || g.marca === args.marca;

    const defsHero =
      args.familia === undefined ? [] : definicoesHero(args.familia);
    const filtrosAtivos = defsHero.flatMap((def) => {
      const filtro = args.filtros?.[def.chave];
      return filtro && filtroAtivo(filtro)
        ? [{ chave: def.chave, filtro }]
        : [];
    });
    // Every active hero filter except `excepto` (the facet being computed).
    const passaDestaques = (g: Doc<"catalogoGrupos">, excepto?: string) =>
      filtrosAtivos.every(
        ({ chave, filtro }) =>
          chave === excepto || passaFiltro(destaqueDe(g, chave), filtro),
      );

    const base = todos.filter(passaBusca);
    // Hero filters belong to the selected familia, so lifting familia for its
    // facet lifts them too.
    const familias = contar(base.filter(passaMarca), "familia");
    const daFamilia = base.filter(passaFamilia);
    const marcas = contar(
      daFamilia.filter((g) => passaDestaques(g)),
      "marca",
    );
    const daFamiliaEMarca = daFamilia.filter(passaMarca);
    const facetas = defsHero.flatMap((def) => {
      const f = faceta(
        daFamiliaEMarca.filter((g) => passaDestaques(g, def.chave)),
        def,
      );
      return f ? [f] : [];
    });
    const filtrados = daFamiliaEMarca.filter((g) => passaDestaques(g));

    const ordenar = args.ordenar ?? "relevancia";
    filtrados.sort((a, b) => {
      switch (ordenar) {
        case "preco-asc":
          return a.precoDesdeCents - b.precoDesdeCents;
        case "preco-desc":
          return b.precoDesdeCents - a.precoDesdeCents;
        case "nome":
          return a.nome.localeCompare(b.nome, "pt");
        case "recentes":
          return b.criadoEm - a.criadoEm;
        default: {
          if (termo !== "") {
            const grau =
              grauCorrespondencia(a, termo) - grauCorrespondencia(b, termo);
            if (grau !== 0) return grau;
          }
          if (a.peso !== b.peso) return a.peso - b.peso;
          return a.nome.localeCompare(b.nome, "pt");
        }
      }
    });

    const total = filtrados.length;
    const porPagina = Math.max(
      1,
      Math.min(PAGINA_MAX, Math.floor(args.porPagina ?? PAGINA_PADRAO)),
    );
    const numPaginas = Math.max(1, Math.ceil(total / porPagina));
    const pagina = Math.min(
      Math.max(0, Math.floor(args.pagina ?? 0)),
      numPaginas - 1,
    );
    const fatia = filtrados.slice(
      pagina * porPagina,
      pagina * porPagina + porPagina,
    );

    const entradas = await Promise.all(fatia.map((g) => paraEntrada(ctx, g)));

    return {
      entradas,
      total,
      numPaginas,
      pagina,
      familias,
      marcas,
      facetas,
    };
  },
});

const VITRINE_MAX = 12;

/**
 * The first product pages of the default order, optionally within a familia —
 * the landing page's showcases. Unlike `listar` it reads only the rows it
 * returns (index on peso, nome), so a catalog change costs a few KB here
 * instead of a full-table read per showcase. Within a peso, names sort by
 * code unit rather than Portuguese collation (upper case before lower, accents
 * last), so the order can differ from `listar` there — fine for a showcase.
 */
export const vitrine = query({
  args: {
    familia: v.optional(v.string()),
    limite: v.number(),
  },
  returns: v.array(catalogoEntryValidator),
  handler: async (ctx, args) => {
    const limite = Math.max(1, Math.min(VITRINE_MAX, Math.floor(args.limite)));
    const familia = args.familia;
    const grupos =
      familia === undefined
        ? await ctx.db
            .query("catalogoGrupos")
            .withIndex("by_peso_nome")
            .take(limite)
        : await ctx.db
            .query("catalogoGrupos")
            .withIndex("by_familia_peso_nome", (q) => q.eq("familia", familia))
            .take(limite);
    return await Promise.all(grupos.map((g) => paraEntrada(ctx, g)));
  },
});

// --- Rebuild -----------------------------------------------------------------

const LOTE = 200;

/**
 * Rebuild `catalogoGrupos` from `produtos` in place, in bounded batches that
 * reschedule themselves: first walk every SKU and sync the groups seen in each
 * batch, then walk the table and sync each row's group, which drops rows whose
 * group no longer has published SKUs. Rows are updated, never emptied and
 * refilled, so the shop keeps its full listing throughout, and unchanged rows
 * are not written (no cache invalidation for a no-op rebuild). Run after
 * deploying a new derived field, and after any bulk migration that writes
 * `produtos` without going through the synced helpers:
 *
 *   npx convex run catalogo:reconstruir
 */
export const reconstruir = internalMutation({
  args: {
    fase: v.optional(v.union(v.literal("construir"), v.literal("limpar"))),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const fase = args.fase ?? "construir";

    if (fase === "construir") {
      const pagina = await ctx.db
        .query("produtos")
        .paginate({ numItems: LOTE, cursor: args.cursor ?? null });
      // A group straddling two batches is synced twice — harmless, idempotent.
      await sincronizarGrupos(
        ctx,
        pagina.page.map((p) => p.grupoModelo),
      );
      await ctx.scheduler.runAfter(0, internal.catalogo.reconstruir, {
        fase: pagina.isDone ? "limpar" : "construir",
        cursor: pagina.isDone ? null : pagina.continueCursor,
      });
      return null;
    }

    const pagina = await ctx.db
      .query("catalogoGrupos")
      .paginate({ numItems: LOTE, cursor: args.cursor ?? null });
    await sincronizarGrupos(
      ctx,
      pagina.page.map((g) => g.grupoModelo),
    );
    if (pagina.isDone) {
      console.log("catalogo:reconstruir concluído");
    } else {
      await ctx.scheduler.runAfter(0, internal.catalogo.reconstruir, {
        fase: "limpar",
        cursor: pagina.continueCursor,
      });
    }
    return null;
  },
});

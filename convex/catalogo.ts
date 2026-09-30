import { v, type Infer } from "convex/values";
import { internalMutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { sincronizarGrupos } from "./lib/catalogoGrupos";
import {
  codificarIndice,
  filtrarCatalogo,
  lerIndice,
  paginar,
} from "./lib/catalogoFiltros";
import { destaqueValidator } from "./schema";

// Public catalog, served from the denormalised `catalogoGrupos` table (see
// lib/catalogoGrupos.ts), one row per product page. The shop loads the whole
// table once as `indice` — one cached result shared by every visitor, re-read
// only when the catalog changes — and searches, filters, sorts and pages it in
// the browser (lib/catalogoFiltros.ts). Covers are resolved per visible page
// (`capas`); the landing page's showcases read a few indexed rows (`vitrine`).
//
// Never returns reseller/discount pricing — only the "desde" PVP.

export const ordenacaoValidator = v.union(
  v.literal("relevancia"),
  v.literal("preco-asc"),
  v.literal("preco-desc"),
  v.literal("nome"),
  v.literal("recentes"),
);

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
  // Deprecated by `destaques`; gone with `listar` once no client reads them.
  frioKwMin: v.optional(v.number()),
  frioKwMax: v.optional(v.number()),
  classeEnergetica: v.optional(v.string()),
  // Hero specs of the familia, in registry order (see catalogoGrupos).
  destaques: v.array(destaqueValidator),
  // Resolved URL of the cover image, or null when the group has no photo.
  capaUrl: v.union(v.string(), v.null()),
});
export type CatalogoEntry = Infer<typeof catalogoEntryValidator>;

// `LinhaIndice` in lib/catalogoFiltros.ts, field for field.
const linhaIndiceValidator = v.object({
  g: v.string(),
  r: v.string(),
  n: v.string(),
  m: v.string(),
  f: v.string(),
  p: v.number(),
  v: v.optional(v.number()),
  w: v.optional(v.number()),
  x: v.optional(v.literal(1)),
  gama: v.optional(v.string()),
  t: v.optional(v.string()),
  d: v.optional(
    v.record(v.string(), v.union(v.array(v.number()), v.array(v.string()))),
  ),
  b: v.optional(v.string()),
});

/**
 * Every product page in one compact payload, newest first: what the catalog
 * grid, search, sorting and Filtros facets need, nothing else (no ids, no
 * cover URLs). No arguments, so Convex caches one result for every visitor
 * and re-runs it only when `catalogoGrupos` changes.
 */
export const indice = query({
  args: {},
  returns: v.array(linhaIndiceValidator),
  handler: async (ctx) => {
    // ~1k small summary rows: the one full read happens per catalog change,
    // not per visitor or per search.
    const grupos = await ctx.db.query("catalogoGrupos").collect();
    return codificarIndice(grupos);
  },
});

const CAPAS_MAX = 48;

/** Cover URLs for the product pages on screen (null = no photo). */
export const capas = query({
  args: { grupos: v.array(v.string()) },
  returns: v.array(
    v.object({ grupoModelo: v.string(), url: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx, args) => {
    const grupos = [...new Set(args.grupos)].slice(0, CAPAS_MAX);
    const capas = await Promise.all(
      grupos.map(async (grupoModelo) => {
        const g = await ctx.db
          .query("catalogoGrupos")
          .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", grupoModelo))
          .unique();
        if (g === null) return null;
        return {
          grupoModelo,
          url: g.capa === null ? null : await ctx.storage.getUrl(g.capa),
        };
      }),
    );
    return capas.filter((c) => c !== null);
  },
});

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

const contagemValidator = v.object({
  valor: v.string(),
  contagem: v.number(),
});

/**
 * Server-side listing for clients deployed before `indice`: the same
 * lib/catalogoFiltros.ts code over the whole table, one page at a time.
 * Removed once no deployed client calls it.
 */
export const listar = query({
  args: {
    busca: v.optional(v.string()),
    familia: v.optional(v.string()),
    marca: v.optional(v.string()),
    filtros: v.optional(
      v.record(
        v.string(),
        v.union(
          v.object({
            min: v.optional(v.number()),
            max: v.optional(v.number()),
          }),
          v.object({ valores: v.array(v.string()) }),
        ),
      ),
    ),
    ordenar: v.optional(ordenacaoValidator),
    // 0-based.
    pagina: v.optional(v.number()),
    porPagina: v.optional(v.number()),
  },
  returns: v.object({
    entradas: v.array(catalogoEntryValidator),
    total: v.number(),
    numPaginas: v.number(),
    pagina: v.number(),
    familias: v.array(contagemValidator),
    marcas: v.array(contagemValidator),
    facetas: v.array(
      v.union(
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
      ),
    ),
  }),
  handler: async (ctx, args) => {
    const todos = await ctx.db.query("catalogoGrupos").collect();
    const { porPagina: pedidos, pagina: paginaPedida, ...pedido } = args;
    const resultado = filtrarCatalogo(
      lerIndice(codificarIndice(todos)),
      pedido,
    );
    const porPagina = Math.max(1, Math.min(48, Math.floor(pedidos ?? 24)));
    const { pagina, numPaginas, inicio, fim } = paginar(
      resultado.grupos.length,
      paginaPedida ?? 0,
      porPagina,
    );
    const porGrupo = new Map(todos.map((g) => [g.grupoModelo, g]));
    const entradas = await Promise.all(
      resultado.grupos
        .slice(inicio, fim)
        .map((g) => paraEntrada(ctx, porGrupo.get(g.grupoModelo)!)),
    );
    return {
      entradas,
      total: resultado.grupos.length,
      numPaginas,
      pagina,
      familias: resultado.familias,
      marcas: resultado.marcas,
      facetas: resultado.facetas,
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

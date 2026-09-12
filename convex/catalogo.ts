import { v, type Infer } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { normalizarTexto, sincronizarGrupos } from "./lib/catalogoGrupos";

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
  // Resolved URL of the cover image, or null when the group has no photo.
  capaUrl: v.union(v.string(), v.null()),
});
export type CatalogoEntry = Infer<typeof catalogoEntryValidator>;

const contagemValidator = v.object({
  valor: v.string(),
  contagem: v.number(),
});

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

export const listar = query({
  args: {
    busca: v.optional(v.string()),
    familia: v.optional(v.string()),
    marca: v.optional(v.string()),
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

    const base = todos.filter(passaBusca);
    const familias = contar(base.filter(passaMarca), "familia");
    const marcas = contar(base.filter(passaFamilia), "marca");
    const filtrados = base.filter((g) => passaFamilia(g) && passaMarca(g));

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

    const entradas = await Promise.all(
      fatia.map(async (g): Promise<CatalogoEntry> => ({
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
        capaUrl: g.capa === null ? null : await ctx.storage.getUrl(g.capa),
      })),
    );

    return { entradas, total, numPaginas, pagina, familias, marcas };
  },
});

// --- Rebuild -----------------------------------------------------------------

const LOTE = 200;

/**
 * Rebuild `catalogoGrupos` from `produtos`, in bounded batches that reschedule
 * themselves: first empty the table, then walk every SKU and sync the groups
 * seen in each batch. Run once after deploying the table, and after any bulk
 * migration that writes `produtos` without going through the synced helpers:
 *
 *   npx convex run catalogo:reconstruir
 */
export const reconstruir = internalMutation({
  args: {
    fase: v.optional(v.union(v.literal("limpar"), v.literal("construir"))),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const fase = args.fase ?? "limpar";

    if (fase === "limpar") {
      const lote = await ctx.db.query("catalogoGrupos").take(LOTE);
      for (const g of lote) await ctx.db.delete(g._id);
      if (lote.length === LOTE) {
        await ctx.scheduler.runAfter(0, internal.catalogo.reconstruir, {
          fase: "limpar",
        });
      } else {
        await ctx.scheduler.runAfter(0, internal.catalogo.reconstruir, {
          fase: "construir",
          cursor: null,
        });
      }
      return null;
    }

    const pagina = await ctx.db
      .query("produtos")
      .paginate({ numItems: LOTE, cursor: args.cursor ?? null });
    // A group straddling two batches is synced twice — harmless, idempotent.
    await sincronizarGrupos(
      ctx,
      pagina.page.map((p) => p.grupoModelo),
    );
    if (pagina.isDone) {
      console.log("catalogo:reconstruir concluído");
    } else {
      await ctx.scheduler.runAfter(0, internal.catalogo.reconstruir, {
        fase: "construir",
        cursor: pagina.continueCursor,
      });
    }
    return null;
  },
});

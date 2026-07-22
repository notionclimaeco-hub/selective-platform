import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  marcaValidator,
  tipoValidator,
  categoriaValidator,
  estadoValidator,
} from "./schema";
import { parsePaginas, PDF_PAGINAS_REGEX } from "./lib/paginas";
import { requireStaff } from "./lib/auth";

// Public shape of a product. Contains PVP only — no reseller/discount pricing
// is ever stored on or returned from a produtos document.
const produtoPublicoValidator = v.object({
  _id: v.id("produtos"),
  _creationTime: v.number(),
  ref: v.string(),
  nome: v.string(),
  marca: marcaValidator,
  tipo: tipoValidator,
  categoria: categoriaValidator,
  gama: v.optional(v.string()),
  capacidadeKw: v.optional(v.number()),
  classeEnergetica: v.optional(v.string()),
  refrigerante: v.optional(v.string()),
  descricao: v.optional(v.string()),
  pvpCents: v.number(),
  imagens: v.array(v.id("_storage")),
  estado: estadoValidator,
  tabelaOrigem: v.string(),
  grupoModelo: v.optional(v.string()),
  variante: v.optional(v.string()),
  pdfPaginas: v.optional(v.string()),
});

// A resolved catalog page download for the product detail page.
const fichaCatalogoValidator = v.object({
  pagina: v.number(),
  url: v.string(),
});

// Product detail = the public product plus its resolved catalog PDF pages and
// image URLs (first = cover; already resolved so the client renders directly).
const produtoDetalheValidator = v.object({
  ...produtoPublicoValidator.fields,
  fichasCatalogo: v.array(fichaCatalogoValidator),
  imagensUrls: v.array(v.string()),
});

// One catalog entry = one group (or one ungrouped product). Never leaks
// reseller/discount pricing — only the "desde" PVP.
const catalogoEntryValidator = v.object({
  // null for ungrouped (standalone) products.
  grupoModelo: v.union(v.string(), v.null()),
  // Canonical variant's ref (drives the product-page link).
  ref: v.string(),
  nome: v.string(),
  marca: marcaValidator,
  categoria: categoriaValidator,
  gama: v.optional(v.string()),
  // Lowest PVP among published variants (integer cents).
  precoDesdeCents: v.number(),
  // Resolved URL of the canonical variant's cover image, or null if none.
  capaUrl: v.union(v.string(), v.null()),
  // First catalog PDF page URL — used as a visual fallback when capaUrl is null.
  capaPdfUrl: v.union(v.string(), v.null()),
  numVariantes: v.number(),
});

// Per-variant payload inside a group detail page.
const grupoVarianteValidator = v.object({
  _id: v.id("produtos"),
  ref: v.string(),
  variante: v.optional(v.string()),
  capacidadeKw: v.optional(v.number()),
  classeEnergetica: v.optional(v.string()),
  refrigerante: v.optional(v.string()),
  pvpCents: v.number(),
  // Resolved URLs of the variant's own images if it has any, otherwise the
  // canonical variant's.
  imagensUrls: v.array(v.string()),
});

const grupoValidator = v.object({
  grupoModelo: v.string(),
  // Page-level content comes from the canonical variant.
  nome: v.string(),
  marca: marcaValidator,
  categoria: categoriaValidator,
  gama: v.optional(v.string()),
  imagensUrls: v.array(v.string()),
  descricao: v.optional(v.string()),
  variantes: v.array(grupoVarianteValidator),
});

/**
 * Canonical variant of a family = the published variant with the lowest
 * `capacidadeKw`; when capacity is missing it sorts last, tie-broken by the
 * lowest `pvpCents`. If no variant has a capacity, this reduces to the cheapest.
 */
function escolherCanonica(variantes: Array<Doc<"produtos">>): Doc<"produtos"> {
  return variantes.reduce((melhor, atual) => {
    const kwMelhor = melhor.capacidadeKw ?? Number.POSITIVE_INFINITY;
    const kwAtual = atual.capacidadeKw ?? Number.POSITIVE_INFINITY;
    if (kwAtual < kwMelhor) return atual;
    if (kwAtual === kwMelhor && atual.pvpCents < melhor.pvpCents) return atual;
    return melhor;
  });
}

/**
 * Resolve storage ids to signed URLs, skipping missing files. Variants of a
 * family typically share the same files, so a memo avoids resolving the same
 * id repeatedly within one query.
 */
function criarResolvedorUrls(ctx: QueryCtx) {
  const memo = new Map<Id<"_storage">, string | null>();
  return async (ids: Array<Id<"_storage">>): Promise<Array<string>> => {
    const urls: Array<string> = [];
    for (const id of ids) {
      let url = memo.get(id);
      if (url === undefined) {
        url = await ctx.storage.getUrl(id);
        memo.set(id, url);
      }
      if (url !== null) urls.push(url);
    }
    return urls;
  };
}

/**
 * Resolve the first catalog PDF page for a product. Memoized by
 * (tabelaOrigem, pagina) since many products share the same page.
 */
function criarResolvedorPdfCapa(
  ctx: QueryCtx,
  resolverUrls: (ids: Array<Id<"_storage">>) => Promise<Array<string>>,
) {
  const memo = new Map<string, string | null>();
  return async (p: Doc<"produtos">): Promise<string | null> => {
    if (p.pdfPaginas === undefined) return null;
    const primeira = parsePaginas(p.pdfPaginas)[0];
    if (primeira === undefined) return null;
    const key = `${p.tabelaOrigem}:${primeira}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const pagina = await ctx.db
      .query("paginasCatalogo")
      .withIndex("by_tabela_pagina", (q) =>
        q.eq("tabelaOrigem", p.tabelaOrigem).eq("pagina", primeira),
      )
      .unique();
    if (!pagina) {
      memo.set(key, null);
      return null;
    }
    const [url] = await resolverUrls([pagina.ficheiro]);
    const result = url ?? null;
    memo.set(key, result);
    return result;
  };
}

/**
 * Resolve a product's referenced catalog pages (pdfPaginas) against its own
 * tabelaOrigem. Pages with no uploaded file yet are silently skipped (uploads
 * may lag the import) — never throws.
 */
async function fichasCatalogoDe(
  ctx: QueryCtx,
  produto: Doc<"produtos">,
): Promise<Array<{ pagina: number; url: string }>> {
  const fichas: Array<{ pagina: number; url: string }> = [];
  if (produto.pdfPaginas === undefined) return fichas;
  for (const pagina of parsePaginas(produto.pdfPaginas)) {
    const linha = await ctx.db
      .query("paginasCatalogo")
      .withIndex("by_tabela_pagina", (q) =>
        q.eq("tabelaOrigem", produto.tabelaOrigem).eq("pagina", pagina),
      )
      .unique();
    if (!linha) continue;
    const url = await ctx.storage.getUrl(linha.ficheiro);
    if (url === null) continue;
    fichas.push({ pagina, url });
  }
  return fichas;
}

// Sort variants by capacity asc (missing capacity last), then by price asc.
function ordenarPorCapacidade(
  variantes: Array<Doc<"produtos">>,
): Array<Doc<"produtos">> {
  return [...variantes].sort((a, b) => {
    const ka = a.capacidadeKw ?? Number.POSITIVE_INFINITY;
    const kb = b.capacidadeKw ?? Number.POSITIVE_INFINITY;
    if (ka !== kb) return ka - kb;
    return a.pvpCents - b.pvpCents;
  });
}

/**
 * Public catalog listing. Returns only published products and PVP pricing,
 * grouped: one entry per `grupoModelo`, or one entry per ref for ungrouped
 * products. Never returns reseller/discount data.
 *
 * The catalog is small (hundreds of rows) so we read with `by_catalogo` and
 * group in-memory — no pagination needed yet.
 */
export const listarCatalogo = query({
  args: {
    marca: v.optional(marcaValidator),
    categoria: v.optional(categoriaValidator),
  },
  returns: v.array(catalogoEntryValidator),
  handler: async (ctx, args) => {
    // by_catalogo is ["estado", "marca", "categoria"]. We can only constrain a
    // field in the index if all preceding fields are also constrained, so
    // `categoria` alone (without `marca`) is applied as a post-filter below.
    const produtos = await ctx.db
      .query("produtos")
      .withIndex("by_catalogo", (q) => {
        if (args.marca !== undefined && args.categoria !== undefined) {
          return q
            .eq("estado", "publicado")
            .eq("marca", args.marca)
            .eq("categoria", args.categoria);
        }
        if (args.marca !== undefined) {
          return q.eq("estado", "publicado").eq("marca", args.marca);
        }
        return q.eq("estado", "publicado");
      })
      .collect();

    const publicados =
      args.marca === undefined && args.categoria !== undefined
        ? produtos.filter((p) => p.categoria === args.categoria)
        : produtos;

    const resolverUrls = criarResolvedorUrls(ctx);
    const pdfCapaDe = criarResolvedorPdfCapa(ctx, resolverUrls);
    const capaUrlDe = async (p: Doc<"produtos">): Promise<string | null> => {
      const capa = p.imagens[0];
      if (capa === undefined) return null;
      const [url] = await resolverUrls([capa]);
      return url ?? null;
    };
    // Photo first; if none, first catalog PDF page; otherwise null (UI placeholder).
    const capasDe = async (p: Doc<"produtos">) => {
      const capaUrl = await capaUrlDe(p);
      const capaPdfUrl = capaUrl === null ? await pdfCapaDe(p) : null;
      return { capaUrl, capaPdfUrl };
    };

    // Partition into named groups and standalone products.
    const grupos = new Map<string, Array<Doc<"produtos">>>();
    const entries: Array<{
      grupoModelo: string | null;
      ref: string;
      nome: string;
      marca: Doc<"produtos">["marca"];
      categoria: Doc<"produtos">["categoria"];
      gama?: string;
      precoDesdeCents: number;
      capaUrl: string | null;
      capaPdfUrl: string | null;
      numVariantes: number;
    }> = [];

    for (const p of publicados) {
      if (p.grupoModelo === undefined) {
        const capas = await capasDe(p);
        entries.push({
          grupoModelo: null,
          ref: p.ref,
          nome: p.nome,
          marca: p.marca,
          categoria: p.categoria,
          gama: p.gama,
          precoDesdeCents: p.pvpCents,
          ...capas,
          numVariantes: 1,
        });
      } else {
        const atual = grupos.get(p.grupoModelo);
        if (atual) {
          atual.push(p);
        } else {
          grupos.set(p.grupoModelo, [p]);
        }
      }
    }

    for (const [grupoModelo, variantes] of grupos) {
      const canonica = escolherCanonica(variantes);
      const precoDesdeCents = Math.min(...variantes.map((x) => x.pvpCents));
      // A group's cover falls back to any variant with images, so the catalog
      // shows a photo even when only some variants have one.
      const comImagem =
        canonica.imagens.length > 0
          ? canonica
          : variantes.find((x) => x.imagens.length > 0);
      const comPdf =
        comImagem ??
        (canonica.pdfPaginas !== undefined
          ? canonica
          : variantes.find((x) => x.pdfPaginas !== undefined));
      const capas = comPdf
        ? await capasDe(comPdf)
        : { capaUrl: null, capaPdfUrl: null };
      entries.push({
        grupoModelo,
        ref: canonica.ref,
        nome: canonica.nome,
        marca: canonica.marca,
        categoria: canonica.categoria,
        gama: canonica.gama,
        precoDesdeCents,
        ...capas,
        numVariantes: variantes.length,
      });
    }

    // Deterministic order for stable rendering.
    entries.sort((a, b) => a.nome.localeCompare(b.nome));
    return entries;
  },
});

/**
 * Public product detail by manufacturer reference. Only returns the product if
 * it is published, otherwise null. Used for standalone (ungrouped) products.
 */
export const obterPorRef = query({
  args: { ref: v.string() },
  returns: v.union(produtoDetalheValidator, v.null()),
  handler: async (ctx, args) => {
    const produto = await ctx.db
      .query("produtos")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .unique();

    if (!produto || produto.estado !== "publicado") {
      return null;
    }

    const fichasCatalogo = await fichasCatalogoDe(ctx, produto);

    // A grouped variant without its own photos inherits the family's: fall
    // back to any variant in the group that has images.
    const resolverUrls = criarResolvedorUrls(ctx);
    let imagens = produto.imagens;
    if (imagens.length === 0 && produto.grupoModelo !== undefined) {
      const grupoModelo = produto.grupoModelo;
      const familia = await ctx.db
        .query("produtos")
        .withIndex("by_grupo", (q) => q.eq("grupoModelo", grupoModelo))
        .collect();
      imagens = familia.find((p) => p.imagens.length > 0)?.imagens ?? [];
    }
    const imagensUrls = await resolverUrls(imagens);

    return { ...produto, fichasCatalogo, imagensUrls };
  },
});

/**
 * Public group detail: all PUBLISHED variants of a family, sorted by capacity
 * ascending, plus page-level content (imagens + descricao) from the canonical
 * variant. Each variant carries its own images when it has any (variant images
 * override the canonical ones). Returns null when the group has no published
 * variants.
 */
export const obterGrupo = query({
  args: { grupoModelo: v.string() },
  returns: v.union(grupoValidator, v.null()),
  handler: async (ctx, args) => {
    const todas = await ctx.db
      .query("produtos")
      .withIndex("by_grupo", (q) => q.eq("grupoModelo", args.grupoModelo))
      .collect();

    const publicadas = todas.filter((p) => p.estado === "publicado");
    if (publicadas.length === 0) {
      return null;
    }

    const canonica = escolherCanonica(publicadas);
    const resolverUrls = criarResolvedorUrls(ctx);

    // Family-level fallback: canonical's images, or any variant's if the
    // canonical has none.
    const imagensFamilia =
      canonica.imagens.length > 0
        ? canonica.imagens
        : (publicadas.find((p) => p.imagens.length > 0)?.imagens ?? []);

    const variantes = await Promise.all(
      ordenarPorCapacidade(publicadas).map(async (p) => ({
        _id: p._id,
        ref: p.ref,
        variante: p.variante,
        capacidadeKw: p.capacidadeKw,
        classeEnergetica: p.classeEnergetica,
        refrigerante: p.refrigerante,
        pvpCents: p.pvpCents,
        imagensUrls: await resolverUrls(
          p.imagens.length > 0 ? p.imagens : imagensFamilia,
        ),
      })),
    );

    return {
      grupoModelo: args.grupoModelo,
      nome: canonica.nome,
      marca: canonica.marca,
      categoria: canonica.categoria,
      gama: canonica.gama,
      imagensUrls: await resolverUrls(imagensFamilia),
      descricao: canonica.descricao,
      variantes,
    };
  },
});

// One variant row inside the admin listing.
const adminVarianteValidator = v.object({
  _id: v.id("produtos"),
  ref: v.string(),
  variante: v.optional(v.string()),
  estado: estadoValidator,
  pvpCents: v.number(),
  numImagens: v.number(),
});

// One family (or standalone) entry in the admin listing. Unlike the public
// catalog this includes every estado (rascunho/publicado/descontinuado) so
// staff can manage images before publishing.
const adminEntryValidator = v.object({
  grupoModelo: v.union(v.string(), v.null()),
  // Canonical/representative ref — opens the family-level image manager.
  ref: v.string(),
  nome: v.string(),
  marca: marcaValidator,
  categoria: categoriaValidator,
  gama: v.optional(v.string()),
  capaUrl: v.union(v.string(), v.null()),
  numVariantes: v.number(),
  numComImagens: v.number(),
  variantes: v.array(adminVarianteValidator),
});

/**
 * Staff-only admin listing of every product, grouped by family (standalone
 * products form their own single-variant entry). Includes all estados and per
 * product image counts so staff can manage photos. The catalog is small
 * (hundreds of rows) so we read the whole table and group in-memory.
 */
export const listarAdmin = query({
  args: {},
  returns: v.array(adminEntryValidator),
  handler: async (ctx) => {
    await requireStaff(ctx);

    const todos = await ctx.db.query("produtos").collect();

    const resolverUrls = criarResolvedorUrls(ctx);
    const capaUrlDe = async (p: Doc<"produtos">): Promise<string | null> => {
      const capa = p.imagens[0];
      if (capa === undefined) return null;
      const [url] = await resolverUrls([capa]);
      return url ?? null;
    };

    const varianteDe = (p: Doc<"produtos">) => ({
      _id: p._id,
      ref: p.ref,
      variante: p.variante,
      estado: p.estado,
      pvpCents: p.pvpCents,
      numImagens: p.imagens.length,
    });

    // Partition into named groups and standalone products.
    const grupos = new Map<string, Array<Doc<"produtos">>>();
    const standalone: Array<Doc<"produtos">> = [];
    for (const p of todos) {
      if (p.grupoModelo === undefined) {
        standalone.push(p);
      } else {
        const atual = grupos.get(p.grupoModelo);
        if (atual) {
          atual.push(p);
        } else {
          grupos.set(p.grupoModelo, [p]);
        }
      }
    }

    const entries: Array<Infer<typeof adminEntryValidator>> = [];

    for (const p of standalone) {
      entries.push({
        grupoModelo: null,
        ref: p.ref,
        nome: p.nome,
        marca: p.marca,
        categoria: p.categoria,
        gama: p.gama,
        capaUrl: await capaUrlDe(p),
        numVariantes: 1,
        numComImagens: p.imagens.length > 0 ? 1 : 0,
        variantes: [varianteDe(p)],
      });
    }

    for (const [grupoModelo, variantes] of grupos) {
      const canonica = escolherCanonica(variantes);
      // Family cover falls back to any variant with images.
      const comImagem =
        canonica.imagens.length > 0
          ? canonica
          : variantes.find((x) => x.imagens.length > 0);
      entries.push({
        grupoModelo,
        ref: canonica.ref,
        nome: canonica.nome,
        marca: canonica.marca,
        categoria: canonica.categoria,
        gama: canonica.gama,
        capaUrl: comImagem ? await capaUrlDe(comImagem) : null,
        numVariantes: variantes.length,
        numComImagens: variantes.filter((x) => x.imagens.length > 0).length,
        variantes: ordenarPorCapacidade(variantes).map(varianteDe),
      });
    }

    entries.sort((a, b) => a.nome.localeCompare(b.nome));
    return entries;
  },
});

/**
 * Staff-only: full product document by ref, for the admin edit form. Returns
 * every stored field (including estado/imagens) so the editor can pre-fill,
 * plus resolved catalog page links for quick preview.
 */
export const obterAdmin = query({
  args: { ref: v.string() },
  returns: v.union(
    v.object({
      ...produtoPublicoValidator.fields,
      fichasCatalogo: v.array(fichaCatalogoValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const produto = await ctx.db
      .query("produtos")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .unique();
    if (!produto) return null;
    return { ...produto, fichasCatalogo: await fichasCatalogoDe(ctx, produto) };
  },
});

// Shared field validators for an imported product row. Reused by the internal
// upsert mutation and the (secret-guarded) bulk importer so both accept exactly
// the same shape.
export const produtoImportFields = {
  ref: v.string(),
  nome: v.string(),
  marca: marcaValidator,
  tipo: tipoValidator,
  categoria: categoriaValidator,
  gama: v.optional(v.string()),
  capacidadeKw: v.optional(v.number()),
  classeEnergetica: v.optional(v.string()),
  refrigerante: v.optional(v.string()),
  descricao: v.optional(v.string()),
  pvpCents: v.number(),
  tabelaOrigem: v.string(),
  grupoModelo: v.optional(v.string()),
  variante: v.optional(v.string()),
  // Verbatim CSV value: "" (none), "15", or "54-55". Normalized on write.
  pdfPaginas: v.optional(v.string()),
};

export const upsertResultValidator = v.object({
  produtoId: v.id("produtos"),
  created: v.boolean(),
  updated: v.boolean(),
  precoAlterado: v.boolean(),
});

export type ProdutoImport = Infer<
  ReturnType<typeof v.object<typeof produtoImportFields>>
>;

/**
 * Idempotent upsert of a product by manufacturer reference. Shared business
 * logic (called by the internal mutation and the bulk importer).
 * - If the product exists: patch the imported fields but preserve the current
 *   `estado` and `imagens` (those are managed in the app, not by the import).
 * - If it does not exist: insert as a draft ("rascunho") with no images.
 *
 * Variant grouping rules (the real guard for the domain):
 * - `grupoModelo` and `variante` are both-or-neither.
 * - A group must never mix brands.
 */
export async function upsertProdutoPorRef(
  ctx: MutationCtx,
  args: ProdutoImport,
): Promise<Infer<typeof upsertResultValidator>> {
  // Grouping metadata is both-or-neither.
  if ((args.grupoModelo === undefined) !== (args.variante === undefined)) {
    throw new Error(
      `Produto "${args.ref}": grupoModelo e variante têm de ser ambos definidos ou ambos vazios.`,
    );
  }

  // Normalize pdfPaginas: empty string means "no pages". Any non-empty value
  // must match the "15" / "54-55" format (same rule as the CSV zod schema).
  const pdfPaginas =
    args.pdfPaginas === undefined || args.pdfPaginas === ""
      ? undefined
      : args.pdfPaginas;
  if (pdfPaginas !== undefined && !PDF_PAGINAS_REGEX.test(pdfPaginas)) {
    throw new Error(
      `Produto "${args.ref}": pdfPaginas "${pdfPaginas}" inválido; use "15" ou "54-55".`,
    );
  }

  const existente = await ctx.db
    .query("produtos")
    .withIndex("by_ref", (q) => q.eq("ref", args.ref))
    .unique();

  // No cross-brand groups: any other row already in this group must share
  // the same marca.
  if (args.grupoModelo !== undefined) {
    const grupoModelo = args.grupoModelo;
    const noGrupo = await ctx.db
      .query("produtos")
      .withIndex("by_grupo", (q) => q.eq("grupoModelo", grupoModelo))
      .collect();
    const conflito = noGrupo.find(
      (p) => p._id !== existente?._id && p.marca !== args.marca,
    );
    if (conflito) {
      throw new Error(
        `Grupo "${args.grupoModelo}" já contém a marca "${conflito.marca}"; ` +
          `não pode misturar com "${args.marca}" (ref "${args.ref}").`,
      );
    }
  }

  // The imported fields (excludes app-managed `estado` and `imagens`).
  const campos = {
    ref: args.ref,
    nome: args.nome,
    marca: args.marca,
    tipo: args.tipo,
    categoria: args.categoria,
    gama: args.gama,
    capacidadeKw: args.capacidadeKw,
    classeEnergetica: args.classeEnergetica,
    refrigerante: args.refrigerante,
    descricao: args.descricao,
    pvpCents: args.pvpCents,
    tabelaOrigem: args.tabelaOrigem,
    grupoModelo: args.grupoModelo,
    variante: args.variante,
    pdfPaginas,
  };

  if (existente) {
    const precoAlterado = existente.pvpCents !== args.pvpCents;
    // Preserve existing `estado` and `imagens` by not including them here.
    await ctx.db.patch(existente._id, campos);
    return {
      produtoId: existente._id,
      created: false,
      updated: true,
      precoAlterado,
    };
  }

  const produtoId = await ctx.db.insert("produtos", {
    ...campos,
    estado: "rascunho",
    imagens: [],
  });
  return { produtoId, created: true, updated: false, precoAlterado: false };
}

/**
 * Idempotent import upsert, keyed by manufacturer reference. Internal only —
 * imports run from trusted backend code. Thin wrapper over `upsertProdutoPorRef`.
 */
export const upsertPorRef = internalMutation({
  args: produtoImportFields,
  returns: upsertResultValidator,
  handler: async (ctx, args) => upsertProdutoPorRef(ctx, args),
});

/**
 * Bulk estado change by manufacturer refs (e.g. publish a curated subset).
 * Internal only — run via `npx convex run`. Unknown refs are reported, not
 * fatal, so a partially wrong list still applies the rest.
 */
export const definirEstadoPorRefs = internalMutation({
  args: {
    refs: v.array(v.string()),
    estado: estadoValidator,
  },
  returns: v.object({
    alterados: v.number(),
    naoEncontrados: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    let alterados = 0;
    const naoEncontrados: Array<string> = [];
    for (const ref of args.refs) {
      const produto = await ctx.db
        .query("produtos")
        .withIndex("by_ref", (q) => q.eq("ref", ref))
        .unique();
      if (!produto) {
        naoEncontrados.push(ref);
        continue;
      }
      if (produto.estado !== args.estado) {
        await ctx.db.patch(produto._id, { estado: args.estado });
        alterados++;
      }
    }
    return { alterados, naoEncontrados };
  },
});

// --- Staff product management (admin app) ---

// Resolve which product docs an action targets: the whole family when
// `aplicarAoGrupo` and the product is grouped, otherwise just the one.
async function alvosDoRef(
  ctx: MutationCtx,
  ref: string,
  aplicarAoGrupo: boolean | undefined,
): Promise<Array<Doc<"produtos">>> {
  const produto = await ctx.db
    .query("produtos")
    .withIndex("by_ref", (q) => q.eq("ref", ref))
    .unique();
  if (!produto) {
    throw new Error(`Produto "${ref}" não encontrado.`);
  }
  if (aplicarAoGrupo === true && produto.grupoModelo !== undefined) {
    const grupoModelo = produto.grupoModelo;
    return await ctx.db
      .query("produtos")
      .withIndex("by_grupo", (q) => q.eq("grupoModelo", grupoModelo))
      .collect();
  }
  return [produto];
}

// Delete storage files in `candidatos` that are no longer referenced by any
// remaining product. The catalog is small so a full scan is fine.
async function limparFicheirosOrfaos(
  ctx: MutationCtx,
  candidatos: Set<Id<"_storage">>,
): Promise<number> {
  if (candidatos.size === 0) return 0;
  const referenciados = new Set<Id<"_storage">>();
  const todos = await ctx.db.query("produtos").collect();
  for (const p of todos) {
    for (const ficheiro of p.imagens) referenciados.add(ficheiro);
  }
  let removidos = 0;
  for (const ficheiro of candidatos) {
    if (referenciados.has(ficheiro)) continue;
    await ctx.storage.delete(ficheiro);
    removidos++;
  }
  return removidos;
}

/**
 * Staff-only: change a product's estado (rascunho/publicado/descontinuado).
 * With `aplicarAoGrupo` and a grouped product, applies to every variant of the
 * family. Idempotent — variants already in the target estado are skipped.
 */
export const definirEstado = mutation({
  args: {
    ref: v.string(),
    estado: estadoValidator,
    aplicarAoGrupo: v.optional(v.boolean()),
  },
  returns: v.object({ atualizados: v.number() }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const alvos = await alvosDoRef(ctx, args.ref, args.aplicarAoGrupo);
    let atualizados = 0;
    for (const alvo of alvos) {
      if (alvo.estado === args.estado) continue;
      await ctx.db.patch(alvo._id, { estado: args.estado });
      atualizados++;
    }
    return { atualizados };
  },
});

/**
 * Staff-only: edit a single product's presentation/pricing fields. Structural
 * keys (ref, marca, tipo, grupoModelo, tabelaOrigem) and app-managed fields
 * (estado, imagens) are intentionally NOT editable here. Optional text fields
 * are cleared when sent empty. `variante` stays required for grouped products.
 */
export const atualizar = mutation({
  args: {
    ref: v.string(),
    nome: v.string(),
    categoria: categoriaValidator,
    pvpCents: v.number(),
    gama: v.optional(v.string()),
    descricao: v.optional(v.string()),
    capacidadeKw: v.optional(v.number()),
    classeEnergetica: v.optional(v.string()),
    refrigerante: v.optional(v.string()),
    variante: v.optional(v.string()),
    pdfPaginas: v.optional(v.string()),
  },
  returns: v.object({ produtoId: v.id("produtos") }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const produto = await ctx.db
      .query("produtos")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .unique();
    if (!produto) {
      throw new Error(`Produto "${args.ref}" não encontrado.`);
    }

    if (args.nome.trim() === "") {
      throw new Error("O nome não pode estar vazio.");
    }
    if (!Number.isFinite(args.pvpCents) || args.pvpCents < 0) {
      throw new Error("Preço inválido.");
    }
    if (
      args.capacidadeKw !== undefined &&
      (!Number.isFinite(args.capacidadeKw) || args.capacidadeKw < 0)
    ) {
      throw new Error("Capacidade inválida.");
    }

    const limpar = (s: string | undefined) =>
      s === undefined || s.trim() === "" ? undefined : s.trim();

    // grupoModelo & variante are both-or-neither: a grouped variant must keep
    // a label. Ungrouped products keep their (undefined) variante.
    const variante =
      produto.grupoModelo !== undefined
        ? limpar(args.variante)
        : produto.variante;
    if (produto.grupoModelo !== undefined && variante === undefined) {
      throw new Error("Variantes de um grupo precisam de um rótulo.");
    }

    const pdfPaginas = limpar(args.pdfPaginas);
    if (pdfPaginas !== undefined && !PDF_PAGINAS_REGEX.test(pdfPaginas)) {
      throw new Error(
        `pdfPaginas "${pdfPaginas}" inválido; use "15" ou "54-55".`,
      );
    }

    await ctx.db.patch(produto._id, {
      nome: args.nome.trim(),
      categoria: args.categoria,
      pvpCents: Math.round(args.pvpCents),
      gama: limpar(args.gama),
      descricao: limpar(args.descricao),
      capacidadeKw: args.capacidadeKw,
      classeEnergetica: limpar(args.classeEnergetica),
      refrigerante: limpar(args.refrigerante),
      variante,
      pdfPaginas,
    });
    return { produtoId: produto._id };
  },
});

/**
 * Staff-only: delete a product. With `removerGrupo` and a grouped product,
 * deletes every variant of the family. Image files left unreferenced by any
 * remaining product are removed from storage.
 */
export const remover = mutation({
  args: {
    ref: v.string(),
    removerGrupo: v.optional(v.boolean()),
  },
  returns: v.object({
    removidos: v.number(),
    ficheirosRemovidos: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const alvos = await alvosDoRef(ctx, args.ref, args.removerGrupo);

    const candidatos = new Set<Id<"_storage">>();
    for (const alvo of alvos) {
      for (const ficheiro of alvo.imagens) candidatos.add(ficheiro);
    }

    let removidos = 0;
    for (const alvo of alvos) {
      await ctx.db.delete(alvo._id);
      removidos++;
    }

    const ficheirosRemovidos = await limparFicheirosOrfaos(ctx, candidatos);
    return { removidos, ficheirosRemovidos };
  },
});

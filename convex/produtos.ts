import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  estadoValidator,
  componenteValidator,
  segmentoValidator,
  atributoValidator,
  produtoImportFields,
  FAMILIAS,
  SISTEMAS,
} from "./schema";

export { produtoImportFields };
import { requireStaff } from "./lib/auth";
import { apagarSemReferencia } from "./imagens";
import {
  escolherCanonica,
  sincronizarGrupo,
  sincronizarGrupos,
} from "./lib/catalogoGrupos";

// Public shape of a product (one SKU). Contains PVP only — no reseller/discount
// pricing is ever stored on or returned from a produtos document.
const produtoPublicoValidator = v.object({
  _id: v.id("produtos"),
  _creationTime: v.number(),
  ref: v.string(),
  ean: v.optional(v.string()),
  marca: v.string(),
  nome: v.string(),
  nomeGrupo: v.string(),
  familia: v.string(),
  segmento: v.optional(segmentoValidator),
  sistema: v.optional(v.string()),
  tipoUnidade: v.optional(v.string()),
  componente: componenteValidator,
  gama: v.optional(v.string()),
  grupoModelo: v.string(),
  // Ordered {chave, valor} pairs: variant axes AND specs, unified. Within a
  // group, keys with ≥2 distinct values become variant-table columns; constant
  // keys render as spec chips.
  atributos: v.array(atributoValidator),
  descricao: v.optional(v.string()),
  pvpCents: v.number(),
  ivaIncluido: v.boolean(),
  tabelaOrigem: v.string(),
  pdfPaginas: v.array(v.number()),
  imagens: v.array(v.id("_storage")),
  estado: estadoValidator,
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

// Per-variant payload inside a group detail page.
const grupoVarianteValidator = v.object({
  _id: v.id("produtos"),
  ref: v.string(),
  atributos: v.array(atributoValidator),
  pvpCents: v.number(),
  // Resolved URLs of the variant's own images if it has any, otherwise the
  // canonical variant's.
  imagensUrls: v.array(v.string()),
});

const grupoValidator = v.object({
  grupoModelo: v.string(),
  // Page-level content comes from the canonical variant.
  nome: v.string(), // nomeGrupo
  marca: v.string(),
  familia: v.string(),
  gama: v.optional(v.string()),
  imagensUrls: v.array(v.string()),
  descricao: v.optional(v.string()),
  variantes: v.array(grupoVarianteValidator),
});

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
 * Resolve a product's referenced catalog pages (pdfPaginas) against its own
 * tabelaOrigem. Pages with no uploaded file yet are silently skipped (uploads
 * may lag the import) — never throws.
 */
async function fichasCatalogoDe(
  ctx: QueryCtx,
  produto: Doc<"produtos">,
): Promise<Array<{ pagina: number; url: string }>> {
  const fichas: Array<{ pagina: number; url: string }> = [];
  for (const pagina of produto.pdfPaginas) {
    const linha = await ctx.db
      .query("paginasCatalogo")
      .withIndex("by_tabela_pagina", (q) =>
        q.eq("tabelaOrigem", produto.tabelaOrigem).eq("pagina", pagina),
      )
      .unique();
    if (!linha || linha.ficheiro === undefined) continue;
    const url = await ctx.storage.getUrl(linha.ficheiro);
    if (url === null) continue;
    fichas.push({ pagina, url });
  }
  return fichas;
}

// Sort variants by price asc (proxy for capacity), tie-broken by ref.
function ordenarVariantes(
  variantes: Array<Doc<"produtos">>,
): Array<Doc<"produtos">> {
  return [...variantes].sort((a, b) => {
    if (a.pvpCents !== b.pvpCents) return a.pvpCents - b.pvpCents;
    return a.ref.localeCompare(b.ref);
  });
}

/**
 * Public product detail by manufacturer reference. Only returns the product if
 * it is published, otherwise null.
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

    // A variant without its own photos inherits the family's: fall back to any
    // variant in the group that has images.
    const resolverUrls = criarResolvedorUrls(ctx);
    let imagens = produto.imagens;
    if (imagens.length === 0) {
      const grupoModelo = produto.grupoModelo;
      const familia = await ctx.db
        .query("produtos")
        .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", grupoModelo))
        .collect();
      imagens = familia.find((p) => p.imagens.length > 0)?.imagens ?? [];
    }
    const imagensUrls = await resolverUrls(imagens);

    return {
      ...produto,
      fichasCatalogo,
      imagensUrls,
    };
  },
});

/**
 * Public group detail: all PUBLISHED variants of a family, sorted by price
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
      .withIndex("by_grupoModelo", (q) =>
        q.eq("grupoModelo", args.grupoModelo),
      )
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
      ordenarVariantes(publicadas).map(async (p) => ({
        _id: p._id,
        ref: p.ref,
        atributos: p.atributos,
        pvpCents: p.pvpCents,
        imagensUrls: await resolverUrls(
          p.imagens.length > 0 ? p.imagens : imagensFamilia,
        ),
      })),
    );

    return {
      grupoModelo: args.grupoModelo,
      nome: canonica.nomeGrupo,
      marca: canonica.marca,
      familia: canonica.familia,
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
  atributos: v.array(atributoValidator),
  estado: estadoValidator,
  pvpCents: v.number(),
  numImagens: v.number(),
});

// One family entry in the admin listing. Unlike the public catalog this
// includes every estado (rascunho/publicado/descontinuado) so staff can manage
// images before publishing.
const adminEntryValidator = v.object({
  grupoModelo: v.string(),
  // Canonical/representative ref — opens the family-level image manager.
  ref: v.string(),
  nome: v.string(), // nomeGrupo
  marca: v.string(),
  familia: v.string(),
  gama: v.optional(v.string()),
  capaUrl: v.union(v.string(), v.null()),
  numVariantes: v.number(),
  numComImagens: v.number(),
  variantes: v.array(adminVarianteValidator),
});

// Paginated admin listing: one page of family entries plus totals computed
// over the whole (filtered) dataset so the UI can render page controls and
// accurate counts.
const adminListValidator = v.object({
  entradas: v.array(adminEntryValidator),
  // Totals over the filtered set (not just the current page).
  totalFamilias: v.number(),
  totalProdutos: v.number(),
  numPaginas: v.number(),
  // Echoed back clamped to a valid range so the client can self-correct.
  pagina: v.number(),
});

// A grouped family entry before its cover URL is resolved.
type EntradaCrua = {
  entrada: Omit<Infer<typeof adminEntryValidator>, "capaUrl">;
  capaDoc: Doc<"produtos"> | null;
};

/**
 * Staff-only admin listing of every product, grouped by family. Includes all
 * estados and per-product image counts so staff can manage photos.
 *
 * Filtering (marca/familia/estado/busca) is applied server-side over the full
 * grouped dataset, so it always runs BEFORE pagination. The catalog is small
 * (hundreds of rows) so we read the whole table and group in-memory; cover URLs
 * are resolved for the current page only.
 */
export const listarAdmin = query({
  args: {
    pagina: v.number(),
    porPagina: v.number(),
    marca: v.optional(v.string()),
    familia: v.optional(v.string()),
    estado: v.optional(estadoValidator),
    busca: v.optional(v.string()),
  },
  returns: adminListValidator,
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const todos = await ctx.db.query("produtos").collect();

    const varianteDe = (p: Doc<"produtos">) => ({
      _id: p._id,
      ref: p.ref,
      atributos: p.atributos,
      estado: p.estado,
      pvpCents: p.pvpCents,
      numImagens: p.imagens.length,
    });

    // Every product belongs to a group (grupoModelo is required).
    const grupos = new Map<string, Array<Doc<"produtos">>>();
    for (const p of todos) {
      const atual = grupos.get(p.grupoModelo);
      if (atual) atual.push(p);
      else grupos.set(p.grupoModelo, [p]);
    }

    const cruas: Array<EntradaCrua> = [];
    for (const [grupoModelo, variantes] of grupos) {
      const canonica = escolherCanonica(variantes);
      // Family cover falls back to any variant with images.
      const comImagem =
        canonica.imagens.length > 0
          ? canonica
          : variantes.find((x) => x.imagens.length > 0);
      cruas.push({
        entrada: {
          grupoModelo,
          ref: canonica.ref,
          nome: canonica.nomeGrupo,
          marca: canonica.marca,
          familia: canonica.familia,
          gama: canonica.gama,
          numVariantes: variantes.length,
          numComImagens: variantes.filter((x) => x.imagens.length > 0).length,
          variantes: ordenarVariantes(variantes).map(varianteDe),
        },
        capaDoc: comImagem ?? null,
      });
    }

    // Filter over the grouped set: marca/familia match the family; estado keeps
    // a family when ANY variant matches; busca matches the family name or any
    // variant ref.
    const termo = (args.busca ?? "").trim().toLowerCase();
    const filtradas = cruas.filter(({ entrada }) => {
      if (args.marca !== undefined && entrada.marca !== args.marca) {
        return false;
      }
      if (args.familia !== undefined && entrada.familia !== args.familia) {
        return false;
      }
      if (
        args.estado !== undefined &&
        !entrada.variantes.some((x) => x.estado === args.estado)
      ) {
        return false;
      }
      if (termo) {
        const alvo =
          entrada.nome.toLowerCase() +
          " " +
          entrada.variantes
            .map((x) => x.ref)
            .join(" ")
            .toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });

    filtradas.sort((a, b) => a.entrada.nome.localeCompare(b.entrada.nome));

    const totalFamilias = filtradas.length;
    const totalProdutos = filtradas.reduce(
      (n, { entrada }) => n + entrada.numVariantes,
      0,
    );
    const porPagina = Math.max(1, Math.floor(args.porPagina));
    const numPaginas = Math.max(1, Math.ceil(totalFamilias / porPagina));
    // Clamp the requested page so an out-of-range request still returns the
    // last valid page instead of nothing.
    const pagina = Math.min(Math.max(0, Math.floor(args.pagina)), numPaginas - 1);
    const inicio = pagina * porPagina;
    const pageSlice = filtradas.slice(inicio, inicio + porPagina);

    const resolverUrls = criarResolvedorUrls(ctx);
    const capaUrlDe = async (p: Doc<"produtos">): Promise<string | null> => {
      const capa = p.imagens[0];
      if (capa === undefined) return null;
      const [url] = await resolverUrls([capa]);
      return url ?? null;
    };

    const entradas = await Promise.all(
      pageSlice.map(async ({ entrada, capaDoc }) => ({
        ...entrada,
        capaUrl: capaDoc ? await capaUrlDe(capaDoc) : null,
      })),
    );

    return { entradas, totalFamilias, totalProdutos, numPaginas, pagina };
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
    return {
      ...produto,
      fichasCatalogo: await fichasCatalogoDe(ctx, produto),
    };
  },
});

export const upsertResultValidator = v.object({
  produtoId: v.id("produtos"),
  created: v.boolean(),
  updated: v.boolean(),
  precoAlterado: v.boolean(),
});

export type ProdutoImport = Infer<
  ReturnType<typeof v.object<typeof produtoImportFields>>
>;

const FAMILIAS_SET = new Set<string>(FAMILIAS);
const SISTEMAS_SET = new Set<string>(SISTEMAS);

/**
 * Idempotent upsert of a product by manufacturer reference. Shared business
 * logic (called by the internal mutation and the bulk importer).
 * - If the product exists: patch the imported fields but preserve the current
 *   `estado` and `imagens` (those are managed in the app, not by the import).
 * - If it does not exist: insert as a draft ("rascunho") with no images.
 *
 * Validation:
 * - `familia` must be one of FAMILIAS; `sistema` (when present) one of SISTEMAS.
 * - A group must never mix brands.
 *
 * Catalog sync: the touched grupoModelo(s) are added to `gruposTocados` when
 * given (bulk callers sync once at the end), otherwise synced right away.
 */
export async function upsertProdutoPorRef(
  ctx: MutationCtx,
  args: ProdutoImport,
  gruposTocados?: Set<string>,
): Promise<Infer<typeof upsertResultValidator>> {
  if (!FAMILIAS_SET.has(args.familia)) {
    throw new Error(
      `Produto "${args.ref}": familia "${args.familia}" inválida. Use uma de: ${FAMILIAS.join(", ")}.`,
    );
  }
  if (args.sistema !== undefined && !SISTEMAS_SET.has(args.sistema)) {
    throw new Error(
      `Produto "${args.ref}": sistema "${args.sistema}" inválido. Use um de: ${SISTEMAS.join(", ")}.`,
    );
  }
  if (
    args.pdfPaginas.some((p) => !Number.isInteger(p) || p <= 0)
  ) {
    throw new Error(
      `Produto "${args.ref}": pdfPaginas deve conter apenas inteiros positivos.`,
    );
  }

  const existente = await ctx.db
    .query("produtos")
    .withIndex("by_ref", (q) => q.eq("ref", args.ref))
    .unique();

  // No cross-brand groups: any other row already in this group must share the
  // same marca.
  const grupoModelo = args.grupoModelo;
  const noGrupo = await ctx.db
    .query("produtos")
    .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", grupoModelo))
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

  // The imported fields (excludes app-managed `estado` and `imagens`).
  const campos = {
    ref: args.ref,
    ean: args.ean,
    marca: args.marca,
    nome: args.nome,
    nomeGrupo: args.nomeGrupo,
    familia: args.familia,
    segmento: args.segmento,
    sistema: args.sistema,
    tipoUnidade: args.tipoUnidade,
    componente: args.componente,
    gama: args.gama,
    grupoModelo: args.grupoModelo,
    atributos: args.atributos,
    descricao: args.descricao,
    pvpCents: args.pvpCents,
    ivaIncluido: args.ivaIncluido,
    tabelaOrigem: args.tabelaOrigem,
    pdfPaginas: args.pdfPaginas,
  };

  // A SKU may move between groups on re-import: both sides need a refresh.
  const tocados = new Set<string>([grupoModelo]);
  if (existente) tocados.add(existente.grupoModelo);

  let resultado: Infer<typeof upsertResultValidator>;
  if (existente) {
    const precoAlterado = existente.pvpCents !== args.pvpCents;
    // Preserve existing `estado` and `imagens` by not including them here.
    await ctx.db.patch(existente._id, campos);
    resultado = {
      produtoId: existente._id,
      created: false,
      updated: true,
      precoAlterado,
    };
  } else {
    const produtoId = await ctx.db.insert("produtos", {
      ...campos,
      estado: "rascunho",
      imagens: [],
    });
    resultado = { produtoId, created: true, updated: false, precoAlterado: false };
  }

  if (gruposTocados) {
    for (const g of tocados) gruposTocados.add(g);
  } else {
    await sincronizarGrupos(ctx, tocados);
  }
  return resultado;
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
    const tocados = new Set<string>();
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
        tocados.add(produto.grupoModelo);
        alterados++;
      }
    }
    await sincronizarGrupos(ctx, tocados);
    return { alterados, naoEncontrados };
  },
});

/**
 * Publish every product that has at least one image. Leaves products without
 * images untouched. Idempotent — already-published products are counted but
 * not rewritten. Run via `npx convex run produtos:publicarComImagens`.
 */
export const publicarComImagens = internalMutation({
  args: {},
  returns: v.object({
    alterados: v.number(),
    jaPublicados: v.number(),
    semImagem: v.number(),
  }),
  handler: async (ctx) => {
    const todos = await ctx.db.query("produtos").collect();
    let alterados = 0;
    let jaPublicados = 0;
    let semImagem = 0;
    const tocados = new Set<string>();
    for (const produto of todos) {
      if (produto.imagens.length === 0) {
        semImagem++;
        continue;
      }
      if (produto.estado === "publicado") {
        jaPublicados++;
        continue;
      }
      await ctx.db.patch(produto._id, { estado: "publicado" });
      tocados.add(produto.grupoModelo);
      alterados++;
    }
    await sincronizarGrupos(ctx, tocados);
    return { alterados, jaPublicados, semImagem };
  },
});

// --- Staff product management (admin app) ---

// Resolve which product docs an action targets: the whole family when
// `aplicarAoGrupo`, otherwise just the one.
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
  if (aplicarAoGrupo === true) {
    const grupoModelo = produto.grupoModelo;
    return await ctx.db
      .query("produtos")
      .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", grupoModelo))
      .collect();
  }
  return [produto];
}

/**
 * Staff-only: change a product's estado (rascunho/publicado/descontinuado).
 * With `aplicarAoGrupo` applies to every variant of the family. Idempotent —
 * variants already in the target estado are skipped.
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
    if (atualizados > 0) {
      await sincronizarGrupos(ctx, alvos.map((a) => a.grupoModelo));
    }
    return { atualizados };
  },
});

/**
 * Staff-only: edit a single product's presentation/pricing fields. Structural
 * keys (ref, marca, componente, grupoModelo, tabelaOrigem) and app-managed
 * fields (estado, imagens) are intentionally NOT editable here. Optional text
 * fields are cleared when sent empty.
 */
export const atualizar = mutation({
  args: {
    ref: v.string(),
    nome: v.string(),
    familia: v.string(),
    pvpCents: v.number(),
    gama: v.optional(v.string()),
    descricao: v.optional(v.string()),
    atributos: v.array(atributoValidator),
    pdfPaginas: v.array(v.number()),
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
    if (!FAMILIAS_SET.has(args.familia)) {
      throw new Error(`Familia "${args.familia}" inválida.`);
    }
    if (!Number.isFinite(args.pvpCents) || args.pvpCents < 0) {
      throw new Error("Preço inválido.");
    }
    if (args.pdfPaginas.some((p) => !Number.isInteger(p) || p <= 0)) {
      throw new Error("Páginas do catálogo inválidas.");
    }

    const limpar = (s: string | undefined) =>
      s === undefined || s.trim() === "" ? undefined : s.trim();

    // Drop attributes with an empty key or value; trim the rest.
    const atributos = args.atributos
      .map((a) => ({ chave: a.chave.trim(), valor: a.valor.trim() }))
      .filter((a) => a.chave !== "" && a.valor !== "");

    await ctx.db.patch(produto._id, {
      nome: args.nome.trim(),
      familia: args.familia,
      pvpCents: Math.round(args.pvpCents),
      gama: limpar(args.gama),
      descricao: limpar(args.descricao),
      atributos,
      pdfPaginas: args.pdfPaginas,
    });
    await sincronizarGrupo(ctx, produto.grupoModelo);
    return { produtoId: produto._id };
  },
});

/**
 * Staff-only: delete a product. With `removerGrupo` deletes every variant of
 * the family. Image files nothing references any more (products, candidates,
 * group decisions) are removed from storage.
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
    await sincronizarGrupos(ctx, alvos.map((a) => a.grupoModelo));

    const ficheirosRemovidos = await apagarSemReferencia(ctx, candidatos);
    return { removidos, ficheirosRemovidos };
  },
});

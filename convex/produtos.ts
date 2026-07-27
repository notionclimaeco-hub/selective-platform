import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  estadoValidator,
  componenteValidator,
  segmentoValidator,
  atributoValidator,
  FAMILIAS,
  SISTEMAS,
} from "./schema";
import { requireStaff } from "./lib/auth";

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

// One catalog entry = one product page (group of SKUs sharing grupoModelo).
// Never leaks reseller/discount pricing — only the "desde" PVP.
const catalogoEntryValidator = v.object({
  grupoModelo: v.string(),
  // Canonical variant's ref (drives the product-page link).
  ref: v.string(),
  nome: v.string(), // product-page name (nomeGrupo)
  marca: v.string(),
  familia: v.string(),
  gama: v.optional(v.string()),
  tipoUnidade: v.optional(v.string()),
  // Lowest PVP among published variants (integer cents).
  precoDesdeCents: v.number(),
  // Resolved URL of the canonical variant's cover image, or null if none.
  capaUrl: v.union(v.string(), v.null()),
  // First catalog PDF page URL — used as a visual fallback when capaUrl is null.
  capaPdfUrl: v.union(v.string(), v.null()),
  numVariantes: v.number(),
  // Cooling capacity span across the group's variants (kW), when published.
  frioKwMin: v.optional(v.number()),
  frioKwMax: v.optional(v.number()),
  // Best energy class in the group ("A+++/A++" style values are split).
  classeEnergetica: v.optional(v.string()),
});

// --- Faceted search -------------------------------------------------------

// Attribute keys whose values become facets. `classe-energetica` holds a
// "cooling/heating" pair, so the facet uses the cooling side.
const CHAVE_CLASSE = "classe-energetica";
const CHAVE_REFRIGERANTE = "refrigerante";
const CHAVE_FRIO_KW = "frio-kw";

// Dimensions the client can filter on and get counts for. Order = display
// order in the sidebar.
const DIMENSOES = [
  "marca",
  "familia",
  "tipoUnidade",
  "segmento",
  "sistema",
  "componente",
  "classeEnergetica",
  "refrigerante",
] as const;
type Dimensao = (typeof DIMENSOES)[number];

const facetaValidator = v.object({
  valor: v.string(),
  contagem: v.number(),
});

const facetasValidator = v.object({
  marca: v.array(facetaValidator),
  familia: v.array(facetaValidator),
  tipoUnidade: v.array(facetaValidator),
  segmento: v.array(facetaValidator),
  sistema: v.array(facetaValidator),
  componente: v.array(facetaValidator),
  classeEnergetica: v.array(facetaValidator),
  refrigerante: v.array(facetaValidator),
});

// Bounds of the numeric filters over the whole published catalog, so range
// inputs can render sensible min/max even while a filter is active.
const limitesValidator = v.object({
  precoMinCents: v.number(),
  precoMaxCents: v.number(),
  frioKwMin: v.number(),
  frioKwMax: v.number(),
});

/** "A+++/A++" → "A+++"; "-/A+" → "A+". Empty when neither side is a class. */
function classePrincipal(valor: string): string | undefined {
  for (const lado of valor.split("/")) {
    const limpo = lado.trim();
    if (/^[A-G]\+*$/.test(limpo)) return limpo;
  }
  return undefined;
}

/** Attribute lookup on a SKU; attributes are an ordered {chave,valor} list. */
function atributo(p: Doc<"produtos">, chave: string): string | undefined {
  return p.atributos.find((a) => a.chave === chave)?.valor;
}

function numeroAtributo(
  p: Doc<"produtos">,
  chave: string,
): number | undefined {
  const bruto = atributo(p, chave);
  if (bruto === undefined) return undefined;
  // The importer normalises decimals to dots, but tolerate commas.
  const n = Number.parseFloat(bruto.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** Energy classes sort best-first (A+++ before A++ before B). */
function ordemClasse(c: string): number {
  const letra = c.charCodeAt(0) - 65; // A = 0
  return letra * 10 - (c.length - 1);
}

// Accessories and spare parts outnumber the actual equipment in every brand's
// price table, so they sink to the bottom of the default ordering — someone
// browsing the catalog wants to see units first, not condensate pumps.
const FAMILIAS_SECUNDARIAS = new Set(["acessorios-e-controlo", "outros"]);

/**
 * How well a group matches the typed term, lower = better. Products whose
 * *name* starts with the term beat products that merely contain it somewhere,
 * and an exact reference match beats everything.
 */
function grauCorrespondencia(e: EntradaCatalogoCrua, termo: string): number {
  if (e.refsLower.split(" ").includes(termo)) return 0;
  const nome = e.nomeLower;
  if (nome.startsWith(termo)) return 1;
  if (nome.includes(` ${termo}`)) return 2;
  if (nome.includes(termo)) return 3;
  return 4; // matched through refs, gama or grupoModelo
}

/**
 * Tie-breaker for the default ordering, lower = better. A group with a photo
 * and published capacity/energy data is a real unit someone can shop for; the
 * spec-less rows are almost always valve kits and spare parts, which belong
 * further down even when the price table files them under a main family.
 */
function pesoApresentacao(e: EntradaCatalogoCrua): number {
  const temEspecificacoes =
    e.entrada.frioKwMin !== undefined ||
    e.entrada.classeEnergetica !== undefined;
  return (
    (e.temFoto ? 0 : 4) +
    (temEspecificacoes ? 0 : 2) +
    (FAMILIAS_SECUNDARIAS.has(e.entrada.familia) ? 1 : 0)
  );
}

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
 * Canonical variant of a family = the cheapest one (price correlates with
 * capacity, so this is the "entry" model), tie-broken by ref for stability.
 */
function escolherCanonica(variantes: Array<Doc<"produtos">>): Doc<"produtos"> {
  return variantes.reduce((melhor, atual) => {
    if (atual.pvpCents < melhor.pvpCents) return atual;
    if (atual.pvpCents === melhor.pvpCents && atual.ref < melhor.ref) {
      return atual;
    }
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
    const primeira = p.pdfPaginas[0];
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
  for (const pagina of produto.pdfPaginas) {
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

// Sort variants by price asc (proxy for capacity), tie-broken by ref.
function ordenarVariantes(
  variantes: Array<Doc<"produtos">>,
): Array<Doc<"produtos">> {
  return [...variantes].sort((a, b) => {
    if (a.pvpCents !== b.pvpCents) return a.pvpCents - b.pvpCents;
    return a.ref.localeCompare(b.ref);
  });
}

// Grouped catalog entry before cover URLs are resolved. Keeping the source
// docs lets us resolve storage/PDF URLs for the current page only.
type EntradaCatalogoCrua = {
  entrada: Omit<
    Infer<typeof catalogoEntryValidator>,
    "capaUrl" | "capaPdfUrl"
  >;
  capaDoc: Doc<"produtos"> | null;
  // Lowercased blob for in-memory busca (includes all variant refs).
  searchText: string;
  // Lowercased name and refs, kept apart from the blob for relevance scoring.
  nomeLower: string;
  refsLower: string;
  // Facet values of the group = union over its variants.
  valores: Record<Dimensao, Set<string>>;
  temFoto: boolean;
  criadoEm: number;
};

const catalogoListValidator = v.object({
  entradas: v.array(catalogoEntryValidator),
  totalFamilias: v.number(),
  numPaginas: v.number(),
  // Echoed back clamped so the client can self-correct after filters shrink.
  pagina: v.number(),
  // Counts per dimension, each computed with its own filter lifted so the user
  // can widen a multi-select without options disappearing.
  facetas: facetasValidator,
  limites: limitesValidator,
});

/**
 * Group one page's worth of published SKUs into catalog entries, precomputing
 * everything the listing needs: facet values, search blob, capacity span and
 * the doc that provides the cover.
 */
function agruparCatalogo(
  produtos: Array<Doc<"produtos">>,
): Array<EntradaCatalogoCrua> {
  const grupos = new Map<string, Array<Doc<"produtos">>>();
  for (const p of produtos) {
    const atual = grupos.get(p.grupoModelo);
    if (atual) atual.push(p);
    else grupos.set(p.grupoModelo, [p]);
  }

  const cruas: Array<EntradaCatalogoCrua> = [];
  for (const [grupoModelo, variantes] of grupos) {
    const canonica = escolherCanonica(variantes);
    const precoDesdeCents = Math.min(...variantes.map((x) => x.pvpCents));
    // Prefer a variant with a photo; otherwise any with a catalog PDF page.
    const comImagem =
      canonica.imagens.length > 0
        ? canonica
        : variantes.find((x) => x.imagens.length > 0);
    const capaDoc =
      comImagem ??
      (canonica.pdfPaginas.length > 0
        ? canonica
        : (variantes.find((x) => x.pdfPaginas.length > 0) ?? null));

    const valores: Record<Dimensao, Set<string>> = {
      marca: new Set(),
      familia: new Set(),
      tipoUnidade: new Set(),
      segmento: new Set(),
      sistema: new Set(),
      componente: new Set(),
      classeEnergetica: new Set(),
      refrigerante: new Set(),
    };
    const kws: Array<number> = [];
    for (const x of variantes) {
      valores.marca.add(x.marca);
      valores.familia.add(x.familia);
      valores.componente.add(x.componente);
      if (x.tipoUnidade) valores.tipoUnidade.add(x.tipoUnidade);
      if (x.segmento) valores.segmento.add(x.segmento);
      if (x.sistema) valores.sistema.add(x.sistema);
      const classe = atributo(x, CHAVE_CLASSE);
      const principal = classe ? classePrincipal(classe) : undefined;
      if (principal) valores.classeEnergetica.add(principal);
      const refrigerante = atributo(x, CHAVE_REFRIGERANTE);
      if (refrigerante) valores.refrigerante.add(refrigerante.toUpperCase());
      const kw = numeroAtributo(x, CHAVE_FRIO_KW);
      if (kw !== undefined) kws.push(kw);
    }

    const classes = [...valores.classeEnergetica].sort(
      (a, b) => ordemClasse(a) - ordemClasse(b),
    );
    const refs = variantes.map((x) => x.ref).join(" ");
    cruas.push({
      entrada: {
        grupoModelo,
        ref: canonica.ref,
        nome: canonica.nomeGrupo,
        marca: canonica.marca,
        familia: canonica.familia,
        gama: canonica.gama,
        tipoUnidade: canonica.tipoUnidade,
        precoDesdeCents,
        numVariantes: variantes.length,
        frioKwMin: kws.length > 0 ? Math.min(...kws) : undefined,
        frioKwMax: kws.length > 0 ? Math.max(...kws) : undefined,
        classeEnergetica: classes[0],
      },
      capaDoc,
      searchText:
        `${canonica.nomeGrupo} ${refs} ${canonica.gama ?? ""} ${grupoModelo}`.toLowerCase(),
      nomeLower: canonica.nomeGrupo.toLowerCase(),
      refsLower: refs.toLowerCase(),
      valores,
      temFoto: variantes.some((x) => x.imagens.length > 0),
      criadoEm: Math.max(...variantes.map((x) => x._creationTime)),
    });
  }
  return cruas;
}

/** Facet counts for one dimension over an already-filtered set. */
function contar(
  entradas: Array<EntradaCatalogoCrua>,
  dimensao: Dimensao,
): Array<Infer<typeof facetaValidator>> {
  const contagens = new Map<string, number>();
  for (const e of entradas) {
    for (const valor of e.valores[dimensao]) {
      contagens.set(valor, (contagens.get(valor) ?? 0) + 1);
    }
  }
  const lista = [...contagens].map(([valor, contagem]) => ({
    valor,
    contagem,
  }));
  if (dimensao === "classeEnergetica") {
    lista.sort((a, b) => ordemClasse(a.valor) - ordemClasse(b.valor));
  } else {
    lista.sort(
      (a, b) => b.contagem - a.contagem || a.valor.localeCompare(b.valor),
    );
  }
  return lista;
}

/**
 * Public catalog listing. Returns only published products and PVP pricing,
 * grouped: one entry per `grupoModelo`. Never returns reseller/discount data.
 *
 * Faceted search: every filter is a multi-select (OR within a dimension, AND
 * across dimensions) and the response carries per-dimension counts computed
 * with that dimension's own filter lifted — otherwise checking one brand would
 * hide the other brands and the user could never widen the selection.
 *
 * Filters run over the full grouped set BEFORE pagination. Cover image/PDF URLs
 * are resolved for the current page only so listing stays cheap as the catalog
 * grows. The catalog is still small (thousands of SKUs), so we read the
 * published rows via the catalog index and group in-memory.
 */
export const listarCatalogo = query({
  args: {
    marcas: v.optional(v.array(v.string())),
    familias: v.optional(v.array(v.string())),
    tiposUnidade: v.optional(v.array(v.string())),
    segmentos: v.optional(v.array(v.string())),
    sistemas: v.optional(v.array(v.string())),
    componentes: v.optional(v.array(v.string())),
    classesEnergeticas: v.optional(v.array(v.string())),
    refrigerantes: v.optional(v.array(v.string())),
    busca: v.optional(v.string()),
    precoMinCents: v.optional(v.number()),
    precoMaxCents: v.optional(v.number()),
    frioKwMin: v.optional(v.number()),
    frioKwMax: v.optional(v.number()),
    apenasComFoto: v.optional(v.boolean()),
    ordenar: v.optional(
      v.union(
        v.literal("relevancia"),
        v.literal("preco-asc"),
        v.literal("preco-desc"),
        v.literal("nome"),
        v.literal("recentes"),
      ),
    ),
    pagina: v.optional(v.number()),
    porPagina: v.optional(v.number()),
  },
  returns: catalogoListValidator,
  handler: async (ctx, args) => {
    // A single index read: with facet counts we need the whole published set
    // anyway, since counts describe what the *other* filters allow.
    const produtos = await ctx.db
      .query("produtos")
      .withIndex("by_catalogo", (q) => q.eq("estado", "publicado"))
      .collect();

    const cruas = agruparCatalogo(produtos);

    const selecao: Record<Dimensao, Array<string>> = {
      marca: args.marcas ?? [],
      familia: args.familias ?? [],
      tipoUnidade: args.tiposUnidade ?? [],
      segmento: args.segmentos ?? [],
      sistema: args.sistemas ?? [],
      componente: args.componentes ?? [],
      classeEnergetica: args.classesEnergeticas ?? [],
      refrigerante: args.refrigerantes ?? [],
    };

    const termo = (args.busca ?? "").trim().toLowerCase();
    // Every word must appear somewhere in the blob, in any order — "daikin
    // mural" and "mural daikin" find the same products.
    const palavras = termo === "" ? [] : termo.split(/\s+/);

    const passaDimensao = (e: EntradaCatalogoCrua, d: Dimensao): boolean => {
      const escolhidos = selecao[d];
      if (escolhidos.length === 0) return true;
      return escolhidos.some((valor) => e.valores[d].has(valor));
    };

    // Numeric/boolean/text filters apply to every dimension's counts alike.
    const passaBase = (e: EntradaCatalogoCrua): boolean => {
      if (!palavras.every((p) => e.searchText.includes(p))) return false;
      if (args.apenasComFoto === true && !e.temFoto) return false;
      if (
        args.precoMinCents !== undefined &&
        e.entrada.precoDesdeCents < args.precoMinCents
      ) {
        return false;
      }
      if (
        args.precoMaxCents !== undefined &&
        e.entrada.precoDesdeCents > args.precoMaxCents
      ) {
        return false;
      }
      // Capacity: the group matches when any of its variants falls in range.
      if (args.frioKwMin !== undefined || args.frioKwMax !== undefined) {
        const { frioKwMin, frioKwMax } = e.entrada;
        if (frioKwMin === undefined || frioKwMax === undefined) return false;
        if (args.frioKwMax !== undefined && frioKwMin > args.frioKwMax) {
          return false;
        }
        if (args.frioKwMin !== undefined && frioKwMax < args.frioKwMin) {
          return false;
        }
      }
      return true;
    };

    const base = cruas.filter(passaBase);
    const filtradas = base.filter((e) =>
      DIMENSOES.every((d) => passaDimensao(e, d)),
    );

    // Counts per dimension with its own filter lifted (the standard faceted
    // behaviour: "Daikin (120)" stays visible next to a checked Midea).
    const facetas = Object.fromEntries(
      DIMENSOES.map((d) => [
        d,
        contar(
          base.filter((e) =>
            DIMENSOES.every((outra) => outra === d || passaDimensao(e, outra)),
          ),
          d,
        ),
      ]),
    ) as Infer<typeof facetasValidator>;

    // Bounds come from the whole catalog so the range inputs never move under
    // the user while they drag them.
    const precos = cruas.map((e) => e.entrada.precoDesdeCents);
    const kwsMin = cruas
      .map((e) => e.entrada.frioKwMin)
      .filter((n): n is number => n !== undefined);
    const kwsMax = cruas
      .map((e) => e.entrada.frioKwMax)
      .filter((n): n is number => n !== undefined);
    const limites = {
      precoMinCents: precos.length > 0 ? Math.min(...precos) : 0,
      precoMaxCents: precos.length > 0 ? Math.max(...precos) : 0,
      frioKwMin: kwsMin.length > 0 ? Math.floor(Math.min(...kwsMin)) : 0,
      frioKwMax: kwsMax.length > 0 ? Math.ceil(Math.max(...kwsMax)) : 0,
    };

    const ordenar = args.ordenar ?? "relevancia";
    filtradas.sort((a, b) => {
      switch (ordenar) {
        case "preco-asc":
          return a.entrada.precoDesdeCents - b.entrada.precoDesdeCents;
        case "preco-desc":
          return b.entrada.precoDesdeCents - a.entrada.precoDesdeCents;
        case "nome":
          return a.entrada.nome.localeCompare(b.entrada.nome, "pt");
        case "recentes":
          return b.criadoEm - a.criadoEm;
        default: {
          // Relevance: how well the name matches what was typed, then how
          // presentable the group is, then alphabetical.
          if (termo !== "") {
            const grau =
              grauCorrespondencia(a, termo) - grauCorrespondencia(b, termo);
            if (grau !== 0) return grau;
          }
          const peso = pesoApresentacao(a) - pesoApresentacao(b);
          if (peso !== 0) return peso;
          return a.entrada.nome.localeCompare(b.entrada.nome, "pt");
        }
      }
    });

    const totalFamilias = filtradas.length;
    const porPagina = Math.max(
      1,
      Math.min(48, Math.floor(args.porPagina ?? 24)),
    );
    const numPaginas = Math.max(1, Math.ceil(totalFamilias / porPagina));
    const pagina = Math.min(
      Math.max(0, Math.floor(args.pagina ?? 0)),
      numPaginas - 1,
    );
    const pageSlice = filtradas.slice(
      pagina * porPagina,
      pagina * porPagina + porPagina,
    );

    const resolverUrls = criarResolvedorUrls(ctx);
    const pdfCapaDe = criarResolvedorPdfCapa(ctx, resolverUrls);
    const capaUrlDe = async (p: Doc<"produtos">): Promise<string | null> => {
      const capa = p.imagens[0];
      if (capa === undefined) return null;
      const [url] = await resolverUrls([capa]);
      return url ?? null;
    };
    const capasDe = async (p: Doc<"produtos">) => {
      const capaUrl = await capaUrlDe(p);
      const capaPdfUrl = capaUrl === null ? await pdfCapaDe(p) : null;
      return { capaUrl, capaPdfUrl };
    };

    const entradas = await Promise.all(
      pageSlice.map(async ({ entrada, capaDoc }) => {
        const capas = capaDoc
          ? await capasDe(capaDoc)
          : { capaUrl: null, capaPdfUrl: null };
        return { ...entrada, ...capas };
      }),
    );

    return { entradas, totalFamilias, numPaginas, pagina, facetas, limites };
  },
});

const sugestaoValidator = v.object({
  ref: v.string(),
  grupoModelo: v.string(),
  nome: v.string(), // nomeGrupo
  marca: v.string(),
  familia: v.string(),
  precoDesdeCents: v.number(),
});

/**
 * Typeahead for the catalog search box: a handful of published product pages
 * matching what has been typed so far, so the user can jump straight to a
 * product instead of scanning the grid.
 *
 * Uses the `search_nome` search index (cheap per keystroke) plus an exact
 * reference lookup, since installers usually paste a manufacturer reference.
 * `estado` is not a filter field on the index, so drafts are dropped after the
 * read — that is why we take more rows than we return.
 */
export const sugerirCatalogo = query({
  args: { termo: v.string(), limite: v.optional(v.number()) },
  returns: v.array(sugestaoValidator),
  handler: async (ctx, args) => {
    const termo = args.termo.trim();
    if (termo.length < 2) return [];
    const limite = Math.min(10, Math.max(1, Math.floor(args.limite ?? 6)));

    const porNome = await ctx.db
      .query("produtos")
      .withSearchIndex("search_nome", (q) => q.search("nome", termo))
      .take(60);

    const porRef = await ctx.db
      .query("produtos")
      .withIndex("by_ref", (q) => q.eq("ref", termo.toUpperCase()))
      .unique();

    const candidatos = [...(porRef ? [porRef] : []), ...porNome].filter(
      (p) => p.estado === "publicado",
    );

    // One suggestion per product page, keeping the search index's ranking.
    const vistos = new Set<string>();
    const sugestoes: Array<Infer<typeof sugestaoValidator>> = [];
    for (const p of candidatos) {
      if (vistos.has(p.grupoModelo)) continue;
      vistos.add(p.grupoModelo);
      sugestoes.push({
        ref: p.ref,
        grupoModelo: p.grupoModelo,
        nome: p.nomeGrupo,
        marca: p.marca,
        familia: p.familia,
        precoDesdeCents: p.pvpCents,
      });
      if (sugestoes.length >= limite) break;
    }
    return sugestoes;
  },
});

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

// Shared field validators for an imported product row (v3 CSV). Reused by the
// internal upsert mutation and the (secret-guarded) bulk importer so both
// accept exactly the same shape. `imagens`/`estado` are app-managed and never
// imported.
export const produtoImportFields = {
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
  atributos: v.array(atributoValidator),
  descricao: v.optional(v.string()),
  pvpCents: v.number(),
  ivaIncluido: v.boolean(),
  tabelaOrigem: v.string(),
  pdfPaginas: v.array(v.number()),
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
 */
export async function upsertProdutoPorRef(
  ctx: MutationCtx,
  args: ProdutoImport,
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
      alterados++;
    }
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
    return { produtoId: produto._id };
  },
});

/**
 * Staff-only: delete a product. With `removerGrupo` deletes every variant of
 * the family. Image files left unreferenced by any remaining product are
 * removed from storage.
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

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// --- Reusable literal validators (shared between the schema and function files) ---

// A product's role within a system. Enforced by the schema.
export const componenteValidator = v.union(
  v.literal("conjunto"),
  v.literal("unidade-interior"),
  v.literal("unidade-exterior"),
  v.literal("deposito"),
  v.literal("acessorio"),
  v.literal("comando"),
);

// Target market. Enforced by the schema.
export const segmentoValidator = v.union(
  v.literal("domestico"),
  v.literal("comercial"),
  v.literal("industrial"),
);

// App-managed publication state (never comes from the import CSV).
export const estadoValidator = v.union(
  v.literal("rascunho"),
  v.literal("publicado"),
  v.literal("descontinuado"),
);

// Installer-company approval. Only `aprovada` grants reseller prices.
export const estadoAprovacaoValidator = v.union(
  v.literal("pendente"),
  v.literal("aprovada"),
  v.literal("rejeitada"),
  v.literal("suspensa"),
);

// Installer-order header states (#5). `cancelada` and `concluida` are terminal.
export const estadoEncomendaValidator = v.union(
  v.literal("recebida"),
  v.literal("aguardando_stock"),
  v.literal("aguardando_pagamento"),
  v.literal("paga"),
  v.literal("cancelada"),
  v.literal("concluida"),
);

// Why a header reached `cancelada`.
export const motivoCancelamentoValidator = v.union(
  v.literal("installer"),
  v.literal("office"),
  v.literal("payment_expired"),
  v.literal("all_lines_dropped"),
);

// Installer-order line state before pay. After `paga`, progress lives in the
// qty buckets on the line — there is no post-pay status enum (#5).
export const notionBaseValidator = v.union(
  v.literal("encomendas"),
  v.literal("linhas"),
  v.literal("excecoes"),
  v.literal("modelos"),
);

export const estadoLinhaValidator = v.union(
  v.literal("por_confirmar"),
  v.literal("confirmada"),
  v.literal("retirada"),
);

// Company address as a single string (street, postal code, locality).
export const moradaValidator = v.string();

// One ordered product attribute, e.g. { chave: "capacidade", valor: "3.5" }.
// A product's specs AND its variant axes both live here — the UI decides how
// to render each key: within a grupoModelo, keys whose values differ across
// variants become columns of the variant table; constant keys render as spec
// chips. Order = display order (axes first, specs after).
export const atributoValidator = v.object({
  chave: v.string(),
  valor: v.string(),
});

// One hero spec of a product page, summarised over its published variants:
// `numero` keys as a min–max span, `enum`/`texto` keys as their distinct
// values. Also the shape of the hero-spec facets `catalogo.listar` returns.
export const destaqueValidator = v.union(
  v.object({
    chave: v.string(),
    tipo: v.literal("intervalo"),
    min: v.number(),
    max: v.number(),
  }),
  v.object({
    chave: v.string(),
    tipo: v.literal("valores"),
    valores: v.array(v.string()),
  }),
);

// Import-time vocabularies. `familia`/`sistema` are stored as free strings (per
// spec) but validated against these lists on import so bad rows are rejected
// with a clear error. Keep these in sync with the frontend label maps.
export const FAMILIAS = [
  "ar-condicionado",
  "bombas-de-calor",
  "aqs",
  "ventilacao",
  "chillers",
  "ventiloconvectores",
  "cortinas-de-ar",
  "purificadores-de-ar",
  "acessorios-e-controlo",
  "outros",
] as const;

export const SISTEMAS = [
  "mono-split",
  "multi-split",
  "vrf",
  "rooftop",
  "monobloco",
  "bibloco",
] as const;

// Import-run lifecycle (#40). `a-promover` is the window while promotion runs
// in scheduled batches.
export const estadoImportacaoValidator = v.union(
  v.literal("a-extrair"),
  v.literal("em-revisao"),
  v.literal("a-promover"),
  v.literal("aprovada"),
  v.literal("rejeitada"),
);

// Staged SKU against the live catalog: no live ref / live price differs /
// same price. Other field changes are visible when a group is opened.
export const diffValidator = v.union(
  v.literal("novo"),
  v.literal("alterado"),
  v.literal("igual"),
);

// Where a candidate photo came from (#images-in-review spec).
export const fonteCandidataValidator = v.union(
  v.literal("site"),
  v.literal("megaclima"),
  v.literal("web"),
  v.literal("pdf"),
  v.literal("upload"),
  v.literal("recorte"),
);

// Per-variant override inside a group's image decision.
export const porRefValidator = v.array(
  v.object({ ref: v.string(), imagens: v.array(v.id("_storage")) }),
);

// Shared field validators for an imported product row (v4 JSON / v3 CSV).
// Reused by the internal upsert, the bulk importer and the staged-SKU table
// so all accept exactly the same shape. `imagens`/`estado` are app-managed
// and never imported.
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

// One staged SKU as the extractor sends it (`lib/stagedSku.ts` JSON contract).
export const stagedSkuFields = {
  ...produtoImportFields,
  compativelCom: v.optional(v.array(v.string())),
  avisos: v.array(v.string()),
};

export default defineSchema({
  // One row = one purchasable SKU. Product pages on the frontend are groups of
  // SKUs sharing `grupoModelo`, rendered as a variant table (one row per SKU,
  // one column per attribute key that varies within the group).
  produtos: defineTable({
    // --- identity ---
    ref: v.string(), // manufacturer reference, unique
    ean: v.optional(v.string()),
    marca: v.string(), // slug: "hisense", "mitsubishi", ...

    // --- naming ---
    nome: v.string(), // variant name, e.g. "Mural Air Master 3.5 kW"
    nomeGrupo: v.string(), // product-page name, no capacity/color

    // --- taxonomy (orthogonal dimensions) ---
    familia: v.string(), // validated against FAMILIAS on import
    segmento: v.optional(segmentoValidator),
    sistema: v.optional(v.string()), // validated against SISTEMAS on import
    tipoUnidade: v.optional(v.string()), // "mural", "cassete-4-vias", ...
    componente: componenteValidator,
    gama: v.optional(v.string()), // series, e.g. "Air Master"

    // --- variant model / specs (unified) ---
    grupoModelo: v.string(), // group slug, e.g. "hisense-air-master"
    // Ordered {chave, valor} pairs holding BOTH variant axes and specs.
    // Within a group, keys whose values differ across variants become columns
    // of the variant table on the product page; constant keys render as spec
    // chips. Order = display order (axes first, specs after).
    atributos: v.array(atributoValidator),

    descricao: v.optional(v.string()),

    // --- commerce ---
    pvpCents: v.number(), // integer cents, VAT-exclusive
    ivaIncluido: v.boolean(), // false for all brand price tables

    // --- provenance / assets ---
    tabelaOrigem: v.string(), // "hisense-2026", "mitsubishi-2026", ...
    // Pages in the brand PDF; the actual files live in `paginasCatalogo`,
    // keyed by (tabelaOrigem, pagina).
    pdfPaginas: v.array(v.number()),

    // --- app-managed (NOT from the CSV) ---
    // Ordered image list; first item is the cover. Managed via the image
    // pipeline / admin, preserved across re-imports.
    imagens: v.array(v.id("_storage")),
    // Publication state; new imports insert as "rascunho".
    estado: estadoValidator,
  })
    // Import upserts + detail lookups by manufacturer reference.
    .index("by_ref", ["ref"])
    // Variant grouping: fetch all SKUs of a product page.
    .index("by_grupoModelo", ["grupoModelo"])
    // Brand (+ familia) browse.
    .index("by_marca", ["marca", "familia"])
    // Familia (+ segmento) browse.
    .index("by_familia_segmento", ["familia", "segmento"])
    // Re-import replaces a brand's rows: find + delete stale rows.
    .index("by_tabela", ["tabelaOrigem"])
    // Public catalog listing/filtering (published only).
    .index("by_catalogo", ["estado", "marca", "familia"])
    // Familia-only public catalog filter (avoids post-filtering by_catalogo).
    .index("by_catalogo_familia", ["estado", "familia"])
    // Free-text search over the variant name, scoped by marca/familia.
    .searchIndex("search_nome", {
      searchField: "nome",
      filterFields: ["marca", "familia"],
    }),

  // Denormalised catalog listing: one row per product page (grupoModelo) with
  // at least one published SKU. Everything the public /produtos grid needs is
  // precomputed here so listing reads ~1 small doc per group instead of every
  // SKU (with its attributes) on every request. Kept in sync by
  // `lib/catalogoGrupos.sincronizarGrupo`, which every produtos write calls;
  // `catalogo:reconstruir` rebuilds the whole table from scratch.
  catalogoGrupos: defineTable({
    grupoModelo: v.string(),
    // Canonical (cheapest) published variant — drives the product-page link.
    ref: v.string(),
    nome: v.string(), // nomeGrupo
    marca: v.string(),
    familia: v.string(),
    gama: v.optional(v.string()),
    tipoUnidade: v.optional(v.string()),
    // Lowest / highest PVP among published variants (integer cents).
    precoDesdeCents: v.number(),
    precoAteCents: v.number(),
    numVariantes: v.number(),
    // Deprecated by `destaques`: kept until the shop reads the hero specs
    // (#69), then dropped.
    frioKwMin: v.optional(v.number()),
    frioKwMax: v.optional(v.number()),
    classeEnergetica: v.optional(v.string()),
    // Hero specs of the group's familia, in registry order; keys no variant
    // carries are absent. Optional only until `catalogo:reconstruir` has
    // backfilled every row — narrow to required with #69.
    destaques: v.optional(v.array(destaqueValidator)),
    // Cover image (first image of the canonical variant, else any variant's).
    capa: v.union(v.id("_storage"), v.null()),
    // Lower-cased "name refs gama grupoModelo" blob for substring search.
    textoBusca: v.string(),
    // Presentation weight for the default order, lower = better (has photo,
    // has specs, is a main family).
    peso: v.number(),
    // Newest variant creation time — the "Novidades" ordering.
    criadoEm: v.number(),
  })
    .index("by_grupoModelo", ["grupoModelo"])
    .index("by_familia", ["familia"])
    .index("by_marca", ["marca"]),

  // One-page catalog PDFs and 110 dpi PNG renders, stored once per
  // (tabelaOrigem, pagina) and shared across every product that references
  // that page. Either file may arrive first, so both are optional.
  // Uniqueness on (tabelaOrigem, pagina) is enforced in the mutation.
  paginasCatalogo: defineTable({
    tabelaOrigem: v.string(),
    pagina: v.number(),
    ficheiro: v.optional(v.id("_storage")),
    imagem: v.optional(v.id("_storage")),
  }).index("by_tabela_pagina", ["tabelaOrigem", "pagina"]),

  // One import run = one pass of a brand price table through extraction,
  // staging and review (#40). Counts are computed by `concluirCarregamento`;
  // the promotion counters by `promoverLote`.
  importacoes: defineTable({
    marca: v.string(),
    ano: v.number(),
    tabelaOrigem: v.string(), // "{marca}-{ano}", matches produtos.tabelaOrigem
    ficheiro: v.string(), // price-table PDF file name
    pdf: v.optional(v.id("_storage")),
    estado: estadoImportacaoValidator,
    numSkus: v.number(),
    numGrupos: v.number(),
    numNovos: v.number(),
    numAlterados: v.number(),
    numIguais: v.number(),
    numComAvisos: v.number(),
    numPromovidos: v.optional(v.number()),
    numReativados: v.optional(v.number()),
    numDescontinuados: v.optional(v.number()),
    numImagensAplicadas: v.optional(v.number()),
    numCandidatasRemovidas: v.optional(v.number()),
    criadoEm: v.number(),
    decididoEm: v.optional(v.number()),
    decididoPor: v.optional(v.string()),
    motivoRejeicao: v.optional(v.string()),
  })
    .index("by_tabelaOrigem", ["tabelaOrigem"])
    .index("by_estado", ["estado"]),

  // Staged SKUs of an import run. Never promoted directly: approval copies
  // them into `produtos` through the existing upsert path.
  skusEmRevisao: defineTable({
    importacaoId: v.id("importacoes"),
    ...stagedSkuFields,
    diff: diffValidator,
    // Live pvpCents whenever the ref already exists in `produtos`.
    precoAnteriorCents: v.optional(v.number()),
    // Same value on every row of a group; set by `marcarGrupoRevisto`.
    grupoRevisto: v.boolean(),
    // Set by `promoverLote`; lets promotion resume after a failed batch.
    promovido: v.boolean(),
  })
    .index("by_importacao", ["importacaoId"])
    // Duplicate-ref check at load, one indexed read per SKU.
    .index("by_importacao_ref", ["importacaoId", "ref"])
    .index("by_importacao_grupo", ["importacaoId", "grupoModelo"])
    .index("by_importacao_promovido", ["importacaoId", "promovido"]),

  // Candidate photos gathered for a product page (brand-wide, keyed by the
  // deterministic grupoModelo). Filled by scripts/imagens/candidatas.mjs and
  // by uploads/cutouts from the review page. Unchosen rows are deleted when
  // the brand's run is approved.
  imagensCandidatas: defineTable({
    marca: v.string(),
    grupoModelo: v.string(),
    ficheiro: v.id("_storage"),
    fonte: fonteCandidataValidator,
    origemUrl: v.optional(v.string()), // page URL, or "pdf:<pagina>"
    hash: v.string(), // sha256 of the stored bytes; dedupe key within a grupoModelo
    largura: v.number(),
    altura: v.number(),
    cor: v.optional(v.string()), // registry colour value when known
    origem: v.optional(v.id("imagensCandidatas")), // recorte: source candidate
    // Why the agent doubts this photo (generic outdoor unit, sister series,
    // PDF thumbnail, dealer watermark…); shown on the thumbnail and rolled up
    // into the group's "Fotos a rever" flag.
    aviso: v.optional(v.string()),
    criadoEm: v.number(),
  })
    .index("by_grupo", ["grupoModelo"])
    .index("by_hash", ["hash"])
    .index("by_grupo_hash", ["grupoModelo", "hash"])
    .index("by_marca", ["marca"]),

  // The ordered image decision for a product page; applied to every SKU of
  // the group on approval (porRef wins for its ref).
  imagensGrupo: defineTable({
    grupoModelo: v.string(),
    marca: v.string(),
    imagens: v.array(v.id("_storage")),
    porRef: v.optional(porRefValidator),
    atualizadoEm: v.number(),
    atualizadoPor: v.string(),
  })
    .index("by_grupo", ["grupoModelo"])
    .index("by_marca", ["marca"]),

  marcas: defineTable({
    slug: v.string(),
    nome: v.string(),
    // Flat discount % our company gets on this brand's whole price table.
    // Never feeds reseller prices — those live in `tierDescontos`.
    descontoPercent: v.number(),
    ativa: v.boolean(),
  }).index("by_slug", ["slug"]),

  // Ordered commercial levels. Count is data, not schema — seed three
  // (base / prata / ouro); staff can add more. Base has limiarCents = 0.
  tiers: defineTable({
    slug: v.string(), // "base", "prata", "ouro", …
    nome: v.string(),
    // Lifetime paid volume (VAT-excl cents) at which this tier becomes
    // volume-derived. Promotion never demotes; a pin overrides.
    limiarCents: v.number(),
    // Display / evaluation order, ascending (base first).
    ordem: v.number(),
    ativa: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_ordem", ["ordem"]),

  // Reseller discount cell: one (marca slug × tier) pair. Missing cell → 0%.
  // Separate from `marcas.descontoPercent` (supplier discount to Climaeco).
  // Uniqueness of (marca, tierId) is enforced in the mutation, not by the schema.
  tierDescontos: defineTable({
    marca: v.string(), // marcas.slug
    tierId: v.id("tiers"),
    descontoPercent: v.number(),
  })
    .index("by_marca_and_tier", ["marca", "tierId"])
    .index("by_tier", ["tierId"]),

  // One installer company per Clerk Organization. Membership stays in Clerk;
  // this record owns approval, tier, and the legal profile.
  // Uniqueness of clerkOrgId and nif is enforced in the mutation, not by the schema.
  installerCompanies: defineTable({
    clerkOrgId: v.string(),
    nomeLegal: v.string(),
    nif: v.string(),
    morada: moradaValidator,
    email: v.string(),
    telefone: v.string(),
    certifNumero: v.optional(v.string()),
    // Staff-only notes; never returned on installer-facing queries.
    notas: v.optional(v.string()),
    estadoAprovacao: estadoAprovacaoValidator,
    // Set on first approval (base tier). Unset while pendente/rejeitada.
    tierId: v.optional(v.id("tiers")),
    // Staff override: when set, holds this tier until staff changes or
    // clears it. Clearing returns the company to its volume-derived tier.
    // Volume counting itself is Fase 2 — the field is modelled now.
    tierPin: v.optional(v.id("tiers")),
    volumeCents: v.number(),
    // Clerk user id of the member who registered the company.
    registadoPor: v.string(),
    registadoEm: v.number(),
    // Last staff decision (approve / reject / suspend / restore).
    decididoEm: v.optional(v.number()),
    decididoPor: v.optional(v.string()),
  })
    .index("by_clerkOrgId", ["clerkOrgId"])
    .index("by_nif", ["nif"])
    .index("by_estadoAprovacao", ["estadoAprovacao"])
    .index("by_registadoPor", ["registadoPor"]),

  // Named sequential counters (e.g. "encomendas" → ENC-n). One row per chave;
  // the mutation reads + patches inside the same transaction, so OCC keeps
  // numbers unique.
  counters: defineTable({
    chave: v.string(),
    valor: v.number(),
  }).index("by_chave", ["chave"]),

  // Installer order header (#5). Convex is the source of truth; Notion (#12),
  // InvoiceXpress (#14) and Revolut (#8) attach to this record in later slices.
  installerOrders: defineTable({
    empresaId: v.id("installerCompanies"),
    clerkOrgId: v.string(),
    numero: v.number(), // ENC-<numero>
    titulo: v.string(), // "ENC-12 — Clima Teste Lda"
    estado: estadoEncomendaValidator,
    cancelReason: v.optional(motivoCancelamentoValidator),
    // Clerk user id of the member who placed the order.
    placedBy: v.string(),
    placedAt: v.number(),
    // Sum of remaining lines (precoRevendaCents × qty), VAT-exclusive.
    totalRevendaCents: v.number(),
    // VAT rate used on documents (#14). Header totals stay s/IVA.
    ivaPercent: v.number(),
    stockRequestedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    cancelledBy: v.optional(v.string()),
    // Payment (#8). `pagamentoToken` is the unguessable public id of
    // /pagamento/$token, minted once and kept for the order's lifetime. The
    // Revolut order is created by `Pedir pagamento` and replaced after
    // `Voltar a editar`; `totalPagamentoCents` is the amount charged (c/IVA).
    pagamentoToken: v.optional(v.string()),
    revolutOrderId: v.optional(v.string()),
    revolutToken: v.optional(v.string()),
    totalPagamentoCents: v.optional(v.number()),
    paymentRequestedAt: v.optional(v.number()),
    paymentExpiresAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    // Notion desk ticket (#12). Set by the first successful render; the
    // office never needs it. `notionErro` is the last failed render reason.
    notionPageId: v.optional(v.string()),
    notionSyncAt: v.optional(v.number()),
    notionErro: v.optional(v.string()),
  })
    .index("by_empresaId", ["empresaId"])
    .index("by_estado", ["estado"])
    .index("by_numero", ["numero"])
    .index("by_notionPageId", ["notionPageId"])
    .index("by_pagamentoToken", ["pagamentoToken"])
    .index("by_revolutOrderId", ["revolutOrderId"]),

  // Every Revolut webhook event we accepted, for idempotency and audit.
  pagamentoEventos: defineTable({
    revolutOrderId: v.string(),
    evento: v.string(),
    encomendaId: v.optional(v.id("installerOrders")),
    recebidoEm: v.number(),
  }).index("by_revolutOrderId", ["revolutOrderId"]),

  // One SKU × qty on an installer order.
  installerOrderLines: defineTable({
    encomendaId: v.id("installerOrders"),
    ref: v.string(),
    marca: v.string(),
    nome: v.string(),
    qty: v.number(),
    // Price snapshot: reseller cents when the line was added. Never
    // re-snapshotted; to refresh a price the office drops and re-adds the SKU.
    precoRevendaCents: v.number(),
    pvpCents: v.number(),
    estadoLinha: estadoLinhaValidator,
    // Internal supplier cost recorded on confirm. Never installer-facing.
    custoCents: v.optional(v.number()),
    // Post-pay buckets, set on ORDER_COMPLETED. Invariant afterwards:
    // qtyPorEnviar + qtyEmTransito + qtyAguardaRecolha + qtyFalhada = qty.
    qtyPorEnviar: v.optional(v.number()),
    qtyEmTransito: v.optional(v.number()),
    qtyAguardaRecolha: v.optional(v.number()),
    qtyFalhada: v.optional(v.number()),
    reembolsadoAt: v.optional(v.number()),
    // Row in db-linhas-selectivedistribui (#12).
    notionPageId: v.optional(v.string()),
  })
    .index("by_encomendaId", ["encomendaId"])
    .index("by_encomenda_and_ref", ["encomendaId", "ref"])
    .index("by_notionPageId", ["notionPageId"]),

  // The four office databases created by `notion/setup.ts` inside the
  // `back-end` Notion page (#10, #12). One row per database.
  notionBases: defineTable({
    chave: notionBaseValidator,
    databaseId: v.string(),
    dataSourceId: v.string(),
  }).index("by_chave", ["chave"]),
});

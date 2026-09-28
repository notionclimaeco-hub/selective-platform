import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  FAMILIAS,
  SISTEMAS,
  atributoValidator,
  diffValidator,
  estadoImportacaoValidator,
  estadoValidator,
  stagedSkuFields,
} from "./schema";
import { requireStaff } from "./lib/auth";
import { conferirSegredo } from "./lib/importSecret";
import { validarAtributos } from "./lib/specRegistry";
import { upsertProdutoPorRef, type ProdutoImport } from "./produtos";
import { upsertPaginaImagem } from "./paginasCatalogo";
import { sincronizarGrupos } from "./lib/catalogoGrupos";
import {
  classificarDiff,
  contarRun,
  dobrarCompatibilidade,
  filtrarGrupos,
  gruposPorRever,
  resumirGrupos,
} from "./lib/importacoes";

// Import runs and staged SKUs (#40). Secret-guarded functions are what the
// extraction toolkit calls; staff functions back the admin review page.
// Promotion on approval runs in scheduled batches (`promoverLote`).

const LOTE_PROMOCAO = 100;

const FAMILIAS_SET = new Set<string>(FAMILIAS);
const SISTEMAS_SET = new Set<string>(SISTEMAS);

const stagedSkuValidator = v.object(stagedSkuFields);
type StagedSkuArgs = Infer<typeof stagedSkuValidator>;

const contagensValidator = v.object({
  numSkus: v.number(),
  numGrupos: v.number(),
  numNovos: v.number(),
  numAlterados: v.number(),
  numIguais: v.number(),
  numComAvisos: v.number(),
});

export const importacaoValidator = v.object({
  _id: v.id("importacoes"),
  _creationTime: v.number(),
  marca: v.string(),
  ano: v.number(),
  tabelaOrigem: v.string(),
  ficheiro: v.string(),
  pdf: v.optional(v.id("_storage")),
  estado: estadoImportacaoValidator,
  ...contagensValidator.fields,
  numPromovidos: v.optional(v.number()),
  numReativados: v.optional(v.number()),
  numDescontinuados: v.optional(v.number()),
  criadoEm: v.number(),
  decididoEm: v.optional(v.number()),
  decididoPor: v.optional(v.string()),
  motivoRejeicao: v.optional(v.string()),
});

export const skuEmRevisaoValidator = v.object({
  _id: v.id("skusEmRevisao"),
  _creationTime: v.number(),
  importacaoId: v.id("importacoes"),
  ...stagedSkuFields,
  diff: diffValidator,
  precoAnteriorCents: v.optional(v.number()),
  grupoRevisto: v.boolean(),
  promovido: v.boolean(),
});

// --- Shared helpers ----------------------------------------------------------

async function obterRun(
  ctx: QueryCtx | MutationCtx,
  importacaoId: Id<"importacoes">,
): Promise<Doc<"importacoes">> {
  const run = await ctx.db.get(importacaoId);
  if (!run) throw new Error("Importação não encontrada.");
  return run;
}

type EstadoImportacao = Doc<"importacoes">["estado"];

function exigirEstado(
  run: Doc<"importacoes">,
  ...estados: Array<EstadoImportacao>
): void {
  if (!estados.includes(run.estado)) {
    throw new Error(
      `Importação em estado "${run.estado}"; esperado ${estados.join(" ou ")}.`,
    );
  }
}

async function linhasDaRun(
  ctx: QueryCtx | MutationCtx,
  importacaoId: Id<"importacoes">,
): Promise<Array<Doc<"skusEmRevisao">>> {
  return await ctx.db
    .query("skusEmRevisao")
    .withIndex("by_importacao", (q) => q.eq("importacaoId", importacaoId))
    .collect();
}

/**
 * Per-SKU checks before staging. Throws on anything that would be rejected
 * by the catalog upsert or by the registry; returns the final attributes and
 * the merged warnings otherwise.
 */
function prepararSku(
  sku: StagedSkuArgs,
  run: Doc<"importacoes">,
  refsNaRun: Set<string>,
): { atributos: Array<{ chave: string; valor: string }>; avisos: Array<string> } {
  if (sku.tabelaOrigem !== run.tabelaOrigem) {
    throw new Error(
      `tabelaOrigem "${sku.tabelaOrigem}" não é a da importação (${run.tabelaOrigem}).`,
    );
  }
  if (sku.marca !== run.marca) {
    throw new Error(
      `marca "${sku.marca}" não é a da importação (${run.marca}).`,
    );
  }
  if (refsNaRun.has(sku.ref)) {
    throw new Error(`ref "${sku.ref}" duplicada na importação.`);
  }
  if (!FAMILIAS_SET.has(sku.familia)) {
    throw new Error(`familia "${sku.familia}" inválida.`);
  }
  if (sku.sistema !== undefined && !SISTEMAS_SET.has(sku.sistema)) {
    throw new Error(`sistema "${sku.sistema}" inválido.`);
  }
  if (!Number.isInteger(sku.pvpCents) || sku.pvpCents < 0) {
    throw new Error("pvpCents deve ser um inteiro não negativo.");
  }
  if (sku.pdfPaginas.some((p) => !Number.isInteger(p) || p <= 0)) {
    throw new Error("pdfPaginas deve conter apenas inteiros positivos.");
  }
  const atributos = dobrarCompatibilidade(sku.atributos, sku.compativelCom);
  const { erros, avisos } = validarAtributos(
    sku.familia,
    sku.componente,
    atributos,
  );
  if (erros.length > 0) throw new Error(erros.join("; "));
  return { atributos, avisos: [...new Set([...sku.avisos, ...avisos])] };
}

// --- Load path (secret-guarded) ---------------------------------------------

/**
 * Open a run for a brand price table. An open run (`a-extrair` or
 * `em-revisao`) of the same table is superseded: its rows are deleted and it
 * is marked `rejeitada`, so a re-run of the extractor needs no cleanup. A run
 * still promoting blocks creation.
 */
export const criarImportacao = mutation({
  args: {
    secret: v.string(),
    marca: v.string(),
    ano: v.number(),
    tabelaOrigem: v.string(),
    ficheiro: v.string(),
    pdf: v.optional(v.id("_storage")),
  },
  returns: v.object({ importacaoId: v.id("importacoes") }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    const agora = Date.now();

    const anteriores = await ctx.db
      .query("importacoes")
      .withIndex("by_tabelaOrigem", (q) => q.eq("tabelaOrigem", args.tabelaOrigem))
      .collect();
    for (const anterior of anteriores) {
      if (anterior.estado === "a-promover") {
        throw new Error(
          `A importação ${anterior._id} de ${args.tabelaOrigem} ainda está a ser promovida.`,
        );
      }
      if (anterior.estado !== "a-extrair" && anterior.estado !== "em-revisao") {
        continue;
      }
      for (const linha of await linhasDaRun(ctx, anterior._id)) {
        await ctx.db.delete(linha._id);
      }
      await ctx.db.patch(anterior._id, {
        estado: "rejeitada",
        decididoEm: agora,
        motivoRejeicao: "substituída por nova extração",
      });
    }

    const importacaoId = await ctx.db.insert("importacoes", {
      marca: args.marca,
      ano: args.ano,
      tabelaOrigem: args.tabelaOrigem,
      ficheiro: args.ficheiro,
      pdf: args.pdf,
      estado: "a-extrair",
      numSkus: 0,
      numGrupos: 0,
      numNovos: 0,
      numAlterados: 0,
      numIguais: 0,
      numComAvisos: 0,
      criadoEm: agora,
    });
    return { importacaoId };
  },
});

/**
 * Append a batch of staged SKUs (the caller splits at ~100). Each SKU is
 * re-validated against the taxonomy and the spec registry and diffed against
 * the live catalog by ref. Bad rows are reported, good rows still commit.
 */
export const carregarSkus = mutation({
  args: {
    secret: v.string(),
    importacaoId: v.id("importacoes"),
    skus: v.array(stagedSkuValidator),
  },
  returns: v.object({
    carregados: v.number(),
    erros: v.array(v.object({ ref: v.string(), erro: v.string() })),
  }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    const run = await obterRun(ctx, args.importacaoId);
    exigirEstado(run, "a-extrair");

    // Refs seen in this batch; earlier batches are checked by index below.
    const refsNaRun = new Set<string>();
    let carregados = 0;
    const erros: Array<{ ref: string; erro: string }> = [];

    for (const sku of args.skus) {
      try {
        const { atributos, avisos } = prepararSku(sku, run, refsNaRun);
        const jaCarregado = await ctx.db
          .query("skusEmRevisao")
          .withIndex("by_importacao_ref", (q) =>
            q.eq("importacaoId", run._id).eq("ref", sku.ref),
          )
          .unique();
        if (jaCarregado) {
          throw new Error(`ref "${sku.ref}" duplicada na importação.`);
        }
        // A group never mixes brands: catch it here, at load, instead of
        // letting `upsertProdutoPorRef` throw mid-promotion and strand the
        // run in `a-promover`.
        const grupoModelo = sku.grupoModelo;
        const noGrupo = await ctx.db
          .query("produtos")
          .withIndex("by_grupoModelo", (q) => q.eq("grupoModelo", grupoModelo))
          .collect();
        const conflito = noGrupo.find((p) => p.marca !== sku.marca);
        if (conflito) {
          throw new Error(
            `grupo "${sku.grupoModelo}" já contém a marca "${conflito.marca}" no catálogo.`,
          );
        }
        const atual = await ctx.db
          .query("produtos")
          .withIndex("by_ref", (q) => q.eq("ref", sku.ref))
          .unique();
        const { diff, precoAnteriorCents } = classificarDiff(atual, sku.pvpCents);
        await ctx.db.insert("skusEmRevisao", {
          importacaoId: run._id,
          ...sku,
          atributos,
          avisos,
          diff,
          precoAnteriorCents,
          grupoRevisto: false,
          promovido: false,
        });
        refsNaRun.add(sku.ref);
        carregados++;
      } catch (e) {
        erros.push({
          ref: sku.ref,
          erro: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return { carregados, erros };
  },
});

/** Close the load: compute the run's counts and open it for review. */
export const concluirCarregamento = mutation({
  args: { secret: v.string(), importacaoId: v.id("importacoes") },
  returns: contagensValidator,
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    const run = await obterRun(ctx, args.importacaoId);
    exigirEstado(run, "a-extrair");
    const linhas = await linhasDaRun(ctx, run._id);
    if (linhas.length === 0) {
      throw new Error("A importação não tem SKUs carregados.");
    }
    const contagens = contarRun(linhas);
    await ctx.db.patch(run._id, { estado: "em-revisao", ...contagens });
    return contagens;
  },
});

/** Secret-guarded record of an uploaded page render (idempotent per slot). */
export const registarPaginaImagem = mutation({
  args: {
    secret: v.string(),
    tabelaOrigem: v.string(),
    pagina: v.number(),
    imagem: v.id("_storage"),
  },
  returns: v.object({
    paginaId: v.id("paginasCatalogo"),
    substituido: v.boolean(),
  }),
  handler: async (ctx, args) => {
    conferirSegredo(args.secret);
    return await upsertPaginaImagem(ctx, {
      tabelaOrigem: args.tabelaOrigem,
      pagina: args.pagina,
      imagem: args.imagem,
    });
  },
});

// --- Review (staff) ----------------------------------------------------------

/** Flag every staged row of a group as reviewed (or not). */
export const marcarGrupoRevisto = mutation({
  args: {
    importacaoId: v.id("importacoes"),
    grupoModelo: v.string(),
    revisto: v.boolean(),
  },
  returns: v.object({ atualizados: v.number() }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const run = await obterRun(ctx, args.importacaoId);
    exigirEstado(run, "em-revisao");
    const linhas = await ctx.db
      .query("skusEmRevisao")
      .withIndex("by_importacao_grupo", (q) =>
        q.eq("importacaoId", run._id).eq("grupoModelo", args.grupoModelo),
      )
      .collect();
    if (linhas.length === 0) {
      throw new Error(`Grupo "${args.grupoModelo}" não existe nesta importação.`);
    }
    let atualizados = 0;
    for (const linha of linhas) {
      if (linha.grupoRevisto === args.revisto) continue;
      await ctx.db.patch(linha._id, { grupoRevisto: args.revisto });
      atualizados++;
    }
    return { atualizados };
  },
});

/** Close a run without promoting. Staged rows are kept for audit. */
export const rejeitarImportacao = mutation({
  args: { importacaoId: v.id("importacoes"), motivo: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireStaff(ctx);
    const run = await obterRun(ctx, args.importacaoId);
    exigirEstado(run, "a-extrair", "em-revisao");
    const motivo = args.motivo?.trim();
    await ctx.db.patch(run._id, {
      estado: "rejeitada",
      decididoEm: Date.now(),
      decididoPor: identity.subject,
      motivoRejeicao: motivo === "" ? undefined : motivo,
    });
    return null;
  },
});

/**
 * Approve a run. Gate: every group with a warning or a price change must be
 * reviewed. Promotion itself runs in scheduled batches (`promoverLote`) so a
 * Daikin-sized table stays under transaction limits; `a-promover` is the
 * visible in-between state.
 */
export const aprovarImportacao = mutation({
  args: { importacaoId: v.id("importacoes") },
  returns: v.object({ agendado: v.boolean() }),
  handler: async (ctx, args) => {
    const identity = await requireStaff(ctx);
    const run = await obterRun(ctx, args.importacaoId);
    exigirEstado(run, "em-revisao");

    const porRever = gruposPorRever(resumirGrupos(await linhasDaRun(ctx, run._id)));
    if (porRever.length > 0) {
      const lista = porRever.slice(0, 10).join(", ");
      const resto = porRever.length > 10 ? ", …" : "";
      throw new Error(
        `${porRever.length} grupo(s) com avisos ou preços alterados ainda por rever: ${lista}${resto}.`,
      );
    }

    await ctx.db.patch(run._id, {
      estado: "a-promover",
      decididoEm: Date.now(),
      decididoPor: identity.subject,
      numPromovidos: 0,
      numReativados: 0,
    });
    await ctx.scheduler.runAfter(0, internal.importacoes.promoverLote, {
      importacaoId: run._id,
    });
    return { agendado: true };
  },
});

// --- Promotion (scheduled batches) ------------------------------------------

/** The 18 catalog fields of a staged row, as `upsertProdutoPorRef` wants them. */
function camposProduto(l: Doc<"skusEmRevisao">): ProdutoImport {
  return {
    ref: l.ref,
    ean: l.ean,
    marca: l.marca,
    nome: l.nome,
    nomeGrupo: l.nomeGrupo,
    familia: l.familia,
    segmento: l.segmento,
    sistema: l.sistema,
    tipoUnidade: l.tipoUnidade,
    componente: l.componente,
    gama: l.gama,
    grupoModelo: l.grupoModelo,
    atributos: l.atributos,
    descricao: l.descricao,
    pvpCents: l.pvpCents,
    ivaIncluido: l.ivaIncluido,
    tabelaOrigem: l.tabelaOrigem,
    pdfPaginas: l.pdfPaginas,
  };
}

/**
 * One promotion batch. Upserts up to LOTE_PROMOCAO unpromoted rows through
 * the catalog path (existing refs keep `imagens` and `estado`; new refs insert
 * as `rascunho`; a `descontinuado` ref that reappears is revived as
 * `rascunho`), marks them `promovido` and reschedules itself. The final pass
 * marks every live ref of the brand (by `marca` or by `tabelaOrigem`) that is
 * absent from the run `descontinuado` and closes the run as `aprovada`.
 * Rows already `promovido` are skipped, so re-running after a failed batch
 * (`npx convex run importacoes:promoverLote '{"importacaoId": "..."}'`)
 * resumes where it stopped.
 */
export const promoverLote = internalMutation({
  args: { importacaoId: v.id("importacoes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await obterRun(ctx, args.importacaoId);
    exigirEstado(run, "a-promover");
    const tocados = new Set<string>();

    const pendentes = await ctx.db
      .query("skusEmRevisao")
      .withIndex("by_importacao_promovido", (q) =>
        q.eq("importacaoId", run._id).eq("promovido", false),
      )
      .take(LOTE_PROMOCAO);

    if (pendentes.length > 0) {
      let reativados = 0;
      for (const linha of pendentes) {
        const anterior = await ctx.db
          .query("produtos")
          .withIndex("by_ref", (q) => q.eq("ref", linha.ref))
          .unique();
        const r = await upsertProdutoPorRef(ctx, camposProduto(linha), tocados);
        if (anterior?.estado === "descontinuado") {
          await ctx.db.patch(r.produtoId, { estado: "rascunho" });
          reativados++;
        }
        await ctx.db.patch(linha._id, { promovido: true });
      }
      await sincronizarGrupos(ctx, tocados);
      await ctx.db.patch(run._id, {
        numPromovidos: (run.numPromovidos ?? 0) + pendentes.length,
        numReativados: (run.numReativados ?? 0) + reativados,
      });
      await ctx.scheduler.runAfter(0, internal.importacoes.promoverLote, {
        importacaoId: run._id,
      });
      return null;
    }

    // Final pass: discontinue what the brand no longer sells. Never delete —
    // order lines reference refs.
    const refsDaRun = new Set((await linhasDaRun(ctx, run._id)).map((l) => l.ref));
    const daMarca = await ctx.db
      .query("produtos")
      .withIndex("by_marca", (q) => q.eq("marca", run.marca))
      .collect();
    const daTabela = await ctx.db
      .query("produtos")
      .withIndex("by_tabela", (q) => q.eq("tabelaOrigem", run.tabelaOrigem))
      .collect();
    const vivos = new Map<Id<"produtos">, Doc<"produtos">>();
    for (const p of [...daMarca, ...daTabela]) vivos.set(p._id, p);

    let descontinuados = 0;
    for (const p of vivos.values()) {
      if (refsDaRun.has(p.ref) || p.estado === "descontinuado") continue;
      await ctx.db.patch(p._id, { estado: "descontinuado" });
      tocados.add(p.grupoModelo);
      descontinuados++;
    }
    await sincronizarGrupos(ctx, tocados);
    await ctx.db.patch(run._id, {
      estado: "aprovada",
      numDescontinuados: descontinuados,
    });
    return null;
  },
});

// --- Queries (staff) ---------------------------------------------------------

export const resumoGrupoValidator = v.object({
  grupoModelo: v.string(),
  nomeGrupo: v.string(),
  marca: v.string(),
  familia: v.string(),
  componente: v.string(),
  numSkus: v.number(),
  numAvisos: v.number(),
  numNovos: v.number(),
  numAlterados: v.number(),
  numIguais: v.number(),
  revisto: v.boolean(),
  precisaRevisao: v.boolean(),
});

export const filtroGruposValidator = v.union(
  v.literal("todos"),
  v.literal("por-rever"),
  v.literal("com-avisos"),
  v.literal("alterados"),
  v.literal("novos"),
);

// The live `produtos` row a staged SKU would replace, reduced for the page.
const atualValidator = v.object({
  nome: v.string(),
  nomeGrupo: v.string(),
  grupoModelo: v.string(),
  pvpCents: v.number(),
  atributos: v.array(atributoValidator),
  estado: estadoValidator,
  numImagens: v.number(),
});

const paginaRevisaoValidator = v.object({
  pagina: v.number(),
  imagemUrl: v.union(v.string(), v.null()),
  pdfUrl: v.union(v.string(), v.null()),
});

/** Runs index: newest first. */
export const listar = query({
  args: {},
  returns: v.array(importacaoValidator),
  handler: async (ctx) => {
    await requireStaff(ctx);
    return await ctx.db.query("importacoes").order("desc").take(100);
  },
});

/**
 * One run with a page of group summaries. Groups are derived in memory from
 * the run's rows (runs are at most low thousands of rows), same offset
 * pagination as `produtos.listarAdmin`. `gruposPorRever` counts over the
 * whole run: zero means approval will pass the gate.
 */
export const obter = query({
  args: {
    importacaoId: v.id("importacoes"),
    pagina: v.number(),
    porPagina: v.number(),
    filtro: v.optional(filtroGruposValidator),
  },
  returns: v.union(
    v.null(),
    v.object({
      importacao: v.object({
        ...importacaoValidator.fields,
        pdfUrl: v.union(v.string(), v.null()),
      }),
      grupos: v.array(resumoGrupoValidator),
      totalGrupos: v.number(),
      numPaginas: v.number(),
      pagina: v.number(),
      gruposPorRever: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const run = await ctx.db.get(args.importacaoId);
    if (!run) return null;

    const resumos = resumirGrupos(await linhasDaRun(ctx, run._id));
    const porRever = gruposPorRever(resumos).length;
    const filtrados = filtrarGrupos(resumos, args.filtro ?? "todos");

    const porPagina = Math.max(1, Math.floor(args.porPagina));
    const numPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
    const pagina = Math.min(Math.max(0, Math.floor(args.pagina)), numPaginas - 1);
    const inicio = pagina * porPagina;

    const pdfUrl = run.pdf === undefined ? null : await ctx.storage.getUrl(run.pdf);
    return {
      importacao: { ...run, pdfUrl },
      grupos: filtrados.slice(inicio, inicio + porPagina),
      totalGrupos: filtrados.length,
      numPaginas,
      pagina,
      gruposPorRever: porRever,
    };
  },
});

/**
 * One staged group: its SKUs by price, each with the live counterpart (or
 * null), plus the PNG render and one-page PDF of every page they cite.
 */
export const obterGrupo = query({
  args: { importacaoId: v.id("importacoes"), grupoModelo: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      grupoModelo: v.string(),
      nomeGrupo: v.string(),
      revisto: v.boolean(),
      skus: v.array(
        v.object({
          ...skuEmRevisaoValidator.fields,
          atual: v.union(atualValidator, v.null()),
        }),
      ),
      paginas: v.array(paginaRevisaoValidator),
    }),
  ),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const run = await ctx.db.get(args.importacaoId);
    if (!run) return null;

    const linhas = await ctx.db
      .query("skusEmRevisao")
      .withIndex("by_importacao_grupo", (q) =>
        q.eq("importacaoId", run._id).eq("grupoModelo", args.grupoModelo),
      )
      .collect();
    const [primeira] = linhas;
    if (!primeira) return null;

    linhas.sort((a, b) => a.pvpCents - b.pvpCents || a.ref.localeCompare(b.ref));

    const skus = [];
    for (const linha of linhas) {
      const p = await ctx.db
        .query("produtos")
        .withIndex("by_ref", (q) => q.eq("ref", linha.ref))
        .unique();
      skus.push({
        ...linha,
        atual: p
          ? {
              nome: p.nome,
              nomeGrupo: p.nomeGrupo,
              grupoModelo: p.grupoModelo,
              pvpCents: p.pvpCents,
              atributos: p.atributos,
              estado: p.estado,
              numImagens: p.imagens.length,
            }
          : null,
      });
    }

    const numeros = [...new Set(linhas.flatMap((l) => l.pdfPaginas))].sort(
      (a, b) => a - b,
    );
    const paginas = [];
    for (const pagina of numeros) {
      const slot = await ctx.db
        .query("paginasCatalogo")
        .withIndex("by_tabela_pagina", (q) =>
          q.eq("tabelaOrigem", run.tabelaOrigem).eq("pagina", pagina),
        )
        .unique();
      paginas.push({
        pagina,
        imagemUrl:
          slot?.imagem === undefined ? null : await ctx.storage.getUrl(slot.imagem),
        pdfUrl:
          slot?.ficheiro === undefined ? null : await ctx.storage.getUrl(slot.ficheiro),
      });
    }

    return {
      grupoModelo: args.grupoModelo,
      nomeGrupo: primeira.nomeGrupo,
      revisto: linhas.every((l) => l.grupoRevisto),
      skus,
      paginas,
    };
  },
});

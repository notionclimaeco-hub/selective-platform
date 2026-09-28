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

    const refsNaRun = new Set(
      (await linhasDaRun(ctx, run._id)).map((l) => l.ref),
    );
    let carregados = 0;
    const erros: Array<{ ref: string; erro: string }> = [];

    for (const sku of args.skus) {
      try {
        const { atributos, avisos } = prepararSku(sku, run, refsNaRun);
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

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  clienteDoAmbiente,
  listarTudo,
  NotionError,
  type Json,
  type NotionRequest,
} from "./cliente";
import {
  corpoInicial,
  ENC,
  espelhoEncomenda,
  espelhoLinha,
  LIN,
  linhaRegisto,
  MOD,
  nomeMarcaPadrao,
  SECCAO_EMAILS,
  SECCAO_LINHAS,
  SECCAO_REGISTO,
  seccaoEmails,
  seccaoRegisto,
  tabelaLinhas,
  type Modelo,
} from "./esquema";
import { bloco, ler } from "./propriedades";

/**
 * Convex → Notion. `renderizar` rewrites every mirror field of one order's
 * ticket and line rows from the Convex documents (creating what is missing),
 * then appends `evento` to the ticket's log. Idempotent, so it doubles as the
 * reconciliation step. Failures retry with backoff; the last failure is kept
 * on the order (`notionErro`) for the sweep to pick up.
 */

const MAX_TENTATIVAS = 5;
const MAX_MODELOS = 50;

function paginaDesapareceu(e: unknown): boolean {
  return (
    e instanceof NotionError &&
    (e.status === 404 || (e.status === 400 && /archived|trash/i.test(e.message)))
  );
}

async function upsertPagina(
  notion: NotionRequest,
  pageId: string | undefined,
  dataSourceId: string,
  properties: Record<string, unknown>,
  children?: Array<Record<string, unknown>>,
): Promise<{ pageId: string; criada: boolean }> {
  if (pageId) {
    try {
      await notion("PATCH", `/pages/${pageId}`, { properties });
      return { pageId, criada: false };
    } catch (e) {
      if (!paginaDesapareceu(e)) throw e;
      // Row deleted by hand — re-create it (flagged in the log by the caller).
    }
  }
  const criada = await notion("POST", "/pages", {
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties,
    ...(children ? { children } : {}),
  });
  return { pageId: criada.id as string, criada: true };
}

/** The office may mark one of the data source's templates as default. */
async function temTemplatePadrao(
  notion: NotionRequest,
  dataSourceId: string,
): Promise<boolean> {
  const resposta = await notion("GET", `/data_sources/${dataSourceId}/templates?page_size=100`);
  const templates = Array.isArray(resposta.templates) ? (resposta.templates as Array<Json>) : [];
  return templates.some((t) => t.is_default === true);
}

/**
 * Create the ticket. With a default template Notion applies the template
 * body asynchronously and `children` is not allowed, so our sections are
 * added later by `garantirCorpo`.
 */
async function criarTicket(
  notion: NotionRequest,
  dataSourceId: string,
  properties: Record<string, unknown>,
  comTemplate: boolean,
  corpo: () => Promise<Array<Record<string, unknown>>>,
): Promise<string> {
  const criada = await notion("POST", "/pages", {
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties,
    ...(comTemplate ? { template: { type: "default" } } : { children: await corpo() }),
  });
  return criada.id as string;
}

function indiceCabecalho(filhos: ReadonlyArray<Json>, texto: string): number {
  return filhos.findIndex((b) => {
    if (b.type !== "heading_2") return false;
    const rich = (b.heading_2 as { rich_text?: Array<{ plain_text?: string }> } | undefined)
      ?.rich_text;
    return (rich ?? []).map((r) => r.plain_text ?? "").join("") === texto;
  });
}

/**
 * Make sure the ticket body has our sections: the lines table (only when
 * there is no template — the template carries its own linked view), the
 * supplier drafts and the log. Returns `false` while a template is still
 * being applied (the page is blank), so the caller can come back later.
 */
async function garantirCorpo(
  notion: NotionRequest,
  pageId: string,
  comTemplate: boolean,
  tabela: Record<string, unknown>,
  emails: () => Promise<Array<Record<string, unknown>>>,
): Promise<boolean> {
  const filhos = await listarTudo(notion, "GET", `/blocks/${pageId}/children`, {}, 200);
  if (comTemplate && filhos.length === 0) return false;

  const cabecalho = indiceCabecalho(filhos, SECCAO_LINHAS);
  if (comTemplate) {
    // Older tickets carry our table; the template's linked view replaces it.
    const seguinte = filhos[cabecalho + 1];
    if (cabecalho !== -1 && seguinte && seguinte.type === "table") {
      await notion("DELETE", `/blocks/${seguinte.id as string}`);
      await notion("DELETE", `/blocks/${filhos[cabecalho]?.id as string}`);
    }
  } else {
    if (cabecalho === -1) {
      await notion("PATCH", `/blocks/${pageId}/children`, {
        children: [bloco.h2(SECCAO_LINHAS), tabela],
      });
    } else {
      const seguinte = filhos[cabecalho + 1];
      if (seguinte && seguinte.type === "table") {
        await notion("DELETE", `/blocks/${seguinte.id as string}`);
      }
      await notion("PATCH", `/blocks/${pageId}/children`, {
        children: [tabela],
        after: filhos[cabecalho]?.id,
      });
    }
  }

  const emFalta: Array<Record<string, unknown>> = [];
  if (indiceCabecalho(filhos, SECCAO_EMAILS) === -1) emFalta.push(...(await emails()));
  if (indiceCabecalho(filhos, SECCAO_REGISTO) === -1) emFalta.push(...seccaoRegisto());
  if (emFalta.length > 0) {
    await notion("PATCH", `/blocks/${pageId}/children`, { children: emFalta });
  }
  return true;
}

async function carregarModelos(
  notion: NotionRequest,
  dataSourceId: string | undefined,
): Promise<Map<string, Modelo>> {
  const modelos = new Map<string, Modelo>();
  if (!dataSourceId) return modelos;
  const resposta = await notion("POST", `/data_sources/${dataSourceId}/query`, {
    page_size: MAX_MODELOS,
  });
  for (const pagina of (resposta.results as Array<Json>) ?? []) {
    const props = (pagina.properties as Record<string, unknown>) ?? {};
    const nome = ler.titulo(props, MOD.titulo).toLowerCase();
    if (nome.length === 0) continue;
    modelos.set(nome, {
      assunto: ler.texto(props, MOD.assunto),
      corpo: ler.texto(props, MOD.corpo),
    });
  }
  return modelos;
}

export const renderizar = internalAction({
  args: {
    encomendaId: v.id("installerOrders"),
    evento: v.optional(v.string()),
    tentativa: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notion = clienteDoAmbiente();
    if (!notion) {
      console.warn("Notion desk: NOTION_API_KEY not set, render skipped");
      return null;
    }
    const dados = await ctx.runQuery(internal.notion.dados.paraRender, {
      encomendaId: args.encomendaId,
    });
    if (!dados) return null;
    const baseEncomendas = dados.bases.find((b) => b.chave === "encomendas");
    const baseLinhas = dados.bases.find((b) => b.chave === "linhas");
    if (!baseEncomendas || !baseLinhas) {
      console.warn("Notion desk not configured (run notion/setup:configurar)");
      return null;
    }

    const agora = Date.now();
    const { encomenda, linhas, empresa } = dados;
    const nomeMarca = (slug: string) =>
      dados.marcas.find((m) => m.slug === slug)?.nome ?? nomeMarcaPadrao(slug);

    try {
      const eventos: Array<string> = [];
      const tentativa = args.tentativa ?? 1;
      const comTemplate = await temTemplatePadrao(notion, baseEncomendas.dataSourceId);
      const modelos = () =>
        carregarModelos(notion, dados.bases.find((b) => b.chave === "modelos")?.dataSourceId);
      const emails = async () => seccaoEmails(encomenda, linhas, await modelos(), nomeMarca);
      const propriedades = espelhoEncomenda(encomenda, linhas, empresa, agora);

      // Header: patch, or (re)create when missing / deleted by hand.
      let ticket: { pageId: string; criada: boolean };
      if (encomenda.notionPageId) {
        try {
          await notion("PATCH", `/pages/${encomenda.notionPageId}`, { properties: propriedades });
          ticket = { pageId: encomenda.notionPageId, criada: false };
        } catch (e) {
          if (!paginaDesapareceu(e)) throw e;
          ticket = { pageId: "", criada: true };
        }
      } else {
        ticket = { pageId: "", criada: true };
      }
      if (ticket.criada) {
        ticket.pageId = await criarTicket(
          notion,
          baseEncomendas.dataSourceId,
          propriedades,
          comTemplate,
          async () => corpoInicial(encomenda, linhas, await modelos(), nomeMarca),
        );
        if (encomenda.notionPageId) {
          eventos.push("Ticket recriado (o anterior foi apagado no Notion)");
        }
      }

      // Body: wait for the template to be applied before adding our sections
      // (a blank page means Notion is still copying it). Give up waiting after
      // the usual number of attempts and write our sections anyway.
      const corpoPronto = await garantirCorpo(
        notion,
        ticket.pageId,
        comTemplate && tentativa < MAX_TENTATIVAS,
        tabelaLinhas(linhas, nomeMarca),
        emails,
      );

      const novasLinhas: Array<{ linhaId: Id<"installerOrderLines">; pageId: string }> = [];
      for (const linha of linhas) {
        const row = await upsertPagina(
          notion,
          linha.notionPageId,
          baseLinhas.dataSourceId,
          espelhoLinha(linha, ticket.pageId),
        );
        if (row.criada) {
          novasLinhas.push({ linhaId: linha._id, pageId: row.pageId });
          if (linha.notionPageId) {
            eventos.push(`Linha ${linha.ref} recriada (apagada no Notion)`);
          }
        }
      }

      await ctx.runMutation(internal.notion.dados.guardarPaginas, {
        encomendaId: encomenda._id,
        encomendaPageId: ticket.criada ? ticket.pageId : undefined,
        linhas: novasLinhas,
        agora,
      });

      if (args.evento) eventos.unshift(args.evento);
      if (!corpoPronto) {
        // Template still applying: come back for the body and the log.
        await ctx.scheduler.runAfter(15_000, internal.notion.sync.renderizar, {
          encomendaId: encomenda._id,
          evento: eventos.join(" · ") || undefined,
          tentativa: tentativa + 1,
        });
        return null;
      }
      if (eventos.length > 0) {
        await notion("PATCH", `/blocks/${ticket.pageId}/children`, {
          children: eventos.map((e) => linhaRegisto(agora, e)),
        });
      }
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      const tentativa = args.tentativa ?? 1;
      console.error(
        `Notion render failed for ${encomenda.titulo} (attempt ${tentativa}): ${mensagem}`,
      );
      if (tentativa < MAX_TENTATIVAS) {
        await ctx.scheduler.runAfter(
          1000 * 2 ** tentativa,
          internal.notion.sync.renderizar,
          { ...args, tentativa: tentativa + 1 },
        );
      } else {
        await ctx.runMutation(internal.notion.dados.registarErro, {
          encomendaId: encomenda._id,
          erro: mensagem,
        });
      }
    }
    return null;
  },
});

/**
 * Periodic sweep (crons.ts): re-render open tickets and pick up anything the
 * webhook missed — rows added by hand and Ação values still set.
 */
export const reconciliar = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const notion = clienteDoAmbiente();
    if (!notion) return null;
    const bases = await ctx.runQuery(internal.notion.dados.bases, {});
    const baseEncomendas = bases.find((b) => b.chave === "encomendas");
    const baseLinhas = bases.find((b) => b.chave === "linhas");
    if (!baseEncomendas || !baseLinhas) return null;

    const abertas = await ctx.runQuery(internal.notion.dados.encomendasAbertas, {});
    for (const [i, encomendaId] of abertas.entries()) {
      await ctx.scheduler.runAfter(i * 500, internal.notion.sync.renderizar, {
        encomendaId,
      });
    }

    const pendentes = new Set<string>();
    const recolher = async (dataSourceId: string, filter: Json) => {
      const resposta = await notion("POST", `/data_sources/${dataSourceId}/query`, {
        filter,
        page_size: 50,
      });
      for (const p of (resposta.results as Array<Json>) ?? []) {
        if (typeof p.id === "string") pendentes.add(p.id);
      }
    };
    await recolher(baseEncomendas.dataSourceId, {
      property: ENC.acao,
      select: { is_not_empty: true },
    });
    await recolher(baseLinhas.dataSourceId, {
      property: LIN.acao,
      select: { is_not_empty: true },
    });
    await recolher(baseLinhas.dataSourceId, {
      property: LIN.convexId,
      rich_text: { is_empty: true },
    });

    let i = 0;
    for (const pageId of pendentes) {
      await ctx.scheduler.runAfter(i++ * 500, internal.notion.entrada.processarPagina, {
        pageId,
      });
    }
    return null;
  },
});

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { clienteDoAmbiente, type NotionRequest } from "./cliente";
import {
  baseDoParent,
  ENC,
  interpretarEncomenda,
  interpretarLinha,
  interpretarNovaLinha,
  LIN,
  limparEntradasEncomenda,
  limparEntradasLinha,
  type Props,
} from "./esquema";
import { ler, prop } from "./propriedades";

/**
 * Notion → Convex. A database automation posts to `/notion/webhook`
 * (http.ts) whenever the office sets an Ação or adds a line row; we never
 * trust the payload — `processarPagina` re-reads the page, interprets the
 * inputs, applies them through the order mutations, clears the inputs and
 * queues a render. Invalid input → `Erro` on that row, nothing applied.
 *
 * Ação is always cleared (even on error) so our own edits can never loop the
 * automation; the other inputs stay so the office can fix and retry.
 */

const POR_NOTION = "notion";

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function marcarErroEncomenda(
  notion: NotionRequest,
  pageId: string,
  erro: string,
): Promise<void> {
  await notion("PATCH", `/pages/${pageId}`, {
    properties: {
      [ENC.acao]: prop.selecao(null),
      [ENC.erro]: prop.texto(`Não aplicado: ${erro}`),
    },
  });
}

async function marcarErroLinha(
  notion: NotionRequest,
  pageId: string,
  erro: string,
): Promise<void> {
  await notion("PATCH", `/pages/${pageId}`, {
    properties: {
      [LIN.acao]: prop.selecao(null),
      [LIN.erro]: prop.texto(`Não aplicado: ${erro}`),
    },
  });
}

async function processarEncomenda(
  ctx: ActionCtx,
  notion: NotionRequest,
  pageId: string,
  props: Props,
): Promise<void> {
  const encomendaId = await ctx.runQuery(internal.notion.dados.encomendaPorPagina, {
    pageId,
  });
  if (encomendaId === null) {
    if (ler.selecao(props, ENC.acao) !== null) {
      await marcarErroEncomenda(notion, pageId, "ticket não reconhecido pela plataforma");
    }
    return;
  }

  let evento: string;
  try {
    const comando = interpretarEncomenda(props);
    if (comando === null) return;
    switch (comando.tipo) {
      case "stock_pedido":
        await ctx.runMutation(internal.encomendas.pedirStock, { encomendaId });
        evento = "Stock pedido aos fornecedores (escritório)";
        break;
      case "cancelar":
        await ctx.runMutation(internal.encomendas.cancelarPeloEscritorio, {
          encomendaId,
          por: POR_NOTION,
        });
        evento = `Cancelada pelo escritório${comando.motivo ? ` — ${comando.motivo}` : ""}`;
        break;
      case "nao_disponivel":
        throw new Error(`a ação "${comando.acao}" ainda não está disponível nesta fase`);
    }
  } catch (e) {
    await marcarErroEncomenda(notion, pageId, mensagem(e));
    return;
  }

  await notion("PATCH", `/pages/${pageId}`, { properties: limparEntradasEncomenda(null) });
  await ctx.scheduler.runAfter(0, internal.notion.sync.renderizar, { encomendaId, evento });
}

async function adotarLinha(
  ctx: ActionCtx,
  notion: NotionRequest,
  pageId: string,
  props: Props,
): Promise<void> {
  try {
    const nova = interpretarNovaLinha(props);
    const encomendaId = await ctx.runQuery(internal.notion.dados.encomendaPorPagina, {
      pageId: nova.encomendaPageId,
    });
    if (encomendaId === null) {
      throw new Error("a encomenda ligada não é reconhecida pela plataforma");
    }
    const linha = await ctx.runMutation(internal.encomendas.adicionarLinha, {
      encomendaId,
      ref: nova.ref,
      qty: nova.qty,
    });
    const anterior = await ctx.runMutation(internal.notion.dados.ligarLinha, {
      linhaId: linha._id,
      pageId,
    });
    if (anterior && anterior !== pageId) {
      // The SKU was revived from a dropped line that had its own row.
      await notion("PATCH", `/pages/${anterior}`, { archived: true });
    }
    await notion("PATCH", `/pages/${pageId}`, { properties: limparEntradasLinha(null) });
    await ctx.scheduler.runAfter(0, internal.notion.sync.renderizar, {
      encomendaId,
      evento: `Linha ${linha.ref} × ${linha.qty} adicionada pelo escritório`,
    });
  } catch (e) {
    await marcarErroLinha(notion, pageId, mensagem(e));
  }
}

async function processarLinha(
  ctx: ActionCtx,
  notion: NotionRequest,
  pageId: string,
  props: Props,
): Promise<void> {
  const ligacao = await ctx.runQuery(internal.notion.dados.linhaPorPagina, { pageId });
  if (ligacao === null) {
    if (ler.texto(props, LIN.convexId).length > 0) {
      await marcarErroLinha(notion, pageId, "linha desconhecida (Convex ID não corresponde)");
      return;
    }
    await adotarLinha(ctx, notion, pageId, props);
    return;
  }

  let evento: string;
  try {
    const comando = interpretarLinha(props);
    if (comando === null) return;
    const { linhaId } = ligacao;
    switch (comando.tipo) {
      case "confirmar": {
        const linha = await ctx.runMutation(internal.encomendas.confirmarLinha, {
          linhaId,
          custoCents: comando.custoCents,
        });
        evento = `Stock confirmado: ${linha.ref} × ${linha.qty}`;
        break;
      }
      case "retirar": {
        await ctx.runMutation(internal.encomendas.retirarLinha, { linhaId });
        evento = `Linha retirada: ${ler.texto(props, LIN.ref)}`;
        break;
      }
      case "alterar_qty": {
        const linha = await ctx.runMutation(internal.encomendas.alterarQtyLinha, {
          linhaId,
          qty: comando.qty,
        });
        evento = `Quantidade alterada: ${linha.ref} → ${linha.qty}`;
        break;
      }
      case "nao_disponivel":
        throw new Error(`a ação "${comando.acao}" ainda não está disponível nesta fase`);
    }
  } catch (e) {
    await marcarErroLinha(notion, pageId, mensagem(e));
    return;
  }

  await notion("PATCH", `/pages/${pageId}`, { properties: limparEntradasLinha(null) });
  await ctx.scheduler.runAfter(0, internal.notion.sync.renderizar, {
    encomendaId: ligacao.encomendaId,
    evento,
  });
}

export const processarPagina = internalAction({
  args: { pageId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notion = clienteDoAmbiente();
    if (!notion) return null;
    const bases = await ctx.runQuery(internal.notion.dados.bases, {});
    const pagina = await notion("GET", `/pages/${args.pageId}`);
    if (pagina.archived === true || pagina.in_trash === true) return null;
    const props = (pagina.properties as Props | undefined) ?? {};
    switch (baseDoParent(pagina.parent, bases)) {
      case "encomendas":
        await processarEncomenda(ctx, notion, args.pageId, props);
        break;
      case "linhas":
        await processarLinha(ctx, notion, args.pageId, props);
        break;
      default:
        // exceções (later slice), modelos, or a page that is not ours.
        break;
    }
    return null;
  },
});

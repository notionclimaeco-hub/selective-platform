import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  clienteDoAmbiente,
  listarTudo,
  NotionError,
  type Json,
  type NotionRequest,
} from "./cliente";
import {
  ENC,
  esquemaEncomendas,
  esquemaExcecoes,
  esquemaLinhas,
  esquemaModelos,
  LIN,
  MOD,
  MODELO_PADRAO,
  relacaoEncomendaDasLinhas,
  MODELO_PADRAO_ASSUNTO,
  MODELO_PADRAO_CORPO,
  NOME_BASE,
  opcoesEmFalta,
  type NotionBase,
} from "./esquema";
import { prop } from "./propriedades";
import { baseValidator } from "./dados";

/**
 * Creates (or upgrades) the four desk databases inside the `back-end` page.
 * Idempotent: finds existing databases by title or by stored id, adds any
 * property or select option missing from the current schema, never deletes
 * anything.
 *
 *   npx convex run notion/setup:configurar
 *
 * Automations cannot be created via API — see the checklist in the PR/README.
 */

type Base = { chave: NotionBase; databaseId: string; dataSourceId: string };
type Esquema = Record<string, Record<string, unknown>>;

function titulo(texto: string) {
  return [{ type: "text", text: { content: texto } }];
}

async function dataSourceDe(
  notion: NotionRequest,
  databaseId: string,
): Promise<string | null> {
  try {
    const db = await notion("GET", `/databases/${databaseId}`);
    const fontes = db.data_sources;
    const primeira = Array.isArray(fontes) ? (fontes[0] as { id?: unknown }) : null;
    return typeof primeira?.id === "string" ? primeira.id : null;
  } catch (e) {
    if (e instanceof NotionError && e.status === 404) return null;
    throw e;
  }
}

async function acrescentarPropriedadesEmFalta(
  notion: NotionRequest,
  dataSourceId: string,
  esquema: Esquema,
): Promise<Array<string>> {
  const atual = await notion("GET", `/data_sources/${dataSourceId}`);
  const propriedades = (atual.properties as Record<string, unknown>) ?? {};
  const existentes = new Set(Object.keys(propriedades));
  const emFalta: Esquema = {};
  for (const [nome, definicao] of Object.entries(esquema)) {
    if (!existentes.has(nome) && !("title" in definicao)) {
      emFalta[nome] = definicao;
    }
  }
  // New Estado / Ação values on selects that already exist.
  const opcoes = opcoesEmFalta(propriedades, esquema);
  const nomes = [
    ...Object.keys(emFalta),
    ...Object.keys(opcoes).map((nome) => `${nome} (opções)`),
  ];
  if (nomes.length > 0) {
    await notion("PATCH", `/data_sources/${dataSourceId}`, {
      properties: { ...emFalta, ...opcoes },
    });
  }
  return nomes;
}

async function garantirBase(
  notion: NotionRequest,
  pageId: string,
  chave: NotionBase,
  esquema: Esquema,
  conhecida: string | undefined,
): Promise<{ base: Base; criada: boolean; acrescentadas: Array<string> }> {
  let databaseId = conhecida;
  let dataSourceId = databaseId ? await dataSourceDe(notion, databaseId) : null;

  if (!databaseId || !dataSourceId) {
    const criada = await notion("POST", "/databases", {
      parent: { type: "page_id", page_id: pageId },
      title: titulo(NOME_BASE[chave]),
      initial_data_source: { properties: esquema },
    });
    databaseId = criada.id as string;
    dataSourceId = await dataSourceDe(notion, databaseId);
    if (!dataSourceId) {
      throw new Error(`Notion returned no data source for ${NOME_BASE[chave]}`);
    }
    return {
      base: { chave, databaseId, dataSourceId },
      criada: true,
      acrescentadas: [],
    };
  }

  const acrescentadas = await acrescentarPropriedadesEmFalta(
    notion,
    dataSourceId,
    esquema,
  );
  return { base: { chave, databaseId, dataSourceId }, criada: false, acrescentadas };
}

/** Older installs created `Encomenda` one-way; make it two-way (`Linhas` on the ticket). */
async function garantirRelacaoBidirecional(
  notion: NotionRequest,
  linhas: Base,
  encomendas: Base,
): Promise<boolean> {
  const atual = await notion("GET", `/data_sources/${linhas.dataSourceId}`);
  const props = (atual.properties as Record<string, Json> | undefined) ?? {};
  const relacao = props[LIN.encomenda]?.relation as { type?: unknown } | undefined;
  if (relacao?.type !== "single_property") return false;
  await notion("PATCH", `/data_sources/${linhas.dataSourceId}`, {
    properties: {
      [LIN.encomenda]: relacaoEncomendaDasLinhas(encomendas.dataSourceId),
    },
  });
  return true;
}

async function semearModeloPadrao(
  notion: NotionRequest,
  modelos: Base,
): Promise<boolean> {
  const existentes = await notion("POST", `/data_sources/${modelos.dataSourceId}/query`, {
    filter: { property: MOD.titulo, title: { equals: MODELO_PADRAO } },
    page_size: 1,
  });
  if (Array.isArray(existentes.results) && existentes.results.length > 0) {
    return false;
  }
  await notion("POST", "/pages", {
    parent: { type: "data_source_id", data_source_id: modelos.dataSourceId },
    properties: {
      [MOD.titulo]: prop.titulo(MODELO_PADRAO),
      [MOD.assunto]: prop.texto(MODELO_PADRAO_ASSUNTO),
      [MOD.corpo]: prop.texto(MODELO_PADRAO_CORPO),
    },
  });
  return true;
}

export const configurar = internalAction({
  args: {},
  returns: v.object({
    bases: v.array(baseValidator),
    criadas: v.array(v.string()),
    acrescentadas: v.array(v.string()),
    modeloPadraoCriado: v.boolean(),
  }),
  handler: async (ctx) => {
    const notion = clienteDoAmbiente();
    if (!notion) throw new Error("NOTION_API_KEY is not set");
    const pageId = process.env.NOTION_BACKEND_PAGE_ID;
    if (!pageId) throw new Error("NOTION_BACKEND_PAGE_ID is not set");

    // Databases already inside the page, by title (block id == database id).
    const filhos = await listarTudo(notion, "GET", `/blocks/${pageId}/children`, {}, 300);
    const porTitulo = new Map<string, string>();
    for (const bloco of filhos) {
      if (bloco.type === "child_database") {
        const t = (bloco.child_database as Json | undefined)?.title;
        if (typeof t === "string") porTitulo.set(t, bloco.id as string);
      }
    }
    const guardadas = new Map(
      (await ctx.runQuery(internal.notion.dados.bases, {})).map((b) => [
        b.chave,
        b.databaseId,
      ]),
    );
    const conhecida = (chave: NotionBase) =>
      guardadas.get(chave) ?? porTitulo.get(NOME_BASE[chave]);

    const criadas: Array<string> = [];
    const acrescentadas: Array<string> = [];
    const bases: Array<Base> = [];
    const regista = async (r: Awaited<ReturnType<typeof garantirBase>>) => {
      if (r.criada) criadas.push(NOME_BASE[r.base.chave]);
      acrescentadas.push(
        ...r.acrescentadas.map((p) => `${NOME_BASE[r.base.chave]}: ${p}`),
      );
      bases.push(r.base);
      await ctx.runMutation(internal.notion.dados.guardarBase, r.base);
      return r.base;
    };

    const encomendas = await regista(
      await garantirBase(notion, pageId, "encomendas", esquemaEncomendas(), conhecida("encomendas")),
    );
    const linhas = await regista(
      await garantirBase(
        notion,
        pageId,
        "linhas",
        esquemaLinhas(encomendas.dataSourceId),
        conhecida("linhas"),
      ),
    );
    if (await garantirRelacaoBidirecional(notion, linhas, encomendas)) {
      acrescentadas.push(`${NOME_BASE.encomendas}: ${ENC.linhas} (relação bidirecional)`);
    }
    await regista(
      await garantirBase(
        notion,
        pageId,
        "excecoes",
        esquemaExcecoes(encomendas.dataSourceId, linhas.dataSourceId),
        conhecida("excecoes"),
      ),
    );
    const modelos = await regista(
      await garantirBase(notion, pageId, "modelos", esquemaModelos(), conhecida("modelos")),
    );
    const modeloPadraoCriado = await semearModeloPadrao(notion, modelos);

    return { bases, criadas, acrescentadas, modeloPadraoCriado };
  },
});

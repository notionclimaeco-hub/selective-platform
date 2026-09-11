/**
 * Minimal Notion REST client for Convex actions (plain `fetch`, no SDK).
 * Pinned to API version 2025-09-03 (data-source model).
 */

export const NOTION_VERSION = "2025-09-03";
const BASE = "https://api.notion.com/v1";
const TENTATIVAS = 3;

export type Json = Record<string, unknown>;
export type Metodo = "GET" | "POST" | "PATCH" | "DELETE";
export type NotionRequest = (
  metodo: Metodo,
  caminho: string,
  corpo?: Json,
) => Promise<Json>;

export class NotionError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(`Notion ${status} ${codigo}: ${mensagem}`);
    this.name = "NotionError";
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function clienteNotion(token: string): NotionRequest {
  return async (metodo, caminho, corpo) => {
    let ultimo: unknown;
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
      const resposta = await fetch(`${BASE}${caminho}`, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
      if (resposta.ok) {
        return (await resposta.json()) as Json;
      }
      const texto = await resposta.text();
      let codigo = "unknown";
      let mensagem = texto;
      try {
        const json = JSON.parse(texto) as { code?: string; message?: string };
        codigo = json.code ?? codigo;
        mensagem = json.message ?? mensagem;
      } catch {
        // non-JSON error body
      }
      ultimo = new NotionError(resposta.status, codigo, mensagem);
      const transitorio =
        resposta.status === 429 || resposta.status >= 500;
      if (!transitorio || tentativa === TENTATIVAS) {
        throw ultimo;
      }
      const retryAfter = Number(resposta.headers.get("retry-after"));
      await esperar(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 500 * 2 ** (tentativa - 1),
      );
    }
    throw ultimo;
  };
}

export function clienteDoAmbiente(): NotionRequest | null {
  const token = process.env.NOTION_API_KEY;
  return token ? clienteNotion(token) : null;
}

/** Follow `next_cursor` on a list endpoint, up to `limite` items. */
export async function listarTudo(
  notion: NotionRequest,
  metodo: Metodo,
  caminho: string,
  corpo: Json,
  limite: number,
): Promise<Array<Json>> {
  const resultados: Array<Json> = [];
  let cursor: string | undefined;
  do {
    const pagina = await notion(
      metodo,
      metodo === "GET"
        ? `${caminho}${caminho.includes("?") ? "&" : "?"}page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`
        : caminho,
      metodo === "GET"
        ? undefined
        : { ...corpo, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    );
    const results = Array.isArray(pagina.results) ? (pagina.results as Array<Json>) : [];
    resultados.push(...results);
    cursor =
      pagina.has_more === true && typeof pagina.next_cursor === "string"
        ? pagina.next_cursor
        : undefined;
  } while (cursor && resultados.length < limite);
  return resultados.slice(0, limite);
}

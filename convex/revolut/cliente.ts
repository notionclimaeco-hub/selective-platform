/**
 * Thin Revolut Merchant API client (header versioning, bearer secret).
 * Production host by default — Pay by Bank has no sandbox; development runs
 * on the developer's own Revolut Business merchant account (#13 Fase 0).
 */

export const REVOLUT_API_VERSION = "2026-04-20";
const HOST_PADRAO = "https://merchant.revolut.com";

export type Json = Record<string, unknown>;
export type RevolutRequest = (metodo: "GET" | "POST", caminho: string, corpo?: Json) => Promise<Json>;

export class RevolutError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(`Revolut ${status} ${codigo}: ${mensagem}`);
    this.name = "RevolutError";
  }
}

export function clienteRevolut(segredo: string, host = HOST_PADRAO): RevolutRequest {
  return async (metodo, caminho, corpo) => {
    const resposta = await fetch(`${host}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${segredo}`,
        "Revolut-Api-Version": REVOLUT_API_VERSION,
        ...(corpo ? { "Content-Type": "application/json" } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await resposta.text();
    const dados: Json = texto.length > 0 ? (JSON.parse(texto) as Json) : {};
    if (!resposta.ok) {
      throw new RevolutError(
        resposta.status,
        typeof dados.code === "string" || typeof dados.code === "number"
          ? String(dados.code)
          : "erro",
        typeof dados.message === "string" ? dados.message : texto.slice(0, 200),
      );
    }
    return dados;
  };
}

/** Null when payments are not configured (the rest of the order flow keeps working). */
export function clienteRevolutDoAmbiente(): RevolutRequest | null {
  const segredo = process.env.REVOLUT_SECRET_KEY;
  if (!segredo) return null;
  return clienteRevolut(segredo, process.env.REVOLUT_API_HOST || HOST_PADRAO);
}

export type OrdemRevolut = { id: string; token: string; state: string };

function ordemDe(dados: Json): OrdemRevolut {
  if (typeof dados.id !== "string" || typeof dados.token !== "string") {
    throw new Error("Revolut order response without id/token");
  }
  return { id: dados.id, token: dados.token, state: String(dados.state ?? "") };
}

export async function criarOrdem(
  revolut: RevolutRequest,
  args: {
    amountCents: number;
    referencia: string;
    descricao: string;
    expiraApos: string;
    urlEncomenda?: string;
    email?: string;
  },
): Promise<OrdemRevolut> {
  return ordemDe(
    await revolut("POST", "/api/orders", {
      amount: args.amountCents,
      currency: "EUR",
      description: args.descricao,
      expire_pending_after: args.expiraApos,
      merchant_order_data: {
        reference: args.referencia,
        ...(args.urlEncomenda ? { url: args.urlEncomenda } : {}),
      },
      ...(args.email ? { customer: { email: args.email } } : {}),
    }),
  );
}

export async function obterOrdem(revolut: RevolutRequest, id: string): Promise<OrdemRevolut> {
  return ordemDe(await revolut("GET", `/api/orders/${id}`));
}

/** Idempotent: an already cancelled / failed order is not an error for us. */
export async function cancelarOrdem(revolut: RevolutRequest, id: string): Promise<string> {
  try {
    return ordemDe(await revolut("POST", `/api/orders/${id}/cancel`)).state;
  } catch (e) {
    if (e instanceof RevolutError && (e.status === 400 || e.status === 422)) {
      return (await obterOrdem(revolut, id)).state;
    }
    throw e;
  }
}

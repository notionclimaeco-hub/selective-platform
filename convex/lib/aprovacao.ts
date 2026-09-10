import type { Infer } from "convex/values";
import { estadoAprovacaoValidator } from "../schema";

export type EstadoAprovacao = Infer<typeof estadoAprovacaoValidator>;

/**
 * Staff-only transitions locked on #3. Any other pair is rejected.
 *
 *   pendente  → aprovada | rejeitada
 *   aprovada  → suspensa
 *   suspensa  → aprovada
 *   rejeitada → aprovada
 */
const TRANSICOES: Record<EstadoAprovacao, ReadonlyArray<EstadoAprovacao>> = {
  pendente: ["aprovada", "rejeitada"],
  aprovada: ["suspensa"],
  rejeitada: ["aprovada"],
  suspensa: ["aprovada"],
};

export function transicaoPermitida(
  de: EstadoAprovacao,
  para: EstadoAprovacao,
): boolean {
  return TRANSICOES[de].includes(para);
}

export function assertTransicao(
  de: EstadoAprovacao,
  para: EstadoAprovacao,
): void {
  if (!transicaoPermitida(de, para)) {
    throw new Error(
      `Invalid approval transition: ${de} → ${para}`,
    );
  }
}

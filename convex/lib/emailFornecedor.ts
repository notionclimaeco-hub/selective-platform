import { linhasRestantes, type EstadoLinha } from "./encomendaEstados";

/**
 * Stock-request email the office copies into its own mail client, one per
 * supplier brand (#82: nothing is sent to suppliers from the platform). One
 * fixed template in code; no editor.
 *
 * Placeholders: {{encomenda}} = ENC-n, {{marca}} = brand name, {{linhas}} =
 * where the reference/quantity table goes.
 */

export const MODELO_ASSUNTO = "Pedido de stock — {{encomenda}}";
export const MODELO_CORPO = [
  "Bom dia,",
  "Agradecemos confirmação de stock e prazo para os seguintes artigos {{marca}}:",
  "",
  "{{linhas}}",
  "",
  "Obrigado,",
  "Climaeco Selective",
].join("\n");

export type EmailFornecedor = { marca: string; assunto: string; corpo: string };

type Linha = { ref: string; nome: string; qty: number; marca: string; estadoLinha: EstadoLinha };

/** Display names when the `marcas` table has no row for the slug. */
const NOMES_MARCA: Record<string, string> = {
  mitsubishi: "Mitsubishi Electric",
  daikin: "Daikin",
  nipon: "Nipon",
  hisense: "Hisense",
  midea: "Midea",
};

export function nomeMarcaPadrao(slug: string): string {
  return NOMES_MARCA[slug] ?? (slug.charAt(0).toUpperCase() + slug.slice(1));
}

/** Reference / quantity list the supplier reads, one article per line. */
export function tabelaEmail(
  linhas: ReadonlyArray<Pick<Linha, "ref" | "nome" | "qty">>,
): string {
  return linhas.map((l) => `${l.ref} × ${l.qty} — ${l.nome}`).join("\n");
}

export function preencherModelo(dados: {
  encomenda: string;
  marca: string;
  linhas: string;
}): { assunto: string; corpo: string } {
  const subst = (texto: string) =>
    texto
      .replaceAll("{{encomenda}}", dados.encomenda)
      .replaceAll("{{marca}}", dados.marca)
      .replaceAll("{{linhas}}", dados.linhas);
  return { assunto: subst(MODELO_ASSUNTO), corpo: subst(MODELO_CORPO) };
}

/** One draft per brand that still has remaining lines, brands sorted by slug. */
export function emailsFornecedores(
  numero: number,
  linhas: ReadonlyArray<Linha>,
  nomeMarca: (slug: string) => string = nomeMarcaPadrao,
): Array<EmailFornecedor> {
  const restantes = linhasRestantes(linhas);
  const marcas = [...new Set(restantes.map((l) => l.marca))].sort();
  return marcas.map((slug) => ({
    marca: slug,
    ...preencherModelo({
      encomenda: `ENC-${numero}`,
      marca: nomeMarca(slug),
      linhas: tabelaEmail(restantes.filter((l) => l.marca === slug)),
    }),
  }));
}

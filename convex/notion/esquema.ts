import type { Doc } from "../_generated/dataModel";
import type { Infer } from "convex/values";
import type { notionBaseValidator } from "../schema";
import {
  linhasRestantes,
  prontaParaPagamento,
  type EstadoEncomenda,
  type MotivoCancelamento,
} from "../lib/encomendaEstados";
import { bloco, euros, ler, prop } from "./propriedades";

/**
 * The office desk contract (#12), amended on 2026-09-11 (no pró-forma).
 * Everything here is pure: database schemas, mirror renderers, the Estado
 * derivation and the interpretation of what the office typed.
 */

export type NotionBase = Infer<typeof notionBaseValidator>;

export const NOME_BASE: Record<NotionBase, string> = {
  encomendas: "db-encomendas-selectivedistribui",
  linhas: "db-linhas-selectivedistribui",
  excecoes: "db-excecoes-selectivedistribui",
  modelos: "db-modelos-selectivedistribui",
};

// --- property names (Portuguese, as the office sees them) --------------------

export const ENC = {
  titulo: "Encomenda",
  convexId: "Convex ID",
  numero: "Nº",
  empresa: "Empresa",
  nif: "NIF",
  estado: "Estado",
  total: "Total s/IVA (€)",
  marcas: "Marcas",
  submetida: "Submetida em",
  atualizada: "Atualizada em",
  linkPagamento: "Link pagamento",
  faturaRecibo: "Fatura-recibo",
  notasCredito: "Notas de crédito",
  acao: "Ação",
  motivo: "Motivo",
  erro: "Erro",
} as const;

export const LIN = {
  titulo: "Linha",
  encomenda: "Encomenda",
  convexId: "Convex ID",
  ref: "Ref",
  nome: "Nome",
  marca: "Marca",
  qty: "Qtd",
  preco: "Preço revenda (€)",
  estado: "Estado linha",
  custo: "Custo (€)",
  porEnviar: "Por enviar",
  emTransito: "Em trânsito",
  noArmazem: "No armazém",
  falhada: "Falhada",
  acao: "Ação",
  novaQty: "Nova qtd",
  guia: "Guia nº",
  qtyMovimento: "Qtd movimento",
  erro: "Erro",
} as const;

export const EXC = {
  titulo: "Exceção",
  tipo: "Tipo",
  encomenda: "Encomenda",
  linha: "Linha",
  descricao: "Descrição",
  resolvida: "Resolvida",
  convexId: "Convex ID",
} as const;

export const MOD = {
  titulo: "Modelo",
  assunto: "Assunto",
  corpo: "Corpo",
} as const;

export const MODELO_PADRAO = "default";

// --- select options ------------------------------------------------------------

export const ACAO_ENCOMENDA = {
  stockPedido: "Stock pedido",
  pedirPagamento: "Pedir pagamento",
  voltarAEditar: "Voltar a editar",
  cancelar: "Cancelar",
} as const;

export const ACAO_LINHA = {
  confirmar: "Confirmar stock",
  retirar: "Retirar",
  alterarQty: "Alterar qtd",
  registarGuia: "Registar guia",
  rececao: "Receção armazém",
  falhar: "Falhar qtd",
} as const;

export const ESTADO_DESK = {
  nova: "Nova — pedir stock",
  aConfirmar: "A confirmar stock",
  prontaACobrar: "Pronta a cobrar",
  aAguardarPagamento: "A aguardar pagamento",
  paga: "Paga — em curso",
  concluida: "Concluída",
  canceladaInstalador: "Cancelada (instalador)",
  canceladaEscritorio: "Cancelada (escritório)",
  canceladaPagamento: "Cancelada (pagamento expirado)",
  canceladaSemLinhas: "Cancelada (sem linhas)",
} as const;

export const ESTADO_LINHA_DESK = {
  por_confirmar: "Por confirmar",
  confirmada: "Confirmada",
  retirada: "Retirada",
} as const;

export const TIPO_EXCECAO = ["Reembolso", "Faturação", "Outro"] as const;

const CANCELADA_POR_MOTIVO: Record<MotivoCancelamento, string> = {
  installer: ESTADO_DESK.canceladaInstalador,
  office: ESTADO_DESK.canceladaEscritorio,
  payment_expired: ESTADO_DESK.canceladaPagamento,
  all_lines_dropped: ESTADO_DESK.canceladaSemLinhas,
};

const COR = {
  cinza: "gray",
  amarelo: "yellow",
  laranja: "orange",
  azul: "blue",
  verde: "green",
  vermelho: "red",
  roxo: "purple",
} as const;

// --- database schemas (for `POST /v1/databases` and schema upgrades) ------------

type Esquema = Record<string, Record<string, unknown>>;

const opcoes = (nomes: ReadonlyArray<string>, cor?: string) => ({
  options: nomes.map((name) => (cor ? { name, color: cor } : { name })),
});

export function esquemaEncomendas(): Esquema {
  return {
    [ENC.titulo]: { title: {} },
    [ENC.convexId]: { rich_text: {} },
    [ENC.numero]: { number: { format: "number" } },
    [ENC.empresa]: { rich_text: {} },
    [ENC.nif]: { rich_text: {} },
    [ENC.estado]: {
      select: {
        options: [
          { name: ESTADO_DESK.nova, color: COR.amarelo },
          { name: ESTADO_DESK.aConfirmar, color: COR.laranja },
          { name: ESTADO_DESK.prontaACobrar, color: COR.azul },
          { name: ESTADO_DESK.aAguardarPagamento, color: COR.roxo },
          { name: ESTADO_DESK.paga, color: COR.verde },
          { name: ESTADO_DESK.concluida, color: COR.cinza },
          { name: ESTADO_DESK.canceladaInstalador, color: COR.vermelho },
          { name: ESTADO_DESK.canceladaEscritorio, color: COR.vermelho },
          { name: ESTADO_DESK.canceladaPagamento, color: COR.vermelho },
          { name: ESTADO_DESK.canceladaSemLinhas, color: COR.vermelho },
        ],
      },
    },
    [ENC.total]: { number: { format: "euro" } },
    [ENC.marcas]: { multi_select: { options: [] } },
    [ENC.submetida]: { date: {} },
    [ENC.atualizada]: { date: {} },
    [ENC.linkPagamento]: { url: {} },
    [ENC.faturaRecibo]: { url: {} },
    [ENC.notasCredito]: { rich_text: {} },
    [ENC.acao]: { select: opcoes(Object.values(ACAO_ENCOMENDA)) },
    [ENC.motivo]: { rich_text: {} },
    [ENC.erro]: { rich_text: {} },
  };
}

export function esquemaLinhas(encomendasDataSourceId: string): Esquema {
  return {
    [LIN.titulo]: { title: {} },
    [LIN.encomenda]: {
      relation: {
        data_source_id: encomendasDataSourceId,
        single_property: {},
      },
    },
    [LIN.convexId]: { rich_text: {} },
    [LIN.ref]: { rich_text: {} },
    [LIN.nome]: { rich_text: {} },
    [LIN.marca]: { select: { options: [] } },
    [LIN.qty]: { number: { format: "number" } },
    [LIN.preco]: { number: { format: "euro" } },
    [LIN.estado]: {
      select: {
        options: [
          { name: ESTADO_LINHA_DESK.por_confirmar, color: COR.amarelo },
          { name: ESTADO_LINHA_DESK.confirmada, color: COR.verde },
          { name: ESTADO_LINHA_DESK.retirada, color: COR.cinza },
        ],
      },
    },
    [LIN.custo]: { number: { format: "euro" } },
    [LIN.porEnviar]: { number: { format: "number" } },
    [LIN.emTransito]: { number: { format: "number" } },
    [LIN.noArmazem]: { number: { format: "number" } },
    [LIN.falhada]: { number: { format: "number" } },
    [LIN.acao]: { select: opcoes(Object.values(ACAO_LINHA)) },
    [LIN.novaQty]: { number: { format: "number" } },
    [LIN.guia]: { rich_text: {} },
    [LIN.qtyMovimento]: { number: { format: "number" } },
    [LIN.erro]: { rich_text: {} },
  };
}

export function esquemaExcecoes(
  encomendasDataSourceId: string,
  linhasDataSourceId: string,
): Esquema {
  return {
    [EXC.titulo]: { title: {} },
    [EXC.tipo]: { select: opcoes(TIPO_EXCECAO) },
    [EXC.encomenda]: {
      relation: { data_source_id: encomendasDataSourceId, single_property: {} },
    },
    [EXC.linha]: {
      relation: { data_source_id: linhasDataSourceId, single_property: {} },
    },
    [EXC.descricao]: { rich_text: {} },
    [EXC.resolvida]: { checkbox: {} },
    [EXC.convexId]: { rich_text: {} },
  };
}

export function esquemaModelos(): Esquema {
  return {
    [MOD.titulo]: { title: {} },
    [MOD.assunto]: { rich_text: {} },
    [MOD.corpo]: { rich_text: {} },
  };
}

export const MODELO_PADRAO_ASSUNTO = "Pedido de stock — {{encomenda}}";
export const MODELO_PADRAO_CORPO = [
  "Bom dia,",
  "",
  "Agradecemos confirmação de stock e prazo para os seguintes artigos {{marca}}:",
  "",
  "{{linhas}}",
  "",
  "Referência interna: {{encomenda}}.",
  "",
  "Obrigado,",
  "Climaeco Selective",
].join("\n");

// --- Estado derivation ---------------------------------------------------------

type Linha = Pick<Doc<"installerOrderLines">, "estadoLinha">;

export function estadoDesk(
  encomenda: Pick<Doc<"installerOrders">, "estado" | "cancelReason">,
  linhas: ReadonlyArray<Linha>,
): string {
  const estado: EstadoEncomenda = encomenda.estado;
  switch (estado) {
    case "recebida":
      return ESTADO_DESK.nova;
    case "aguardando_stock":
      return prontaParaPagamento(estado, linhas)
        ? ESTADO_DESK.prontaACobrar
        : ESTADO_DESK.aConfirmar;
    case "aguardando_pagamento":
      return ESTADO_DESK.aAguardarPagamento;
    case "paga":
      return ESTADO_DESK.paga;
    case "concluida":
      return ESTADO_DESK.concluida;
    case "cancelada":
      return CANCELADA_POR_MOTIVO[encomenda.cancelReason ?? "office"];
  }
}

// --- mirrors -------------------------------------------------------------------

export function marcasDe(
  linhas: ReadonlyArray<Pick<Doc<"installerOrderLines">, "marca" | "estadoLinha">>,
): Array<string> {
  return [...new Set(linhasRestantes(linhas).map((l) => l.marca))].sort();
}

/** Every mirror field of the ticket. Inputs (Ação, Motivo, Erro) are not here. */
export function espelhoEncomenda(
  encomenda: Doc<"installerOrders">,
  linhas: ReadonlyArray<Doc<"installerOrderLines">>,
  empresa: Pick<Doc<"installerCompanies">, "nomeLegal" | "nif">,
  agora: number,
): Record<string, unknown> {
  return {
    [ENC.titulo]: prop.titulo(encomenda.titulo),
    [ENC.convexId]: prop.texto(encomenda._id),
    [ENC.numero]: prop.numero(encomenda.numero),
    [ENC.empresa]: prop.texto(empresa.nomeLegal),
    [ENC.nif]: prop.texto(empresa.nif),
    [ENC.estado]: prop.selecao(estadoDesk(encomenda, linhas)),
    [ENC.total]: prop.numero(euros(encomenda.totalRevendaCents)),
    [ENC.marcas]: prop.multiSelecao(marcasDe(linhas)),
    [ENC.submetida]: prop.data(encomenda.placedAt),
    [ENC.atualizada]: prop.data(agora),
  };
}

export function espelhoLinha(
  linha: Doc<"installerOrderLines">,
  encomendaPageId: string,
): Record<string, unknown> {
  return {
    [LIN.titulo]: prop.titulo(`${linha.ref} — ${linha.nome}`),
    [LIN.encomenda]: prop.relacao([encomendaPageId]),
    [LIN.convexId]: prop.texto(linha._id),
    [LIN.ref]: prop.texto(linha.ref),
    [LIN.nome]: prop.texto(linha.nome),
    [LIN.marca]: prop.selecao(linha.marca),
    [LIN.qty]: prop.numero(linha.qty),
    [LIN.preco]: prop.numero(euros(linha.precoRevendaCents)),
    [LIN.estado]: prop.selecao(ESTADO_LINHA_DESK[linha.estadoLinha]),
    [LIN.custo]: prop.numero(
      linha.custoCents === undefined ? null : euros(linha.custoCents),
    ),
    [LIN.porEnviar]: prop.numero(linha.qtyPorEnviar ?? null),
    [LIN.emTransito]: prop.numero(linha.qtyEmTransito ?? null),
    [LIN.noArmazem]: prop.numero(linha.qtyAguardaRecolha ?? null),
    [LIN.falhada]: prop.numero(linha.qtyFalhada ?? null),
  };
}

/** Clear the office inputs after an action was applied (or rejected). */
export function limparEntradasEncomenda(erro: string | null): Record<string, unknown> {
  return {
    [ENC.acao]: prop.selecao(null),
    [ENC.motivo]: prop.texto(""),
    [ENC.erro]: prop.texto(erro ?? ""),
  };
}

export function limparEntradasLinha(erro: string | null): Record<string, unknown> {
  return {
    [LIN.acao]: prop.selecao(null),
    [LIN.novaQty]: prop.numero(null),
    [LIN.guia]: prop.texto(""),
    [LIN.qtyMovimento]: prop.numero(null),
    [LIN.erro]: prop.texto(erro ?? ""),
  };
}

// --- supplier email drafts -------------------------------------------------------

export type Modelo = { assunto: string; corpo: string };

export function preencherModelo(
  modelo: Modelo,
  dados: { marca: string; encomenda: string; linhas: string },
): Modelo {
  const subst = (texto: string) =>
    texto
      .replaceAll("{{marca}}", dados.marca)
      .replaceAll("{{encomenda}}", dados.encomenda)
      .replaceAll("{{linhas}}", dados.linhas);
  return { assunto: subst(modelo.assunto), corpo: subst(modelo.corpo) };
}

export function linhasParaEmail(
  linhas: ReadonlyArray<Pick<Doc<"installerOrderLines">, "ref" | "nome" | "qty">>,
): string {
  return linhas.map((l) => `- ${l.ref} — ${l.nome} × ${l.qty}`).join("\n");
}

/** Page body at ticket creation: one draft per marca, then the event log. */
export function corpoInicial(
  encomenda: Pick<Doc<"installerOrders">, "titulo">,
  linhas: ReadonlyArray<Doc<"installerOrderLines">>,
  modelos: Map<string, Modelo>,
  nomeMarca: (slug: string) => string,
): Array<Record<string, unknown>> {
  const blocos: Array<Record<string, unknown>> = [
    bloco.h2("Emails aos fornecedores"),
  ];
  for (const marca of marcasDe(linhas)) {
    const daMarca = linhasRestantes(linhas).filter((l) => l.marca === marca);
    const modelo = modelos.get(marca) ?? modelos.get(MODELO_PADRAO);
    blocos.push(bloco.h3(nomeMarca(marca)));
    if (!modelo) {
      blocos.push(bloco.paragrafo(linhasParaEmail(daMarca)));
      continue;
    }
    const preenchido = preencherModelo(modelo, {
      marca: nomeMarca(marca),
      encomenda: encomenda.titulo,
      linhas: linhasParaEmail(daMarca),
    });
    blocos.push(bloco.paragrafo(`Assunto: ${preenchido.assunto}`));
    blocos.push(bloco.paragrafo(preenchido.corpo));
  }
  blocos.push(bloco.divisor(), bloco.h2("Registo"));
  return blocos;
}

export function linhaRegisto(agora: number, evento: string): Record<string, unknown> {
  const data = new Date(agora).toISOString().replace("T", " ").slice(0, 16);
  return bloco.paragrafo(`${data} — ${evento}`);
}

// --- interpretation of what the office typed -----------------------------------------

export type ComandoEncomenda =
  | { tipo: "stock_pedido" }
  | { tipo: "cancelar"; motivo: string }
  | { tipo: "nao_disponivel"; acao: string };

export type ComandoLinha =
  | { tipo: "confirmar"; custoCents: number | undefined }
  | { tipo: "retirar" }
  | { tipo: "alterar_qty"; qty: number }
  | { tipo: "nao_disponivel"; acao: string };

export type Props = Record<string, unknown>;

/** `null` means nothing to do (no Ação set). Throws on malformed inputs. */
export function interpretarEncomenda(props: Props): ComandoEncomenda | null {
  const acao = ler.selecao(props, ENC.acao);
  if (acao === null) return null;
  switch (acao) {
    case ACAO_ENCOMENDA.stockPedido:
      return { tipo: "stock_pedido" };
    case ACAO_ENCOMENDA.cancelar:
      return { tipo: "cancelar", motivo: ler.texto(props, ENC.motivo) };
    default:
      return { tipo: "nao_disponivel", acao };
  }
}

export function interpretarLinha(props: Props): ComandoLinha | null {
  const acao = ler.selecao(props, LIN.acao);
  if (acao === null) return null;
  switch (acao) {
    case ACAO_LINHA.confirmar: {
      const custo = ler.numero(props, LIN.custo);
      if (custo !== null && custo < 0) {
        throw new Error("Custo (€) não pode ser negativo");
      }
      return {
        tipo: "confirmar",
        custoCents: custo === null ? undefined : Math.round(custo * 100),
      };
    }
    case ACAO_LINHA.retirar:
      return { tipo: "retirar" };
    case ACAO_LINHA.alterarQty: {
      const qty = ler.numero(props, LIN.novaQty);
      if (qty === null || !Number.isInteger(qty) || qty < 1) {
        throw new Error("Preencha 'Nova qtd' com um inteiro ≥ 1");
      }
      return { tipo: "alterar_qty", qty };
    }
    default:
      return { tipo: "nao_disponivel", acao };
  }
}

/** A row the office added by hand: no Convex ID yet, `Ref` + `Qtd` typed. */
export function interpretarNovaLinha(
  props: Props,
): { ref: string; qty: number; encomendaPageId: string } {
  const ref = ler.texto(props, LIN.ref);
  const qty = ler.numero(props, LIN.qty);
  const relacao = ler.relacao(props, LIN.encomenda);
  if (relacao.length !== 1) {
    throw new Error("Ligue a linha a exatamente uma encomenda");
  }
  if (ref.length === 0) throw new Error("Preencha 'Ref'");
  if (qty === null || !Number.isInteger(qty) || qty < 1) {
    throw new Error("Preencha 'Qtd' com um inteiro ≥ 1");
  }
  return { ref, qty, encomendaPageId: relacao[0] as string };
}

/** Which of our databases a page belongs to, from its parent data source id. */
export function baseDoParent(
  parent: unknown,
  bases: ReadonlyArray<{ chave: NotionBase; dataSourceId: string; databaseId: string }>,
): NotionBase | null {
  if (typeof parent !== "object" || parent === null) return null;
  const p = parent as { data_source_id?: unknown; database_id?: unknown };
  const norm = (id: string) => id.replace(/-/g, "").toLowerCase();
  for (const base of bases) {
    if (
      (typeof p.data_source_id === "string" &&
        norm(p.data_source_id) === norm(base.dataSourceId)) ||
      (typeof p.database_id === "string" &&
        norm(p.database_id) === norm(base.databaseId))
    ) {
      return base.chave;
    }
  }
  return null;
}

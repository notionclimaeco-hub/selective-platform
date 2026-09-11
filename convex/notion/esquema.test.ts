import { describe, expect, it } from "vitest";
import type { Doc } from "../_generated/dataModel";
import {
  ACAO_ENCOMENDA,
  ACAO_LINHA,
  baseDoParent,
  corpoInicial,
  ENC,
  espelhoEncomenda,
  espelhoLinha,
  ESTADO_DESK,
  estadoDesk,
  interpretarEncomenda,
  interpretarLinha,
  interpretarNovaLinha,
  LIN,
  limparEntradasLinha,
  MODELO_PADRAO_CORPO,
  preencherModelo,
  tabelaLinhas,
} from "./esquema";
import { pageIdDoWebhook } from "./webhook";

type Linha = Doc<"installerOrderLines">;
type Encomenda = Doc<"installerOrders">;

const encomenda = (extra: Partial<Encomenda> = {}): Encomenda =>
  ({
    _id: "enc1" as Encomenda["_id"],
    _creationTime: 1,
    empresaId: "emp1" as Encomenda["empresaId"],
    clerkOrgId: "org_1",
    numero: 7,
    titulo: "ENC-7 — Clima Teste Lda",
    estado: "recebida",
    placedBy: "user_1",
    placedAt: Date.UTC(2026, 8, 11, 14, 0),
    totalRevendaCents: 12345,
    ivaPercent: 23,
    ...extra,
  }) as Encomenda;

const linha = (extra: Partial<Linha> = {}): Linha =>
  ({
    _id: "lin1" as Linha["_id"],
    _creationTime: 1,
    encomendaId: "enc1" as Linha["encomendaId"],
    ref: "HS-001",
    marca: "hisense",
    nome: "Split 9k",
    qty: 2,
    precoRevendaCents: 9000,
    pvpCents: 10000,
    estadoLinha: "por_confirmar",
    ...extra,
  }) as Linha;

const select = (name: string | null) => ({ select: name ? { name } : null });
const number = (n: number | null) => ({ number: n });
const text = (t: string) => ({ rich_text: t ? [{ plain_text: t }] : [] });
const relation = (ids: Array<string>) => ({ relation: ids.map((id) => ({ id })) });

describe("estadoDesk", () => {
  it("follows the header, refining aguardando_stock by line confirmation", () => {
    expect(estadoDesk(encomenda(), [linha()])).toBe(ESTADO_DESK.nova);
    expect(
      estadoDesk(encomenda({ estado: "aguardando_stock" }), [linha()]),
    ).toBe(ESTADO_DESK.aConfirmar);
    expect(
      estadoDesk(encomenda({ estado: "aguardando_stock" }), [
        linha({ estadoLinha: "confirmada" }),
        linha({ estadoLinha: "retirada" }),
      ]),
    ).toBe(ESTADO_DESK.prontaACobrar);
    expect(
      estadoDesk(encomenda({ estado: "cancelada", cancelReason: "installer" }), []),
    ).toBe(ESTADO_DESK.canceladaInstalador);
    expect(
      estadoDesk(
        encomenda({ estado: "cancelada", cancelReason: "all_lines_dropped" }),
        [],
      ),
    ).toBe(ESTADO_DESK.canceladaSemLinhas);
  });
});

describe("mirrors", () => {
  it("renders header mirrors in euros with remaining marcas only", () => {
    const props = espelhoEncomenda(
      encomenda(),
      [linha(), linha({ marca: "nipon", estadoLinha: "retirada" })],
      { nomeLegal: "Clima Teste Lda", nif: "509442013" },
      Date.UTC(2026, 8, 11, 15, 0),
    );
    expect(props[ENC.total]).toEqual({ number: 123.45 });
    expect(props[ENC.marcas]).toEqual({ multi_select: [{ name: "hisense" }] });
    expect(props[ENC.estado]).toEqual(select(ESTADO_DESK.nova));
    expect(props[ENC.convexId]).toEqual({
      rich_text: [{ type: "text", text: { content: "enc1" } }],
    });
    expect(props).not.toHaveProperty(ENC.acao);
  });

  it("renders line mirrors with the ticket relation and empty buckets before pay", () => {
    const props = espelhoLinha(linha({ custoCents: 7050 }), "page-enc");
    expect(props[LIN.encomenda]).toEqual({ relation: [{ id: "page-enc" }] });
    expect(props[LIN.preco]).toEqual({ number: 90 });
    expect(props[LIN.custo]).toEqual({ number: 70.5 });
    expect(props[LIN.porEnviar]).toEqual({ number: null });
    expect(props[LIN.estado]).toEqual(select("Por confirmar"));
  });

  it("clears inputs and writes the error text", () => {
    const limpo = limparEntradasLinha("x");
    expect(limpo[LIN.acao]).toEqual(select(null));
    expect(limpo[LIN.erro]).toEqual({
      rich_text: [{ type: "text", text: { content: "x" } }],
    });
  });
});

describe("supplier drafts", () => {
  it("fills placeholders", () => {
    const m = preencherModelo(
      { assunto: "Stock {{encomenda}}", corpo: MODELO_PADRAO_CORPO },
      { marca: "Hisense", encomenda: "ENC-7", linhas: "- HS-001 × 2" },
    );
    expect(m.assunto).toBe("Stock ENC-7");
    expect(m.corpo).toContain("artigos Hisense:");
    expect(m.corpo).toContain("- HS-001 × 2");
    expect(m.corpo).not.toContain("{{");
  });

  it("builds one draft per remaining marca, falling back to the default model", () => {
    const blocos = corpoInicial(
      encomenda(),
      [
        linha(),
        linha({ _id: "lin2" as Linha["_id"], ref: "NP-1", marca: "nipon", nome: "Suporte" }),
        linha({ _id: "lin3" as Linha["_id"], marca: "daikin", estadoLinha: "retirada" }),
      ],
      new Map([
        ["default", { assunto: "Pedido {{marca}}", corpo: "{{linhas}}" }],
        ["nipon", { assunto: "Nipon {{encomenda}}", corpo: "N: {{linhas}}" }],
      ]),
      (slug) => slug.toUpperCase(),
    );
    const texto = JSON.stringify(blocos);
    expect(texto).toContain("Assunto: Pedido HISENSE");
    expect(texto).toContain("Assunto: Nipon ENC-7");
    expect(texto).toContain("N: - NP-1 — Suporte × 2");
    // Dropped line: in the table (as Retirada) but no supplier draft.
    const rascunhos = JSON.stringify(blocos.filter((b) => b.type !== "table"));
    expect(rascunhos).not.toContain("DAIKIN");
    expect(texto).toContain("Registo");
  });

  it("lists every line in the table, dropped ones last", () => {
    const tabela = tabelaLinhas(
      [
        linha({ ref: "Z-1", estadoLinha: "retirada" }),
        linha({ ref: "B-1", custoCents: 1234 }),
        linha({ ref: "A-1", estadoLinha: "confirmada" }),
      ],
      (slug) => slug,
    );
    const linhasTabela = (tabela.table as { children: Array<{ table_row: { cells: Array<Array<{ text: { content: string } }>> } }> }).children;
    const refs = linhasTabela.slice(1).map((r) => r.table_row.cells[0]?.[0]?.text.content);
    expect(refs).toEqual(["A-1", "B-1", "Z-1"]);
    expect(linhasTabela[2]?.table_row.cells[5]?.[0]?.text.content).toBe("12.34 €");
    expect(linhasTabela[3]?.table_row.cells[6]?.[0]?.text.content).toBe("Retirada");
  });
});

describe("interpretation of office input", () => {
  it("header: nothing set → null; stock; cancel with motive; unavailable actions", () => {
    expect(interpretarEncomenda({ [ENC.acao]: select(null) })).toBeNull();
    expect(
      interpretarEncomenda({ [ENC.acao]: select(ACAO_ENCOMENDA.stockPedido) }),
    ).toEqual({ tipo: "stock_pedido" });
    expect(
      interpretarEncomenda({
        [ENC.acao]: select(ACAO_ENCOMENDA.cancelar),
        [ENC.motivo]: text("sem stock"),
      }),
    ).toEqual({ tipo: "cancelar", motivo: "sem stock" });
    expect(
      interpretarEncomenda({ [ENC.acao]: select(ACAO_ENCOMENDA.pedirPagamento) }),
    ).toEqual({ tipo: "nao_disponivel", acao: "Pedir pagamento" });
  });

  it("line: confirm converts euros to cents; qty change validates", () => {
    expect(
      interpretarLinha({
        [LIN.acao]: select(ACAO_LINHA.confirmar),
        [LIN.custo]: number(70.5),
      }),
    ).toEqual({ tipo: "confirmar", custoCents: 7050 });
    expect(
      interpretarLinha({ [LIN.acao]: select(ACAO_LINHA.confirmar) }),
    ).toEqual({ tipo: "confirmar", custoCents: undefined });
    expect(
      interpretarLinha({
        [LIN.acao]: select(ACAO_LINHA.alterarQty),
        [LIN.novaQty]: number(3),
      }),
    ).toEqual({ tipo: "alterar_qty", qty: 3 });
    expect(() =>
      interpretarLinha({
        [LIN.acao]: select(ACAO_LINHA.alterarQty),
        [LIN.novaQty]: number(0),
      }),
    ).toThrow(/Nova qtd/);
    expect(() =>
      interpretarLinha({
        [LIN.acao]: select(ACAO_LINHA.confirmar),
        [LIN.custo]: number(-1),
      }),
    ).toThrow(/negativo/);
    expect(interpretarLinha({ [LIN.acao]: select(ACAO_LINHA.registarGuia) })).toEqual({
      tipo: "nao_disponivel",
      acao: "Registar guia",
    });
  });

  it("new row: needs exactly one order, a ref and a qty", () => {
    expect(
      interpretarNovaLinha({
        [LIN.ref]: text(" HS-002 "),
        [LIN.qty]: number(1),
        [LIN.encomenda]: relation(["page-enc"]),
      }),
    ).toEqual({ ref: "HS-002", qty: 1, encomendaPageId: "page-enc" });
    expect(() =>
      interpretarNovaLinha({ [LIN.ref]: text("X"), [LIN.qty]: number(1) }),
    ).toThrow(/exatamente uma encomenda/);
    expect(() =>
      interpretarNovaLinha({
        [LIN.qty]: number(1),
        [LIN.encomenda]: relation(["p"]),
      }),
    ).toThrow(/Ref/);
  });
});

describe("routing", () => {
  const bases = [
    { chave: "encomendas" as const, databaseId: "db-enc", dataSourceId: "ds-enc" },
    { chave: "linhas" as const, databaseId: "dbl", dataSourceId: "1234abcd-0000-0000-0000-000000000000" },
  ];

  it("matches parents by data source or database id, ignoring dashes", () => {
    expect(baseDoParent({ data_source_id: "ds-enc" }, bases)).toBe("encomendas");
    expect(
      baseDoParent({ data_source_id: "1234ABCD000000000000000000000000" }, bases),
    ).toBe("linhas");
    expect(baseDoParent({ database_id: "db-enc" }, bases)).toBe("encomendas");
    expect(baseDoParent({ page_id: "x" }, bases)).toBeNull();
  });

  it("extracts the page id from automation and integration payloads", () => {
    expect(pageIdDoWebhook({ data: { object: "page", id: "p1" } })).toBe("p1");
    expect(pageIdDoWebhook({ entity: { id: "p2", type: "page" } })).toBe("p2");
    expect(pageIdDoWebhook({ data: { object: "database", id: "d" } })).toBeNull();
    expect(pageIdDoWebhook("nope")).toBeNull();
  });
});

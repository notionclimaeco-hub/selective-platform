import { describe, expect, it } from "vitest";
import { emailsFornecedores, nomeMarcaPadrao, preencherModelo } from "./emailFornecedor";

const linha = (extra: Partial<Parameters<typeof emailsFornecedores>[1][number]> = {}) => ({
  ref: "HS-001",
  nome: "Split 9k",
  qty: 2,
  marca: "hisense",
  estadoLinha: "por_confirmar" as const,
  ...extra,
});

describe("supplier stock-request email", () => {
  it("fills every placeholder, the table where {{linhas}} sits", () => {
    const m = preencherModelo({ encomenda: "ENC-7", marca: "Hisense", linhas: "HS-1 × 2 — Split" });
    expect(m.assunto).toBe("Pedido de stock — ENC-7");
    expect(m.corpo).toBe(
      [
        "Bom dia,",
        "Agradecemos confirmação de stock e prazo para os seguintes artigos Hisense:",
        "",
        "HS-1 × 2 — Split",
        "",
        "Obrigado,",
        "Climaeco Selective",
      ].join("\n"),
    );
  });

  it("builds one draft per remaining marca, without dropped lines", () => {
    const emails = emailsFornecedores(7, [
      linha(),
      linha({ ref: "NP-1", marca: "nipon", nome: "Suporte", qty: 1 }),
      linha({ ref: "HS-002", nome: "Split 12k", qty: 3, estadoLinha: "confirmada" }),
      linha({ ref: "DK-1", marca: "daikin", estadoLinha: "retirada" }),
    ]);
    expect(emails.map((e) => e.marca)).toEqual(["hisense", "nipon"]);
    expect(emails[0]?.assunto).toBe("Pedido de stock — ENC-7");
    expect(emails[0]?.corpo).toContain("artigos Hisense:");
    expect(emails[0]?.corpo).toContain("HS-001 × 2 — Split 9k\nHS-002 × 3 — Split 12k");
    expect(emails[1]?.corpo).toContain("NP-1 × 1 — Suporte");
    expect(emails[1]?.corpo).not.toContain("HS-001");
  });

  it("names brands from the caller, falling back to the built-in names", () => {
    expect(emailsFornecedores(1, [linha()], (s) => s.toUpperCase())[0]?.corpo).toContain(
      "artigos HISENSE:",
    );
    expect(nomeMarcaPadrao("mitsubishi")).toBe("Mitsubishi Electric");
    expect(nomeMarcaPadrao("fujitsu")).toBe("Fujitsu");
  });
});

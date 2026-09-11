import { describe, expect, it } from "vitest";
import {
  assertPodeCancelar,
  assertPodeEditarLinhas,
  assertPodePedirStock,
  assertQty,
  bucketsIniciais,
  bucketsValidos,
  estadoLinhaAposQty,
  linhasRestantes,
  podeCancelar,
  podeEditarLinhas,
  prontaParaPagamento,
  prontaParaConcluir,
  registarFalha,
  registarGuia,
  registarRecepcao,
  tituloEncomenda,
  totalRestanteCents,
  type EstadoEncomenda,
} from "./encomendaEstados";

const ESTADOS: Array<EstadoEncomenda> = [
  "recebida",
  "aguardando_stock",
  "aguardando_pagamento",
  "paga",
  "cancelada",
  "concluida",
];

describe("tituloEncomenda / assertQty", () => {
  it("formats ENC-n — company", () => {
    expect(tituloEncomenda(7, "Clima Teste Lda")).toBe(
      "ENC-7 — Clima Teste Lda",
    );
  });

  it("accepts 1..999 integers only", () => {
    expect(assertQty(1)).toBe(1);
    expect(assertQty(999)).toBe(999);
    for (const bad of [0, -1, 1.5, 1000, Number.NaN]) {
      expect(() => assertQty(bad)).toThrow(/qty/);
    }
  });
});

describe("header gates", () => {
  it("cancel is allowed only before paga", () => {
    for (const estado of ESTADOS) {
      const esperado =
        estado === "recebida" ||
        estado === "aguardando_stock" ||
        estado === "aguardando_pagamento";
      expect(podeCancelar(estado)).toBe(esperado);
    }
    expect(() => assertPodeCancelar("paga")).toThrow(/paga/);
    expect(() => assertPodeCancelar("cancelada")).toThrow(/cancelada/);
  });

  it("stock requested only from recebida", () => {
    expect(() => assertPodePedirStock("recebida")).not.toThrow();
    for (const estado of ESTADOS.filter((e) => e !== "recebida")) {
      expect(() => assertPodePedirStock(estado)).toThrow(estado);
    }
  });

  it("line edits only before the pró-forma", () => {
    for (const estado of ESTADOS) {
      const esperado = estado === "recebida" || estado === "aguardando_stock";
      expect(podeEditarLinhas(estado)).toBe(esperado);
    }
    expect(() => assertPodeEditarLinhas("aguardando_pagamento")).toThrow();
  });
});

describe("lines", () => {
  const confirmada = { estadoLinha: "confirmada" as const };
  const porConfirmar = { estadoLinha: "por_confirmar" as const };
  const retirada = { estadoLinha: "retirada" as const };

  it("remaining excludes retirada", () => {
    expect(linhasRestantes([confirmada, retirada, porConfirmar])).toEqual([
      confirmada,
      porConfirmar,
    ]);
  });

  it("total ignores dropped lines", () => {
    expect(
      totalRestanteCents([
        { estadoLinha: "confirmada", qty: 2, precoRevendaCents: 1000 },
        { estadoLinha: "retirada", qty: 5, precoRevendaCents: 99999 },
        { estadoLinha: "por_confirmar", qty: 1, precoRevendaCents: 500 },
      ]),
    ).toBe(2500);
  });

  it("emit pró-forma needs aguardando_stock, ≥1 remaining, all confirmed", () => {
    expect(prontaParaPagamento("aguardando_stock", [confirmada])).toBe(true);
    expect(
      prontaParaPagamento("aguardando_stock", [confirmada, retirada]),
    ).toBe(true);
    expect(
      prontaParaPagamento("aguardando_stock", [confirmada, porConfirmar]),
    ).toBe(false);
    expect(prontaParaPagamento("aguardando_stock", [retirada])).toBe(false);
    expect(prontaParaPagamento("aguardando_stock", [])).toBe(false);
    expect(prontaParaPagamento("recebida", [confirmada])).toBe(false);
  });

  it("qty change keeps confirmada on reduce, resets on increase", () => {
    expect(estadoLinhaAposQty("confirmada", 5, 3)).toBe("confirmada");
    expect(estadoLinhaAposQty("confirmada", 5, 5)).toBe("confirmada");
    expect(estadoLinhaAposQty("confirmada", 5, 6)).toBe("por_confirmar");
    expect(estadoLinhaAposQty("por_confirmar", 1, 1)).toBe("por_confirmar");
    expect(() => estadoLinhaAposQty("retirada", 1, 2)).toThrow(/dropped/);
  });
});

describe("post-pay qty buckets", () => {
  it("initialises everything as por enviar", () => {
    const b = bucketsIniciais(4);
    expect(b).toEqual({
      qtyPorEnviar: 4,
      qtyEmTransito: 0,
      qtyAguardaRecolha: 0,
      qtyFalhada: 0,
    });
    expect(bucketsValidos(b, 4)).toBe(true);
  });

  it("moves qty through guia → recepção and fail, keeping the invariant", () => {
    let b = bucketsIniciais(10);
    b = registarGuia(b, 3);
    b = registarGuia(b, 4); // two guias, same SKU
    expect(b.qtyEmTransito).toBe(7);
    b = registarRecepcao(b, 7);
    b = registarFalha(b, 3);
    expect(b).toEqual({
      qtyPorEnviar: 0,
      qtyEmTransito: 0,
      qtyAguardaRecolha: 7,
      qtyFalhada: 3,
    });
    expect(bucketsValidos(b, 10)).toBe(true);
  });

  it("rejects moves larger than the source bucket", () => {
    const b = bucketsIniciais(2);
    expect(() => registarGuia(b, 3)).toThrow(/guia/);
    expect(() => registarRecepcao(b, 1)).toThrow(/warehouse/);
    expect(() => registarFalha(b, 0)).toThrow(/fail/);
  });

  it("concluida when every remaining line is at the warehouse or failed", () => {
    const feita = {
      qtyPorEnviar: 0,
      qtyEmTransito: 0,
      qtyAguardaRecolha: 1,
      qtyFalhada: 1,
    };
    expect(
      prontaParaConcluir([
        { estadoLinha: "confirmada", qty: 2, buckets: feita },
        { estadoLinha: "retirada", qty: 9, buckets: null },
      ]),
    ).toBe(true);
    expect(
      prontaParaConcluir([
        { estadoLinha: "confirmada", qty: 2, buckets: feita },
        { estadoLinha: "confirmada", qty: 2, buckets: bucketsIniciais(2) },
      ]),
    ).toBe(false);
    expect(prontaParaConcluir([])).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  assertTransicao,
  transicaoPermitida,
  type EstadoAprovacao,
} from "./aprovacao";

const ESTADOS: EstadoAprovacao[] = [
  "pendente",
  "aprovada",
  "rejeitada",
  "suspensa",
];

const PERMITIDAS: Array<[EstadoAprovacao, EstadoAprovacao]> = [
  ["pendente", "aprovada"],
  ["pendente", "rejeitada"],
  ["aprovada", "suspensa"],
  ["suspensa", "aprovada"],
  ["rejeitada", "aprovada"],
];

describe("transicaoPermitida", () => {
  it("allows the locked staff transitions", () => {
    for (const [de, para] of PERMITIDAS) {
      expect(transicaoPermitida(de, para)).toBe(true);
    }
  });

  it("rejects every other pair, including no-ops", () => {
    const permitidas = new Set(PERMITIDAS.map(([de, para]) => `${de}→${para}`));
    for (const de of ESTADOS) {
      for (const para of ESTADOS) {
        if (permitidas.has(`${de}→${para}`)) continue;
        expect(transicaoPermitida(de, para)).toBe(false);
      }
    }
  });
});

describe("assertTransicao", () => {
  it("throws on a forbidden transition", () => {
    expect(() => assertTransicao("pendente", "suspensa")).toThrow(
      /pendente → suspensa/,
    );
    expect(() => assertTransicao("rejeitada", "pendente")).toThrow(
      /rejeitada → pendente/,
    );
  });

  it("does not throw on a locked transition", () => {
    expect(() => assertTransicao("pendente", "aprovada")).not.toThrow();
  });
});

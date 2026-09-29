// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ordenarParaFolha, resolverEscolhas } from "./escolhas.mjs";

const c = (_id: string, fonte: string, extra: Record<string, unknown> = {}) => ({ _id, fonte, ...extra });

describe("ordenarParaFolha", () => {
  it("numbers each photo with its cutout right after it, orphan cutouts last", () => {
    const folha = ordenarParaFolha([
      c("r1", "recorte", { origem: "s1" }),
      c("s1", "site"),
      c("w1", "web", { aviso: "marca de água" }),
      c("r9", "recorte"),
      c("r2", "recorte", { origem: "w1" }),
    ]);
    expect(folha.map((x) => [x.n, x._id])).toEqual([
      [1, "s1"], [2, "r1"], [3, "w1"], [4, "r2"], [5, "r9"],
    ]);
    // A cutout inherits its source's warning, so the sheet shows it.
    expect(folha.find((x) => x._id === "r2")).toMatchObject({ origemN: 3, aviso: "marca de água" });
  });
});

describe("resolverEscolhas", () => {
  const indice = {
    "g-a": [{ n: 1, _id: "s1", fonte: "site" }, { n: 2, _id: "r1", fonte: "recorte" }],
    "g-b": [{ n: 1, _id: "s2", fonte: "site" }],
  };

  it("maps tile numbers to candidate ids in pick order", () => {
    const { escolhas, avisos } = resolverEscolhas({ "g-a": [2, 1] }, indice);
    expect(escolhas).toEqual([{ grupoModelo: "g-a", candidatas: ["r1", "s1"] }]);
    // Picking a non-cutout is allowed but reported.
    expect(avisos).toEqual(["g-a: #1 não é recorte (site)"]);
  });

  it("skips empty picks and rejects unknown groups or numbers", () => {
    expect(resolverEscolhas({ "g-b": [] }, indice).escolhas).toEqual([]);
    expect(() => resolverEscolhas({ "g-x": [1] }, indice)).toThrow(/g-x/);
    expect(() => resolverEscolhas({ "g-a": [3] }, indice)).toThrow(/#3/);
    expect(() => resolverEscolhas({ "g-a": [1, 1] }, indice)).toThrow(/repetid/);
  });
});

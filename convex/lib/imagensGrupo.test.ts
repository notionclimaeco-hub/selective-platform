import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import {
  candidatasARemover,
  ficheirosEscolhidos,
  listaParaRef,
  validarPorRef,
} from "./imagensGrupo";

const f = (s: string) => s as Id<"_storage">;

describe("listaParaRef", () => {
  it("uses the ref override when present, else the group list", () => {
    const d = {
      imagens: [f("g1"), f("g2")],
      porRef: [{ ref: "A-PRETO", imagens: [f("p1")] }],
    };
    expect(listaParaRef(d, "A-PRETO")).toEqual([f("p1")]);
    expect(listaParaRef(d, "A-BRANCO")).toEqual([f("g1"), f("g2")]);
  });
});

describe("ficheirosEscolhidos", () => {
  it("unions the group list and every override; null decision is empty", () => {
    const d = { imagens: [f("g1")], porRef: [{ ref: "X", imagens: [f("p1"), f("g1")] }] };
    expect([...ficheirosEscolhidos(d)].sort()).toEqual(["g1", "p1"]);
    expect(ficheirosEscolhidos(null).size).toBe(0);
  });
});

describe("candidatasARemover", () => {
  it("keeps candidates whose file is in the kept set", () => {
    const c = [
      { _id: "c1", ficheiro: f("g1") },
      { _id: "c2", ficheiro: f("x") },
    ];
    expect(candidatasARemover(c, new Set([f("g1")])).map((x) => x._id)).toEqual(["c2"]);
  });
});

describe("validarPorRef", () => {
  it("rejects refs outside the group and duplicates", () => {
    const refs = new Set(["A", "B"]);
    expect(validarPorRef([{ ref: "A" }], refs)).toBeNull();
    expect(validarPorRef([{ ref: "Z" }], refs)).toMatch(/Z/);
    expect(validarPorRef([{ ref: "A" }, { ref: "A" }], refs)).toMatch(/repetida/);
  });
});

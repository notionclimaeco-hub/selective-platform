import { describe, expect, it } from "vitest";
import { FAMILIAS } from "../schema";
import {
  REGISTO_SPECS,
  chavesDaCategoria,
  heroSpecs,
  rotuloChave,
  validarAtributos,
} from "./specRegistry";

describe("REGISTO_SPECS", () => {
  it("covers every familia in the schema", () => {
    for (const familia of FAMILIAS) {
      expect(REGISTO_SPECS[familia], familia).toBeDefined();
    }
  });

  it("has exactly three ordered hero specs per familia", () => {
    for (const familia of FAMILIAS) {
      expect(heroSpecs(familia), familia).toHaveLength(3);
    }
    expect(heroSpecs("ar-condicionado")).toEqual([
      "frio-kw",
      "calor-kw",
      "classe-energetica",
    ]);
  });

  it("every hero key is a registered key of its familia", () => {
    for (const familia of FAMILIAS) {
      const chaves = new Set(REGISTO_SPECS[familia].chaves.map((c) => c.chave));
      for (const hero of heroSpecs(familia)) {
        expect(chaves.has(hero), `${familia}:${hero}`).toBe(true);
      }
    }
  });

  it("never registers the same key twice in a familia", () => {
    for (const familia of FAMILIAS) {
      const chaves = REGISTO_SPECS[familia].chaves.map((c) => c.chave);
      expect(new Set(chaves).size, familia).toBe(chaves.length);
    }
  });

  it("enum keys declare their values", () => {
    for (const familia of FAMILIAS) {
      for (const c of REGISTO_SPECS[familia].chaves) {
        if (c.tipo === "enum") {
          expect(c.valores?.length, `${familia}:${c.chave}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("filters keys by componente", () => {
    const ue = chavesDaCategoria("ar-condicionado", "unidade-exterior").map(
      (c) => c.chave,
    );
    expect(ue).toContain("unidades-max");
    expect(ue).not.toContain("dimensoes-ui");
    const ui = chavesDaCategoria("ar-condicionado", "unidade-interior").map(
      (c) => c.chave,
    );
    expect(ui).toContain("dimensoes-ui");
    expect(ui).not.toContain("unidades-max");
  });
});

describe("rotuloChave", () => {
  it("returns the Portuguese label with unit for registered keys", () => {
    expect(rotuloChave("frio-kw")).toBe("Frio (kW)");
    expect(rotuloChave("deposito-l")).toBe("Depósito (L)");
    expect(rotuloChave("classe-energetica")).toBe("Classe energética");
  });

  it("humanises unknown keys", () => {
    expect(rotuloChave("chave-nova")).toBe("Chave nova");
  });
});

describe("validarAtributos", () => {
  const ok = [
    { chave: "frio-kw", valor: "3.5" },
    { chave: "calor-kw", valor: "4.0" },
    { chave: "classe-energetica", valor: "A+++/A++" },
  ];

  it("accepts a well-formed conjunto", () => {
    expect(validarAtributos("ar-condicionado", "conjunto", ok)).toEqual({
      erros: [],
      avisos: [],
    });
  });

  it("rejects a number with a unit or comma decimal", () => {
    const r = validarAtributos("ar-condicionado", "conjunto", [
      ...ok.slice(1),
      { chave: "frio-kw", valor: "3,5 kW" },
    ]);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).toMatch(/frio-kw/);
    expect(r.erros[0]).toMatch(/3,5 kW/);
  });

  it("rejects a value outside an enum", () => {
    const r = validarAtributos("ar-condicionado", "conjunto", [
      ...ok,
      { chave: "wifi", valor: "yes" },
    ]);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).toMatch(/wifi/);
    expect(r.erros[0]).toMatch(/sim, opcional, nao/);
  });

  it("rejects a booleano that is not sim/nao", () => {
    const r = validarAtributos("acessorios-e-controlo", "acessorio", [
      { chave: "tipo", valor: "sonda" },
      { chave: "incluido", valor: "true" },
    ]);
    // "incluido" is not registered -> warning, not a type error.
    expect(r.erros).toEqual([]);
    expect(r.avisos.some((a) => a.includes("incluido"))).toBe(true);
  });

  it("rejects a classe-energetica that is not frio/calor", () => {
    const r = validarAtributos("ar-condicionado", "conjunto", [
      ...ok.slice(0, 2),
      { chave: "classe-energetica", valor: "A+++" },
    ]);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).toMatch(/classe-energetica/);
    const semLado = validarAtributos("ar-condicionado", "conjunto", [
      ...ok.slice(0, 2),
      { chave: "classe-energetica", valor: "A++/-" },
    ]);
    expect(semLado.erros).toEqual([]);
  });

  it("rejects dimensoes that are not AxLxP", () => {
    const r = validarAtributos("ar-condicionado", "conjunto", [
      ...ok,
      { chave: "dimensoes-ui", valor: "295 x 798 x 225 mm" },
    ]);
    expect(r.erros).toHaveLength(1);
    const bem = validarAtributos("ar-condicionado", "conjunto", [
      ...ok,
      { chave: "dimensoes-ui", valor: "295x798x225" },
    ]);
    expect(bem.erros).toEqual([]);
  });

  it("rejects compativel-com containing a semicolon", () => {
    const r = validarAtributos("ar-condicionado", "unidade-exterior", [
      { chave: "frio-kw", valor: "5.2" },
      { chave: "compativel-com", valor: "MSZ-AY25; MSZ-AY35" },
    ]);
    expect(r.erros).toHaveLength(1);
  });

  it("rejects a key listed twice", () => {
    const r = validarAtributos("ar-condicionado", "conjunto", [
      ...ok,
      { chave: "frio-kw", valor: "2.5" },
    ]);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).toMatch(/duplicad/);
  });

  it("warns on an unknown key", () => {
    const r = validarAtributos("ar-condicionado", "conjunto", [
      ...ok,
      { chave: "potencia-sonora", valor: "60" },
    ]);
    expect(r.erros).toEqual([]);
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0]).toMatch(/potencia-sonora/);
  });

  it("warns on a key that does not apply to the componente", () => {
    const r = validarAtributos("ar-condicionado", "unidade-interior", [
      { chave: "frio-kw", valor: "3.5" },
      { chave: "calor-kw", valor: "4.0" },
      { chave: "unidades-max", valor: "3" },
    ]);
    expect(r.erros).toEqual([]);
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0]).toMatch(/unidades-max/);
    expect(r.avisos[0]).toMatch(/unidade-interior/);
  });

  it("warns on a missing required key", () => {
    const r = validarAtributos("ar-condicionado", "conjunto", [
      { chave: "frio-kw", valor: "3.5" },
    ]);
    expect(r.erros).toEqual([]);
    expect(r.avisos).toHaveLength(2);
    expect(r.avisos.join("\n")).toMatch(/calor-kw/);
    expect(r.avisos.join("\n")).toMatch(/classe-energetica/);
  });

  it("does not require keys of other componentes", () => {
    // UE only requires frio-kw; classe-energetica is a conjunto requirement.
    const r = validarAtributos("ar-condicionado", "unidade-exterior", [
      { chave: "frio-kw", valor: "5.2" },
    ]);
    expect(r).toEqual({ erros: [], avisos: [] });
  });

  it("accessories carry no thermal requirements", () => {
    const r = validarAtributos("acessorios-e-controlo", "comando", [
      { chave: "tipo", valor: "comando-cabo" },
      { chave: "cor", valor: "branco" },
    ]);
    expect(r).toEqual({ erros: [], avisos: [] });
  });

  it("heat-pump indoor units carry their class, not their own kW", () => {
    const r = validarAtributos("bombas-de-calor", "unidade-interior", [
      { chave: "classe-kw", valor: "10" },
      { chave: "deposito-l", valor: "300" },
    ]);
    expect(r).toEqual({ erros: [], avisos: [] });
    const ue = validarAtributos("bombas-de-calor", "unidade-exterior", [
      { chave: "classe-kw", valor: "10" },
    ]);
    expect(ue.avisos.join("\n")).toMatch(/classe-kw: não se aplica/);
    expect(ue.avisos.join("\n")).toMatch(/calor-kw: obrigatório/);
  });

  it("solar kits need collectors, not a tank volume", () => {
    expect(
      validarAtributos("aqs", "conjunto", [{ chave: "coletores", valor: "3" }]),
    ).toEqual({ erros: [], avisos: [] });
    expect(validarAtributos("aqs", "deposito", []).avisos[0]).toMatch(/deposito-l/);
  });

  it("knows the Stylish panel colours and the AHU/fan coil axes", () => {
    expect(
      validarAtributos("ar-condicionado", "unidade-interior", [
        { chave: "frio-kw", valor: "2.0" },
        { chave: "calor-kw", valor: "2.5" },
        { chave: "cor", valor: "madeira-clara" },
      ]),
    ).toEqual({ erros: [], avisos: [] });
    expect(
      validarAtributos("ventilacao", "conjunto", [
        { chave: "caudal-m3h", valor: "325" },
        { chave: "zonas", valor: "2" },
        { chave: "controlo", valor: "humidade" },
        { chave: "orientacao", valor: "direita" },
        { chave: "tamanho", valor: "3" },
      ]),
    ).toEqual({ erros: [], avisos: [] });
    expect(
      validarAtributos("ventiloconvectores", "conjunto", [
        { chave: "frio-kw", valor: "2.6" },
        { chave: "calor-kw", valor: "3.5" },
        { chave: "valvula-3-vias", valor: "sim" },
      ]),
    ).toEqual({ erros: [], avisos: [] });
  });

  it("errors on an unknown familia", () => {
    const r = validarAtributos("frigorificos", "conjunto", ok);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).toMatch(/frigorificos/);
  });
});

describe("validarValor", () => {
  it("accepts only sim/nao for booleano keys", async () => {
    const { validarValor } = await import("./specRegistry");
    const def = {
      chave: "incluido",
      tipo: "booleano" as const,
      rotulo: "Incluído",
      obrigatorio: [],
      hero: false,
    };
    expect(validarValor(def, "sim")).toBeUndefined();
    expect(validarValor(def, "nao")).toBeUndefined();
    expect(validarValor(def, "true")).toMatch(/sim, nao/);
  });
});

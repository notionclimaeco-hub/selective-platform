import { describe, expect, it } from "vitest";
import { grupoModeloDeterministico, slugGama } from "./stagedSku";

describe("slugGama", () => {
  it("lowercases, strips accents and punctuation, collapses hyphens", () => {
    expect(slugGama("MSZ-EF Kirigamine Zen")).toBe("msz-ef-kirigamine-zen");
    expect(slugGama("M-Thermal Arctic")).toBe("m-thermal-arctic");
    expect(slugGama("Chão/Teto 1×1")).toBe("chao-teto-1-1");
    expect(slugGama("  Air  Master  ")).toBe("air-master");
  });
});

describe("grupoModeloDeterministico", () => {
  it("omits the componente for conjuntos", () => {
    expect(grupoModeloDeterministico("hisense", "Air Master", "conjunto")).toBe(
      "hisense-air-master",
    );
  });

  it("appends the componente otherwise", () => {
    expect(
      grupoModeloDeterministico("hisense", "Air Master", "unidade-interior"),
    ).toBe("hisense-air-master-unidade-interior");
    expect(grupoModeloDeterministico("daikin", "BRC1H", "comando")).toBe(
      "daikin-brc1h-comando",
    );
  });

  it("falls back to the ref slug when there is no gama", () => {
    expect(
      grupoModeloDeterministico("nipon", undefined, "acessorio", "NP-KIT/2"),
    ).toBe("nipon-np-kit-2-acessorio");
  });

  it("throws when neither gama nor ref is usable", () => {
    expect(() =>
      grupoModeloDeterministico("nipon", "   ", "conjunto", ""),
    ).toThrow(/gama/);
  });
});

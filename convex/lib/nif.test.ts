import { describe, expect, it } from "vitest";
import { normalizarNif, validarNif } from "./nif";

describe("normalizarNif", () => {
  it("strips spaces and hyphens", () => {
    expect(normalizarNif("509 442 013")).toBe("509442013");
    expect(normalizarNif("509-442-013")).toBe("509442013");
  });
});

describe("validarNif", () => {
  it("accepts NIFs whose check digit matches", () => {
    // 5×9 = 45; 45 % 11 = 1 → check 0
    expect(validarNif("500000000")).toBe(true);
    // sum 162; 162 % 11 = 8 → check 3
    expect(validarNif("509442013")).toBe(true);
    // person NIF: sum 156; 156 % 11 = 2 → check 9
    expect(validarNif("123456789")).toBe(true);
  });

  it("accepts NIFs formatted with spaces", () => {
    expect(validarNif("509 442 013")).toBe(true);
  });

  it("rejects wrong length, non-digits, and illegal first digits", () => {
    expect(validarNif("")).toBe(false);
    expect(validarNif("50944201")).toBe(false);
    expect(validarNif("5094420130")).toBe(false);
    expect(validarNif("50944201a")).toBe(false);
    expect(validarNif("409442013")).toBe(false);
    expect(validarNif("709442013")).toBe(false);
  });

  it("rejects a valid-looking NIF with a wrong check digit", () => {
    expect(validarNif("509442014")).toBe(false);
    expect(validarNif("509442012")).toBe(false);
    expect(validarNif("123456780")).toBe(false);
  });
});

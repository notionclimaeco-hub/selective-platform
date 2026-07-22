import { describe, it, expect } from "vitest";
import { parsePaginas, PDF_PAGINAS_REGEX } from "./paginas";

describe("parsePaginas", () => {
  it("parses a single page", () => {
    expect(parsePaginas("15")).toEqual([15]);
  });

  it("parses an inclusive range", () => {
    expect(parsePaginas("54-55")).toEqual([54, 55]);
    expect(parsePaginas("54-56")).toEqual([54, 55, 56]);
  });

  it("trims surrounding whitespace", () => {
    expect(parsePaginas("  15 ")).toEqual([15]);
  });

  it("normalizes a descending range to ascending", () => {
    expect(parsePaginas("56-54")).toEqual([54, 55, 56]);
  });

  it("returns [] for empty or invalid input", () => {
    expect(parsePaginas("")).toEqual([]);
    expect(parsePaginas("abc")).toEqual([]);
    expect(parsePaginas("12-")).toEqual([]);
    expect(parsePaginas("1-2-3")).toEqual([]);
  });
});

describe("PDF_PAGINAS_REGEX", () => {
  it("accepts single pages and ranges", () => {
    expect(PDF_PAGINAS_REGEX.test("15")).toBe(true);
    expect(PDF_PAGINAS_REGEX.test("54-55")).toBe(true);
  });

  it("rejects malformed values", () => {
    expect(PDF_PAGINAS_REGEX.test("")).toBe(false);
    expect(PDF_PAGINAS_REGEX.test("12-")).toBe(false);
    expect(PDF_PAGINAS_REGEX.test("p15")).toBe(false);
  });
});

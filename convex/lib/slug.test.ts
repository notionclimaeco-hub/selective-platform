import { describe, expect, it } from "vitest";
import { slugifyNome } from "./slug";

describe("slugifyNome", () => {
  it("lowercases, strips accents, and hyphenates", () => {
    expect(slugifyNome("Clima Eco Lda")).toBe("clima-eco-lda");
    expect(slugifyNome("Açaí & Frio, Lda.")).toBe("acai-frio-lda");
  });

  it("falls back when nothing usable remains", () => {
    expect(slugifyNome("@@@")).toBe("empresa");
    expect(slugifyNome("")).toBe("empresa");
  });

  it("truncates to 32 characters", () => {
    expect(slugifyNome("a".repeat(40)).length).toBe(32);
  });
});

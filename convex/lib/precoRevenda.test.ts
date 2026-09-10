import { describe, expect, it } from "vitest";
import { precoRevendaCents, tierPorVolume } from "./precoRevenda";

describe("precoRevendaCents", () => {
  it("returns PVP when the discount is 0% (missing matrix cell)", () => {
    expect(precoRevendaCents(89900, 0)).toBe(89900);
  });

  it("subtracts the percent and rounds to the nearest cent", () => {
    // 10% of 89900 = 80910
    expect(precoRevendaCents(89900, 10)).toBe(80910);
    // 12.5% of 10000 = 8750
    expect(precoRevendaCents(10000, 12.5)).toBe(8750);
    // 33% of 100 = 67 (66.00 would be 33% of 100? 100*0.67 = 67)
    expect(precoRevendaCents(100, 33)).toBe(67);
    // 1% of 1 cent rounds to 1 (0.99 → 1)
    expect(precoRevendaCents(1, 1)).toBe(1);
    // 50% of 1 cent rounds to 1 (0.5 → 1, banker's? Math.round(0.5)=1)
    expect(precoRevendaCents(1, 50)).toBe(1);
  });

  it("can reach 0 at 100%", () => {
    expect(precoRevendaCents(89900, 100)).toBe(0);
  });

  it("rejects negative inputs", () => {
    expect(() => precoRevendaCents(-1, 0)).toThrow(/pvpCents/);
    expect(() => precoRevendaCents(100, -1)).toThrow(/descontoPercent/);
  });
});

describe("tierPorVolume", () => {
  const tiers = [
    { slug: "base", limiarCents: 0 },
    { slug: "prata", limiarCents: 1_000_000 },
    { slug: "ouro", limiarCents: 5_000_000 },
  ];

  it("returns the highest tier whose threshold is met", () => {
    expect(tierPorVolume(tiers, 0)?.slug).toBe("base");
    expect(tierPorVolume(tiers, 999_999)?.slug).toBe("base");
    expect(tierPorVolume(tiers, 1_000_000)?.slug).toBe("prata");
    expect(tierPorVolume(tiers, 5_000_000)?.slug).toBe("ouro");
    expect(tierPorVolume(tiers, 9_000_000)?.slug).toBe("ouro");
  });

  it("returns null when there are no active tiers", () => {
    expect(tierPorVolume([], 0)).toBeNull();
  });
});

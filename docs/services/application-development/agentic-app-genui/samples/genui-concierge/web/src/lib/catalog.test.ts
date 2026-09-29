import { describe, expect, it } from "vitest";
import { CATEGORIES, UnknownProductError, isRegion, listProducts } from "./catalog";

describe("listProducts", () => {
  it("prices products in the regional currency", () => {
    const [kr] = listProducts({ region: "KR", ids: ["x-ultra"] });
    const [us] = listProducts({ region: "US", ids: ["x-ultra"] });
    const [de] = listProducts({ region: "DE", ids: ["x-ultra"] });

    expect(kr.currency).toBe("KRW");
    expect(us.currency).toBe("USD");
    expect(de.currency).toBe("EUR");
    expect(kr.priceLabel).toContain("₩");
    expect(us.priceLabel).toContain("$");
    expect(de.priceLabel).toContain("€");
  });

  it("filters by category", () => {
    const phones = listProducts({ region: "US", category: "phone" });
    expect(phones.length).toBeGreaterThanOrEqual(3);
    expect(phones.every((p) => p.category === "phone")).toBe(true);
  });

  it("returns ids in the requested order", () => {
    const ids = ["x-lite", "x-fold", "x-ultra"];
    expect(listProducts({ region: "KR", ids }).map((p) => p.id)).toEqual(ids);
  });

  it("rejects unknown product ids instead of inventing data", () => {
    expect(() => listProducts({ region: "KR", ids: ["x-ultra", "x-ghost"] })).toThrow(UnknownProductError);
    try {
      listProducts({ region: "KR", ids: ["x-ghost"] });
    } catch (error) {
      expect((error as UnknownProductError).ids).toEqual(["x-ghost"]);
    }
  });

  it("reports regional availability", () => {
    const [kr] = listProducts({ region: "KR", ids: ["x-flip"] });
    const [de] = listProducts({ region: "DE", ids: ["x-flip"] });
    expect(kr.inStock).toBe(true);
    expect(de.inStock).toBe(false);
  });

  it("covers every category used by the bundle catalog", () => {
    for (const category of CATEGORIES) {
      expect(listProducts({ region: "KR", category }).length).toBeGreaterThan(0);
    }
  });

  it("serves an app-owned product image for every product", () => {
    for (const product of listProducts({ region: "US" })) {
      expect(product.image).toBe(`/products/${product.id}.webp`);
    }
  });
});

// Each sample prompt in the pattern guide must resolve to a distinct, data-backed combination.
describe("sample prompt scenarios", () => {
  const phones = (region: "KR" | "US" | "DE") => listProducts({ region, category: "phone" });

  it("offers at least two phones under 1.5M KRW for the gift prompt", () => {
    expect(phones("KR").filter((p) => p.price <= 1_500_000).length).toBeGreaterThanOrEqual(2);
  });

  it("has a light compact phone for the spotlight prompt", () => {
    const [pro] = listProducts({ region: "KR", ids: ["x-pro"] });
    const lightest = [...phones("KR")].sort((a, b) => parseInt(a.specs.무게) - parseInt(b.specs.무게))[0];
    expect(lightest.id).toBe(pro.id);
  });

  it("shows regional availability for foldables in Germany", () => {
    const foldables = listProducts({ region: "DE", ids: ["x-fold", "x-flip"] });
    expect(foldables.map((p) => p.inStock)).toEqual([true, false]);
  });

  it("fits a studio TV, fridge and washer within a 3M KRW budget", () => {
    const studio = listProducts({ region: "KR", ids: ["tv-qled-43", "fridge-compact", "washer-compact-12"] });
    expect(studio.reduce((sum, p) => sum + p.price, 0)).toBeLessThanOrEqual(3_000_000);
  });

  it("covers the seasonal and parents' home bundles", () => {
    for (const category of ["aircon", "dehumidifier", "purifier", "vacuum", "dryer"] as const) {
      expect(listProducts({ region: "KR", category }).length, category).toBeGreaterThan(0);
    }
  });
});

describe("isRegion", () => {
  it("accepts supported regions only", () => {
    expect(isRegion("DE")).toBe(true);
    expect(isRegion("de")).toBe(false);
    expect(isRegion(42)).toBe(false);
  });
});

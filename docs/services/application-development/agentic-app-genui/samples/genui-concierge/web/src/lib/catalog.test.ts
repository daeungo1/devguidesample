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

describe("isRegion", () => {
  it("accepts supported regions only", () => {
    expect(isRegion("DE")).toBe(true);
    expect(isRegion("de")).toBe(false);
    expect(isRegion(42)).toBe(false);
  });
});

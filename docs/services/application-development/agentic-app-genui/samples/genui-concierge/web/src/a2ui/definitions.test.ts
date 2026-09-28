import { describe, expect, it } from "vitest";
import { bundleDefinitions } from "./definitions";

const FORBIDDEN = /price|cost|currency|stock|amount|total/i;

describe("Contoso bundle catalog definitions", () => {
  it("describes every component so the model can choose it", () => {
    for (const [name, def] of Object.entries(bundleDefinitions)) {
      expect(def.description.length, name).toBeGreaterThan(20);
    }
  });

  it("never lets the model supply prices, currency or stock", () => {
    for (const [name, def] of Object.entries(bundleDefinitions)) {
      const offending = Object.keys(def.props.shape).filter((key) => FORBIDDEN.test(key));
      expect(offending, name).toEqual([]);
    }
  });

  it("requires product ids for product-bearing components", () => {
    expect(bundleDefinitions.ProductTile.props.safeParse({ reason: "fits" }).success).toBe(false);
    expect(bundleDefinitions.ProductTile.props.safeParse({ productId: "tv-qled-65" }).success).toBe(true);
    expect(bundleDefinitions.BundleSummary.props.safeParse({ productIds: ["tv-qled-65"] }).success).toBe(true);
  });

  it("accepts data-model bindings for text props", () => {
    const parsed = bundleDefinitions.BundleHeader.props.safeParse({ title: { path: "/title" } });
    expect(parsed.success).toBe(true);
  });
});

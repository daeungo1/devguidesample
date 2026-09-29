import { describe, expect, it } from "vitest";
import { phoneComparisonSchema } from "./phone-comparison";
import { productSpotlightSchema } from "./product-spotlight";

const FORBIDDEN = /price|cost|currency|stock|amount|total|image/i;
const SCHEMAS = { show_phone_comparison: phoneComparisonSchema, show_product_spotlight: productSpotlightSchema };

describe("Controlled component contracts", () => {
  it("never lets the model supply prices, stock or image URLs", () => {
    for (const [name, schema] of Object.entries(SCHEMAS)) {
      const offending = Object.keys(schema.shape).filter((key) => FORBIDDEN.test(key));
      expect(offending, name).toEqual([]);
    }
  });

  it("compares two to four phones", () => {
    expect(phoneComparisonSchema.safeParse({ productIds: ["x-pro"] }).success).toBe(false);
    expect(phoneComparisonSchema.safeParse({ productIds: ["x-pro", "x-flip"] }).success).toBe(true);
  });

  it("spotlights exactly one product with at most three reasons", () => {
    expect(productSpotlightSchema.safeParse({ reasons: ["가벼움"] }).success).toBe(false);
    expect(productSpotlightSchema.safeParse({ productId: "x-pro", reasons: ["168g", "3배 줌"] }).success).toBe(true);
    expect(productSpotlightSchema.safeParse({ productId: "x-pro", reasons: ["a", "b", "c", "d"] }).success).toBe(false);
  });
});

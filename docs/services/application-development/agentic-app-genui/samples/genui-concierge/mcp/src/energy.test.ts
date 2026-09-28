import { describe, expect, it } from "vitest";
import { APPLIANCES, getHousehold, isRegion, simulateSavings } from "./energy.js";

describe("getHousehold", () => {
  it("returns every appliance with the regional tariff and currency", () => {
    const kr = getHousehold("KR");
    expect(kr.currency).toBe("KRW");
    expect(kr.appliances.map((a) => a.id)).toEqual(APPLIANCES.map((a) => a.id));

    expect(getHousehold("US").currency).toBe("USD");
    expect(getHousehold("DE").currency).toBe("EUR");
  });
});

describe("isRegion", () => {
  it("accepts only supported regions", () => {
    expect(isRegion("KR")).toBe(true);
    expect(isRegion("JP")).toBe(false);
    expect(isRegion(undefined)).toBe(false);
  });
});

describe("simulateSavings", () => {
  it("saves nothing at eco level 0", () => {
    const result = simulateSavings("KR", 0);
    expect(result.savedKwh).toBe(0);
    expect(result.savedCost).toBe(0);
    expect(result.afterKwh).toBe(result.beforeKwh);
  });

  it("never saves more than each appliance's maximum at eco level 100", () => {
    const result = simulateSavings("US", 100);
    for (const appliance of APPLIANCES) {
      const row = result.perAppliance.find((p) => p.id === appliance.id)!;
      const expected = appliance.monthlyKwh * (1 - appliance.maxSavingRatio);
      expect(row.afterKwh).toBeCloseTo(expected, 1);
    }
    expect(result.savedKwh).toBeGreaterThan(0);
    expect(result.savedKwh).toBeLessThan(result.beforeKwh);
  });

  it("scales savings linearly with the eco level", () => {
    const half = simulateSavings("DE", 50);
    const full = simulateSavings("DE", 100);
    expect(half.savedKwh).toBeCloseTo(full.savedKwh / 2, 0);
  });

  it("prices savings in the regional currency", () => {
    const kr = simulateSavings("KR", 100);
    expect(kr.currency).toBe("KRW");
    expect(Number.isInteger(kr.savedCost)).toBe(true);

    const us = simulateSavings("US", 100);
    expect(us.currency).toBe("USD");
    expect(us.savedCost).toBeCloseTo(us.savedKwh * getHousehold("US").tariffPerKwh, 1);
  });

  it("rejects eco levels outside 0-100", () => {
    expect(() => simulateSavings("KR", -1)).toThrow(RangeError);
    expect(() => simulateSavings("KR", 101)).toThrow(RangeError);
    expect(() => simulateSavings("KR", Number.NaN)).toThrow(RangeError);
  });
});

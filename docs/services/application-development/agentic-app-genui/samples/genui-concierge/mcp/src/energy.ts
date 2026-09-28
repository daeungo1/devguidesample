/**
 * Illustrative household energy model for the Contoso Energy demo.
 * Consumption, tariffs and saving ratios are fictional sample values.
 */

export type Region = "KR" | "US" | "DE";
export type Currency = "KRW" | "USD" | "EUR";
export type ApplianceId = "fridge" | "washer" | "dryer" | "aircon" | "tv";

export interface Appliance {
  id: ApplianceId;
  name: string;
  monthlyKwh: number;
  /** Upper bound of the reduction AI eco mode can reach for this appliance. */
  maxSavingRatio: number;
}

export interface Household {
  region: Region;
  currency: Currency;
  tariffPerKwh: number;
  appliances: Appliance[];
}

export interface SavingsResult {
  region: Region;
  ecoLevel: number;
  currency: Currency;
  beforeKwh: number;
  afterKwh: number;
  savedKwh: number;
  savedCost: number;
  perAppliance: { id: ApplianceId; name: string; beforeKwh: number; afterKwh: number }[];
}

export const APPLIANCES: readonly Appliance[] = [
  { id: "fridge", name: "Contoso 스마트 냉장고", monthlyKwh: 38, maxSavingRatio: 0.15 },
  { id: "washer", name: "Contoso AI 세탁기", monthlyKwh: 22, maxSavingRatio: 0.3 },
  { id: "dryer", name: "Contoso 히트펌프 건조기", monthlyKwh: 48, maxSavingRatio: 0.25 },
  { id: "aircon", name: "Contoso 무풍 에어컨", monthlyKwh: 165, maxSavingRatio: 0.35 },
  { id: "tv", name: "Contoso 4K QLED TV", monthlyKwh: 26, maxSavingRatio: 0.2 },
];

const TARIFFS: Record<Region, { currency: Currency; tariffPerKwh: number }> = {
  KR: { currency: "KRW", tariffPerKwh: 160 },
  US: { currency: "USD", tariffPerKwh: 0.17 },
  DE: { currency: "EUR", tariffPerKwh: 0.39 },
};

export function isRegion(value: unknown): value is Region {
  return typeof value === "string" && value in TARIFFS;
}

export function getHousehold(region: Region): Household {
  const { currency, tariffPerKwh } = TARIFFS[region];
  return { region, currency, tariffPerKwh, appliances: APPLIANCES.map((a) => ({ ...a })) };
}

const roundKwh = (value: number) => Math.round(value * 10) / 10;

function roundCost(value: number, currency: Currency): number {
  return currency === "KRW" ? Math.round(value) : Math.round(value * 100) / 100;
}

export function simulateSavings(region: Region, ecoLevel: number): SavingsResult {
  if (!Number.isFinite(ecoLevel) || ecoLevel < 0 || ecoLevel > 100) {
    throw new RangeError(`ecoLevel must be between 0 and 100, received ${ecoLevel}`);
  }
  const household = getHousehold(region);
  const intensity = ecoLevel / 100;

  const perAppliance = household.appliances.map((appliance) => ({
    id: appliance.id,
    name: appliance.name,
    beforeKwh: appliance.monthlyKwh,
    afterKwh: roundKwh(appliance.monthlyKwh * (1 - appliance.maxSavingRatio * intensity)),
  }));

  const beforeKwh = roundKwh(perAppliance.reduce((sum, row) => sum + row.beforeKwh, 0));
  const afterKwh = roundKwh(perAppliance.reduce((sum, row) => sum + row.afterKwh, 0));
  const savedKwh = roundKwh(beforeKwh - afterKwh);

  return {
    region,
    ecoLevel,
    currency: household.currency,
    beforeKwh,
    afterKwh,
    savedKwh,
    savedCost: roundCost(savedKwh * household.tariffPerKwh, household.currency),
    perAppliance,
  };
}

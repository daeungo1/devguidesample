"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { PricedProduct, Region } from "./catalog";

export const REGIONS: { id: Region; label: string }[] = [
  { id: "KR", label: "대한민국 · KRW" },
  { id: "US", label: "United States · USD" },
  { id: "DE", label: "Deutschland · EUR" },
];

const RegionContext = createContext<Region>("KR");
export const RegionProvider = RegionContext.Provider;
export const useRegion = () => useContext(RegionContext);

export type CatalogState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; products: PricedProduct[] };

export async function fetchCatalog(region: Region, ids: string[]): Promise<PricedProduct[]> {
  const params = new URLSearchParams({ region, ids: ids.join(",") });
  const response = await fetch(`/api/catalog?${params}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Catalog request failed (${response.status})`);
  return body.products as PricedProduct[];
}

/**
 * Loads authoritative product facts; components never trust prices from model output.
 * Tool arguments stream in fragments, so ids are only fetched once they stop changing.
 */
export function useCatalog(ids: string[] | undefined, region: Region, settleMs = 350): CatalogState {
  const key = (ids ?? []).join(",");
  const [state, setState] = useState<CatalogState>({ status: "loading" });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setState({ status: "loading" });
    const timer = setTimeout(() => {
      fetchCatalog(region, key.split(","))
        .then((products) => !cancelled && setState({ status: "ready", products }))
        .catch((error: Error) => !cancelled && setState({ status: "error", message: error.message }));
    }, settleMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, region, settleMs]);

  return key ? state : { status: "loading" };
}

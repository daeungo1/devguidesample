"use client";

import { z } from "zod";
import { fetchCatalog } from "./region";

/**
 * Host-side bridges for Fully Open UIs. Agent-authored HTML runs in a sandbox
 * without network access to our API, so product facts flow through here.
 */
export const sandboxFunctions = [
  {
    name: "get_catalog_facts",
    description:
      "Returns authoritative Contoso product facts (name, regional price label, energy grade, stock). " +
      "Call it from generated UI instead of hard-coding prices: " +
      "await Websandbox.connection.remote.get_catalog_facts({ productIds: ['fridge-4door'], region: 'KR' })",
    parameters: z.object({
      productIds: z.array(z.string()).min(1).max(8),
      region: z.enum(["KR", "US", "DE"]),
    }),
    handler: async ({ productIds, region }: { productIds: string[]; region: "KR" | "US" | "DE" }) => {
      try {
        const products = await fetchCatalog(region, productIds);
        return {
          ok: true,
          products: products.map((p) => ({
            id: p.id,
            name: p.name,
            priceLabel: p.priceLabel,
            price: p.price,
            currency: p.currency,
            energyGrade: p.energyGrade ?? null,
            inStock: p.inStock,
          })),
        };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  },
];

export const DESIGN_SKILL = `Design generated UIs for Contoso Electronics:
- Clean product-brand look: white or near-black background, teal accent #0f766e, rounded 12px cards, system font.
- Explain one idea interactively (slider, toggle or step-through). Keep it to one screen with no scrolling.
- Label every number with its unit. Show a caption that values are illustrative unless they came from get_catalog_facts.
- Text in the user's language. Make controls keyboard-accessible with visible focus.`;

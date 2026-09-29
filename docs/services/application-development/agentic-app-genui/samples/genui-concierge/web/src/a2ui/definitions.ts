import { z } from "zod";
import type { CatalogDefinitions } from "@copilotkit/a2ui-renderer";

/** Literal or data-model binding: the A2UI binder resolves `{ path }` before rendering. */
const DynString = z.union([z.string(), z.object({ path: z.string() })]);

const RegionProp = z.enum(["KR", "US", "DE"]).optional();

/**
 * Contoso home-bundle catalog. The agent composes these blocks freely, but
 * product facts are fetched by id inside the renderers, so no definition
 * exposes a price, currency or stock prop to the model.
 */
export const bundleDefinitions = {
  BundleHeader: {
    description:
      "Title block for a home-appliance bundle. Use once at the top. `subtitle` summarises the household (size, family, budget).",
    props: z.object({ title: DynString, subtitle: DynString.optional() }),
  },
  ProductTile: {
    description:
      "One Contoso product in the bundle. Pass a product id from lookup_catalog and a one-line reason it fits this household. The tile loads name, price and energy grade itself. Place tiles in a Row, two per Row. Set `region` only when the user asked for another region.",
    props: z.object({ productId: z.string(), reason: DynString.optional(), region: RegionProp }),
  },
  BundleSummary: {
    description:
      "Totals card for the bundle. Pass every product id in the bundle; it computes the regional total. Optionally pass the customer's budget as text, and `region` when the user asked for another region.",
    props: z.object({ productIds: z.array(z.string()), budgetLabel: DynString.optional(), region: RegionProp }),
  },
  EnergyNote: {
    description: "A short energy-efficiency note for the bundle, such as expected savings from AI eco mode.",
    props: z.object({ text: DynString }),
  },
  TipList: {
    description: "A short list of setup or usage tips (2-4 items) for the household.",
    props: z.object({ title: DynString.optional(), items: z.array(z.string()) }),
  },
} satisfies CatalogDefinitions;

export type BundleDefinitions = typeof bundleDefinitions;
export const BUNDLE_CATALOG_ID = "contoso-home-bundle";

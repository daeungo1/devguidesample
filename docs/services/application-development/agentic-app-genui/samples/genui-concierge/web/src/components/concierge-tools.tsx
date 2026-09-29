"use client";

import { useAgentContext, useComponent } from "@copilotkit/react-core/v2";
import { PhoneComparison, phoneComparisonSchema } from "./phone-comparison";
import { ProductSpotlight, productSpotlightSchema } from "./product-spotlight";
import type { Region } from "@/lib/catalog";

/** Registers the Controlled components as frontend tools and shares the customer's region. */
export function ConciergeTools({ region }: { region: Region }) {
  useAgentContext({
    description: "Customer region. Pass it as `region` to every tool.",
    value: region,
  });

  useComponent({
    name: "show_phone_comparison",
    description:
      "Shows Contoso's pre-built smartphone comparison card. Pass 2-4 phone product ids from lookup_catalog.",
    parameters: phoneComparisonSchema,
    render: PhoneComparison,
    // The card is the answer; skipping the follow-up run keeps it from being rendered twice.
    followUp: false,
  });

  useComponent({
    name: "show_product_spotlight",
    description:
      "Shows Contoso's pre-built detail card for ONE product of any category. Pass a product id from lookup_catalog and up to three short fit reasons.",
    parameters: productSpotlightSchema,
    render: ProductSpotlight,
    followUp: false,
  });

  return null;
}

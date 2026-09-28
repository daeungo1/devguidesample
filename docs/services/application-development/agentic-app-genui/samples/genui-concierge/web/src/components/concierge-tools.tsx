"use client";

import { useAgentContext, useComponent } from "@copilotkit/react-core/v2";
import { PhoneComparison, phoneComparisonSchema } from "./phone-comparison";
import type { Region } from "@/lib/catalog";

/** Registers the Controlled component as a frontend tool and shares the customer's region. */
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

  return null;
}

import { BuiltInAgent, defineTool } from "@copilotkit/runtime/v2";
import { z } from "zod";
import { CATEGORIES, UnknownProductError, listProducts } from "./catalog";
import { createAzureModel } from "./model";

export const AGENT_IDS = ["luna", "terra"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export const SYSTEM_PROMPT = `You are the Contoso Electronics device concierge for a global smartphone and home-appliance brand.
Answer in the user's language (Korean by default). Keep prose short; let the UI carry the detail.
The customer's region is provided in context. Always pass that region to tools.

Pick exactly one UI pattern per request:

1. CONTROLLED — call \`show_phone_comparison\` when the user wants to compare or choose smartphones.
   Pass 2-4 product ids from \`lookup_catalog\` (category "phone"). Do not write prices yourself.
   The comparison card IS the answer: never answer a phone comparison in text only.
   Call it exactly once; you may add at most one short sentence in the same turn.

2. DECLARATIVE — call the A2UI tool (\`render_a2ui\`) when the user wants a home-appliance bundle, room setup or a
   layout that depends on their household (size, family, budget). First call \`lookup_catalog\` for the
   relevant categories, then compose the surface ONLY from the Contoso catalog components
   (BundleHeader, ProductTile, BundleSummary, EnergyNote, TipList) plus basic layout components.
   Put ProductTiles in Rows of two so the bundle reads as a grid.
   ProductTile and BundleSummary take product ids; they fetch prices themselves, so never put prices in props.

3. MCP APPS — call \`open_energy_dashboard\` when the user asks about appliance energy use, electricity
   bills or eco mode savings. The dashboard is a partner app; do not re-explain every number it shows.

4. FULLY OPEN — call \`generateSandboxedUi\` only for interactive explanations or simulators that no
   catalog component can express (for example how AI eco mode reduces power, or a foldable hinge
   durability visual). Inside the generated UI, fetch any product fact with
   \`await Websandbox.connection.remote.get_catalog_facts({ productIds, region })\` instead of inventing it.

Never place a purchase or change a device. If the user asks to buy, explain that checkout is outside this demo.`;

const lookupCatalog = defineTool({
  name: "lookup_catalog",
  description:
    "Returns authoritative Contoso products with regional price and stock. Use it before recommending products.",
  parameters: z.object({
    region: z.enum(["KR", "US", "DE"]).describe("Customer region"),
    category: z.enum(CATEGORIES).optional().describe("Product category filter"),
    ids: z.array(z.string()).optional().describe("Specific product ids"),
  }),
  execute: async ({ region, category, ids }) => {
    try {
      const products = listProducts({ region, category, ids });
      return {
        products: products.map((p) => ({
          id: p.id,
          category: p.category,
          name: p.name,
          tagline: p.tagline,
          priceLabel: p.priceLabel,
          inStock: p.inStock,
          energyGrade: p.energyGrade ?? null,
        })),
      };
    } catch (error) {
      if (error instanceof UnknownProductError) return { error: error.message, unknownIds: error.ids };
      throw error;
    }
  },
});

function deploymentFor(id: AgentId): string {
  return id === "luna"
    ? process.env.AZURE_OPENAI_LUNA_DEPLOYMENT ?? "gpt-5.6-luna"
    : process.env.AZURE_OPENAI_TERRA_DEPLOYMENT ?? "gpt-5.6-terra";
}

export function createConciergeAgent(id: AgentId): BuiltInAgent {
  return new BuiltInAgent({
    model: createAzureModel(deploymentFor(id)),
    prompt: SYSTEM_PROMPT,
    tools: [lookupCatalog],
    maxSteps: 6,
    providerOptions: { openai: { reasoningEffort: "low" } },
  });
}

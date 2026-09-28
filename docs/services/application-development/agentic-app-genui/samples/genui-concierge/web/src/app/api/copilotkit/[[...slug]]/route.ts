import {
  CopilotRuntime,
  InMemoryAgentRunner,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { AGENT_IDS, createConciergeAgent } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Handler = (request: Request) => Promise<Response>;
let handler: Handler | undefined;

// Built on first request so deployment settings are read at runtime, not during `next build`.
function getHandler(): Handler {
  handler ??= createCopilotRuntimeHandler({
    basePath: "/api/copilotkit",
    runtime: new CopilotRuntime({
      agents: Object.fromEntries(AGENT_IDS.map((id) => [id, createConciergeAgent(id)])),
      runner: new InMemoryAgentRunner(),
      // Declarative: renders A2UI surfaces composed from the client catalog.
      a2ui: {},
      // MCP Apps: tools with UI resources from the Contoso Energy partner server.
      mcpApps: {
        servers: [
          { type: "http", url: process.env.MCP_SERVER_URL ?? "http://127.0.0.1:3001/mcp", serverId: "contoso-energy" },
        ],
      },
      // Fully Open: agent-authored HTML/CSS/JS rendered in a sandboxed iframe.
      openGenerativeUI: true,
    }),
  }) as Handler;
  return handler;
}

const route: Handler = (request) => getHandler()(request);

export const GET = route;
export const POST = route;
export const PATCH = route;
export const DELETE = route;

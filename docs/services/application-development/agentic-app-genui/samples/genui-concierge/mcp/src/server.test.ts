import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { afterEach, describe, expect, it } from "vitest";
import { DASHBOARD_URI, createServer } from "./server.js";
import { simulateSavings } from "./energy.js";

const FAKE_HTML = "<!doctype html><html><body>dashboard</body></html>";

async function connect() {
  const server = createServer({ loadDashboardHtml: async () => FAKE_HTML });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

describe("Contoso Energy MCP server", () => {
  it("links open_energy_dashboard to the dashboard UI resource", async () => {
    const { client, close } = await connect();
    cleanup = close;

    const { tools } = await client.listTools();
    const dashboard = tools.find((t) => t.name === "open_energy_dashboard");
    expect(dashboard).toBeDefined();
    const ui = (dashboard!._meta as { ui?: { resourceUri?: string } })?.ui;
    expect(ui?.resourceUri).toBe(DASHBOARD_URI);
  });

  it("marks simulate_savings as an app-only tool", async () => {
    const { client, close } = await connect();
    cleanup = close;

    const { tools } = await client.listTools();
    const simulate = tools.find((t) => t.name === "simulate_savings");
    expect(simulate).toBeDefined();
    const ui = (simulate!._meta as { ui?: { visibility?: string[] } })?.ui;
    expect(ui?.visibility).toEqual(["app"]);
  });

  it("serves the dashboard HTML with the MCP Apps MIME type", async () => {
    const { client, close } = await connect();
    cleanup = close;

    const { contents } = await client.readResource({ uri: DASHBOARD_URI });
    expect(contents[0]).toMatchObject({ uri: DASHBOARD_URI, mimeType: RESOURCE_MIME_TYPE, text: FAKE_HTML });
  });

  it("returns the household baseline when the dashboard opens", async () => {
    const { client, close } = await connect();
    cleanup = close;

    const result = await client.callTool({ name: "open_energy_dashboard", arguments: { region: "KR" } });
    const structured = result.structuredContent as { simulation: { ecoLevel: number; currency: string } };
    expect(structured.simulation).toMatchObject({ ecoLevel: 0, currency: "KRW" });
  });

  it("computes savings through the app-only tool", async () => {
    const { client, close } = await connect();
    cleanup = close;

    const result = await client.callTool({ name: "simulate_savings", arguments: { region: "US", ecoLevel: 60 } });
    expect(result.structuredContent).toEqual(simulateSavings("US", 60));
  });

  it("rejects unsupported regions", async () => {
    const { client, close } = await connect();
    cleanup = close;

    const result = await client.callTool({ name: "simulate_savings", arguments: { region: "JP", ecoLevel: 10 } });
    expect(result.isError).toBe(true);
  });
});

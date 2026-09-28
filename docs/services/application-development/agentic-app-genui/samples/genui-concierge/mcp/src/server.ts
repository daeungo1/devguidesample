import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer, type CallToolResult, type ReadResourceResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getHousehold, simulateSavings } from "./energy.js";

export const DASHBOARD_URI = "ui://contoso/energy-dashboard.html";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DASHBOARD_FILE = path.join(PACKAGE_ROOT, "dist", "app", "energy-dashboard.html");

const regionSchema = z.enum(["KR", "US", "DE"]).describe("Customer region: KR, US or DE");

export interface ServerOptions {
  loadDashboardHtml?: () => Promise<string>;
}

function jsonResult(summary: string, structuredContent: Record<string, unknown>): CallToolResult {
  return { content: [{ type: "text", text: summary }], structuredContent };
}

export function createServer(options: ServerOptions = {}): McpServer {
  const loadDashboardHtml = options.loadDashboardHtml ?? (() => fs.readFile(DASHBOARD_FILE, "utf-8"));
  const server = new McpServer({ name: "contoso-energy", version: "1.0.0" });

  registerAppTool(
    server,
    "open_energy_dashboard",
    {
      title: "Open Contoso Energy dashboard",
      description:
        "Opens the interactive Contoso Energy dashboard for the customer's connected home appliances. " +
        "Use it when the user wants to see, compare or reduce appliance electricity usage.",
      inputSchema: z.object({ region: regionSchema }),
      _meta: { ui: { resourceUri: DASHBOARD_URI } },
    },
    async ({ region }): Promise<CallToolResult> => {
      const household = getHousehold(region);
      const simulation = simulateSavings(region, 0);
      return jsonResult(
        `Contoso Energy dashboard opened for ${region}. Current monthly usage is ${simulation.beforeKwh} kWh across ${household.appliances.length} appliances.`,
        { household, simulation },
      );
    },
  );

  registerAppTool(
    server,
    "simulate_savings",
    {
      title: "Simulate AI eco mode savings",
      description: "Recalculates monthly usage and cost for an AI eco mode level between 0 and 100.",
      inputSchema: z.object({
        region: regionSchema,
        ecoLevel: z.number().int().min(0).max(100).describe("AI eco mode intensity, 0-100"),
      }),
      _meta: { ui: { resourceUri: DASHBOARD_URI, visibility: ["app"] } },
    },
    async ({ region, ecoLevel }): Promise<CallToolResult> => {
      const simulation = simulateSavings(region, ecoLevel);
      return jsonResult(
        `Eco level ${ecoLevel}: saves ${simulation.savedKwh} kWh (${simulation.savedCost} ${simulation.currency}) per month.`,
        { ...simulation },
      );
    },
  );

  registerAppResource(
    server,
    "Contoso Energy dashboard",
    DASHBOARD_URI,
    { mimeType: RESOURCE_MIME_TYPE, description: "Interactive appliance energy dashboard" },
    async (): Promise<ReadResourceResult> => ({
      contents: [{ uri: DASHBOARD_URI, mimeType: RESOURCE_MIME_TYPE, text: await loadDashboardHtml() }],
    }),
  );

  return server;
}

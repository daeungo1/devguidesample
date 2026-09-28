import { defineConfig } from "vitest/config";

// Separate from vite.config.ts, whose root points at the MCP App sources.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});

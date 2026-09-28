import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Bundles the MCP App into one self-contained HTML file with no external assets,
// so the host can render it without granting any extra CSP origins.
export default defineConfig({
  root: "app",
  plugins: [viteSingleFile()],
  build: {
    outDir: "../dist/app",
    emptyOutDir: true,
    rollupOptions: { input: "app/energy-dashboard.html" },
  },
});

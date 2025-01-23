import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Anything that groups runs by day depends on the clock's time zone. The tests
// run on Dubai time wherever they are run: a laptop there, or a CI machine on
// UTC. The end-to-end tests do the same (see playwright.config.ts).
process.env.TZ = "Asia/Dubai";

export default defineConfig({
  plugins: [react()],
  // Read the "@/..." import alias from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    // The adapters and statistics need no browser. Component tests ask for one
    // themselves with a `// @vitest-environment jsdom` line at the top.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

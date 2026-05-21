import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // ES module support — the source uses `export function`
    include: ["src/**/*.test.js"],
    // Use node environment to avoid JSDOM complexities
    environment: "node",
  },
});

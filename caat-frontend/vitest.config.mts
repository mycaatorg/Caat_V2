import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    pool: "vmThreads",
    // Bound CPU/memory pressure on developer machines as well as hosted CI.
    // Unbounded local workers made real editor tests time out and cascade cleanup.
    maxWorkers: 2,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "json-summary", "lcov"],
      // PROD-206: floor the verified local/hosted whole-source baseline.
      // Allow one extra point for runtime variation; do not narrow includes.
      thresholds: { lines: 58, statements: 57, functions: 52, branches: 51 },
      // Include untested production code: these are whole-source UNIT coverage
      // numbers. Browser route/journey coverage is reported separately.
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "hooks/**/*.{ts,tsx}",
        "extensions/**/*.{ts,tsx}",
        "constants/**/*.{ts,tsx}",
        "middleware.ts",
      ],
      exclude: [
        "**/*.d.ts", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}",
        "**/__tests__/**", "**/tests/**", "**/node_modules/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

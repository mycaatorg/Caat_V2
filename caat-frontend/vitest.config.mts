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
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "json-summary", "lcov"],
      // Ratchet the verified whole-source baseline; new work should add tests.
      thresholds: { lines: 33, statements: 32, functions: 25, branches: 28 },
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

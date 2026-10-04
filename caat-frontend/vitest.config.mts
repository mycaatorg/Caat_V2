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
      // Keep the report scoped to modules with explicit unit coverage: core
      // helpers plus the feature shells/components exercised by unit tests.
      // This is reporting only; avoid a whole-app percentage claim or a
      // threshold that the selected test scope has not established.
      // Globs avoid the literal "(main)" route-group parens (glob-special).
      include: [
        "components/essays/EssaysShell.tsx",
        "components/profile/PersonalInfoCard.tsx",
        "components/communities/GroupJoinButton.tsx",
        "lib/scholarship-tracking.ts",
        "lib/scholarship-filters.ts",
        "lib/local-date.ts",
        "lib/profile-match.ts",
        "app/**/applications/api.ts",
        "app/**/communities/actions/_shared.ts",
        "app/**/communities/actions/profiles.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

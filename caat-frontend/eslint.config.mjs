import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated test/coverage artifacts (gitignored); never lint their bundled
    // output, or blocking lint would choke on thousands of minified-vendor
    // findings that are not our source.
    "playwright-report/**",
    "playwright-report-low-cap/**",
    "test-results/**",
    "coverage/**",
  ]),
  // CommonJS test files use require() by design.
  {
    files: ["tests/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Ban the removed src/ Supabase client. Use lib/supabase/{server,client}.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/src/lib/supabaseClient",
              message:
                "Import getBrowserClient() from @/lib/supabase/client (client components) or createServerClient() from @/lib/supabase/server (server).",
            },
          ],
          patterns: ["@/src/*", "@/src"],
        },
      ],
    },
  },
]);

export default eslintConfig;

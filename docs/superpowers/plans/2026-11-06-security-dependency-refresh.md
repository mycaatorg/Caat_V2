# Patch production dependencies and audit CI (PROD-247)

Execute inline under the standing build/review/deploy authorization. The recorded production dependency audit fails with 1 critical, 10 high, 2 moderate and 1 low affected-package entries; this is advisory evidence, not evidence of exploitation.

Update Next and eslint-config-next together to 16.4.5, keeping React 19.2.3. This is an existing Next 16 app with migrated asynchronous request APIs; no major-version codemod is applicable. Raise the Node engine floor to the patched sanitizer's >=22.12.0 requirement (local and CI use Node 24). Update the Tiptap family together within v3, sanitizer within v2 and Zod within v4. Resolve vulnerable transitive dependencies through compatible upstream versions, without forced major upgrades or blind overrides.

Add a blocking npm production dependency audit in Project CI and the local verification command. The gate must fail for high/critical advisories and registry errors. Preserve deterministic npm lockfile installation. Keep lower severity findings visible, with no false zero-vulnerability claim.

Validation: retain original audit failure; clean npm ci; audit JSON and gate; inspect package/lock changes; all bootstrap/discovery contracts, typecheck, lint, full unit coverage, production build and isolated browser journeys sequentially; targeted desktop/Android/iPhone editor and public scholarship checks. No student data writes. Obtain actual Claude and a fresh strongest independent whole-branch review on a pinned commit; apply actionable findings in one fix pass and reverify affected/full gates. Hosted CI must pass before integration and release. Verify deployed SHA, live public smoke, provider health and the separately reviewed source-repair migration before marking release tickets Done.

Compatibility findings: explicitly align Vitest/coverage-v8 at 4.1.12 and keep Vite on patched v6.4.5, restore strict peer dependency resolution, and retain existing behavior behind exact-line lint exceptions tracked in PROD-248. Development-only minimatch advisory follow-up is PROD-249. No global lint rules disabled.

The patched sanitizer requires native Node CJS-to-ESM loading. Use the forks test pool with the existing two-worker cap; do not mock or exclude sanitizer/community tests.

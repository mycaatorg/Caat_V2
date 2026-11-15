# Lint minimatch patch implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve PROD-249's development-only minimatch advisory without downgrading Next or its lint tooling.

**Architecture:** Scope an exact minimatch11.0.1 override to @typescript-eslint/typescript-estree8.72.1. Its only minimatch call uses the retained named minimatch function with dot:true. Keep all other dependency versions and v3 consumers unchanged. Exercise the actual parser project-service allowlist boundary as compatibility coverage.

**Tech Stack:** npm overrides/lockfile, TypeScript ESLint parser, Vitest and existing CI.

**Spec:** Linear PROD-249. Primary evidence: https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249 and https://raw.githubusercontent.com/isaacs/minimatch/v11.0.1/changelog.md . The upstream patch removes APIs unused by this parser; this is a deliberate scoped major override pending upstream adoption, not an automatic force-fix.

## Global Constraints

- No runtime dependency changes, Next/tooling downgrades, global minimatch override or weakened audit/lint gates.
- Exact override scoped to the currently examined parser version; reassess it on parser upgrades.
- No untrusted/exploit pattern execution. The failing npm audit is the dependency defect reproduction; compatibility tests should pass both before and after the patch.
- Keep source-refresh reporting PR337 separate; base this branch on its reviewed5d732e2 tree.

## Review Focus

- Actual parser handles ordinary and dotfile allowlisted TypeScript files with real type information.
- A file outside both tsconfig and allowlist still fails rather than silently entering the default project.
- All non-target dependency versions and production flags remain unchanged.
- Scoped override matches the installed parent and the patched version resolves under that parent, not just at the root.
- Production audit and full CI stay blocking; no runtime security claim based on a dev-only patch.

## Task 1: Patch and validate the lint dependency

Files: caat-frontend/package.json, package-lock.json, tests/unit/lint-toolchain-compatibility.test.ts and .github/workflows/ci.yml.

- [ ] Capture npm audit reporting the current moderate advisory and inspect the parent call site. Done during preflight:7moderate,0high/critical; one retained named-function call.
- [ ] Add real parser allowlist/type-information/negative-boundary tests; run on current dependency as compatibility baseline.
- [ ] Add the version-scoped override and update only its dependency subtree. Check lockfile diff and npm ls; expect minimatch11.0.1 under the parser, v3 unchanged.
- [ ] Add audit:all at moderate severity to local verification and the existing CAAT CI job, retaining the production high/critical gate. This prevents a parser version upgrade from silently reintroducing the advisory after the version-specific override stops matching. Run both audits successfully; registry failures remain blocking.
- [ ] Run npm ci, audit, compatibility tests, types, strict lint, full units and production build. Expect all success and zero current advisories. Record residuals if any rather than force-fixing unrelated packages.
- [ ] Actual Claude and fresh independent review, then hosted CI and release gates; update Linear on completion.

# Whole-app testing implementation plan

> For agentic workers: use subagent-driven-development. Parent owns integration, independent review, release checks, and deployment.

**Goal:** Give every CAAT page an explicit verification path, exercise critical behavior and user journeys, and make fast, honest CI results gate releases.

**Architecture:** Keep one source repository. Run deterministic unit/component/API tests on standard GitHub Linux runners. Run all authenticated browser checks and write-capable full-stack journeys against disposable local Supabase with synthetic users and data; some page loads write implicitly. Reproduce the same environment on the Mac mini. Report whole-source coverage independently from page-route coverage; a route entry is not evidence of successful interaction coverage.

**Tech stack:** Next.js, React, Vitest/V8, Playwright/Chromium, Supabase, GitHub Actions, existing CAAT Vercel Git integration.

**Spec:** User request in this task: entire webapp, smaller tests covering every page and major features, larger user journeys, speed and GitHub usage efficiency. Mac mini may host an isolated test environment. No test Supabase exists today.

## Constraints

- No tests create/edit/delete production student data.
- Do not mask failures with conditional assertions, broad success-or-error alternatives, skipped setup, or production credential fallbacks.
- Keep fast PR jobs on GitHub-hosted Ubuntu; the existing private-repo Mac runner setup must not be bypassed for this public repo.
- Use the StealthStartup/CAAT Vercel integration for preview and production.
- Do not deploy until exact release revision passes applicable checks; record unavailable integration coverage as unavailable.

## Review focus

- Network/database failures preserve edits and stop dependent writes.
- Authentication redirects never masquerade as successful page loads.
- New/dynamic routes cannot silently fall out of the route inventory.
- Tests must prove persisted outcomes or precise boundary contracts, not merely toast text.
- Long browser jobs must have timeouts, bounded concurrency, cached dependencies and short-lived failure artifacts.

## Tasks

- [x] Reproduce essay async loss and add failing regressions; serialize writes, protect failed transitions and active-draft clicks. Verify 15 component scenarios.
- [x] Add profile and group interaction regressions; mutation-check rollback assertion.
- [x] Repair coverage discovery and dedicated-test-database isolation guard; test both contracts.
- [x] Measure matched-scope before/after coverage (278 baseline tests,301 after initial pass), and distinguish it from whole-source coverage.
- [x] Measure and commit whole-source coverage configuration for `app`, `components`, `lib`, `hooks`, `extensions`, `constants`, and middleware; include untested source rather than selected favorable files. Store JSON/LCOV artifact and clear CI summary.
- [x] Add route manifest at `caat-frontend/tests/e2e/route-coverage.json`; compare it with all32 actual `page.tsx` routes in a Node contract test. Record public/protected/dynamic coverage modes and which journeys require isolated data.
- [x] Expand public/authenticated browser checks using actual headings/content and URL/status checks; test auth gates for protected route patterns. Consolidate browser build and add bounded timeouts/cancellation.
- [x] Add essay API contracts at `tests/unit/essays-api.test.ts`; stop on reset failures before later create/select writes. Verify red-before/green-after.
- [x] Add settings/account/export tests for authorization, user scoping, confirmation and failure recovery; no real destructive requests.
- [x] Audit remaining page behavior and major journey specs, remove false-green branches, and add deterministic coverage for the highest-risk missing flows (applications, scholarship discovery, documents, authentication).
- [x] Resolve isolated staging infrastructure: same repo and exact commit, separate database with synthetic users/data, no production credentials. Mac mini now runs a dedicated loopback-only Colima/Supabase stack; 42-table schema bootstrap and owner/peer row/storage checks pass. GitHub creates a fresh stack per run, without production credentials.
- [x] Run fresh full coverage, typecheck, lint, build and browser checks; independently review final stable diff with Claude. Resolve material findings.
- [ ] Push, verify exact-head GitHub checks and CAAT Vercel preview; merge through develop/main only after release gates. Verify production deployment SHA and post-deploy read-only smoke; update Linear.

## Evidence commands

From `caat-frontend`: `npm run test:coverage`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e:ci` against the isolated local stack (one production build). Public post-deploy checks use `npm run test:e2e:public`. From repo root: `node --test .github/scripts/*.test.js`, `git diff --check`. For release: `gh pr checks` plus GitHub deployment SHA/status. System Chrome may be used for local verification via temporary external config; committed CI remains Chromium.

## Expanded measurement (2026-10-04, pending final browser/release verification)

Using the same whole-runtime coverage configuration at develop baseline d047e2f and the expanded worktree: 278 → 389 unit/component tests (+39.93%); lines 474/6760 (7.01%) → 1239/6955 (17.81%), +10.80 percentage points. Browser route inventory covers 32 page patterns and is not a claim that all interactions are covered. Signup, logout, login and own-account deletion are covered by an isolated browser journey. Successful email-based password reset, rich resume formatting, mobile/cross-browser behavior, and other detailed workflows still need further journey work.

Independent Claude review identified the resume deletion/autosave race; regression tests reproduced it and the fix drains writes before deletion, prepares a replacement, and never flushes the removed id. Follow-up review confirmed that blocker fixed. A follow-up saved-fingerprint concern was also reproduced and fixed; failed deletion after a successful flush no longer produces a false unsaved-change warning. Essay custom-prompt deletion is now coordinated with pending saves too.

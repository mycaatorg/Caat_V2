# Low-row-cap CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make real 50-row-cap export/Today/calendar regressions a blocking CI phase.
**Architecture:** A Node runner validates the local status and test environment, applies and restores the role override around a bounded browser child process. The runner starts and owns the existing production build independently; a dedicated Playwright config selects three journeys and isolates diagnostics. CI invokes it sequentially after the normal suite.
**Tech Stack:** Node built-ins, psql, existing Playwright and GitHub Actions.
**Spec:** docs/superpowers/specs/2026-10-30-low-row-cap-ci-design.md

## Global Constraints
- Only disposable loopback API/database and seeded test mode; no production operations.
- Reuse one built application; run sequentially after default browser suite.
- Real cap50, API-verified by each journey; restore exact prior override and fail on cleanup/restoration errors.
- No admin credentials in argv, logs or browser environment; preserve separate diagnostics.
- Existing coverage/retry/flaky gates unchanged; no dependencies.

## Review Focus
- Malformed or mismatched endpoints must fail before SQL; test unsafe URL/user/database/port combinations.
- Applying the cap may commit then fail; test restoration after partial failure.
- Cancellation can arrive before mutation or during browser work; test both plus real child/grandchild shutdown.
- Restoration failure must override apparent browser success; test SQL failure and verification mismatch.
- Empty selection must not pass; inspect actual Playwright list and CI result for exactly three selected journeys.

### Task 1: Safe cap runner and CI integration

**Files:** Create `.github/scripts/low-row-cap-e2e.mjs`, `.github/scripts/low-row-cap-e2e.test.js`, `caat-frontend/playwright.low-cap.config.ts`; modify `.github/workflows/ci.yml`; document operation in `docs/operations/low-row-cap-ci.md`.
**Interfaces:** `validateLowCap(env,status)` returns validated local configuration; `runLowCap({env,status,sql,runBrowser,signal})` restores prior SQL state before resolving/rejecting; `runChild(command,args,{env,cwd,signal,killGraceMs})` bounds process-group termination; `runBrowserPhase({env,signal,...})` owns and awaits both app/test groups before SQL restoration. CLI consumes the status-file path and invokes psql via private environment/stdin and Playwright with sanitized public settings.

- [x] Write behavioral tests: invalid environments perform no SQL; existing/absent override restored on pass/failure; partial apply failure restored; malformed old value refuses mutation; restoration SQL/verification failures reject; pre-abort makes no mutation; in-flight abort waits for browser shutdown before restore; actual child and grandchild cannot survive cancellation; secrets excluded from process arguments/browser settings.
- [x] Run `node --test .github/scripts/low-row-cap-e2e.test.js`; observe failure from missing runner behavior.
- [x] Implement minimal runner and low-cap config; integrate sequential CI step with separate report upload paths. Existing tests perform real API cap assertions. Use exact three journey names and no pass-with-no-tests option.
- [x] Run all script/safety tests; list exact three Playwright tests; run real local low-cap phase against built app and verify SQL restoration independently. Run typecheck/lint and full unit suite; preserve failures.
- [ ] Commit, obtain actual Claude and one independent whole-branch review. Address important findings with failing then passing regressions. Run feature/release/main CI and normal deployment checks before Done.

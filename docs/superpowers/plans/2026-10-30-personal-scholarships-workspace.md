# Personal Scholarships Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make personal scholarships a complete searchable deadline planner with honest failures.
**Architecture:** Preserve existing cards/dialog; shared pure selector/date helper and paginated owner reader; parent owns search/filter/sort/loading, dialog owns drafts.
**Tech Stack:** Existing Next.js/React/TypeScript/Supabase/Tailwind/Vitest/Playwright.
**Spec:** docs/superpowers/specs/2026-10-30-personal-scholarships-workspace-design.md

## Global Constraints
- No schema/dependency changes; no currency aggregation, invented eligibility, or submission/award claims.
- Complete owner-scoped reads; later-page/auth failure is not empty success.
- Local date-only comparisons; invalid dates never crash cards or enter upcoming totals.
- Preserve failed form drafts; confirmed deletion and retryable errors; phone/keyboard access.
- Keep ignored evidence and existing catalog discovery separate.

## Review Focus
- Initial read racing new creation cannot overwrite new records (Task2).
- Zero-row delete under RLS cannot remove the visible card (Task1/2).
- Unknown/invalid dates and timezone boundaries are honest (Task2).
- Rapid repeated save and dialog close while saving cannot lose draft/create duplicates (Task2).
- Later-page failure cannot show plausible partial aggregate counts (Task1/3).

### Task 1: Complete personal scholarship reads and confirmed delete
**Files:** scholarships/user-scholarships-api.ts; tests/unit/user-scholarships-api.test.ts (new), frontend paths.
**Interfaces:** fetchUserScholarships():Promise<UserScholarship[]> unchanged; deleteUserScholarship(id):Promise<void> now confirms returned id. Consume evidencePages.
- [ ] Write RED tests using existing createMockSupabase:5 rows under cap2, stable owner/date/id ordering; later-page error rejects; no user rejects; deletion zero rows rejects, one row resolves.
- [ ] Run `npx vitest run tests/unit/user-scholarships-api.test.ts`; expect missing completeness/confirmation failures.
- [ ] Implement pagination/auth failure and returned-id delete confirmation, keeping filters and write shape.
- [ ] Run same tests, expect pass. Commit.

### Task 2: Searchable deadline workspace and reliable dialog
**Files:** scholarships/my-scholarships-panel.tsx; lib/personal-scholarship-workspace.ts (new); tests/unit/personal-scholarship-workspace.test.ts; tests/unit/my-scholarships-panel.test.tsx (new).
**Interfaces:** scholarshipDateKey(value):string|null validates date prefix; scholarshipDeadlineGroup(row,today):upcoming|past|undated; selectPersonalScholarships(rows,query,filter,sort,today) returns sorted copy. Existing card uses valid key for rendering.
- [ ] RED tests: today inclusive, yesterday past, null/invalid undated; name/provider/country search; all sorts and ties; load error hides counts and retries; active filters/reset; failed edit retains text and retry works; busy form cannot close/submit twice; failed delete keeps card.
- [ ] Run targeted tests; expect absent helper/controls/recovery failures.
- [ ] Implement helper and workspace layout, labelled controls/links/empty states; callback loader with unmount generation guard; block add until complete initial read. Guard form writes with ref and busy close prevention, inline error, labelled close control.
- [ ] Run all new tests and existing scholarship tests; expect pass. Commit.

### Task 3: Verify and release
**Files:** staging-journeys.spec.ts; documentation/evidence.
**Interfaces:** existing isolated student helpers/custom scholarship cards, no service-role/production writes.
- [ ] Add real PROD220 desktop/phone journey covering creation, query/filter/sort, forced later-page and write failures, draft retention, reload, deletion and overflow/screenshots; run alongside PROD146 Today integration.
- [ ] Full unit coverage/build/type/lint and hosted normal/low-cap suites pass; inspect screenshots.
- [ ] Actual Claude and independent whole-branch review; important findings RED→GREEN plus full suite, no rereview loop.
- [ ] Merge feature/release only after gates, verify exact-main CI/READY aliases/post-READY provider/live checks; update Linear/checkpoints and ledger.

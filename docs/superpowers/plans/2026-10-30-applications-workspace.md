# Applications Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give students a complete, searchable application stage board without losing edits.
**Architecture:** Reuse existing application cards and ordered write queue. Complete data reader plus keyed note-draft hook, then responsive workspace controls.
**Tech Stack:** Existing Next.js, React, TypeScript, Supabase, Tailwind, Vitest and Playwright.
**Spec:** docs/superpowers/specs/2026-10-30-applications-workspace-design.md

## Global Constraints
- No schema or external integration changes; no invented admissions/submission claims.
- Existing eight manual statuses and 800ms notes debounce remain.
- Complete owner-scoped reads; a later-page error cannot produce partial counts.
- Drafts survive view/filter/lane changes; phone layouts and keyboard controls remain usable.
- Preserve ignored evidence; finish review and release gates before Linear Done.

## Review Focus
- In-flight older note result must not overwrite a newer unsent draft (Task 2).
- Delete during note debounce must not write after deletion; failed delete restores draft (Task 2).
- Failed optimistic status move must restore lane and keyboard focus (Task 2/3).
- Missing school join, tied dates and undated records must sort deterministically (Task 2).
- Short API pages and later-page failure must not silently truncate counts (Task 1/3).

### Task 1: Complete application reads
**Files:** applications/api.ts; tests/unit/applications-api.test.ts (frontend paths).
**Interfaces:** fetchApplications(): Promise<ApplicationRow[]> remains unchanged; consumes evidencePages<T>.
- [ ] Add RED tests: simulated cap2 over5 rows returns all5, owner eq on each page, created_at/id ordering; later-page error rejects.
- [ ] Run `npx vitest run tests/unit/applications-api.test.ts`; expect new assertions fail.
- [ ] Implement evidencePages reader with range and sanitized errors; preserve auth guard.
- [ ] Run same tests; expect all pass. Commit.

### Task 2: Stateful planning workspace
**Files:** applications/client.tsx; applications/use-application-notes.ts (new); lib/application-workspace.ts (new); tests/unit/applications-client.test.tsx; tests/unit/application-workspace.test.ts (new).
**Interfaces:** applicationStage(status) maps to four fixed stages; selectApplications(rows,query,filter,sort) returns sorted copies. useApplicationNotes(save) owns keyed drafts and input/toggle/retry/clear/cancel methods. Cards consume draft state/callbacks; parent retains saveField queue.
- [ ] Write RED tests for all8 stage mapping, query/country casefold, deterministic sorting/undated last; board counts/filter/reset; pending draft across board/list and lane move; failed save retry after filter; stale result; delete before debounce.
- [ ] Run targeted tests; expect missing workspace controls/helper and lost draft failures.
- [ ] Implement helpers/hook, workspace hero/stage summary/controls, responsive board/list, labelled controls and lane-move focus restoration.
- [ ] Run all application unit tests; expect pass with existing write/rollback/import/preparation assertions preserved. Commit.

### Task 3: Browser verification and ship
**Files:** tests/e2e/staging-journeys.spec.ts; operations/checkpoint documentation as needed.
**Interfaces:** existing isolated seed/login helpers and application API; no production writes.
- [ ] Add real PROD-218 journey: search/reset/sort, switch views during notes debounce, status lane move, failed status/save recovery, reload persistence, keyboard focus, overflow and screenshots.
- [ ] Run journey on desktop/Android/iPhone, inspect screenshots; expect all pass. Run whole unit coverage/type/lint/build and hosted normal+low-cap CI; expect green.
- [ ] Actual Claude and independent whole-branch review; reproduce important findings RED→GREEN and full relevant suite, no repeated reviewer loops.
- [ ] Merge feature/release; verify exact-main CI, READY deployment and both aliases, post-READY provider health and readonly live checks. Progress Linear/checkpoints with exact evidence. Commit final docs.

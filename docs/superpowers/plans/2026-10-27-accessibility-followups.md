# Accessibility follow-ups implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Retain students' position after dialogs and announce the actual preparation state.
**Architecture:** Explicit opening-element refs and stable region fallbacks at remaining LibraryDialog callers; derive preparation announcements from row visibility.
**Tech Stack:** Existing React 19, Radix Dialog, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-27-accessibility-followups-design.md

## Global Constraints
- No dependency, database, permission or appearance changes.
- Keep pending-write guards and failed-save drafts.
- Automated evidence is distinct from human accessibility testing.

## Review Focus
- Safari pointer clicks need explicit opener identity (Task 1 browser test).
- Filtered-out edited items need a connected region fallback (Task 1 regression).
- Save changes a trigger's accessible name without replacing identity (Task 1 browser test).
- Missing checks on inactive, unsaved or foreign-university courses mean absent rows (Task 2 cases).
- Existing explicit-opener callers and busy dialogs must remain intact (Task 1 audit and regressions).

### Task 1: Restore library dialog focus
**Files:** components/profile/{EvidenceLibraryCard,EvidenceItemEditor,EvidenceImportDialog}.tsx; components/applications/hub-evidence-items.tsx; tests/unit/evidence-library-ui.test.tsx; tests/e2e/staging-journeys.spec.ts (all under caat-frontend).
**Interfaces:** Consumes LibraryDialog returnFocusRef/fallbackFocusRef, both RefObject<HTMLElement|null>. Produces explicit event.currentTarget capture in library/hub parents, passed to child dialogs.
- [ ] Add component tests opening without focus, closing and checking actual activeElement; filtered edit removes trigger then focuses labelled region.
- [ ] Run focused unit tests; expect focus assertions FAIL against current code.
- [ ] Capture actual openers in parent refs, pass through required child props, add tabIndex=-1/ref to stable labelled regions.
- [ ] Extend existing PROD-153 real-data journey with pointer Close/Escape for all remaining dialog paths and successful save focus assertions. Run desktop/phone Chromium/WebKit; expect PASS.
- [ ] Run focused unit tests; expect PASS; commit task.

### Task 2: Announce visible preparation reset
**Files:** caat-frontend/components/applications/course-preparation-card.tsx; caat-frontend/tests/unit/course-preparation-card.test.tsx.
**Interfaces:** Consumes refreshed courses/checks/savedCourseIds; produces announcement matching the row's existing render condition. No Task 1 dependency.
- [ ] Add regression for write success followed by missing check with retained saved active course: visible Start check is focused; live text includes Not started, excludes no longer shown. Add missing-row inactive/unsaved/foreign-university cases.
- [ ] Run focused test; expect visible-row announcement FAIL.
- [ ] Use same saved+available condition as rendering to distinguish absent check from absent row.
- [ ] Run focused tests; expect PASS; commit task.

### Verification and release
- [ ] npm test (whole suite), npm run typecheck, npm run lint; expect passes (record existing warnings).
- [ ] Fresh independent whole-branch reviewer plus actual Claude CLI review; important fixes RED→GREEN, minors ticketed.
- [ ] Feature PR to develop, passing CI; release PR to main, passing CI, matching ready Vercel deployment and auth/live smoke checks.
- [ ] Update both Linear issues and checkpoint with exact evidence. Preserve ignored evidence for handover.

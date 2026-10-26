# Course Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist manual course preparation with source review and owned supporting work (PROD-175).
**Architecture:** Database owns snapshots and optimistic concurrency. Focused client helpers and application/Today components reuse existing source work.
**Tech Stack:** Next.js, React, TypeScript, Supabase PostgreSQL, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-26-course-preparation-design.md

## Global Constraints
- No inferred eligibility, submission or acceptance; no catalogue fact changes.
- Three stable keys: prerequisites, assumed_knowledge, application_route.
- Preserve snapshots/links when unsaved; changed snapshots need explicit acknowledgement and reopen.
- Enforce owner/application constraints in the database. Include export, account cascades and fresh CI bootstrap.
- User already authorizes implementation/review/release; reuse isolated checkout and execute inline.

## Review Focus
- Concurrent source edit and mark-reviewed must never silently approve unseen information (Task 1 race test).
- Unsave, inactive and school remapping must retain visible context (Tasks 1/2).
- Delayed loads/writes must not overwrite another application or newer state (Task 2 component/browser tests).
- Source deletion/tailoring must update linked work without affecting preparation (Tasks 1/2).
- Partial failures must remain actionable and must not look like an empty checklist (Task 2).

### Task 1: Persistent model and database integrity
**Files:** new migration 20261026010000_course_preparation.sql; types/course-preparation.ts; types/database.ts; lib/course-preparation.ts; lib/account-export-collections.ts; tests/unit/course-preparation.test.ts; tests/staging/course-preparation-rls.mjs and course-preparation-race.mjs; bootstrap scripts.
**Interfaces:** Produces snapshotForCourse(course,key), preparationNeedsReview(check,course), fetchCoursePreparation(applicationId?), saveCoursePreparation(input), link/unlink course work. RPC save_course_preparation(application,course,key,action,expected_revision,expected_snapshot) returns one check. Actions start/reviewed/reopen/acknowledge.
- [ ] Write model tests: changed field/year/availability => needs review; unchanged => false; missing facts remain null; other field change does not invalidate unrelated check. Write RLS tests for invalid/foreign sources and stale revisions, duplicate starts, unknown/inactive/remapped courses, unsave persistence and cascades.
- [ ] Run focused Vitest and local RLS before implementation. Expected: missing implementation/migration failure.
- [ ] Implement typed model, migration, RPC/grants, paginated reads and writes, export manifest; register migration and RLS/race in fresh CI.
- [ ] Run focused tests and real local RLS/race. Expected: pass; concurrent stale actions rejected with integrity/conflict, not timeout.
- [ ] Commit database/model with test evidence.

### Task 2: Application preparation, evidence and Today review
**Files:** components/applications/course-preparation-card.tsx; components/applications/course-preparation-work.tsx; components/today/course-preparation-review.tsx; application client and Today page; lib/requirement-evidence.ts (extract source loader only); tests/unit/course-preparation-card.test.tsx; tests/e2e/staging-journeys.spec.ts.
**Interfaces:** Consumes Task 1 API/types and existing WorkSource; preparation card receives applicationId, schoolId, saved courses. Existing tracked courses loaded even when unsaved. Today consumes same owner-scoped read helper.
- [ ] Write UI/browser tests for start/review/reopen, explicit source acknowledgement resetting reviewed, evidence links not ticking, unsave persistence, inactive warning, retryable loads, mobile/keyboard dialog use.
- [ ] Run tests before UI. Expected: missing preparation section/actions.
- [ ] Implement accessible card/rows with previous/current facts, explicit action labels, latest request guards, no optimistic false success. Supporting picker shows current work. Add Today needs-review links and refresh on focus.
- [ ] Run unit suite, lint/typecheck, targeted browser on Chromium/phone/WebKit. Expected: pass, no overflow, persistence survives reload.
- [ ] Commit UI and verification.

### Task 3: Review and release
**Files:** review evidence in ignored ledger; Linear175/168/checkpoint; PRs.
**Interfaces:** Whole branch against origin/develop, reviewed SQL and exact commit heads.
- [ ] Run independent whole-branch reviewer and real Claude review. Fix important findings with regression tests; ticket minor follow-ups.
- [ ] Run full checks and fresh CI; review production migration metadata, apply reviewed migration and verify ACL/schema before frontend release.
- [ ] Create feature PR to develop, attach, wait exact-head checks; merge then release PR to main and attach. Verify main CI/auth/production aliases and HTTP checks before Done.

# Course follow-ups implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** Show recorded course entry information and let students save personal follow-ups to Today.
**Architecture:** Extend the existing hub course read, reuse the existing to-do API and accessible LibraryDialog. No schema change or catalogue seeds.
**Tech Stack:** Next.js, React, TypeScript, Supabase, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-25-course-follow-ups.md

## Global constraints
- Preserve unknown, stale and inactive source states; assumed knowledge is not automatically mandatory.
- Owner-scoped writes only; no status/readiness mutation or eligibility inference.
- Personal tasks do not synchronize with future provider changes; parent PROD-168 retains that work.
- No new dependencies or schema migrations.

## Review focus
- Unknown source year and malformed saved course must never look confirmed or disappear.
- Secondary page failure must invalidate the list.
- Rapid repeated submits must create one task; rejected write preserves user input.
- Pointer and keyboard close restore focus on mobile/Safari.
- Task success must be backed by a real row and appear on Today for the same user.

### Task 1: Course read integrity and source details
**Files:** lib/course-data.ts, app/(main)/applications/[id]/api.ts, components/applications/saved-courses-card.tsx; tests/unit/hub-saved-courses.test.tsx and application-hub-api.test.ts.
**Interfaces:** HubCourse adds required nullable prerequisites/prerequisites_url/assumed_knowledge/source_year; fetchSavedCoursesForSchool keeps Promise<HubCourse[]>.
- [ ] Add failing normalization, copy, pagination and malformed-row tests.
- [ ] Run focused tests and inspect expected failures.
- [ ] Implement fields, bounded reads, and requirements display; update typed fixtures.
- [ ] Run focused tests/typecheck; commit.

### Task 2: Editable personal follow-up
**Files:** new components/courses/course-follow-up.tsx, saved-courses-card.tsx, components/dashboard/api.ts; tests/unit/course-follow-up.test.tsx and existing dashboard tests.
**Interfaces:** CourseFollowUp({course: HubCourse, schoolName: string}) renders opener/dialog; uses addTodo(text,{due_date,priority:2}).
- [ ] Add failing user-flow tests: defaults/edit/date, retained failure, repeated submit, focus return, unavailable saved row.
- [ ] Run tests, implement smallest complete flow.
- [ ] Verify Today destination and retain existing owner API. Run full unit suite/typecheck/focused lint.
- [ ] Commit implementation and verification evidence.

### Task 3: Browser verification, review and release
**Files:** tests/e2e/staging-journeys.spec.ts; progress ledger.
- [ ] Add isolated journey for task creation from saved course, failure/retry, Today persistence and untouched application state; run desktop and phone with zero retries.
- [ ] Fresh independent whole-branch review and actual Claude review; fix important findings with regression tests.
- [ ] Feature PR to develop; wait exact-head CI; release PR to main; verify deployment aliases, public/authenticated checks and main CI.
- [ ] Close PROD-169 and update checkpoint; keep PROD-168 in progress for snapshots/evidence.

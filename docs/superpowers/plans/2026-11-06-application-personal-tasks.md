# Application personal tasks

> Implement inline with superpowers:executing-plans. Use TDD, one fresh whole-delta review and actual Claude review. User has delegated product decisions and authorized tested releases.

**Goal/spec:** PROD-264, under PROD-77. A student can create or attach a personal task beside an application and work on the same task in Today and the planning timeline. Personal tasks are not official requirements and do not imply submission.

**Architecture:** Keep `user_todos` as the only task record. Add an owner-scoped `application_task_links` table, one application per task. Deleting a task removes its link; deleting an application removes only its links, preserving personal tasks. Existing task text/date editing and completion remain authoritative. Use the current Next.js/TypeScript/Supabase/Vitest/Playwright stack, without new dependencies.

**UI direction:** Extend CAAT's existing monochrome/maroon application layout. A clearly labelled Personal tasks section below course preparation shows bounded task rows, text/date/completion, Edit and Unlink. Inline Add task and Link existing task forms avoid adding a second modal system. Existing TaskEditor handles editing. Today shows a separate application link outside the checkbox label. Timeline continues to route to the same task in Today. No automatic inclusion in printed briefs.

## Constraints and decisions

- Owner checks at database level for both task and application; authenticated access only. Anonymous and cross-account attempts must fail. No changes to existing task/application policies.
- `application_task_links`: task_id primary key referencing user_todos ON DELETE CASCADE; application_id references user_school_applications ON DELETE CASCADE; user_id references auth.users; created_at. Index owner/application/task. Select/delete own links; insert requires owned task and owned application. No UPDATE grant/policy: unlink before linking elsewhere.
- Atomic invoker-rights `create_application_task(p_task_id, p_application_id, p_text, p_due_date)` validates the existing trim/UTF-16 1..1000 contract, creates task plus link together, and returns TaskDetails. A stable client-generated task ID makes an identical retry return the existing owned task/link; changed payload or conflicting ID fails without overwriting anything. No orphan on link failure.
- All reads owner-scoped and paginated with evidencePages, continuing to terminal empty and rejecting late-page errors. Link-existing choices exclude already-linked tasks, with bounded search/results. Unlink verifies the original application and affected row; it never deletes task content.
- Separate auth/application-keyed component, cancel stale reads, preserve failed form inputs, serialize writes, avoid optimistic false completion. Refresh after writes; announce changes and keep sensible keyboard focus. Completion remains visible in the hub; Today shows open tasks as before.
- Add links to account export. Account deletion already deletes tasks/applications and cascading links. No private bodies or new outbound sharing.
- Deploy the additive migration before code using it; previous app remains compatible. Retain exact migration/production verification evidence. Never apply a migration twice.

## Task 1: persistence and security

- [x] Add isolated authenticated database regressions: owned create/link/read/unlink; cross-owner task/application and anonymous rejection; duplicate identical create retry; changed retry conflict; no orphan on failed link; Unicode/date boundaries; app deletion retains task; task deletion removes link.
- [x] Run against the old schema and observe missing-contract failures. Add migration `20261106030000_application_personal_tasks.sql`, minimal database types and staged bootstrap wiring. Run real local database checks and safety contracts to green.
- [x] Add link collection to export and cover its owner/order contract. Existing account deletion behavior must remain valid.

## Task 2: data and user flow

- [x] Add `lib/application-tasks.ts` with complete linked/available reads, atomic create, existing-task link and verified unlink. Unit regressions for owner filtering, cap50, late failure, no-row writes and safe errors; watch fail then implement.
- [x] Add `components/applications/application-personal-tasks.tsx`, integrated below CoursePreparationCard. Reuse TaskEditor and task validation/completion APIs. Test auth/app remount, stale response, failed save preserving input and stable request ID, link/unlink, completed state, retry, pagination/search and focus.
- [x] Load owner-scoped links in Today alongside existing collections and join to its already-owned application list. Add an optional application context to TodayTodo and a separate link in TodoRows. Existing timeline/deep-link pagination remains unchanged because the same user_todos rows are used. Test context isolation and missing/stale links.

## Task 3: full journeys and release

- [x] Real owned browser journey: add task in application, reload, edit/complete/reopen from Today, verify timeline and application link, attach existing task, unlink without deletion, failed write/read recovery. Desktop and emulated Android/iPhone; inspect screenshots and keyboard focus. Scoped synthetic cleanup only.
- [ ] Low-cap journey proves tail tasks/links and availability picker remain complete; wire into existing low-cap gate. Existing app brief/course preparation and Today journeys remain green.
- [ ] Full unit coverage, types, strict lint, build, database safety contracts and actual Claude/fresh independent review. Record all findings and rulings; one fix pass for blockers.
- [ ] Feature/develop/release CI, additive migration once, exact READY main deployment/aliases, provider and live smoke checks, final main CI and Linear completion evidence. Do not call human testing or physical-device testing complete.

## Review focus

Cross-owner context attachment; atomic create/idempotent retry after uncertain delivery; deletion preserving personal work; stale identity/application reads and ongoing writes; complete paginated task/link joins; date-only/UTF-16 validation; task editor CAS behavior; no nested interactive link in checkbox label; account export/delete coverage; backward-compatible migration order.

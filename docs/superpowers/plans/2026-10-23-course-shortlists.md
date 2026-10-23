# University course shortlists implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. The user has approved M3 continuation; do not ask again to start. This document is implementation-ready planning, not a claim that the feature exists.

**Goal:** Let students save and compare up to three specific Australian university courses alongside their existing major explorer.

**Architecture:** Public read-only offering catalogue plus private owner-scoped saves. Course identity is institution/program/campus, never UAC code alone. Server-render catalogue and saves; browser mutations preserve retryability. Extend Shortlist and Today without modifying existing university or major bookmarks.

**Tech stack:** Existing Next.js App Router, React, TypeScript, Supabase/Postgres RLS, Vitest and isolated Playwright CI. No new dependency or paid service.

**Spec:** ../specs/2026-10-23-course-shortlists-design.md; canonical work ticket PROD-76.

## Global constraints

- Preserve /majors and its up-to-three comparison. Add /courses with clear paired navigation.
- Start with five sourced offerings from three universities. Call it a starter catalogue, not Australian-wide coverage.
- Domestic undergraduate scope. Show fee year, category, basis and exclusions together; never infer admission chances.
- Unknown is not zero, free, unrestricted or no prerequisites. Keep prerequisites distinct from assumed knowledge.
- Retain inactive offerings and saved links. Catalogue writes are privileged ingestion only; students can only manage their own saves.
- No auto-creation or deletion of university bookmarks. Programme-to-school mapping is contextual, not a user action.
- A source refresh requires rechecking the official source; never roll verification dates forward just to clear warnings.

## Review focus

1. Same UAC code on two distinct degrees: both must coexist and save independently (Task1).
2. Invalid or mixed-year fees and missing prerequisites: explicit unknown/category/year copy, no ranking by incompatible costs (Tasks1/2).
3. Save failure while another save succeeds or account changes: do not roll back unrelated state or leak prior-owner saves (Task2).
4. Hidden retained pages during navigation: browser assertions target accessible regions, not arbitrary first matches (Task4).
5. Inactive offering with an existing bookmark: still visible in shortlist with unavailable status and provider link; no hard deletion (Tasks1/3).

### Task1: catalogue and ownership boundary

Files: create `caat-frontend/supabase/migrations/20261023070000_course_offerings.sql`, `caat-frontend/types/courses.ts`, `caat-frontend/lib/course-catalog.ts`, `caat-frontend/tests/unit/course-catalog.test.ts`, `caat-frontend/tests/staging/course-rls.mjs`; modify `caat-frontend/types/database.ts`, `caat-frontend/tests/staging/bootstrap-local.mjs` and isolated CI bootstrap.

Interface: `CourseOffering` contains stable id, provider/program identity, nullable school mapping, title, campus, duration, prerequisite/assumed-knowledge text, fee amount/year/category/basis, application route/source URL, checked-at/source year and active status. `getCourseOfferings(): Promise<CourseOffering[]>` is public cached data only; throw on load error rather than pretending catalogue is empty.

- [ ] Write failing validation/loader tests: same UAC permits distinct offerings; source URL must be http(s); malformed source/fee values remain unconfirmed; failed fetch rejects.
- [ ] Create additive schema: public SELECT only on course_offerings, no student INSERT/UPDATE/DELETE; user_course_bookmarks composite owner/offering key, owner RLS, FK to auth.users with account-deletion cleanup, offering FK without destructive catalogue deletion. Map production schools by verified unique name/country, not hardcoded IDs; fail ambiguous mapping or keep null.
- [ ] Seed reviewed facts from spec with exact source and date, nullable unknowns and dated fee semantics. Stable-key upserts preserve user references. Document source-review procedure and inactive-state handling.
- [ ] Update database types and catalogue loader with explicit field selection/validation. Cache only global catalogue, never private saves.
- [ ] Run real isolated RLS tests for anon read, denied catalogue mutations, owner save/read/remove, cross-user read/write spoofing denial, inactive retained save and foreign-key integrity. Never use production for destructive RLS fixtures.
- [ ] Commit the tested foundation on `codex/caat-course-shortlists`.

### Task2: course browser, saves and comparison

Files: create `caat-frontend/app/(main)/courses/page.tsx`, `caat-frontend/app/(main)/courses/client.tsx`, `caat-frontend/components/courses/course-comparison.tsx`, `caat-frontend/components/courses/course-navigation.tsx`, `caat-frontend/lib/course-bookmarks.ts`, `caat-frontend/tests/unit/course-browser.test.tsx`; modify `caat-frontend/app/(main)/majors/page.tsx`.

Interfaces: `loadCourseBookmarks(client,userId): Promise<string[]>`; `setCourseBookmark(client,userId,courseId,saved): Promise<void>`. Inputs and errors are scoped to the current owner. All mutation outcomes are checked; zero-row denied saves cannot report success.

- [ ] Write failing tests: save/remove and reload, failed saves retain retry, concurrent saves do not revert each other, account switch discards stale results, max-three comparison, search does not clear selection, empty/error states and safe source links.
- [ ] Add paired Explore majors / University courses navigation. Preserve existing CAAT typography, maroon accents, spacing and focus states. Use left-aligned readable provider/course titles and concise provenance, not decorative statistics.
- [ ] Build course cards with university, campus, duration, source state, save and compare actions. Do not preload personal saves into a shared cache. Disable duplicate pending operations with an immediate guard.
- [ ] Compare selected offerings in a semantic table with bounded horizontal scrolling. Show prerequisites and assumed knowledge separately, fee year/category/basis together, provider application instructions and verification dates. Label mixed-year fees explicitly. Unknown campus/fee remains unknown.
- [ ] Test keyboard open/close, selection removal, mobile page width and failure feedback. Record results on PROD-76 and commit.

### Task3: Shortlist and Today continuity

Files: modify `caat-frontend/lib/shortlist.ts`, `caat-frontend/components/shortlist/ShortlistView.tsx`, `caat-frontend/lib/today-data.ts`, `caat-frontend/lib/today.ts`, `caat-frontend/components/today/TodayView.tsx`, their existing unit tests and fixtures.

Interface: extend `ShortlistKind` with `course`, `Shortlist` with typed saved offerings, `TodayInput.saved` and SavedPreview with course counts/links. Existing `major` URL filters keep their meaning; label them Majors and new offerings University courses.

- [ ] Write failing integration tests: all four saved kinds present, specific course saves visible on Today, major/university saves unchanged, course removal only removes that course, failed removal restores the affected row at a findable position, inactive saved courses remain visible.
- [ ] Extend loaders with explicit owner-scoped queries and checked errors. An unavailable new table/read is an actionable load failure, not an empty account. Apply the schema before deploying dependent code.
- [ ] Extend UI category counts, search, pagination, reset and restored-item navigation. Keep pre-hydration URL state consistent. Deep link specific saved offerings back to their course context.
- [ ] Run complete existing Shortlist/Today suites with updated fixtures; preserve all previous behaviour. Commit.

### Task4: release gate

Files: extend `caat-frontend/tests/e2e/staging-journeys.spec.ts`, isolated seed and CI RLS harness. Keep new journeys in the existing CI test selection; tag intended phone journeys.

- [ ] Verify persisted save → reload → Shortlist → Today → remove → reload with an isolated user. Compare three offerings, including shared-UAC distinct programs, unknown fee and differing fee years. Check legacy major compare remains functional.
- [ ] Run all units, typecheck, lint, real RLS checks, production build and existing browser journeys. Exercise desktop and phone plus keyboard. No test-only production fixtures or credential exposure.
- [ ] Obtain actual Claude source review; fix substantive findings and prove regressions. Keep minor deferred notes explicit.
- [ ] PR to develop, release PR to main, exact-head CI, additive production migration with recorded result, deploy, exact SHA/alias checks and user-flow verification. Mark PROD-76 Done only after its acceptance flows are released; keep downstream PROD-77/78/79 separate.

## Execution status

Design/source research is complete. The catalogue schema, reviewed seeds, typed loader, owner-scoped bookmark API and isolated RLS test harness are implemented; real database CI is pending. All 814 unit tests, typecheck, lint and 13 CI safety contracts pass. The course browser/comparison and Shortlist/Today integration are not implemented yet. No course migration or feature has been deployed. PROD-75/142 release is independent and must not be misrepresented as delivery of this plan.

# Finish the application (PROD-148 + minimal PROD-77) implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task, with superpowers:test-driven-development for every task. This document is implementation-ready planning, not a claim that the feature exists. Stop and ask the owner at the gates marked **OWNER GATE**; do not guess past them.

**Goal:** A saved course leads to the student's application at that university. The hub shows the courses the student saved there and the scholarships they attached, each with a requirements checklist built only from recorded data. Majors link to catalogue courses through a reviewed mapping.

**Architecture:** No change to `user_school_applications`. Courses reach an application through `course_offerings.school_id`, and creation only ever happens on an explicit click through one helper that is idempotent on 23505. The major-to-course mapping is a reviewed constant in code. Scholarships attach through the existing `user_bookmarked_scholarships.school_id`, which needs an UPDATE RLS policy, an application-delete detach trigger and (if approved) a key-only ticks table. Checklists are pure functions of the catalogue row plus the PROD-75 source helper.

**Tech stack:** Existing Next.js App Router, React, TypeScript, Supabase/Postgres RLS, Vitest, isolated Playwright CI. No new dependency or paid service.

**Spec:** ../specs/2026-10-23-opportunity-requirements-design.md. Tickets: PROD-148, PROD-77 (minimal slice; the rest of PROD-77 stays open). Branch: `codex/caat-finish-application` from `develop` **after PROD-147 has merged** (this plan edits files PROD-147 changes: hub `api.ts`/`client.tsx`, `applications/api.ts`, `lib/preparation-checklist.ts` consumers).

## Global constraints

- Never create an application except on a click whose label says it does. No creation on save, mount, reload, retry, import or hover. Never create or delete university bookmarks.
- One application per university (existing unique constraint). A course is context for that application, never a second application.
- Unknown is not "no". Recorded is not verified. Stale says stale. Item labels must not contain "eligible", "qualify", "matched" or "submitted". Ticks are preparation only and never change any status or the 3-step application score.
- No eligibility inference beyond PROD-75: the hub checklist never reads the profile, and rules are always "Check with the provider".
- No copies of text: no notes, todos or stored requirement text. Ticks store keys only.
- Owner-scoped reads use `.eq('user_id', uid)` plus RLS. Writes must prove they touched the owner's row (`.select()` plus a non-empty assert). Results for a previous account are discarded.
- Each new hub read fails independently into an "unavailable, Retry" state, never into empty copy.
- Migrations are additive and applied to production before dependent code is deployed. Never run destructive RLS fixtures against production.

## Review focus

1. Double creation: two saved courses at one university, a Shortlist university row and a course row clicked together, or two tabs. Expect exactly one application and no error toast on 23505 (Tasks 1, 7).
2. Nothing creates by itself: mount, save, reload and account switch all leave the applications count unchanged (Tasks 2, 7).
3. RLS: attach without your own application, attach a peer's bookmark, peer reads ticks, application delete then status change. Each must fail or behave as specified on a real database (Task 4).
4. The status-update fix: changing an existing bookmark from Interested to Applied works after the migration, and its regression test failed before it (Task 0/4).
5. Wording: snapshot the checklist labels and assert the banned words never appear. Stale/unverified/future dates follow PROD-75 exactly (Task 5).
6. Hub regressions: PROD-147 checklist score and groups unchanged; the new reads don't serialise the hub (Tasks 3, 6).

### Task 0: confirm the ground truth (read-only, no code)

- [ ] Confirm PROD-147 is merged to develop; branch from it. If it isn't merged, stop and report.
- [ ] On a disposable local stack (`tests/staging/README.md`), prove the suspected bug: bookmark the seed scholarship as Interested, then call `trackScholarship(id, 'applied')` as the owner; record the error. Also prove that a plain `update({school_id})` returns zero rows. Write both down in PROD-77.
- [ ] Read-only production checks (public catalogue reads only, anon key, no writes): the five `course_offerings.school_id` values are non-null; the exact production `majors.name` values proposed for the mapping exist exactly once; the current `user_bookmarked_scholarships` policies match the 4 October snapshot (no UPDATE policy). Record the results on PROD-148/PROD-77.
- [ ] **OWNER GATE:** present (a) the major mapping pairs, (b) the ticks table versus read-only checklist, (c) the attach copy, and (d) the fact that fixing the policy changes current status-change behaviour. Proceed only with answers recorded on the tickets.

### Task 1: one helper that opens or starts an application

Files: create `caat-frontend/lib/application-for-school.ts`, `caat-frontend/tests/unit/application-for-school.test.ts`; modify `caat-frontend/app/(main)/applications/api.ts` (export a variant of `addApplication` that surfaces the Postgres code before `sanitizeError`), `caat-frontend/components/shortlist/ShortlistView.tsx` (university row `startApplication` uses the helper).

Interface: `startApplicationForSchool(schoolId: number): Promise<{ application: { id: string; status: ApplicationStatus }; created: boolean }>`. Inserts through `addApplication`. On `23505` it reads `fetchApplicationForSchool(schoolId)` and returns `created: false`; if that read is null or fails, it throws. Any other error throws a sanitised message.

- [ ] Failing tests: creates when absent; returns the existing row with `created: false` on 23505; throws on other errors and on 23505 followed by a null read; never calls insert twice for one call.
- [ ] Implement. Switch the Shortlist university row to the helper, showing "You're already tracking <name>." when `created` is false. Existing `shortlist-view` tests stay green.
- [ ] Commit `PROD-148: idempotent start-application helper`.

### Task 2: "Track an application at <university>" on saved courses

Files: create `caat-frontend/components/courses/course-application-action.tsx`, `caat-frontend/tests/unit/course-application-action.test.tsx`; modify `caat-frontend/lib/shortlist.ts` (add `schoolId` to `ShortlistCourse`; select `school_id` in the course embed), `caat-frontend/components/shortlist/ShortlistView.tsx` (course row action), `caat-frontend/app/(main)/courses/page.tsx` (owner-scoped `user_school_applications(id, school_id, status)` read, uncached, `.catch(() => null)`), `caat-frontend/app/(main)/courses/client.tsx` (applications state with the same owner/reload guard as saved ids; render the action on saved cards only); existing tests `shortlist-view.test.tsx`, `course-shortlist.test.ts`, `course-browser.test.tsx`.

Interface: `<CourseApplicationAction institutionName schoolId application busy unavailable onStart onRetry />`. It is a pure view: the parents own state and the busy key `apply-<schoolId>`, so every course and university row for a school stays in sync.

- [ ] Failing tests: with an application → "Open your <institution> application" link to `/applications/<id>` plus status; without → button "Track an application at <institution>" with help text "Adds <institution> to My applications so you can prepare. It does not apply to the university."; `schoolId` null → explanatory text, no button; applications read failed → "Couldn't check your applications" plus Retry, no create button; mount/save/re-render never call `onStart`; double click calls it once; failure keeps the button and toasts; success updates every row for that school; account switch discards a previous owner's applications and in-flight results; unsaved `/courses` cards show no action.
- [ ] Implement. Keep CAAT maroon styling and the existing Pill and link patterns. No navigation on success.
- [ ] Run the Shortlist, course and Today suites; Today must not change. Commit `PROD-148: track an application from a saved course`.

### Task 3: saved courses on the hub, and majors to courses

Files: create `caat-frontend/components/applications/saved-courses-card.tsx`, `caat-frontend/lib/course-major-map.ts`, `caat-frontend/components/majors/major-courses.tsx`, `caat-frontend/tests/unit/hub-saved-courses.test.tsx`, `caat-frontend/tests/unit/course-major-map.test.ts`, `caat-frontend/tests/unit/major-courses.test.tsx`; modify `caat-frontend/app/(main)/applications/[id]/api.ts` (add `savedCourses: HubCourse[]` and `savedCoursesUnavailable: boolean` to `ApplicationHub`; the read joins the existing `Promise.all`), `caat-frontend/app/(main)/applications/[id]/client.tsx` (card directly below the Preparation checklist), `caat-frontend/app/(main)/majors/[id]/page.tsx` (section after Typical Coursework), `caat-frontend/tests/unit/application-hub-api.test.ts`, `caat-frontend/tests/unit/application-hub-client.test.tsx`.

Interfaces: `HubCourse = Pick<CourseOffering, 'id'|'name'|'campus'|'application_route'|'application_url'|'source_url'|'verified_at'|'active'>`, normalised through `normalizeCourse` rules (safe URLs, valid dates). Read: `user_course_bookmarks.select('course_id, course_offerings!inner(...)').eq('user_id', uid).eq('course_offerings.school_id', schoolId)`. `COURSE_MAJOR_LINKS: readonly { courseId: string; majorName: string; reviewedOn: string; note: string }[]`; `coursesForMajor(majorName: string, catalogue: CourseOffering[]): CourseOffering[]`, which uses an exact trimmed name match and drops unknown or inactive courses.

- [ ] Failing tests (hub): query is owner- and school-filtered; inactive saved course listed with retained copy; missing route → "Application route not recorded. Check the provider."; unsafe `application_url` not linked; `<CourseSource>` shows the date and stale copy; read error → unavailable plus Retry, not empty; empty → "You haven't saved a course at <school>." with a `/courses` link; prep score and PROD-147 groups unchanged.
- [ ] Failing tests (mapping): every `courseId` exists in the seeded catalogue IDs (parse `supabase/migrations/20261023070000_course_offerings.sql` or a shared ID list); no duplicate pairs; every entry has `reviewedOn` and `note`; matching is exact (case and whitespace variants of a name don't match; no substring match); a major without entries renders no section; catalogue failure renders "Couldn't load university courses."
- [ ] Implement with the owner-approved pairs from Task 0. The major page uses the cached `getCourseOfferings()`; there is no personal data on that page section.
- [ ] Commit `PROD-148: saved courses on the hub and reviewed major-to-course links`.

### Task 4: migration for attachments and ticks, plus real RLS

Files: create `caat-frontend/supabase/migrations/20261024090000_scholarship_application_links.sql`, `caat-frontend/tests/staging/opportunity-rls.mjs`; modify `caat-frontend/tests/staging/bootstrap-local.mjs` (apply the migration after the course migration, then a new fixture file), create `caat-frontend/tests/staging/seed-opportunities.sql`, modify `.github/scripts/bootstrap-local-supabase.mjs` (run `opportunity-rls.mjs` after `course-rls.mjs`), `caat-frontend/types/database.ts`, `caat-frontend/app/(main)/settings/export/route.ts` (add `user_scholarship_prep_checks` to `byUserId`).

Migration (single transaction, idempotent guards):
- `CREATE POLICY "users can update own scholarship bookmarks" ON public.user_bookmarked_scholarships FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id AND (school_id IS NULL OR EXISTS (SELECT 1 FROM public.user_school_applications a WHERE a.user_id = (select auth.uid()) AND a.school_id = user_bookmarked_scholarships.school_id)));`
- Function plus `AFTER DELETE ON public.user_school_applications FOR EACH ROW` trigger: `UPDATE public.user_bookmarked_scholarships SET school_id = NULL WHERE user_id = OLD.user_id AND school_id = OLD.school_id;` (security invoker; `SET search_path = public`).
- If approved at the Task 0 gate: `user_scholarship_prep_checks` as specified (composite FK to the bookmark `ON DELETE CASCADE`, `CHECK (item_key ~ '^(separate-application|essay|deadline|official-link|rule:[a-z0-9]{8,64})$')`, RLS enabled, `REVOKE ALL ... FROM anon, authenticated`, `GRANT SELECT, INSERT, DELETE ... TO authenticated`, owner policies for those three commands, `GRANT ALL ... TO service_role`).
- No new columns on existing tables. No new index (bookmarks per user are few; `idx_user_bookmarked_scholarships_user` covers the owner filter).

Fixtures (`seed-opportunities.sql`, after migrations): a synthetic course offering `e2e-test-course-900001` mapped to school 900001 with a route, application URL, source URL and `verified_at = now() - interval '10 days'`; a second synthetic scholarship `e2000000-...-0000000000a1` with `application_requirements = {"separate_application_required": true, "application_mode": "online form", "must_meet": ["E2E rule one", "E2E rule two"]}`, `requires_essay = true`, a future deadline, a safe `external_url` and `last_verified_at = now() - interval '200 days'` (so the stale path shows). The existing seed scholarship stays unverified (the unverified path).

- [ ] Write `opportunity-rls.mjs` first and run it against the unmigrated stack: the status-update case must fail (RED). Cases: owner updates status on an existing bookmark; owner attaches to a school with their own application; owner cannot attach to a school without one (error or zero rows); peer cannot update the owner's bookmark (zero rows); peer cannot read, insert or delete the owner's ticks; anon denied everywhere; deleting the application nulls `school_id`, after which a status change still succeeds; deleting the bookmark cascades its ticks; deleting the auth user cascades everything. Use synthetic users and clean up, following `course-rls.mjs`.
- [ ] Apply the migration and fixtures; the RLS script passes (GREEN). Regenerate or patch `types/database.ts`.
- [ ] Commit `PROD-77: let students attach saved scholarships to their applications (RLS + detach trigger)`.

### Task 5: requirements checklist logic

Files: modify `caat-frontend/lib/scholarship-eligibility.ts` (export `scholarshipSourceState(row, now): { sourceUrl; verifiedAt; syncedAt; freshness }` and make `explainEligibility` call it; no behaviour change); create `caat-frontend/lib/scholarship-requirements.ts`, `caat-frontend/tests/unit/scholarship-requirements.test.ts`; extend `caat-frontend/tests/unit/scholarship-eligibility.test.tsx` with helper parity cases.

Interface: `scholarshipChecklist(row: Pick<ScholarshipRow, 'id'|'requires_essay'|'deadline_at'|'external_url'|'application_requirements'|'eligibility_summary'|'last_verified_at'|'source_last_synced_at'|'school_name'|'is_active'>, now: Date): { source: SourceState; inactive: boolean; recordedInstitution: string | null; items: { key: string; kind: 'separate-application'|'essay'|'deadline'|'official-link'|'rule'; label: string; state: 'recorded'|'not-recorded'|'passed'; detail: string | null; href: string | null }[] }`. `ruleKey(text)` gives `rule:` plus a deterministic lowercase hex hash (for example FNV-1a, 64-bit hex) of the trimmed, whitespace-collapsed text.

- [ ] Failing tests: every branch in spec section E (true/false/missing/non-boolean separate flag; essay true/false/null; deadline future/past/missing/invalid/impossible date; safe/unsafe/missing link; `must_meet` with non-strings and blanks dropped; `eligibility_text` dedupe against the summary and `must_meet`); source states recent/stale/unverified/future-dated identical to `explainEligibility` for the same rows; rule keys stable under reordering and different for changed text; keys match the migration CHECK regex; no label or detail matches `/\b(eligib|qualif|matched|submitted)/i`; inactive flag; the function never reads profile data (type-level: no profile parameter).
- [ ] Implement, then run the full existing PROD-75 suite unchanged.
- [ ] Commit `PROD-77: requirements checklist from recorded scholarship data`.

### Task 6: attach, detach, ticks and the hub card

Files: modify `caat-frontend/lib/scholarship-tracking.ts` (add `attachScholarship(scholarshipId, schoolId)`, `detachScholarship(scholarshipId)`, `setPrepCheck(scholarshipId, itemKey, checked)`, `fetchAttachedForSchool(schoolId)`, `fetchPrepChecks()`; make `fetchTrackedForSchool` throw on error instead of returning `[]`); create `caat-frontend/components/applications/scholarship-requirements-card.tsx`, `caat-frontend/components/applications/attach-scholarship-dialog.tsx`, `caat-frontend/tests/unit/scholarship-attachments.test.ts`, `caat-frontend/tests/unit/hub-scholarship-requirements.test.tsx`; modify `caat-frontend/app/(main)/applications/[id]/api.ts` (add `attachedScholarships`, `attachedUnavailable`, `prepChecks`, `trackedUnavailable`; move the name-match read into the parallel batch), `caat-frontend/app/(main)/applications/[id]/client.tsx` (scholarships card groups 1 to 3 in spec order), `caat-frontend/lib/shortlist.ts` and `caat-frontend/components/shortlist/ShortlistView.tsx` ("For <school>" label on attached scholarship rows), `caat-frontend/app/(main)/scholarships/[id]/ScholarshipTracking.tsx` (remove the "no manual link" comment; behaviour unchanged), existing hub and tracking tests.

Write semantics: attach and detach use `update({ school_id }).eq('user_id', uid).eq('scholarship_id', id).select('scholarship_id, school_id')`; zero rows throws "Couldn't attach. Make sure you still have this application, then try again." Ticks: insert with `onConflict ... ignoreDuplicates` and verify as `setCourseBookmark` does; untick deletes after an owner/session check as `removeCourseBookmark` does.

- [ ] Failing tests (API): owner filters on every call; zero-row attach and detach throw; move sends one update; tick insert/verify/delete paths; `fetchTrackedForSchool` error now surfaces.
- [ ] Failing tests (hub UI): group order; suggestions exclude attached items and say "mention <school>"; Attach on a suggestion and from the dialog; the dialog shows the current attachment and requires confirmation to move; attach copy present; recorded institution shown neutrally when it differs; per-item source suffix and header label (stale and unverified fixtures); unknown items read "Not recorded…", never "No"; tick is optimistic with per-key guard and rollback on failure; untick works; ticks don't change `prepScoreLabel`; each group's unavailable state is separate and the attach button is disabled while attached reads are unavailable; a previous account's results are discarded; phone width has no horizontal overflow (class assertions), and checkboxes have accessible names "I've prepared this: <item label>".
- [ ] Implement with existing Card, GroupLabel, ReadyItem-like rows and maroon accents. The ReadyItem two-state icon is not reused for the three recorded states; text carries the state.
- [ ] Commit `PROD-77: attach saved scholarships and track their requirements on the hub`.

### Task 7: persisted journeys and release gate

Files: extend `caat-frontend/tests/e2e/staging-journeys.spec.ts` (two journeys, both tagged `@phone`), plus `.github/scripts/report-write-e2e-boundary.js` if it lists covered writes.

- [ ] Journey PROD-148: sign in as the isolated student, remove any application for school 900001 (existing helper), save `e2e-test-course-900001` on `/courses`. The card shows "Track an application at E2E Test University"; reload and confirm no application exists yet (the `/applications` card count is unchanged). Click on the Shortlist course row; the action becomes "Open your … application". Reload `/courses`: the card shows Open (no second button) and the application count for 900001 is exactly one. Open the hub: the "Courses you saved at E2E Test University" card lists the course with route, official link, source link and the date. Then remove the course save and the application, and reload to confirm both are gone.
- [ ] Journey PROD-77: bookmark scholarship `…a1` as Interested, then change it to Applied (the update path; it would have failed before Task 4) and reload. Create the 900001 application, open the hub and attach `…a1` from the dialog. The checklist shows "A separate scholarship application is required (recorded)", "An essay is required (recorded)", both rules as "Check with the provider" and the stale label. Tick "Read the official scholarship page", reload and confirm the tick persisted. Detach, reload: the checklist is gone and the scholarship is still saved on Shortlist without "For …". Then delete the application and confirm with a direct query that `school_id` is null. Clean up in `finally`.
- [ ] Run all units, typecheck, lint, all RLS scripts, the production build and the browser journeys locally and in CI. Exercise desktop, phone and keyboard (tab to Track, Attach, the dialog and the checkboxes).
- [ ] Obtain an actual Claude source review on the final head; fix substantive findings with regression tests first.
- [ ] PR to develop, then the release PR to main with exact-head CI. Apply the migration to production before deploying (record the result on PROD-77), deploy, and verify the exact SHA and both flows. Mark PROD-148 Done and move PROD-77 to its next state only after release verification; the rest of PROD-77 (more opportunity types, `user_scholarships`, Today reminders for scholarship deadlines) stays open.

## Out of scope

- Writing `intended_majors` or notes from a course; course-specific deadlines; more than one application per university.
- Attaching the student's own custom scholarships (`user_scholarships.school_id`).
- Scholarship deadlines on Today or the dashboard rollup.
- A hub RPC, unless Task 7 shows a real regression.
- A `course_offering_majors` table (follow-up when catalogue ingestion exists).

## Execution status

23 October 2026: planning only. Reconnaissance is recorded in the spec. No branch, migration or code exists for this lane. Task 0 and its owner gate come first.

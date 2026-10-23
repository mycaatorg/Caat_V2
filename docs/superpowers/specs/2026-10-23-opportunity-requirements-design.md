# Finish the application: course-to-application links and scholarship requirements — PROD-148 and minimal PROD-77

One lane, two tickets. PROD-148 connects a saved course to the student's per-university application and links majors to catalogue courses through a reviewed mapping. Minimal PROD-77 lets a student attach a saved scholarship to one of their applications and shows a requirements checklist built only from recorded data. Both build on PROD-147 (application hub preparation checklist, hub scholarship panel, deadline links to `/applications/[id]`) and PROD-76 (`course_offerings`, `user_course_bookmarks`, `/courses`, course rows in Shortlist and Today). Planning only; nothing here exists yet.

## Verified reconnaissance, 23 October 2026

Read from the working tree (main at 4f51ba9, which contains PROD-76 via PR187) and `origin/codex/caat-hub-scholarships-and-links` (PROD-147, unmerged at the time of writing). Schema facts are from `caat-frontend/tests/staging/schema.snapshot.json` (production schema metadata, provenance 4 October 2026), `tests/staging/schema.sql`, `supabase/migrations/` and `types/database.ts`.

### Applications
- `user_school_applications` is one row per student per university: `UNIQUE (user_id, school_id)`, `school_id integer NOT NULL` FK `schools(id) ON DELETE CASCADE`, `user_id` FK `auth.users ON DELETE CASCADE`. One RLS policy `ALL` with `auth.uid() = user_id` both ways. Columns: id, status (checked enum, default `researching`), deadline_at (date), notes, intended_majors text[], timestamps. There is no course or opportunity column, so a course can only point at "the application at its university". That is enough for PROD-148; no schema change needed.
- Creation today: `addApplication(schoolId)` in `app/(main)/applications/api.ts` inserts `{user_id, school_id, status: 'researching', intended_majors: profile.target_majors}` and returns the row with `schools(id,name,country)`. Callers: Shortlist university row "Start application" (`components/shortlist/ShortlistView.tsx` `startApplication`, per-school busy key), school detail "Track Application" (`app/(main)/schools/[id]/application-button.tsx`), the applications page search (ref guard against double click) and bulk `importBookmarkedSchools`. All are explicit clicks. None handles the unique violation (23505) from a second tab: it surfaces as a generic failure toast even though the application now exists. `sanitizeError` hides the code, so the code must be read before sanitising.
- `fetchApplicationForSchool(schoolId)` already returns the owner's row or null.
- Hub data: `fetchApplicationHub` in `app/(main)/applications/[id]/api.ts` (client-side, browser Supabase client). On the PROD-147 branch it runs the application read, then `Promise.all` of profile, essay prompts, drafts, documents and the catalogue scholarship read, then `fetchTrackedForSchool(schoolName)` sequentially. That last call reads every one of the student's scholarship bookmarks with a join and matches `scholarships.school_name` to the school name in JS (inference by name), and swallows errors as an empty list.
- Hub layout on PROD-147: left column = Preparation checklist card (`data-prep-checklist`, 3 steps from `lib/preparation-checklist.ts`, footnote "Tracks what you have prepared in CAAT. It does not send anything to the university."), Essays, Documents, "Scholarships for this school" (a "You're tracking" group from the name match, then "Also listed for this school" from `scholarship_schools`, with an unavailable state distinct from empty). Right rail = Status, deadline, notes.

### Courses (PROD-76)
- `course_offerings.school_id bigint NULL` FK `schools(id) ON DELETE SET NULL`, resolved in the migration by exact `schools.name` and country; unmapped stays NULL. Fields for the hub: `application_route`, `application_url`, `source_url NOT NULL`, `verified_at`, `active`. Public SELECT only.
- In disposable test stacks none of the five seeded offerings map to a school (the real university names do not exist there; the synthetic school is `900001 E2E Test University`). Journeys need a synthetic offering mapped to 900001, inserted after the course migration (bootstrap runs `seed.sql` before `20261023070000_course_offerings.sql`).
- `user_course_bookmarks (user_id, course_id)` owner RLS for SELECT/INSERT/DELETE.
- `loadShortlist` selects `course_offerings(id, name, institution_name, campus, active, source_url)`, not `school_id`, and already loads the owner's applications into `appsBySchool`. `/courses` server page loads the cached catalogue and the owner's saved ids only; it does not load applications.
- `courseFreshness(verified_at, now)` and `<CourseSource>` (date plus 90-day stale copy plus official link) exist and are reusable.

### Majors
- `majors (id uuid, name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)`. No slug and no unique constraint on name. `school_majors (school_id, major_id)` exists but links majors to universities, not to offerings. There is no major-to-offering relation anywhere.
- Detail page `app/(main)/majors/[id]/page.tsx` is a server component with sections Career Paths, Typical Coursework, Degree Length by Country.

### Scholarships
- `user_bookmarked_scholarships`: PK `(user_id, scholarship_id)`, `status` (checked: interested/applied/awarded/not_selected), `school_id integer NULL` FK `schools(id) ON DELETE SET NULL`, created_at. Index on user_id only.
- RLS policies: SELECT, INSERT, DELETE for `authenticated` with `auth.uid() = user_id`. **There is no UPDATE policy.** Table grants include UPDATE, but with RLS on and no UPDATE policy every UPDATE matches zero rows. Consequences:
  - `school_id` cannot be written by a student today. It is read (`fetchBookmarkTracking`, scholarships page and client) but never written; `ScholarshipTracking.tsx` states by design that there is "no manual 'applying at' link".
  - `trackScholarship` upserts `{user_id, scholarship_id, status}` with `onConflict`. On an existing bookmark that becomes `INSERT ... ON CONFLICT DO UPDATE`, which RLS should reject because no UPDATE policy exists. So changing an existing bookmark's status (Interested → Applied) is very likely broken in production today. The existing journey ("scholarship status persists…") only goes from unsaved to Applied (the insert path), so CI would not catch it. This must be confirmed with a real RLS test before anything else (plan Task 0).
- No `application_requirements` table exists. `scholarships.application_requirements` is a **jsonb column**. Keys read by the app: `application_mode` (string), `separate_application_required` (boolean), `must_meet` (string[]), `eligibility_text` (string). The values come from the LLM extraction pipeline (`docs/superpowers/plans/2026-07-03-scholarship-pipeline.md`), so they are recorded data, not verified facts.
- Other recorded fields used here: `requires_essay boolean NULL`, `deadline_at`, `application_open_at`, `external_url`, `last_verified_at`, `source_last_synced_at`, `school_name`, `is_active`.
- PROD-75 freshness lives inside `explainEligibility` in `lib/scholarship-eligibility.ts`: `last_verified_at` only, more than 90 days old means stale, missing, future or invalid means unverified, plus `safeHref(external_url)`. The private `timestamp()` helper and `FRESH_DAYS` are **not exported**, so they need a behaviour-preserving extraction before reuse.
- M3 source audit (plan `2026-10-23-m3-eligibility.md`): 4,224 production rows, none verified in the last 90 days (PROD-143 tracks re-verification). Until that lands, nearly every checklist will show stale or unverified sources.
- `user_scholarships` (the student's own custom scholarships) also has `school_id`. It is out of scope here (see open questions).

## PROD-148 decisions

### A. "Track an application at <university>" on a saved course
- Shown on each Shortlist course row and each `/courses` card **that the student has saved**. The label uses the course's `institution_name`, matching what the row already shows.
- State comes from the owner's applications keyed by `course.school_id`:
  - Application exists → link "Open your <institution> application" to `/applications/<id>` plus the status pill, matching the Shortlist university row.
  - No application → button "Track an application at <institution>". **Only a click creates it.** No creation on save, render, page load, import or retry. Tooltip/help text: "Adds <institution> to My applications so you can prepare. It does not apply to the university."
  - `school_id` NULL → no button; muted text "This course isn't linked to a university in CAAT yet." Never guess a school from the name.
- Creation reuses `addApplication` through a new `startApplicationForSchool(schoolId)` that treats 23505 as "already exists": it reads the existing row and returns it as a success ("You're already tracking <institution>"). Other errors leave the button enabled with a retry toast. An in-flight guard keyed `apply-<schoolId>` (shared with the university row) stops double creation, so two saved courses at one university resolve to the same application.
- After creation the action becomes the Open link in place; no automatic navigation. Every course row at that university updates together because state is keyed by school.
- No university bookmark is created or removed (PROD-76 rule). The application's `intended_majors` default stays as `addApplication` does it today (profile target majors). The course does **not** write `intended_majors` or notes.
- `/courses` gains an owner-scoped, uncached `user_school_applications (id, school_id, status)` read on the server, passed as initial state and reloaded on account switch with the same owner guard the saved ids use. If it fails, the action shows "Couldn't check your applications. Retry" rather than offering to create one, so a failed read cannot lead to a misleading create.
- Shortlist: `loadShortlist` adds `school_id` to the course select; course rows look up `appsBySchool`. The Shortlist "Start application" button and the new course action share the busy key and the `startApplicationForSchool` helper.

### B. Saved courses on the application hub
- New hub card **"Courses you saved at <school>"**, placed directly under the Preparation checklist card (course choice comes before essays and documents). It is not a preparation step and does not change "x of 3 steps".
- Query (owner-scoped, one round trip, parallel with the others): `user_course_bookmarks.select('course_id, course_offerings!inner(id, name, campus, application_route, application_url, source_url, verified_at, active, school_id)').eq('user_id', uid).eq('course_offerings.school_id', schoolId)`.
- Each row shows: course name linking to `/courses?course=<id>`, campus, **official application route** (`application_route` text, or "Application route not recorded. Check the provider."), the application link when `application_url` is safe, and `<CourseSource>` for the source URL, verification date and freshness. Inactive saved courses stay listed with the PROD-76 "No longer in the active catalogue" copy.
- Empty: "You haven't saved a course at <school>." plus a link to `/courses`. Read failure: "Couldn't load your saved courses. Retry", never the empty copy.
- Courses saved at a university **without** an application do not appear anywhere new except via the action in A.

### C. Major → catalogue courses (reviewed mapping, no inference)
- Recommended: **no schema change.** A checked-in, reviewed mapping `lib/course-major-map.ts`: entries `{ courseId, majorName, reviewedOn, note }`. Major names are matched exactly (case-sensitive, trimmed) against `majors.name`. No fuzzy matching, no category matching, no `school_majors` inference. A course ID missing from the catalogue or an inactive course is silently not shown; a test fails if a mapping references an unknown seeded course ID.
- Why code and not a table: five offerings, changes go through PR review (which is the "reviewed" step), and it avoids another catalogue migration while coverage is a starter set. Revisit with a `course_offering_majors` table once the catalogue has ingestion (see open questions).
- Initial mapping is a **proposal that needs owner sign-off** before merge, after a read-only check that these exact major names exist once in production: Computer Science → `unsw-3778-kensington`, `unsw-3789-kensington`, `sydney-bpadvcmp1000-camperdown`, `anu-aacom`; Commerce or Business (whichever exact production name exists) → `unsw-3502-kensington`. If a name is missing or duplicated, that pair is dropped rather than re-pointed.
- Placement: new section "University courses in CAAT" after Typical Coursework on the major page, same `font-code` uppercase heading style. Rows: course name, institution, campus, linking to `/courses?course=<id>`. Footnote: "A reviewed starter list, not every course that teaches this major." No section when the major has no mapping. Catalogue load failure: "Couldn't load university courses." (not hidden, not "none").

## PROD-77 (minimal) decisions

### D. Attach a saved scholarship to an application
- Storage: the existing `user_bookmarked_scholarships.school_id`. One bookmark has one `school_id`, so a scholarship can be attached to **at most one** application at a time. Moving it is an explicit action with the current target named ("Currently attached to University of Sydney. Move it here?").
- Required migration (unavoidable; no new columns on existing tables):
  1. An UPDATE policy on `user_bookmarked_scholarships` for `authenticated`: `USING (auth.uid() = user_id)` and `WITH CHECK (auth.uid() = user_id AND (school_id IS NULL OR EXISTS (SELECT 1 FROM user_school_applications a WHERE a.user_id = auth.uid() AND a.school_id = user_bookmarked_scholarships.school_id)))`. This lets a student attach only to a university where they have an application. It also fixes the status-change bug above, which is the riskiest side effect and gets its own regression test.
  2. An `AFTER DELETE` trigger on `user_school_applications` that sets `school_id = NULL` on that owner's bookmarks for that school, so deleting an application detaches its scholarships. Without it, later status changes on those bookmarks would fail the WITH CHECK, and recreating the application would silently re-attach old scholarships.
  3. Optional ticks table (see F).
- UI on the hub's scholarships card, which becomes three groups in this order:
  1. **"Attached to this application"**: one requirements checklist per attached scholarship (E), with Detach.
  2. **"Saved scholarships that mention <school>"**: the existing name-matched list (`fetchTrackedForSchool`) minus attached ones, each with an **Attach** button. The name match only *suggests*; nothing is attached automatically. Its read errors become an unavailable state instead of an empty list.
  3. "Also listed for this school" (PROD-147 catalogue list, unchanged).
  Plus a button "Attach a saved scholarship" that opens a dialog listing all the student's bookmarks (title, provider, status, current attachment). Saving a new scholarship from inside the dialog is out of scope; the dialog links to `/scholarships`.
- Fixed attach copy, shown in the dialog and under group 1: "Attaching a scholarship organises your preparation for <school>. It does not mean you are eligible, and it does not apply for you." If `scholarships.school_name` is recorded and differs from the school, show it neutrally: "Recorded institution: <school_name>." No warning that implies a rule.
- Shortlist scholarship rows show "For <school>" when attached (read from the existing `school_id` plus `appsBySchool`), linking to the hub. No attach control on Shortlist in this minimal slice.
- Writes are not optimistic: the button shows pending, the write is `update({school_id}).eq('user_id').eq('scholarship_id').select('scholarship_id, school_id')`, and zero rows returned is an error ("Couldn't attach. Make sure you still have this application, then try again."). Detach writes `school_id: null` the same way. On success the hub updates locally; no full refetch needed.

### E. Per-scholarship requirements checklist (recorded data only)
- A pure function `scholarshipChecklist(row, now)` in `lib/scholarship-requirements.ts` builds the items. It uses only the scholarship row and the extracted PROD-75 source helper; no profile data. Item kinds, fixed order, with stable keys:
  1. `separate-application`: `application_requirements.separate_application_required === true` → "A separate scholarship application is required (recorded)"; `false` → "No separate application is required (recorded)"; anything else → "Not recorded whether a separate application is needed". `application_mode` is shown as recorded text if it is a non-empty string.
  2. `essay`: `requires_essay` true → "An essay is required (recorded)"; false → "No essay is required (recorded)"; null → "Not recorded whether an essay is required". It does **not** link to or count essays drafted in CAAT: no inference that an existing draft meets the requirement.
  3. `deadline`: valid `deadline_at` in the future → "Closes <date> (recorded)"; in the past → "The recorded closing date (<date>) has passed. Check whether it has reopened."; missing or invalid → "No closing date recorded". This is not merged into the application's own deadline step.
  4. `official-link`: `safeHref(external_url)` → "Read the official scholarship page" with the link; otherwise "No safe official link recorded".
  5. `rule:<hash>` for each recorded rule: `must_meet` strings, plus `eligibility_text` when it differs from `eligibility_summary` and from every `must_meet` entry (the same dedupe rule `explainEligibility` uses). Label: "Recorded rule: <text>". The state is always "Check with the provider". No matched or unmet status, no profile comparison. A link "See how this compares with your profile" goes to the scholarship page, where PROD-75's panel already does the limited comparison.
- Each item carries a three-way recorded state, `recorded`, `not-recorded` or `passed` (deadline only), shown as text, not colour alone. Unknown stays unknown, never "No".
- Source label: **every item** shows the source state from the extracted helper: "Recorded <verified date>", followed by "source checked within 90 days", "source not checked in over 90 days; details may have changed" or "source verification date unknown". In the UI the label is written once per scholarship header and repeated as a short suffix ("as recorded <date>, stale") on each item so an item read alone (screen reader, narrow screen) still carries it. `source_last_synced_at` is labelled separately as "synced", never as verified (PROD-75 rule).
- Inactive scholarships (`is_active = false`) show "No longer active in CAAT's catalogue" at the top of their checklist; items still render.
- Hash for rule keys: a stable string hash of the normalised (trimmed, whitespace-collapsed) text. Reordering keeps ticks; changed text yields a new key, so an old tick never lands on a different rule.
- No copy of notes, rules or text is stored anywhere. The checklist is recomputed from the catalogue row on each load.

### F. Ticks (preparation only)
- Students can tick any item as "Prepared" (checkbox label "I've prepared this"). Ticks never change application status, scholarship status, or the 3-step application score, and the card footnote repeats the PROD-147 line: "Ticks track your preparation in CAAT. They don't submit anything to the provider."
- Persistence needs storage, and no existing column fits without copying text. Recommended: an additive table `user_scholarship_prep_checks (user_id uuid, scholarship_id uuid, item_key text, checked_at timestamptz default now(), PRIMARY KEY (user_id, scholarship_id, item_key), FOREIGN KEY (user_id, scholarship_id) REFERENCES user_bookmarked_scholarships ON DELETE CASCADE)` with owner SELECT/INSERT/DELETE RLS (no UPDATE) and an item_key length/format CHECK. It stores keys only, no text. Removing the bookmark removes its ticks; detaching keeps them, because preparation for a scholarship survives a move.
- Ticks whose key no longer matches a derived item are ignored, not shown.
- Fallback if the owner rejects a new table: ship E read-only without ticks (F becomes a follow-up). Do not fall back to localStorage, `user_todos` or notes.
- Tick writes are optimistic per key with a per-key in-flight guard. On failure, only that key reverts and a toast offers retry. Results for a previous account are discarded (same owner-guard pattern as the course saves).

## Owner and privacy boundaries
- All new reads are owner-filtered with `.eq('user_id', uid)` **and** RLS. Catalogue tables stay public-read and are never written by students.
- RLS guarantees: a student cannot attach a peer's bookmark (zero rows), cannot attach to a university without their own application (WITH CHECK), cannot read or write a peer's ticks, and anon has no access. The attach write returns the row and asserts it, so an RLS no-op cannot report success.
- No profile fields are read for E. The major mapping and course catalogue are global, cached and contain no personal data. The applications read on `/courses` is never put into `unstable_cache`.
- Account data export (`app/(main)/settings/export/route.ts`) adds `user_scholarship_prep_checks`. Account deletion is covered by the FK cascades (auth.users → bookmarks → ticks); the RLS test proves it.

## Failure and retry summary
| Action | On failure | Retry |
|---|---|---|
| Start application (course row/card) | Button stays, toast "Couldn't start tracking. Try again." 23505 → treated as success with the existing row. | Manual click only; never automatic |
| Applications read on `/courses` | Action replaced by "Couldn't check your applications" + Retry; no create button | Retry button |
| Hub saved-courses read | Card shows unavailable + Retry, not empty | Card-level retry, rest of hub unaffected |
| Hub attached-scholarships read | Group 1 unavailable + Retry; attach button disabled (we can't show the current state) | Card-level retry |
| Name-match suggestions read | Group 2 unavailable message (no longer silent `[]`) | Card-level retry |
| Attach / detach / move | Pending state, then toast; nothing moves locally | Click again |
| Tick / untick | That key reverts, toast | Click again |
| Major page catalogue read | "Couldn't load university courses." | Page reload |

## What persists
- PROD-148: only `user_school_applications` rows, and only when the student clicks. The major mapping lives in code.
- PROD-77: `user_bookmarked_scholarships.school_id` (attach/detach/move), and `user_scholarship_prep_checks` rows (ticks) if F is approved. A bookmark's `status` behaves as before, now actually updatable.

## Risks, stated plainly
- **Attaching reads as eligibility.** Mitigated by the fixed copy, no matched or unmet states, no attach suggestion that says "eligible", and suggestions labelled "mention <school>". Residual risk: students will still read "attached" as "applies here". Copy review by the owner is required.
- **Creating applications the student didn't ask for.** Only one code path creates (a labelled button click). Tests assert no insert on mount, save, hover, reload or retry, and that a 23505 race never creates a second row (the unique constraint guarantees it server-side).
- **Policy change widens writes.** The new UPDATE policy also lets a student change `scholarship_id` on their own bookmark row via a crafted request. It is harmless (own row, FK enforced), but it is a broader grant than needed; column-level UPDATE grants were considered and rejected because the existing `trackScholarship` upsert would then fail. Noted for security review.
- **The fix changes existing behaviour.** Status changes on existing bookmarks start working. That is the intended behaviour, but it has been silently failing (likely with an error toast). Confirm with the owner that no one depended on it.
- **Hub query cost.** The hub goes from about 7 to about 10 round trips (saved courses, attached scholarships with jsonb, ticks), all owner-scoped and run in parallel, plus the existing sequential name-match read. The unbounded name-match read (all bookmarks plus a join) stays; it is moved into the parallel batch. If p95 hub load regresses noticeably, a single `security invoker` RPC is the follow-up, not part of this lane.
- **Stale data everywhere.** With zero production scholarships verified in 90 days, most checklists will say "not checked in over 90 days". That is honest but noisy. PROD-143 is the real fix.
- **LLM-extracted requirements.** `must_meet` and `separate_application_required` come from extraction, so they can be wrong in either direction. Labelled "recorded"; never presented as the provider's word.
- **One attachment per scholarship.** Portable scholarships used at several universities can't be attached to all of them. This is a limit of the existing column, stated in the UI ("A scholarship can be attached to one application at a time").
- **Major mapping judgement.** "Computer Science" ↔ "Bachelor of Advanced Computing" is an editorial call. Owner sign-off is the review step.

## Verification required
Unit: `startApplicationForSchool` (exists, creates, 23505, other errors, foreign/zero rows); course action component (no create on mount or save, double-click guard, shared busy key, null `school_id`, failed applications read); Shortlist and `/courses` integration (account switch discards stale applications); hub saved-courses mapping and failure state; mapping integrity (unknown IDs, duplicates, exact-name match only); major section empty/error/present; extracted freshness helper (identical outputs to `explainEligibility` on the existing fixtures); `scholarshipChecklist` for every recorded/not-recorded/passed/invalid branch, rule dedupe, key stability, and absence of "eligible", "matched" or "submitted" wording; attach/detach/tick API with zero-row assertions; hub client groups, move confirmation, optimistic tick rollback, score unchanged.
Real RLS (`tests/staging/opportunity-rls.mjs`, disposable stack only): status update on an existing bookmark (bug regression), attach with and without own application, peer spoofing, application delete detaches, bookmark delete cascades ticks, anon denied, account deletion cascade.
Persisted journeys (one per ticket): see the plan's Task 7. Desktop, phone, keyboard. Actual Claude review and CI on the exact head before release. No paid services.

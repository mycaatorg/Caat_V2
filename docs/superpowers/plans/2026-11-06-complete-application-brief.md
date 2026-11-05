# Complete optional application planning sections

> Execute inline using executing-plans and TDD. User delegated product decisions and authorized reviewed/tested releases. PROD-266 under PROD-77; do not add this plan to the PROD-264 PR.

**Goal:** A student can choose to print course preparation and their application-linked personal tasks in the existing private application brief. Default-off choices preserve privacy. Use existing Next.js/TypeScript/Supabase/Vitest/Playwright stack and document styles; no new dependencies or migration.

**Current evidence:** The brief already supports core application/writing/document status, optional notes and attached scholarships. Application tasks are introduced by PROD-264. Course preparation already has source snapshots, reviewed status, current-course comparison and owner-scoped complete readers. Read-only inspection and Cortx consultation completed while PROD-264 release CI runs.

## Product decisions / boundaries

- Two independent default-off choices: Include course preparation; Include my personal application tasks. Existing notes/scholarship choices retain their meaning.
- Course section includes saved courses associated with this university plus this application's persisted course checks. Use `fetchCoursePreparation(applicationId, schoolId)` only after the owned hub loads. Preserve all checks, including a course absent from the catalogue: print prior recorded facts and an explicit current-information-unavailable/Needs review state. Never silently omit orphan checks.
- Current recorded facts and previously recorded snapshots remain distinct. Reuse PREPARATION_KEYS/LABELS, snapshotForCourse and preparationNeedsReview. A previously reviewed check becomes Needs review if current facts changed or course is inactive/moved/missing. Assumed knowledge stays preparation guidance, not automatically an entry requirement. Saved-but-unstarted courses show Not started. Do not claim eligibility or submission.
- Course facts allowlist: course name/code/campus; applicable item text; safe provider/source URLs; source year/checked timestamp; recorded personal check status. No linked evidence bodies, document contents, essay bodies, file paths or private work-source metadata. Keep previous and current facts with their respective timestamps.
- Task section reads `fetchApplicationTasks(applicationId)` and includes only linked owned tasks: text, optional date and completion. Stable ordering and complete collections; no 20-row UI limit in print. No priorities/IDs/private implementation fields. Label as personal work, not official requirements.
- Optional readers must fail closed: no partial data, printing disabled and print portal removed while any selected section is loading/unavailable. Unchecking a failed section permits the complete remaining brief. Errors are generic, never raw provider details.
- A refresh clears old data before reads; preserve the current user's choices for the same application and reload selected extras against the new hub. Auth/application remount resets choices and data. Generation guards ignore late reads after deselection, refresh or account/application change. Pending read generations cannot resurrect a deselected section.
- Existing core brief must still work when optional endpoints fail or choices are off. Both screen and print render one immutable prepared snapshot. Empty sections state the actual absence, never absence of official requirements.

## Task 1: allowlisted model and data completeness

- [ ] Add pure course/task brief builders with explicit types and strict allowlists; tests RED before implementation.
- [ ] Cover current/changed/inactive/moved/missing courses, multiple keys, source timestamps, Unicode/long text, hostile URLs, null snapshots, completed/undated tasks, no private fields and deterministic ordering. Ensure a missing course retains historical checks.
- [ ] Reuse complete owner-scoped readers, not an unpaged alternative. Readers must not fetch private linked evidence/draft content.

## Task 2: optional preview and print sections

- [ ] Add independent checkboxes and guarded asynchronous states. Test default exclusion, independent choices, selection pending/error printing block, uncheck recovery, refresh clearing stale source data, account/application changes and late completions.
- [ ] Extend document view with clearly separated previous/current course facts and full personal task rows. Reuse existing typography, source-note and table styles; long items can flow across pages without clipping. Screen/print previews must contain the same selected data.
- [ ] Keep core/notes/scholarships existing tests green. New React effects should not add legacy compiler-warning suppressions.

## Task 3: verification and release

- [ ] Real isolated desktop/emulated Android/iPhone journey: create scoped checks and personal tasks; change catalogue source to prove Needs review; include/exclude both; inject a late-page failure; inspect long multipage PDF and screenshots. Restore only the exact synthetic fixture changes and clean all created rows.
- [ ] Real PostgREST cap50 with >50 linked tasks/checks proves complete last items. Add the journey to the existing low-cap gate.
- [ ] Full units, types, strict lint, clean build, actual Claude and one fresh whole-delta independent review. Fix blockers once with RED→GREEN evidence; ticket minors.
- [ ] Exact-head feature/develop/release/main CI, READY production aliases, live smoke/provider/sitemap/identity and computed print/screen CSS checks. No student writes or human/physical-device claims. Mark PROD-266 Done only after those gates.

## Review focus

Default-off privacy; allowlist/no evidence or essay contents; source snapshot vs current truth and missing catalogue rows; conditional complete reads; old request resurrection after deselection/account/app/refresh; selected optional failures cannot print partial output; date-only and safe URL handling; long PDF content completeness; same immutable preview/print data; no impact on existing brief when extras excluded.

# Course requirements and personal follow-ups — PROD-169

First release under PROD-168. A student on a university application can inspect the courses they saved there, distinguish recorded prerequisites from assumed knowledge, open the relevant source, and save an editable personal follow-up to Today. This builds on existing course comparison and bookmarks.

## Behavior

Extend HubCourse with prerequisites, prerequisites_url, assumed_knowledge, source_year. Normalize blanks, unsafe URLs and invalid years to null. Read all saved courses using stable course_id ordering and 200-row pages; a failed page or malformed joined course makes the card unavailable rather than silently omitting saved work.

Keep the existing route and source display. Add a compact requirements block per course: “Recorded prerequisites”, “Assumed knowledge”, source year (or unknown), safe prerequisite-page link. Missing prerequisites explicitly mean unknown, not none. Assumed knowledge is preparation guidance, not automatically a mandatory entry requirement. Stale, unknown and inactive source states retain existing wording. No new seeded facts, source verification dates or eligibility claims.

A per-course “Plan a follow-up” button opens the established accessible dialog with explicit return-focus ref. Student edits a prefilled task (confirm requirements for course/university), optional due date, and chooses Save to Today. Input is trimmed, nonempty, maximum 1000 characters; real calendar date or empty. The personal task is not a prerequisite checkmark and does not modify source details, status, readiness, bookmarks or eligibility. The task text and date are editable before saving. Post-save text/date editing on Today is separate work in PROD-170; this release does not claim that capability. Explain that tasks are personal notes, not admission decisions or submissions. Success shows an in-card confirmation and link to /today?view=todos. Error keeps the entered fields and allows retry; lock submits synchronously while saving and guard modal close. Safe generic errors never render backend detail.

Use existing addTodo owner-authenticated insert, default medium priority, no schema migration. A successful response must contain a saved row, never treat a missing row as success. Existing account export and Today loaders already include user_todos. Existing account-deletion behavior is unchanged. No email notifications implied by a personal due date.

## Boundaries and subsequent slice

PROD-168 remains In Progress: versioned provider requirement identities/snapshots, explicit review of changed/removed rules, persisted preparation checks and requirement-level evidence links are subsequent work. Personal tasks in this slice are student-owned free text; they do not track provider updates automatically. No checkboxes that could drift between versions are introduced.

## Validation

Unit tests cover normalized fields/URLs/years, multiple pages/read failure/malformed rows, clear copy, editable task/date, write rejection retaining input, double-submit, close focus and no false success. Real isolated desktop and phone journeys save a task and see it on Today, verify unchanged application state and task ownership, and exercise failure recovery. Existing full unit suite, typecheck/lint, independent and actual Claude review, exact-head CI and deployment health gate completion. Real human pilot remains PROD-81.

# Personal scholarship deadline workspace (PROD-220)

Improve the existing My Scholarships collection, which contains opportunities the student entered themselves. Catalog discovery/matching is already implemented and stays separate. Use existing Next.js/React/Tailwind/Supabase and CAAT typography/maroon theme; no schema or dependencies.

## Student experience
Retain My Scholarships heading and existing add/edit/delete cards. Add a concise planning introduction, links to Today and calendar, and a complete collection overview: all records, upcoming (today or later), past deadlines, and no valid deadline. Search title/provider/country case-insensitively; combine with labelled filter buttons and deadline/newest/name sorting. Default All, deadline ascending (undated last), deterministic id tie-breaks. Counts use full loaded data; results count names the visible subset. Reset restores empty query/All. True-empty and filtered-empty guidance differ.

Use date-only values in the student's local calendar. Invalid dates are not rendered with date-fns format and never counted as upcoming/past; show Check deadline and include in No deadline view. Do not aggregate amounts across currencies/frequencies, imply eligibility or award likelihood, or invent new verification data. Clearly label the collection as self-entered and retain provider links. All controls, long names, forms and cards fit phones.

## Data and recovery
fetchUserScholarships loads every owner-scoped page with evidencePages, stable created_at desc/id asc, and terminal empty read. Unauthenticated and any page error reject, never appear as an empty collection. Retryable alert hides totals until complete. Loading/retry hides add entry points until the initial complete read to prevent stale fetch overwriting newly added rows. Old requests cannot set state after panel unmount.

Deletion confirms an owned returned id; zero-row or API failures keep the card with error feedback. Existing form retains typed values after failed save and blocks duplicate submissions/accidental close while an active save is pending. Add explicit busy guard, labelled close action and inline retryable failure message if missing; preserve manual cancellation when idle. Do not reset notes or form drafts when workspace controls change. No claim of draft persistence after deliberate dialog cancellation/browser closure.

## Verification
Unit API tests for short pages/terminal/error/auth/owner filters and zero-row delete. UI/helper tests for date boundaries, invalid dates, search/sort/filter/reset, load retry and full counts, failed form saves and deletion. Actual isolated browser journey desktop/Android/iPhone: create three personal scholarships (upcoming,past,undated), search/filter/sort, edit under outage, delete under outage, reload and safe links, phone overflow/screenshots, existing Today custom deadline regression. Full suite, build/types/lint, actual Claude and independent review, hosted gates and exact deployment before Done. No production student CRUD/human pilot claim.

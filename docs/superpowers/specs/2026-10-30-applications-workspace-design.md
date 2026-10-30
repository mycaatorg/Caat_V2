# Applications planning workspace (PROD-218)

Turn the flat application list into a useful student planning workspace. The user delegates product choices and requests continuous implementation, testing, review and release without approval menus.

## Design decisions
Use the existing Next.js/React/Tailwind/Supabase stack and CAAT maroon, typography and theme tokens. Default to a responsive board: one column on phones, two on medium widths, four on wide desktops. Offer a list view for scanning. Keep existing cards, explicit status controls, preparation checklist, deadline editing, notes, add/import and confirmed deletion.

Four lanes map the eight manual statuses: Researching (researching), Preparing (applying), Awaiting outcome (submitted, decision_pending), Outcomes (accepted, rejected, waitlisted, withdrawn). Counts describe tracked records, never readiness or admission chances. A compact stage overview shows all loaded applications; board headings count matching applications. Copy states that statuses are student-maintained and CAAT does not submit applications.

Search tracked university names/countries case-insensitively; keep All/In Progress/Outcome filters. Sorting: newest by created_at descending (default), deadline ascending with undated last, university ascending; deterministic id tie-breaks. Empty search/filter results offer Reset filters; true empty state offers add/import guidance. Today and shortlist links connect existing workspaces.

Fetch the complete owner-scoped application set using evidencePages and stable created_at/id ordering, continuing after short pages until empty. Any page failure yields the existing retryable load error; no partial totals or fabricated zero stage counts. No schema or external integration changes.

## Drafts and accessibility
Lift note text, open state, save status, debounce timers and sequence tracking into a keyed workspace hook. Switching board/list, changing filters, sorting and moving lanes preserves pending and failed drafts. Retain 800ms debounce, clear/retry and ordered writes; cancel queued note save on delete to prevent an update after deletion. Failed deletion restores the row and its draft. Flush pending saves through the existing ordered write queue when ordinary navigation unmounts the workspace, then clean up timers. No cross-session draft persistence claim.

Use labelled search/sort/status controls, pressed view/filter buttons, labelled lanes and stage counts. Preserve focus after lane moves and failed status rollback; avoid drag-only interactions. Long names and date inputs must fit phone screens. Reuse existing failure/ownership rules.

## Verification / release
API tests for multiple capped pages, stable owner ordering, terminal empty page and later-page failure. UI tests for lane mapping/counts, search/sort/reset, load errors, draft preservation and failed writes. Real local browser journey on desktop/Android/iPhone for view switches, notes reload, status movement/rollback, keyboard and horizontal overflow; preserve screenshots. Full unit/coverage/build/type/lint and hosted CI, actual Claude and independent final review. Merge and verify exact main deployment/aliases/post-READY provider health before Linear Done. Human pilot and production student CRUD remain unperformed unless actually executed.

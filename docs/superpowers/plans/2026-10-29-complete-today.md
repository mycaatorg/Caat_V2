# PROD-207 — complete Today and deadline reads

Use the already verified shared pager for full Today collections and all unified deadline sources. Preserve owner filters, existing projection privacy, student-local dates, status rules and newest-first saved previews. Add unique order tie-breakers. Keep the intentional latest-resume limit and optional custom prompt title fallback. Do not change dashboard event editing or calendar download formats.

1. Reproduce capped deadline sources, capped Today collections/to-dos, wrong late-page scholarship status and late failed/missing pages. Observe RED. Keep fixtures finite.
2. Replace single-page and short-page-EOF reads with the shared bounded pager. Confirm GREEN and existing semantics/owner filters.
3. Exercise Today with more than one real database page, including low-cap queries; whole unit coverage/type/lint, actual Claude review and one fresh whole-branch review. Require feature/release/main CI and exact production deployment checks. No production migration.

Follow-up boundary: the dashboard's separate editable calendar_events query and its existing optional-overlay failure UX are separate from this loader change; track if still capped after the audit. Buffered, nontransactional snapshots and extra terminal reads remain intentional.

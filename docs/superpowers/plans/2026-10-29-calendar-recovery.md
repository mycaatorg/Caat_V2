# PROD-209 — complete, recoverable dashboard calendar

Use the current React/Supabase stack and shared bounded pager. Preserve student-local dates and existing event CRUD. Load editable events in stable time_start/id order with the owner filter. Resolve events and the unified deadline overlay independently: retain successful content, visibly identify any failed source, and offer Retry calendar. Never claim Nothing on this date while loading or after either source fails. Retry starts a fresh read; ignore late results after unmount. Disable calendar writes during loading so a refresh cannot overwrite a new edit.

1. Observe failures for capped events, late-page failure, overlay failure, retry, authentication failure and loading state in component tests.
2. Implement pagination and recoverable read states. Keep privacy and dates unchanged.
3. Add desktop/mobile browser coverage for late real rows and a failed request/retry. Run unit coverage/type/lint, actual Claude and a final independent branch review, then feature/release/main CI and exact deployment checks. No migration.

Scope: no CRUD redesign, keyset snapshots, database/schema changes or calendar restyling. Existing buffered nontransactional paging limitation remains. Preserve ignored evidence.

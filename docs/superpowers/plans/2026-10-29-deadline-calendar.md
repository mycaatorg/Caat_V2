# PROD-203: calendar snapshot of upcoming due dates

Use existing Next.js/Supabase and CAAT Today styling. Add a quiet download control beneath Coming up (also in its expanded view), with clear snapshot/all-day/source-check copy. No calendar connection, scheduled messaging or live-sync claims. User has delegated product/implementation decisions and repeatedly approved continuous build/test/review/release.

Authenticated GET /today/calendar returns an owner-only .ics attachment from all upcoming applications, saved catalogue scholarships and personal scholarships. Exclude calendar appointments and task text. Use current hidden application statuses and recorded date semantics. Paginate until an empty page (even when the server returns less than the requested size); stable unique source ordering, finite row/page limits, fail the whole export on source failure. Snapshot may reflect edits during preparation. Empty export returns204 with useful UI status.

Serializer follows RFC5545: CRLF, escaped TEXT, UTF-8-aware75-octet line folding, all-day DTSTART and exclusive next-day DTEND, stable account/source/item UID, UTC DTSTAMP, fixed CAAT origin for return links. Never include essays, documents, notes, secrets or invitation/alarm components. Source: https://www.rfc-editor.org/rfc/rfc5545 (3.1,3.3.11,3.6.1).

Tasks: (1) failing serializer/pagination/route tests, implement serializer+owner loader+route; (2) Today control, component failure/empty/retry tests and real download browser coverage with owned/peer fixtures; (3) full coverage/typecheck/lint, desktop/phone verification, real parser check, Claude+fresh independent review; (4) PR/CI/release/exact-main/auth/READY/live gates.

Review focus: cross-account data, source filters, cap/pagination truncation, date/timezone boundaries, CRLF/property injection, multibyte folding, download errors and unmount, snapshot wording and mobile/keyboard use. Preserve existing Today data and layout; feature adds no DB migration.

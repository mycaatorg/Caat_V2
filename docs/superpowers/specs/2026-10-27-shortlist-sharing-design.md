# Revocable shortlist sharing — PROD-80

Students need a focused way to discuss selected options with parents, teachers and advisers. Build on the existing shortlist and comparison, in the existing Next.js/React/Supabase app. User has delegated design decisions and authorized implementation, review and release without further approval gates.

## Product contract
- Student selects 1–20 currently saved catalogue items (courses, universities, majors, scholarships). No selection by default.
- Server prepares a recipient-only snapshot. Preview and recipient use the same renderer. Publish compares the exact preview to a fresh server reconstruction; changes require another preview.
- Only kind, catalogue ID, title, public details and provider URL are shared. Never include owner identity, application IDs/status, scholarship progress/attachments, profile, notes, essays, documents or preparation.
- Fixed snapshot: later catalogue/bookmark edits do not broaden or silently alter an existing share. Show snapshot date and 30-day expiry. At most 50 stored links per account; allow removal of old records.
- Anyone holding the link can read the chosen snapshot without signing in. Clearly explain this before creation. Revocation prevents subsequent reads, not copies already made.
- Owner can inspect shared contents, revoke access, remove an old record, or replace an active link. Replacement invalidates the prior token and preserves the snapshot/expiry. Copy/select fallback is accessible; tokens are recoverable only in the immediate creation/replacement result, otherwise replace the link.

## Architecture and security decisions (builder's calls)
A new owner-scoped `shortlist_shares` table stores UUID identity, owner FK with cascade, token hash, JSONB items, timestamps, revision and revocation. SHA-256 of a 32-byte browser crypto token is stored; raw tokens never enter tables/export. Owner SELECT and DELETE only, no direct INSERT/UPDATE. Authenticated SECURITY DEFINER RPCs build preview, create, rotate and revoke. Account-row lock serializes creation/cap checks. Expected revision guards replacement; revocation always wins at its row lock. Token/hash uniqueness and idempotent creation avoid ambiguous network retry duplicates.

A narrow SECURITY DEFINER read RPC accepts only the opaque token and returns items/created_at/expires_at when active; anonymous table access stays denied. No service-role browser/server secret is needed. All RPCs pin an empty search path and least-privilege EXECUTE. Logical conflicts use PT409, never custom40001.

Recipient page `/share/shortlist#<token>` keeps the capability out of URL paths/query logs and HTTP Referer. A dedicated non-persistent, sessionless client calls the read RPC via POST with no-store fetch; the public page contains no private server-rendered data. Private output is cleared on failed/revoked refresh, page hide, token change and expiration; refresh on visibility/focus and every30seconds. No indexing, no-referrer headers, and analytics/speed-insight beforeSend filters reject share-page events and strip fragments elsewhere. Never log tokens. RPC server checks are authoritative even when the recipient bypasses UI.

## Interface and recovery
Use a dedicated authenticated `/shortlist/share` page reached by “Share selected items” from the current shortlist. Selection is refreshed from current bookmarks, supports search, preserves picks across search, and is separate from normal shortlist filters/removal. A review step shows exactly the public items; creating a link is explicit. Failed preview/create preserves selection, no false success; 12-second aborted requests provide recovery. Manage existing links even when the shortlist is empty. Use existing paper/serif/maroon styling, simple rows and clear controls, mobile wrapping, keyboard focus and status announcements.

## Verification/release
Real database tests for forged/unowned/empty/duplicate selections, payload tampering, direct writes, cross-owner reads/mutations, token rotation, revoked/expired/removed access, snapshot stability, account cascade and concurrent creation/revocation. Unit/component tests cover bounded failures, selection/preview privacy, stale responses, no clipboard and recipient refresh clearing. Desktop/phone Chromium/WebKit journey publishes, reads anonymously, replaces and revokes. Fresh CI installs migration and tests. Include owner export without bearer secrets. Independent and actual Claude reviews; exact-head feature/develop/main CI, production migration ACL checks, live aliases/auth/HTTP verification. Human student pilot remains PROD-81.

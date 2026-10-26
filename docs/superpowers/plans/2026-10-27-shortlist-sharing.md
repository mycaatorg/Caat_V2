# Shortlist Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline, task-by-task.

**Goal:** Ship selected, previewed, revocable shortlist sharing (PROD-80).
**Architecture:** Database constructs immutable public-field snapshots; owner RPCs control opaque capabilities; sessionless recipient reads enforce expiry/revocation on every request.
**Tech Stack:** Existing Next.js/React/TypeScript, Supabase PostgreSQL, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-27-shortlist-sharing-design.md

## Global Constraints
- 1–20 explicitly selected items; 50 stored links/account; 30-day expiry; SHA-256 of 32 random bytes; no raw tokens stored/exported/logged.
- Share items only `{kind,id,title,details,sourceUrl}`; no owner/application/private work data. No custom40001 errors.
- Preserve existing shortlist/comparison. Reuse isolated worktree, no new dependency or service key.
- 12-second bounded client requests; recipient refresh every30seconds and on focus/visibility; clear on failure/hide/token change/expiry.
- User authorized native execution and release; retain review ledger as durable evidence.

## Review Focus
- Catalogue or bookmark changed after preview: create rejects unseen payload (Task1 SQL/Task2 UI).
- Concurrent create/replace/revoke: caps and revoked access remain enforced; idempotent retries don't duplicate (Task1 real DB/race).
- Slow earlier responses after navigation/selection changes: no stale share or new content overwrite (Task2 component).
- Copy blocked on mobile: selectable link and truthful copy result; no false success (Task2/browser).
- Capability leaking through analytics/referrer/cache or recipient retaining old data after revoke: filter/hide/fail closed and real anonymous read (Task2/3).

### Task1: Persisted sharing boundary
Files: migration20261027010000_shortlist_sharing.sql; types/shortlist-sharing.ts; types/database.ts; lib/shortlist-sharing.ts; lib/account-export-collections.ts; tests/staging/shortlist-sharing-rls.mjs; bootstrap scripts; tests/unit/shortlist-sharing.test.ts.
Interfaces: ShareSelection `{kind,id}[]`; SharedItem `{kind,id,title,details:string[],sourceUrl:string|null}`; SharedSnapshot `{items,created_at,expires_at}`; ShareRecord addsid/user_id/token_hash/revision/revoked_at. RPCs preview_shortlist_share(selection), create_shortlist_share(selection,expected_items,token), replace_shortlist_share(id,expected_revision,token), revoke_shortlist_share(id), read_shortlist_share(token). Client functions matching preview/create/replace/revoke/load/remove/read; errors preserve context and never imply success.
- [ ] Write failing real SQL/API and pure unit privacy/contract tests; run and observe missing implementation.
- [ ] Implement schema/functions, typed helpers and export; register fresh CI migration/RLS tests.
- [ ] Run real RLS/concurrency/expiry/cascade and focused unit tests; full types; commit verified deliverable.

### Task2: Owner and recipient flows
Files: app/(main)/shortlist/share/page.tsx; components/shortlist/share-manager.tsx; share-preview.tsx; shared-shortlist.tsx; app/share/shortlist/page.tsx; lib/share-telemetry.ts; components/site-telemetry.tsx; app/layout.tsx; next.config.ts; app/robots.ts; shortlist CTA; tests/unit/shortlist-share-ui.test.tsx; tests/e2e/staging-journeys.spec.ts.
Consumes Task1 ShareRecord/SharedSnapshot and helpers. Preview/recipient render same SharedItem component. Owner phases select→preview→created; history independently loadable. Recipient reads token fragment with no session and no cache. No private body in metadata.
- [ ] Write UI tests for exact preview, mutation failure, stale response, revoked clearing, blocked clipboard; observe RED.
- [ ] Build accessible owner/recipient components, privacy headers/telemetry guard, and navigation.
- [ ] Add real browser journey including anonymous context, replace/revoke and privacy assertions; run desktop/phone/WebKit, fullunit/type/lint; inspect screenshots; commit.

### Task3: Review and ship
Files: review evidence/ledger, Linear80 and checkpoint, PRs.
- [ ] Independent whole-branch reviewer plus actual Claude review; fix important findings with regression tests, ticket minors.
- [ ] Exact-head fresh CI; production schema preflight, reviewed additive migration, ACL postflight; merge develop→main release.
- [ ] Verify mainCI/auth/READYaliases/HTTP; mark ticket Done and update durable checkpoint. Continue next authorized backlog work from currentdevelop.

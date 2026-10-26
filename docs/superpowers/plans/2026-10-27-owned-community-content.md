# Owner Community Content Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. Steps use checkbox syntax for tracking.

**Goal:** Let former private-group members remove their own content without regaining private access.
**Architecture:** Narrow owner-only listing/redaction RPCs preserve RLS and reply structure; existing authenticated UI exposes confirmation and recovery.
**Tech Stack:** Existing Next.js/React/TypeScript/Supabase PostgreSQL, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-27-owned-community-content-design.md

## Global Constraints
No new dependencies, no application service-role access, no membership/history changes, no broader read policies. Preserve peer replies and return no peer/group metadata. Remove only caller-owned content. Existing worktree reused after PROD-97 release.

## Review Focus
- Stale edits/direct writes after redaction cannot restore payloads.
- Listing must never reveal private peer text, reply/vote aggregates or group names.
- Concurrent repeated requests preserve replies and return honest status.
- Removing a resume post revokes its frozen copy without touching its draft.
- Account deletion and moderation still work with removal triggers.

### Task 1: Database removal boundary
**Files:** new migration20261027030000_owned_community_content.sql, tests/staging/community-owned-content-rls.mjs, bootstrap-local.mjs, CI bootstrap script, types/database.ts.
**Interfaces:** list_owned_community_content(p_page integer) returns rows(kind text,id uuid,content text,created_at timestamptz,removed boolean), page0..250,21 rows; remove_owned_community_content(p_kind text,p_id uuid) returns boolean. Both auth.uid only, blank search_path, authenticated EXECUTE only.
- [ ] Write real DB test asserting own former-group post/comment list, no private reads, remove/repeat true, foreign/missing false, anonymous denied, replies unchanged, no membership changes, rejoin/stale writes fail, own draft remains and shared copy removed.
- [ ] Run via local-run helper: expected missing RPC failure (RED).
- [ ] Implement narrow RPCs, is_removed field/check and immutable removed-field triggers; register migrations/test/types.
- [ ] Run real DB test: expected PASS; run existing community and resume permission tests: expected PASS.
- [ ] Commit database deliverable.

### Task 2: Owner management actions/UI
**Files:** actions/owned-content.ts, actions barrel, communities/your-content/page.tsx, components/communities/OwnedContentManager.tsx, community page link, types/community.ts/PostCard.tsx, tests/unit/community-owned-content.test.tsx, route-coverage.
**Interfaces:** listOwnCommunityContentAction(page) returns rows/more/error; removeOwnCommunityContentAction(kind,id) returns error|null. Client gets validated own excerpts only.
- [ ] Write failing action/UI tests for auth, invalid kind/UUID/page, thrown/error/false results, confirmation, pending guard, failure preserves content and retry succeeds.
- [ ] Run focused Vitest: expected missing implementation failure.
- [ ] Implement server actions with12s query timeout and UI with15s request timeout, retained error/retry, confirmed server removal. Clear cards after success and suppress edit option for removed posts.
- [ ] Run focused tests: expected PASS. Commit.

### Task 3: Browser/review/release
- [ ] Add @phone real browser private-group former-member removal flow with peer-reply preservation and final no-private-read assertions.
- [ ] Run desktop/phone Chrome/WebKit journey, full units/type/lint, real DB suite: all PASS (existing lint warnings recorded).
- [ ] Fresh independent whole-branch reviewer + actual Claude review. Important fixes one RED→GREEN pass; minors ticketed. Preserve auditable evidence ledger.
- [ ] PR exact-head CI PASS; apply additive production migration after metadata preflight; check ACL/triggers; merge/release, verify exact-main CI/Vercel aliases/auth and live management redirect. Mark Linear Done only with release evidence.

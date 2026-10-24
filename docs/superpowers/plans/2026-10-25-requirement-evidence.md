# Requirement Evidence Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: superpowers:executing-plans. Implement inline; fresh whole-branch review at the end.

**Goal:** Connect supporting work to scholarship requirements without implying completion or submission.
**Architecture:** Add immutable, owner-scoped associations to existing application evidence and essay drafts; batch service and a shared hub controller/modal.
**Tech Stack:** Next.js/React, Supabase/PostgreSQL, Vitest, Playwright.
**Spec:** `docs/superpowers/specs/2026-10-25-requirement-evidence.md`

## Global Constraints
- Reuse the verified clean managed worktree, branch from develop. All work belongs to PROD-161.
- Same-owner and same-application constraints in PostgreSQL; grants are narrow. Source work and manual ticks survive unlink/detach.
- Respect source tailoring, render plain text, distinguish loading/error/empty. Paginate stable ordering.
- Existing user authorization covers implementation, review, CI and release; no repeated approval question.
- No production synthetic tests or claims of human testing. Do not change retries/timeouts to mask failures.

## Review Focus
Concurrent attachment movement/deletion; cross-owner and cross-application references; cascades during account deletion; duplicate inserts; stale requirement labels; inaccessible sources; stale UI after source edits; failure/retry and focus restoration; exact-head CI and migration-before-dependent-release.

### Task 1: Storage and service contracts
Interfaces: `requirement_evidence_links` and `lib/requirement-evidence.ts` provide paginated bundles, validated duplicate-safe linking and owner-scoped unlinking. Sources preserve current tailoring.
- [x] Write real local RLS tests and service/export tests first; run RED (missing table/service and omitted export).
- [x] Implement migration, typed table, service and export inclusion; wire RLS script into CI bootstrap.
- [x] Run focused Vitest and real local RLS GREEN; commit.
Expected: owner succeeds; peer/anon/cross-app fail; source/detach/account cleanup works; export fails closed.

### Task 2: Hub interaction
Interfaces: application ID flows into scholarship hub; one controller loads all sources/links; requirement cards accept supporting-work render slots.
- [x] Write focused UI and persisted browser journey; observe RED before UI implementation.
- [x] Implement picker, previews, source labels, changed/removed requirement review, retry/unlink and cascade explanation.
- [x] Run focused unit and desktop/phone browser journeys GREEN; commit.
Expected: persisted link/unlink; no automatic tick/status; tailored title/content visible; changed requirements retained; keyboard focus restored and no phone overflow.

### Task 3: Review and release
- [ ] Run typecheck, lint, unit suite, production build and relevant browser journeys.
- [ ] Actual Claude review and fresh whole-branch reviewer; fix substantive findings with regression tests.
- [ ] Push feature PR to develop; exact-head CI; attach PR and progress Linear.
- [ ] Merge develop; apply reviewed additive migration with production pre/postflight; release PR to main with exact-head CI.
- [ ] Verify exact production SHA, aliases, public/protected routes and deployed auth health. Record evidence and close only PROD-161.
Expected: all required CI and release checks pass; honest bounded test evidence recorded in Linear.

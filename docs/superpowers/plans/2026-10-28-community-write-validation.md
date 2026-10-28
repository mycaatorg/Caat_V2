# Community write validation implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline; one fresh whole-branch independent review after implementation.

**Goal:** Direct authenticated REST and shared-resume publication obey the existing post limits and attachment bounds.
**Architecture:** Add an empty-search-path SECURITY DEFINER trigger on community_posts. It uses the existing author advisory lock (seed97) to serialize counts and inserts across both entry points, sees all author posts, pins authenticated creation time and rejects owner/time changes. Validate/normalize changed attachment fields only; unchanged legacy fields remain editable/removable. Trusted maintenance without auth.uid retains fixture/migration capabilities. RLS/grants stay unchanged.
**Tech stack:** PostgreSQL, existing Supabase local REST/Auth/RPC contracts, Node assert.
**Spec:** PROD-187 and its 28 Oct boundary audit; standing autonomous implementation/review/release approval.

## Constraints and review focus
- Limits remain 100 posts in rolling24h and5000 currently retained posts per author; existing RPC retry-before-cap remains.
- Concurrent REST/REST, mixed REST/RPC and multirow INSERT must not exceed caps or leave partial publications.
- Count hidden and inaccessible private-group posts; owner/time fields cannot bypass caps.
- Match ResultCard, ScoreCard and PollOption existing schema bounds, ECMAScript trimming and UTF-16 lengths; required types and unknown-key normalization.
- Legacy unchanged malformed fields must not block ordinary edits, moderation, owner removal or account cleanup.
- No visibility widening, production synthetic writes, private data inspection or dependency changes. Human pilot81 remains separate.

## Task 1: database boundary and executable contracts
Files: new `caat-frontend/supabase/migrations/20261028010000_community_write_validation.sql`, new `caat-frontend/tests/staging/community-write-validation.mjs`; modify bootstrap-local.mjs, .github/scripts/bootstrap-local-supabase.mjs, staging/README.md and schema comment.
- [x] Write local real-REST contract: 101-row bulk rejected with zero rows; validate malformed/valid attachment shapes, UTF-16 boundaries, timestamp/owner tampering and nonowner denial. Observe RED before migration.
- [x] Add daily99→100 REST/REST and REST/RPC races; failed RPC leaves no post/share/publication; retry at cap returns existing result. Add4999→5000 older-row lifetime race, hidden/private rows and edits at cap. Exact disposable-account cleanup in finally.
- [x] Implement trigger plus small internal string-normalization helper; revoke direct execution, qualify references, blank search_path. Reject changed owner/created_at; pin authenticated inserted created_at. Validate inserted or changed fields, preserve unchanged legacy fields. No historical row rewrite.
- [x] Run contract GREEN, bootstrap safety, existing63 community RLS plus resume sharing/owned content/AuthAdmin cleanup; typecheck/full units/lint. Check SQL metadata and production readonly metadata before migration.
- [ ] Independent final review and actual Claude; fix material findings with RED→GREEN. Full CI, production additive migration metadata comparison, normal develop/main release, exact-main CI/auth/deployment/live gates. Update Linear and preserve ignored evidence.

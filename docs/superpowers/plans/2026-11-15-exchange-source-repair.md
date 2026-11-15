# Exchange award source repair implementation plan

Execute inline using executing-plans; user has authorised reviewed production improvements and opted out of repeated design approvals.

**Goal:** Repair the broken provider link for UGTR1048 (PROD-277), preserving its identity, student saves and recorded facts.
**Architecture:** One additive, guarded, idempotent SQL data migration. Reuse the PROD244 isolated database harness pattern and normal CI/release flow.
**Spec:** PROD277 in Linear and the preservation requirements in `2026-11-06-unsw-source-repair.md`.

## Scope and decisions
- Target `1b720943-1f37-49e5-b45d-8877d79a483e`, source `c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a`, external ID `UGTR1048`, title `UNSW Student Exchange Achievement Award`.
- Replace `https://www.scholarships.unsw.edu.au/scholarships/id/1899/7088#UGTR1048` with `https://www.scholarships.unsw.edu.au/scholarships/id/2001` only. The official current 2027 page now includes the exact award code/title. This follows the existing seven exchange link repairs, without claiming that historical award fields were re-extracted.
- Preserve every field except external_url, an additive raw_payload audit entry, and the normal updated_at trigger. Never advance import/verification dates, deactivate, delete or reparent saves.
- Missing production ID is a no-op for fresh isolated databases; production preflight must find exactly one target. Validate identity/activity/URL/object payload under a row lock; abort on drift. Replaying a repaired row changes nothing.
- Reuse the current isolated worktree and local database; never reset them. Production secrets remain in memory.

## Review focus
Wrong/null URL, identity drift, inactive target, scalar/array payload, replay, unrelated rows and saved statuses must not be damaged. Source identity does not imply current eligibility or freshness.

## Task 1: Regression and repair
- [ ] Add `tests/staging/exchange-achievement-source-repair.mjs`: disposable local target/unrelated rows and owner bookmarks. Run the actual migration, compare complete protected snapshots and bookmark rows, repeat for idempotency, and reject drift atomically.
- [ ] Observe RED against an empty migration before implementation.
- [ ] Implement `supabase/migrations/20261115010000_exchange_achievement_source_repair.sql` with BEGIN, 5s lock timeout, exact guards, lock and narrowly scoped UPDATE.
- [ ] Register the migration in `tests/staging/bootstrap-migrations.mjs` and the harness in `.github/scripts/bootstrap-local-supabase.mjs`.
- [ ] Run the real local harness and bootstrap contract tests; expected PASS. Hosted full CI remains mandatory.

## Task 2: Review and release
- [ ] Actual Claude plus fresh independent whole-branch review. Fix important findings with regression coverage.
- [ ] Feature PR to develop, exact-head full CI, release PR/main CI. Apply the reviewed migration once with production snapshot/hash guards and verify preserved facts/saves before frontend deployment refreshes caches.
- [ ] Verify both production aliases at the release SHA, source URL in the public award page, provider health, 50 public journeys, catalogue/sitemap parity and automatic production check. Mark PROD277 Done only after this evidence.

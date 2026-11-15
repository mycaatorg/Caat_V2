# Source outage guard implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent a widespread provider outage from hiding scholarships during a refresh (PROD-281).

**Architecture:** Keep source fetch/record/ordinary verification in the existing bounded worker pool, but queue deactivations until every selected URL has completed successfully. Before running that queue, reject when gone URL count exceeds 25 or 2% of selected URLs. Store the failed run and history, keep all pending awards active. Dry run reports held rows without writes.

**Tech Stack:** Existing Node runner, Vitest, isolated Supabase/PostgreSQL integration.

**Spec:** docs/superpowers/specs/2026-10-23-source-change-notifications-design.md, mass-event guard principle; Linear PROD-281 narrows this slice to refresh protection.

## Global Constraints

- No production service key on laptop/CI; synthetic local credentials only.
- No migration, notices, events, automatic scheduling or override switch.
- No concurrent imports during refresh; post-guard legacy writes remain per-row transactions.
- Denominator is selected distinct URLs after prefix/limit. Exactly 25 and exactly 2% pass. Zero selected URLs passes.
- An incomplete scan or write failure must execute no queued deactivations. Ordinary verification already completed may remain.
- Preserve source outcomes as evidence; a held gone check is not evidence of actual deactivation.

## Review Focus

- Late gone result must hold earlier queued removals: async order test.
- Partial scan failure with work in flight must not release the queue: failure test.
- One page with several awards counts once for URL ratio, but every queued row is held: shared-page test.
- Filter/limit must determine the ratio, not total catalogue size: scoped run test.
- Dry run must report held candidates and zero write-method calls: dry summary test.

## Task 1: Defer deactivation until the complete batch passes the guard

Files: scripts/refresh-scholarship-sources.mjs; tests/unit/refresh-scholarship-sources.test.ts; tests/staging/scholarship-source-checks.mjs; docs/operations/scholarship-source-refresh.md (all under caat-frontend except docs).

Interfaces: runRefresh retains existing arguments; summary adds deactivationsHeld. Internal guard uses gone URLs and selected URL count. Apply throws an actionable error when held and stores failed run counts; dry-run returns a summary with held row count and excludes held rows from plannedUpdates.

- [ ] Add regression tests for 1/49 blocked, 1/50 allowed, 25/1250 allowed, 26/1300 blocked; completed full-batch ordering; late failure; scope and dry-run no writes. Run focused Vitest and observe relevant failures.
- [ ] Queue only deactivate operations. After pool completes, hold if either threshold exceeds; set counts.deactivations_held only when positive. Apply failure uses existing finishSafely; records_seen is the sum of completed recorded outcome counts, not planned batch size. Dry summary lists held rows and removes them from plannedUpdates. Otherwise run queued guarded deactivations sequentially before successful summary.
- [ ] Keep existing fixture scope small and extend the real DB test so its 1/5 gone case is held with check history and failed run, row and bookmarks intact. Then prove the permitted path using the same target and 49 synthetic healthy URLs. Track all run IDs through startRun so failed runs are cleaned; delete only own padding rows and associations. Adjust later fixture expectations for the target deactivated by this permitted run.
- [ ] Update operations docs with thresholds, bounded-batch behavior, incomplete scan handling, partial verification, retained history, no override and per-row atomicity limits.
- [ ] Run focused tests, full real source integration, types/lint/full units. Get actual Claude and independent review, resolve important findings with regression tests.
- [ ] Commit, PR to develop, full hosted CI, merge, production release gates and Linear evidence.

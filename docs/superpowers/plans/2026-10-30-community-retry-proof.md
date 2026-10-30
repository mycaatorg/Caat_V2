# Community retry proof plan

Use superpowers:executing-plans inline. Base cb81086, stacked after pending PROD220; rebase only this slice after merge.
Spec: docs/superpowers/specs/2026-10-30-community-retry-proof-design.md

## Constraints
No product deduplication without evidence of duplicate product rows. No relaxed retry/timeouts. Local isolated student RLS only; unique marker and reliable cleanup.

## Task 1: Prove post cardinality and visible-card invariants
- Update staging-community.spec.ts to query owned rows by unique marker after retry and after reload, expecting one row and unchanged id.
- Write deterministic hidden-replica scenario against existing locator and observe RED; visible second replica must still be counted as a duplicate.
- Replace locator with visible post-card root and explicit complete body assertions. Cleanup owned row by marker even after page failure.
- Run repeated target production-build tests. Record historical root cause remains unproven. Commit.

## Task 2: Review and release
- Actual Claude and independent whole-branch review; Important fixes RED→GREEN, no rereview.
- Hosted full CI then develop/release/exact-main CI, READY aliases, provider/live checks. Ticket/checkpoints accurately reflect verification.

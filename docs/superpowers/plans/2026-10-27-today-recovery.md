# Today recovery plan — PROD-172

Spec: docs/superpowers/specs/2026-10-27-today-recovery.md

## Task 1: recovery and validation UI
Add RED regressions for missing-row close, copyable draft, preserved unrelated completion/Undo, stale Undo invalidation, pagination/focus, field error semantics, disabled opener fallback and sign-in view recovery. Implement minimal changes to TaskEditor, personal-tasks validation and TodayView. Expected: focused tests GREEN; existing save/reload timeout and conflict tests remain green.

## Task 2: consistent RPC text boundary
Add a real local SQL contract test that fails on whitespace-only and 501 supplementary characters. Add an additive CREATE OR REPLACE migration with the same signature/invoker/owner/CAS/grants; include it in fresh CI bootstrap. Test whitespace trimming, exact UTF-16 boundary, unchanged content on invalid/peer writes and preserved completion/priority. Generate local types and compare function contract. Expected: SQL contract GREEN and unit validation parity.

## Task 3: verify/review/release
Extend existing Today real-data journey for missing-task recovery and accessible errors; run desktop/phone Chromium/WebKit. Run full units/typecheck/lint. Obtain actual Claude and one fresh independent review, fix important findings RED→GREEN. Commit/push feature PR to develop with CI pass; apply reviewed additive migration and verify metadata; release main with source equivalence, exact-main CI, auth health, READY aliases and live checks. Update Linear/checkpoints; preserve ignored evidence. Human pilot remains PROD-81.

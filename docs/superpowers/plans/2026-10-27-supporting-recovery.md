# Supporting-work recovery implementation plan — PROD-163

> Use superpowers:executing-plans inline with one fresh final reviewer.

Goal: distinguish a confirmed saved association from a subsequent refresh failure, safely finish a successful write even when another local change supersedes its refresh, and isolate the browser journey's scholarship data.

Architecture: retain the existing provider, generation-based load suppression and write lock. A separate confirmed-write status survives refresh errors. Close the picker after the post-write read settles regardless of whether it was superseded; existing dialog fallback handles a still-disabled opener. Failed writes retain the picker and selection. No schema, dependency, or permission changes.

Constraints: existing React/Next/Supabase patterns; keep manual preparation ticks separate; preserve user source content. Actual Claude review is quota-blocked until 18:50 Sydney; open draft PR and CI without claiming review/release completion. PROD-81 remains genuine human testing.

## Task 1: provider recovery
- [ ] Add failing UI regressions for saved-link/read failure with retry and single write, superseded successful read with persistent saved status and focus fallback, and removed-link/read failure.
- [ ] Run `npx vitest run tests/unit/requirement-evidence-ui.test.tsx`; expect new regressions FAIL with picker still open/no confirmed status.
- [ ] Update `components/applications/requirement-supporting-work.tsx`: confirmed operation status independent of read errors, unconditional completion callback after read settles, status rendered outside/inside modal as appropriate; clear obsolete status on next operation/open.
- [ ] Run focused UI/helper tests; expect PASS, including existing failed-write selection and successful-load focus behavior.

## Task 2: browser fixture and real recovery
- [ ] Add two reserved supporting-work scholarship seed rows in `tests/staging/seed-opportunities.sql`. Use only these scholarship IDs in the PROD-161 browser journey; preflight refuses existing bookmarks and cleanup removes only created fixture associations. Reuse current application without deleting pre-existing application data.
- [ ] Extend the browser journey to interrupt GET after a successful association POST, assert saved confirmation/closed modal/refresh retry and exactly one persisted link; continue existing manual tick/tailoring/unlink/detach flow.
- [ ] Run desktop Chromium, phone Chromium/WebKit journey against caat-test only; expect3/3 PASS.

## Task 3: verification and review
- [ ] Run full units, typecheck, lint, and diff check. Request independent final review and ledger its findings; actual Claude remains a required pending release gate.
- [ ] Commit and open independent draft PR to develop, attach it, obtain full CI. Record exact SHA and evidence in Linear. No production release until outstanding review gate resolved.

Review focus: superseded reads must not overwrite newer state; failed saves must not show success; retry must not issue a duplicate write; focus must land outside the closed picker; fixture cleanup must not cascade existing shared scholarship associations. Tests in Tasks1/2 cover these cases.

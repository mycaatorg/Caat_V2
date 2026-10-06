# Application and checklist mutations with failure recovery — PROD-88

## Goal
Prove that application list, application hub (readiness checklist, status, deadline, majors) and the school-page tracking button persist the right state, recover from failed writes without false success or lost edits, and never claim success for a write that changed nothing.

## Constraints
Extend existing tests; no production writes; synthetic owner data only. Fix only defects reproduced by a failing test first. Keep one browser build, strict flaky failure, bounded jobs and coverage floors. Baseline: 442 unit tests; whole-source lines 26.19% (1843/7037), statements 25.55%, branches 22.34%, functions 18.26%; browser 89 checks.

## Inventory (source vs tests at develop eb103d8)

| Surface | Mutations | Existing tests |
|---|---|---|
| `applications/api.ts` | add, update (status/deadline/notes), update majors, delete, import bookmarks | API unit tests for happy path and returned errors only |
| `applications/client.tsx` | optimistic status/deadline/notes/delete, add-school search, import bookmarks | none (0% lines) |
| `applications/[id]/api.ts` | hub aggregate, status, deadline | none (0% lines) |
| `applications/[id]/client.tsx` | readiness checklist, status menu, deadline, majors editor | none (0% lines) |
| `schools/[id]/application-button.tsx` | track application | none (0% lines) |
| Browser | track, list status, notes, reload, hub content | `staging-journeys.spec.ts` (no failures, no hub mutations, deletion not asserted) |

## Candidate defects to reproduce

1. Update/delete that matches no owned row (deleted elsewhere, foreign or invalid id) resolves as success.
2. List and hub roll back failed writes by restoring a whole snapshot, wiping concurrent successful edits.
3. A failed notes save leaves the indicator on "Saving…" indefinitely; a stale failure can override a newer success.
4. Importing bookmarks reports failure when only the follow-up count refresh fails.
5. A failed initial load renders the "No applications yet" empty state.
6. The hub readiness checklist does not reflect a deadline change (or a status change whose refetch fails) until reload.
7. The majors editor allows overlapping whole-array writes; a failed add discards the typed major.

## Tasks
- [x] API unit tests (list + hub modules): 5 red (defect 1), fixed with a shared written-row guard.
- [x] List component tests: 8 red (defects 2–5), fixed with field-scoped rollback, a per-application write queue, a load-error state, a three-state notes indicator and a separate badge refresh.
- [x] Hub component tests: 8 red (defects 2, 6, 7), fixed by deriving the checklist from the edited application, dropping the post-save refetch, serializing writes and guarding the majors editor. Tracking button tests pass without changes.
- [x] Mutation checks: removing either write queue fails its ordering test.
- [x] One isolated browser journey (`staging-journeys.spec.ts`): 90/90 browser checks on the Mac mini stack; new journey 5/5 repeated runs.
- [ ] Independent review; PR to develop; release to main; verify deployment and public checks; update Linear.

## Measurement

Unit tests 442 → 511. Whole-source lines 26.19% → 31.07% (2191/7051), statements 25.55% → 30.40%, branches 22.34% → 26.23%, functions 18.26% → 23.66%. Floors ratcheted to 31/30/23/26. Browser checks 89 → 90. Per file lines: list client 0 → 93%, hub client 0 → 89%, hub API 0 → 97%, list API 88 → 100%, tracking button 0 → 100%.

## Residual scope

Notes typed into a card whose save failed are lost if the card unmounts (filter switch) before a retry. The school-page button treats a failed status lookup as untracked; the unique constraint turns a resulting duplicate track into an error toast, not a duplicate row.

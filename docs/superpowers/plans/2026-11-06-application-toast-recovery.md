# Application recovery notifications — PROD-273

Execute inline. Base029c088, branchcodex/caat-application-toast-recovery. User authorizes fixes and reviewed production release. FailedCI42122886670 is retained, never blindly rerun.

## Evidence
Trace PATCH notes retryHTTP200 at22:44:40.217 and screenshot show Saved. Two Sonner error notifications remain; finalSave click pointer(x1200,y695/706) lies over bottom notification area. Installed Sonner pauses auto-close during interaction/expansion. saveField creates an anonymous error notification and never dismisses it on successful retry. Treat this as contradictory recovery feedback, not a persistence failure; exact hover path inferred from pointer/screenshot and timer code, to be reproduced deterministically.

## Design
Give each application+editable-field failure a stable notification ID. Only the latest confirmed successful write for that same field dismisses that ID. A failed retry keeps/replaces the same error. Older superseded writes, other fields and other applications must not clear it. Preserve ordered writes, field rollback, typed drafts and API behavior. No global toast clearing, no timing/gate relaxation.

## Tasks
1. Add unit RED for matching-error dismissal after success, independent record/field errors, failed retry retaining ID and superseded success not clearing error prematurely. Add a deterministic built browser regression by pausing the already-installed clock immediately after the injected note failure, preserving the error through filter changes and successful retry. Hover the retained error during keyboard retry, then resume animation frames while hover still prevents ordinary expiry. Assert the recovered error disappears; unit tests pin unrelated error retention. Retain reload/storage assertions.
2. Implement IDs/dismiss only at latest confirmed success. Focused/full units,types/lint/build and desktop/emulatedAndroid/iPhone browser journey GREEN with retries0.
3. ActualClaude and one fresh independent delta review; important findings one RED/GREEN pass. Integrate with reviewedPROD272 and existingPR325; fresh complete CI, develop/release/main and production checks beforeDone. No physical-device/human claim.

## Review focus
Per-field/record notification ownership; older queued success vs latest failure; failed retry still visible; no premature clearing on request start; no privacy/API/status behavior changes; deterministic browser test cannot pass merely by notification timeout and still verifies persisted notes.

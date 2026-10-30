# Zero-warning CI implementation plan

> Use superpowers:executing-plans inline, followed by one fresh whole-branch review.

**Goal:** PROD-228 removes four known warnings and makes npm run lint fail on future warnings, preserving shortlist sharing cancellation.
**Architecture:** Existing eslint CLI is the single local/CI entry point. Capture stable generation ref objects in the ShareManager effect cleanup, rather than copying numeric current values. Remove the unused mock abortSignal parameter while keeping fluent promise behavior. No packages, schema or new runtime behavior.
**Specification:** User authorized ongoing CI/CD quality work without repeated approval. Strict lint runs through existing workflow npm run lint. No disables or suppressed warnings; no threshold exemptions.

## Global constraints
Preserve generation invalidation on unmount and StrictMode effect replay. Preserve late history rejection after mutation. No production CRUD or human testing claim. Keep evidence and actual Claude plus independent review; final branch/develop/release/main checks and provider/live proof before Done.

## Review focus
Ref identity vs numeric snapshot; cancellation after StrictMode replay and final unmount; mock abortSignal return compatibility; existing CI actually consumes strict lint script.

### Task 1: Establish strict lint and cancellation regression
- Set lint script --max-warnings=0, run npm run lint; Expected: RED on four known warnings.
- Add StrictMode stale-candidate/history response regression. Expected: PASS before refactor because it protects existing semantics; lint is the changing acceptance test.
- Capture stable ref objects inside effect; cleanup increments their current values. Remove unused mock parameter. Expected: npm run lint GREEN with zero warnings and focused sharing tests GREEN.

### Task 2: Verify and review
- Full unit coverage, types, production build and shortlist sharing desktop/Android/iPhone browser journey. Expected: PASS without retries or threshold changes.
- Fresh actual Claude and independent whole-branch review, one RED/GREEN blocker-fix pass if needed. Preserve review limits/rulings in ledger.
- PR against develop after rebasing off merged PROD-227; final CI, develop/release/main/provider/live. Linear progresses with evidence, never claim production from local results.

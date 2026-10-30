# Document persistence selectors (PROD-226)

Repair the hosted document-upload persistence false failure without hiding visible duplicates. Existing product rows already expose article roles named by exact filename. No app/API/schema behavior changes.

## Task 1: Reproduce and repair active document row selection

1. Extract the current global filename/XPath row lookup and write a browser DOM contract with sidebar, hidden main, hidden nested row and active exact-name row. Add a visible duplicate and require count two, then remove it and require count one. Expected: old lookup fails, fixed lookup passes.
2. Scope the helper to all accessible mains and exact named articles. Use it in upload/reload, recovery/delete and link/tailor/replacement journeys; cleanup must wait for the deletion dialog to close before asserting absence so modal aria-hiding cannot create a false pass. First upload journey must surface cleanup failures while preserving an original failure.
3. Run the contract and all three real isolated document journeys against the existing production build. Expected: no flakes, upload/replace/link/reload/storage-delete semantics preserved.
4. Full units, types, lint and safety/discovery. Expected: all pass; existing lint warnings are separately reported. Commit, actual Claude review and independent whole-branch review, hosted CI, release and production read-only verification.

## Review Focus

Check strict visible duplicate detection across multiple mains; exact filename matching; modal aria-hidden false absence; no widening of cleanup scope; original assertion failure preservation; selectors in all three consumers. Distinguish deterministic selector fixture from real persistence/browser evidence and read-only production checks.

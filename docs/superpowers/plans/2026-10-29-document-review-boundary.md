# PROD-94: document review integrity

Refresh stale draft PR164 against current develop; preserve its old checkout. User has standing approval for building/testing/review/merging/releases and additive migrations. Current production has no document review guard. Prior557/91tests are stale.

## Spec and decisions
Only trusted service/database processes may assign review outcomes or notes. Authenticated inserts normalize to pending_review/no notes. Authenticated updates may preserve current review fields or voluntarily reset status to pending_review; they may not forge outcomes/notes. Changing file identity or review-relevant metadata automatically resets status, even if the direct caller omits status. Preserve reviewer feedback for resubmission. Remove unused client status mutation helper.

A stored object must not be overwritten/deleted/recreated while the owner's document row references it: otherwise direct Storage writes can retain a stale verified badge. Add restrictive user-documents write policies requiring no referencing owner document for insert/update/delete; both old/new paths checked onupdate. Existing app uploads replacement undernewpath, updatesrow, then deletesoldobject; delete removesrowfirst, so existingflowsfit. Otherbuckets/service-role/readpolicies unchanged. Validate realStorageAPI and privileged review pluspeerdenials.

## Tasks
1. RED isolatedREST/Storage contract for forgedinsert/update, notes, service review, directmetadatachange, samepathoverwrite/delete/reinsert, peer writes, ordinary replace/delete and cleanup. Implement additive current-dated migration with emptysearchpath; registerplan/bootstrap; GREEN.
2. Run current documentunit/UI and desktop/phone browserjourneys, fullcoverage/typecheck/lint, freshDBCI. ActualClaude plus freshindependentreview. Fixmaterialfindings RED/GREEN.
3. Readproductionmetadata immediatelybefore boundedtransaction migration; verify intendedfunction/policy changes and unchangedexistingACL/RLS/policies. NewPR supersedesstale164 afterrelease. Exact-mainCI/auth/READYaliases/livegates required.

## Review focus
Storage path mutations and referencing-row policy semantics, same-object overwrite, post-reviewmetadatachanges, service-rolebypass, linked-documentdeleteconstraints, races withtrustedreview, ordinaryreplacecleanup, owner/peer boundaries and unchangedotherbuckets.

## Signed upload capability finding
The real Storage contract proved that an upload URL issued before a document reference can overwrite bytes while bypassing authenticated RLS. Add an AFTER Storage metadata trigger that invalidates matching public document reviews on insert/delete or changed bucket/name/version/content metadata. Ignore access-time-only changes. The function is security definer with empty search_path and revoked execute permissions; it only updates public.documents, never Storage metadata/files. Trusted file writes also invalidate the old review. Migration is atomic with bounded lock/statement waits.

This protects stored review status when an object changes. A future trusted reviewer workflow must compare the reviewed object version before committing its decision; this change does not implement that workflow or claim to prevent a trusted process explicitly assigning a stale review after a concurrent replacement.

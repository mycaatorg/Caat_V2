# Complete source-refresh catalogue reads (PROD-236)

The refresh runner currently treats any response shorter than its requested
1,000 rows as complete. A lower server row cap therefore silently excludes later
scholarships. Read until an empty response and advance by the actual returned
length. Keep the current stable ID ordering, filters, selected columns, and
fail-before-fetch/write behavior when a later page fails.

## Task 1

Add unit regressions with a two-row server cap, including three-row and four-row
catalogues. Assert every ID is returned once and query filters/order are retained.
For both dry-run and apply, simulate a second-page failure and assert no source
fetch or database writes occur. Update the existing fixed-response doubles to
respect range offsets so an empty terminal page is represented accurately.

Run the focused file. Expected: four new cases fail under the old pagination.
Change only pagination termination and offset advance. Run the focused file,
whole unit suite, TypeScript, lint, and isolated source-check contract.
Expected: all pass. No production fetch/import or data mutation.

## Review and release

Actual Claude plus one independent whole-branch review. Review focus: lower caps,
exact cap multiples, late read errors before side effects, unchanged query filters
and stable ordering, no changes to source hashing or freshness decisions.
Then feature/develop/release/main CI and exact production deployment checks.
Preserve evidence and record nonblocking review rulings in the ledger.

## Limits

Offset pagination is a snapshot-like scan, not a transactional snapshot: concurrent
catalogue changes can shift positions. This existing limitation is unchanged.
The manual runner remains unscheduled; production catalogue freshness is PROD-143.

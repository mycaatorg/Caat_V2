# PROD-162 implementation plan

Spec: docs/superpowers/specs/2026-10-25-account-export.md
Base: ee79e3a4fca2c4c156e2ee823806972068087114

## Task 1: Complete and paginate export
- Add failing unit cases for all omitted collections, every owner/composite ordering, >200 existing rows, later-page errors and >100 owned parents with >200 child rows.
- Implement a typed collection manifest and paged readers. Bound child filters to 100 IDs. Preserve response keys and generic failures; add no-store to error responses.
- Clarify Settings text and additive scope metadata. Run targeted tests, typecheck and lint; commit.

## Task 2: Real browser download
- Add loopback-only journey creating 201 uniquely marked todos plus a saved course, preserving preexisting bookmarks and deleting only this run’s fixture rows.
- Download through Settings, parse the real file, assert 201 own rows and course, scope metadata and no foreign-owned rows; run desktop and phone with zero retries.
- Run complete unit suite. Commit test and documentation.

## Task 3: Review and release
- Fresh whole-branch reviewer plus actual Claude no-tools review. Fix significant findings with regression tests; record minor follow-ups.
- Feature PR to develop, exact-head required CI. Wait until release208 completed before merging this feature.
- Release develop to main; verify exact deployed SHA and both aliases, main CI, auth-health and bounded production errors. Update Linear after verification.

## Review Focus
Check account ownership for publicly readable community tables and incoming relationships, missing or incorrect composite keys, child pagination/batch boundaries, partial exports on later failure, unsafe fixtures, and export buffering/concurrent-write limits. No service-role route queries or schema changes permitted.

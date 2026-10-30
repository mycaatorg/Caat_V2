# Document Vault workspace implementation plan

Use superpowers:executing-plans inline, one final independent review plus actual Claude. Existing stack/worktree; branch codex/caat-document-vault-workspace based on40baa69 pendingPR268. Rebase only this slice after268 merges. Spec: docs/superpowers/specs/2026-10-30-document-vault-workspace-design.md.

## Global constraints
Complete owner reads on server/client; no partial totals. No review-status writes/schema/dependency/env changes. Existing signed links, usage and upload/replacement/delete recovery remain. One DOM for responsive rows. Preserve ignored evidence.

## Review focus
Initial read versus upload/auto-open; server/client pagination parity; low row caps/later failures; filter-page interactions after delete; all row actions remain reachable on phone; no fabricated review outcomes.

### Task1: Complete shared reader
- New lib/document-reader.ts with readOwnedDocuments(client,userId):Promise<DocumentRow[]> using evidencePages, stable uploaded_at desc/id asc, ownerfilter everypage.
- RED tests cap2 over5, later failure rejects; integrate documents/api.ts and documents/page.tsx. Adapt existing API mock range semantics and expectations without weakening ownership/error tests.
- Run document reader/API tests green, commit.

### Task2: Search/status/sort and responsive layout
- New pure document-workspace selector with combined name/category/status filters and immutable deterministic newest/oldest/name sorting.
- RED UI tests search/category/status composition, reset/page1, failed load no counts, pendingread prevents upload, existing failed-load upload recovery remains. Ignore stale reads.
- Implement controls/counts/distinct empty states; responsive row grid, phone wrapped filename/date/actions and category wrapping, no duplicated widgets. Keep existing row/action tests meaningful.
- Run all document tests green, type/lint/build and full unit suite; commit.

### Task3: Browser/review/release
- Real local creation/search/filter/sort/reload/replace/delete failure recovery on desktop/Android/iPhone; screenshots/no viewport overflow. No production writes.
- Actual Claude and independent whole-branch review, important fixes RED→GREEN plus relevant/full tests, no rereview.
- Hosted feature/develop/release/exact-main CI; READY aliases/postREADYprovider/live checks before Done. Update Linear/checkpoints and evidence.

# Document upload, storage and deletion failure paths — PROD-89

## Goal
Prove that document upload, access, replacement and deletion never report false success, never lose the student's chosen file or list state on failure, and keep storage objects and `documents` rows consistent when only one side of a write succeeds.

## Constraints
Extend existing upload/signature and owner/peer storage tests; synthetic files on the disposable local stack only; fix only defects reproduced by a failing test first. Baseline after PROD-88: 517 unit tests; lines 31.24%, statements 30.63%, branches 26.39%, functions 23.66%; 90 browser checks.

## Inventory (develop 26a20aa)

| Boundary | Existing coverage | Gap |
|---|---|---|
| `documents/api.ts` upload | happy path, spoofed bytes, insert failure compensation | signed-out, type/size, limit and limit-check failure, storage failure, failed compensation |
| delete | owner-scoped path, storage-then-row order | row failure after storage removal, lookup failure, already removed, storage failure after row delete |
| replace | owner scoping, ordering, update failure compensation, missing row | upload failure, invalid bytes, old-file removal failure, lookup failure |
| signed link | own path only | signed-out, storage failure |
| `documents/client.tsx` | none (0% lines) | load failure, upload/replace/delete failure and retry, double submit, client validation, school tag, view |
| Browser | upload + metadata after reload (`staging-journeys`), owner/peer storage RLS (`rls-smoke`) | failed request and retry, stored bytes via signed link, object removal after delete |

## Defects reproduced and fixed
1. Deleting removed the stored file before the row; if the row delete failed the document stayed listed but pointed at a missing file (unit red; browser journey red on the old code at the "file survives" check). The row is now deleted first, then the file; a file-removal failure after the row is gone is logged, not reported as a failed delete.
2. A failed ownership lookup before delete was ignored, deleting the row and orphaning the file. Delete is now one owner-scoped `delete ... select("storage_path")`, so the file path comes from the row actually deleted and there is no separate lookup to fail.
6. (Review) If a row delete committed but its response was lost, a retry found no row and left the stored file (e.g. a passport scan) behind while reporting success. When the row is already gone, delete now removes the client-held path, only inside the caller's own folder (storage RLS enforces the same). The browser journey reproduces this with a committed-then-dropped DELETE and fails on the reviewed commit at the "object is gone" check.
7. (Review) After a failed load, a successful upload toasted success but stayed hidden behind the error, and the stat cards showed zeros. Upload now reloads the list in that state, and the stats are hidden while the load error shows.
3. A failed per-student limit check read as zero documents, skipping the 50-document limit. It now stops the upload.
4. A failed lookup before replacement was reported as "Document not found". It now reports a failure.
5. A failed list load showed "No documents uploaded yet." and invited a first upload. It now shows a retryable error.

Already correct and now covered: upload/replace/delete keep the sheet or dialog and chosen file on failure, block double submits, re-enable for retry; client-side type and size checks; compensation removal of a staged object; old file kept when a replacement's row update fails.

## Evidence
Unit tests 517 → 553. Lines 31.24% → 33.62% (2379/7076), statements 30.63% → 32.92%, branches 26.39% → 28.72%, functions 23.66% → 25.97%; floors ratcheted to 33/32/25/28. Documents API 90% lines, documents client 0 → 83%. Browser checks 90 → 91 on the Mac mini isolated stack; new journey 5/5 repeated runs. The existing upload journey's status/category assertions are scoped to its own row so a reused isolated database cannot cause strict-mode collisions.

## Residual scope
- `documents` UPDATE policy lets an owner change any column, including `status`, so a student can mark their own document "verified" through the API. Needs a reviewed migration (tracked separately).
- View opens the signed link with `window.open` after an await; stricter popup blockers (Safari) may block it.
- Storage removal failures are logged only outside production; there is no production error reporting yet, and storage `remove` reports an RLS-blocked object as an empty success.

## Tasks
- [x] Inventory and red tests (API 5, UI 1), fixes, browser journey red on old code then green.
- [x] Independent review (Claude Opus): one important finding (lost delete response orphaning the file) and three minor (signed-URL base in the journey, untested list ordering, upload hidden behind load error). All fixed with regressions that fail on the reviewed commit.
- [ ] PR to develop; release to main; verify deployment; update Linear.

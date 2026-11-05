# Shared resume publication validation — PROD-186

Execute inline; review the whole branch once independently and with actual Claude. Existing authorization covers implementation, tests and release after verification.

Reject malformed direct RPC snapshots before any post/publication/copy can be committed. Keep original resumes owner-only, reader sanitization, immutable publication retry hashes and consumed-ID tombstones unchanged. Validate only new or changed snapshots; do not rewrite historical copies or prevent revocation/deletion.

Use a narrow database trigger and existing internal ECMAScript trim/UTF-16 field validator. Allowed object keys are title/sections and section label/html, both required. Bounds match the application DTO: trimmed nonempty title up to200 UTF-16 units,1–20 sections,label up to100,html up to20000,canonical DTO JSON up to100000 UTF-16 units. Reject wrong types/null/unknown fields. Reader still sanitizes HTML; SQL is shape validation, not HTML sanitization.

1. Add isolated RPC rejection tests for bad section elements, oversized/missing/unknown fields and whole-payload size. Prove no post/share/consumed-ID artifacts after rejected calls; retry a corrected copy using the same ID. Test Unicode and valid boundaries. Observe RED on existing schema.
2. Add a current-timestamp migration and bootstrap registration. Observe GREEN. Run all isolated boundary contracts, full units/types/lint/build/browser as applicable. No live credentials in tests.
3. Actual Claude plus independent review, one blocker fix pass with reproduced tests. PR/develop/release CI, migration and production checks before Done. Preserve local evidence. Keep this separate from the already-reviewed planning release.

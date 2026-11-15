# Source check coverage implementation plan

Execute inline using executing-plans. User authorised continuing tested production improvements; no repeated design approval. PROD-278 is the private association slice of `docs/superpowers/specs/2026-10-23-source-change-notifications-design.md`.

**Goal:** Preserve which active scholarship rows a source check covered, even if their source URLs change later.
**Architecture:** Private `scholarship_source_check_rows` table and service-only, invoker `record_scholarship_source_check(p_check jsonb,p_rows jsonb)` RPC. Record check and covered rows in one transaction. Runner supplies captured IDs and exact source URLs; SQL locks and verifies those rows before storing history. Existing outcome/freshness/deactivation semantics remain unchanged.

## Constraints and decisions
- Associations contain check_id, scholarship_id and the original source_url. Check deletion is restricted while associated; scholarship deletion cascades its associations. No student grants/policies; no notices, read RPC or outbound delivery in this slice.
- RPC accepts1..5000 unique row IDs (larger groups fail explicitly), validates objects and URLs, locks in ID order, and rejects missing/inactive/changed-URL rows without creating a check. It returns server-generated id/checked_at, never accepts a caller timestamp. Existing run FK/outcome constraints remain authoritative.
- The JS store verifies each raw URL normalises to the checked URL using the existing normaliser. Do not duplicate URL normalisation in SQL. Service callers are trusted; SQL role grants are the external boundary.
- This captures URL association at recording time, not a verified field diff or atomicity of the later legacy freshness/deactivation calls. Avoid concurrent catalogue imports as documented.
- Dry-run remains read-only. Apply preflight requires the new table before starting a run. Existing history is not retroactively inferred; production currently has zero checks and must be rechecked before rollout.
- Production service-role credentials remain off this laptop. The documented mini env file is absent and its generic Supabase URL belongs to a different project; no use of that credential.

## Review focus
Missing/duplicate/changed rows, null/malformed inputs, many awards sharing one URL, denied student/anonymous calls, partial writes and cleanup with the new foreign key. Migration must not alter existing checks/grants or award facts.

## Task1: Implement with regressions
- [ ] Unit RED: runRefresh passes the exact covered rows into recording; mismatched normalised URLs cannot be recorded by the JS store.
- [ ] Add migration `20261115020000_scholarship_source_check_rows.sql`, append bootstrap order. Schema has private table/index/RLS/grants and atomic recording RPC, no definer privileges.
- [ ] Update createSupabaseStore.recordCheck(check,rows) to map captured id/source_url and use the RPC; runRefresh passes each grouped row set. Preflight includes the table. Update operation docs.
- [ ] New isolated `scholarship-source-associations.mjs` tests atomic success, preserved facts, row snapshots, invalid/missing/inactive/changed/duplicate rows, denied roles and history-delete restriction. Register it before the existing source-check integration, whose cleanup must delete its own associations first.
- [ ] Run both real DB scripts, focused then full units, bootstrap contracts, lint/types. Do not reset existing local DB.

## Task2: Review and release
- [ ] Actual Claude and independent whole-branch review against PROD277 head cb7a81a; fix Important findings with regressions.
- [ ] Exact-head feature/develop/release/main CI; apply reviewed additive schema after preflight, verify ACL/RLS/function/security/index metadata and zero-history assumption.
- [ ] Both production aliases, live public/provider/catalogue checks and automatic production verification before Done. Starting persisted refreshes on the mini is a separate step; report its status honestly.

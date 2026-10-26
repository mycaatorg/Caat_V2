# Community resume sharing implementation — PROD-97

Use the existing isolated worktree, implement inline under executing-plans/TDD, then one fresh whole-branch review plus the requested actual Claude review. User has authorized this work and normal release steps.

1. RED→GREEN safe snapshot tests: published mode, malicious HTML and links, metadata exclusion, bounds, guided personal/content generation. Extract existing pure guided HTML functions without changing builder output.
2. RED→GREEN action and database contracts. Add bounded snapshot schema, owner preparation, atomic idempotent post/share RPC, post-scoped read and owner revoke. Real local RLS tests cover owner/peer/nonmember/anonymous, private membership changes, both block directions, hidden/deleted posts, unshared drafts, failed atomic writes, retries, account cleanup.
3. Composer preview/consent and recipient full-content reader with errors/retry/revocation. UI regressions cover selection races, consent clearing, failed reads and stale promises. Add authenticated real browser journey for new post, peer read, independent draft edit, removal and no leaked inactive draft/script execution. Desktop and phone Chromium/WebKit.
4. Register migration, types, export, bootstrap and CI database tests. Run full unit, type/lint, focused browser then CI production build/full journeys. One independent most-capable fresh-context review and actual Claude; critical/important fixes one RED→GREEN pass, minors ticketed.
5. Commit/PR, inspect exact-head CI. Apply additive production migration after metadata preflight, verify ACL/functions, merge release, verify exact main CI, live production deployment and auth health. Update Linear/checkpoint only with evidence.

Review focus: alternate/direct API paths; arbitrary JSON/HTML/structured values; auth/visibility transition mid-flight; revoked share replay and idempotency; legacy attachments; draft deletion and inactive drafts; full resume beyond page one; anonymous author identity warning; stale selection/response, timeout and hidden-tab clearing; account export/deletion.

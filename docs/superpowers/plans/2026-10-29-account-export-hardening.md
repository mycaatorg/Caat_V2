# PROD-165: account export completeness and cleanup

The shared pager treats any response shorter than200 as the end, which silently truncates when PostgREST caps results below200. Use actual returned-row offsets and an empty terminal page. Keep owner filters/stable unique ordering, cancellation and whole-operation failure; reject null/error responses and stop after1000 requests by default (explicit smaller bounds supported). A bounded failure must never return partial data.

1. Reproduce capped pages and late/null failure in the pager and account route; add bounded/cancellation cases. Audit shared consumers and make test fixtures represent finite ranged data rather than endlessly repeating rows.
2. Implement actual-length pagination; pin child order assertions. Clarify that recipient-owned notifications may mention another actor. Keep current buffered, non-transactional snapshot semantics; streaming needs no new infrastructure for this fix.
3. Make export browser-fixture cleanup attempt every scoped deletion and report failures, with a forced first-cleanup failure regression.
4. Run full coverage, typecheck/lint, actual desktop and phone exports, and a local PostgREST cap below200 if supported. Restore local configuration after the check. Actual Claude and one fresh independent whole-branch review; fresh CI, release and exact production gates.

Review focus: late-page failure, empty vs missing data, effective server cap, off-by-one bound, cancelled pending response, shared caller finite fixtures, ownership on every page/child batch, cleanup errors, truthful scope. Preserve ignored evidence. No production database change.

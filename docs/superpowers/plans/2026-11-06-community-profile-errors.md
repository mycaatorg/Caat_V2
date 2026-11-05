# Community profile load errors (PROD-258)

A failed profile read is currently rendered as a 404. Distinguish failed auth/profile/privacy/follower reads from a successful empty profile lookup. Failure returns a generic load error; the server page renders an honest unavailable message with a full-navigation retry link. Only successful empty lookups use 404. Preserve all profile privacy rules. Emit only a fixed failure-stage label and constrained error code to help diagnose server failures, never IDs, tokens or raw messages.

The historical CI failure showed404 but omitted the first-attempt network trace. Its exact cause is still unproven. Retain first-failure traces in CI and preserve failOnFlakyTests, retries, timeouts and assertions. Do not claim the intermittent cause resolved merely because a later run passes.

1. Reproduce action failures mapping to missing records with controlled RPC/auth/secondary errors; reproduce page error mapping to 404. Keep successful-missing and privacy tests.
2. Return generic errors on failed reads, render retry UI, record safe diagnostic codes. Add first-failure tracing. Run focused/full coverage/types/lint/build and existing community browser journey.
3. Review this pinned delta with Claude and one independent reviewer; required full hosted CI must pass. PROD-258 investigation remains open if original intermittent cause is not proven, even after this confirmed error-classification fix ships.

Review focus: successful missing profile versus RPC failure, auth failure before query, partial/error results, privacy defaults only on successful missing settings, no sensitive diagnostic data, retry href encoding, strict CI gate unchanged. Browser traces expose only isolated synthetic account sessions in these CI journeys; no production writes or credentials enter the job.

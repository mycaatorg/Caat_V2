# Profile response diagnostics — PROD-258

Execute inline; user authorizes continued reviewed delivery. Base a1a222e. Reuse current checkout/branch, append separately reviewed diagnostics to PR325, which remains stacked on PR323.

## Evidence and scope
Two strict CI failures reached the author profile retry UI with stage=profile/code=unknown. Browser saw HTTP200 RSC, not the underlying server response. PostgREST may return code empty with status0 for fetch/abort failures. Cause is unproven. Add normalized numeric status (0 or integer100–599; otherwise null) to existing privacy-safe diagnostic. Carry response status from all five database reads; auth status from auth error when available. Do not log message/details/hint/IDs/headers or add automatic retries. No user-visible behavior or schema change; PROD258 stays open until a cause is reproduced/fixed.

## Tasks
1. Tests first: assert empty-code status0/502 remain distinguishable, normal error status is carried for each read/auth, malformed status does not leak/coerce. RED before implementation, then focused GREEN.
2. Add narrow normalization and propagate status. Preserve privacy gating and fixed public error. Full units/types/lint/build; run existing community/profile browser journey with zero retries.
3. Actual Claude plus one fresh independent delta review. Important findings one RED/GREEN pass; minors ticketed. Update PR325/Linear; full CI current head, never waive flaky gate. Merge/deploy only with existing release gates, keep root-cause investigation open.

## Review focus
Status0 must survive falsy handling; unknown/malformed values must remain null; all profile result branches must pass status; no logging arbitrary strings/headers/messages or assumptions that HTTP200 means success. Existing safe code restriction unchanged.

# Automatic production release verification — PROD-272

Execute inline with regression tests and one fresh whole-delta review plus actual Claude. User authorizes CI/CD improvements and verified deployment. Base029c088; branchcodex/caat-production-release-verification, separate from PR325 currently in CI.

## Design
Reuse authenticated /api/health/auth, adding only a validated 40-character hexadecimal VERCEL_GIT_COMMIT_SHA on healthy authorized responses. Do not expose raw env values or change provider failure semantics. Missing/invalid metadata still permits the hourly readiness monitor, but cannot pass exact-release verification.

Extend checkAuthHealth with optional expected revision. Existing callers retain health-only behavior. Invalid expected revisions fail before networking; valid expectation requires exact valid returned revision and healthy response. Preserve fixed HTTPS destination, no redirects, no raw response/error output.

Add release-health-check.js: validate token and revision; --wait allows at most30 checks separated10s, each existing fetch bounded10s; default single check for the post-smoke assertion. No arbitrary URL/secret input from event payload.

New workflow runs after successful CI push on main from this same repository (workflow_run), or manual dispatch on main. Checkout immutable triggering SHA with persisted credentials disabled, read-only permissions, pinned actions, secret only in health-probe steps. Install locked frontend dependencies and Chromium. Check release revision/provider, run only public-smoke project (no auth setup/student writes, retries0), check same revision/provider afterwards even if browser checks fail, upload failure report and always summarize boundaries. Cancel older in-progress release-verification jobs when superseded.

## Tasks
1. Add RED route and checker regressions for healthy authorized revision, invalid/missing metadata, unauthorized failure privacy, expected mismatch/missing/invalid body, invalid expectation no fetch. Implement and GREEN.
2. RED bounded wait tests; implement wrapper. Add workflow and safety contract checks for trusted-main trigger, immutable checkout, least permissions, no secret in browser env, only public project, before/after checks. Run node contracts and actionlint if available.
3. Full units/types/lint/build and built health route integration with synthetic provider only, no live provider credentials. Existing read-only public browser suite on current production; subsequent deployed workflow must verify its own release. Claude + fresh independent review, important fixes one RED/GREEN pass, then full feature/develop/release/main gates and observed production workflow beforeDone.

## Review focus
Workflow_run privilege boundary and immutable revision, manual branch rejection, same-head checks across alias change, bounded wait/failure exit, health-only backward compatibility, no raw env/response/secret disclosure, public-only browser scope, event-controlled values never interpolated into shell source. No automatic rollback; no claim of DB sitemap parity or private flow runtime health.

## Sources
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run
https://vercel.com/docs/environment-variables/system-environment-variables#vercel_git_commit_sha

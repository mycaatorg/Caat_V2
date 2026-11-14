# Production release verification

The `Production release verification` workflow follows successful push CI on `main` for `mycaatorg/Caat_V2`. A manual dispatch is accepted only on `main`. It checks out the exact triggering commit, waits for that revision on the canonical production origin, runs the public browser smoke suite, then checks that the same revision and provider health still hold.

The existing authenticated `/api/health/auth` response includes `revision` only when the provider is healthy and `VERCEL_GIT_COMMIT_SHA` is a valid full lowercase Git SHA. Vercel's automatic system environment variables must remain enabled. Missing metadata cannot pass release verification; the existing hourly provider-only check remains compatible. No new credential is needed: both probes use `AUTH_HEALTH_CHECK_TOKEN` already configured in GitHub and Vercel. Never print or paste the token.

Before browser tests, the workflow permits at most30 attempts with10seconds between them and a10second fetch timeout. Afterwards it performs a single check, even if the browser step failed. A mismatch, provider error, missing credential or malformed response fails the run. A newer run cancels an older verification. It does not automatically roll back production.

Browser coverage is read-only: public pages, record-specific scholarship navigation, sitemap structure/uniqueness, and unauthenticated route guards. It has no account setup or production database credentials. Retries are disabled. Failure reports are retained for7days. Expected revision and coverage limits appear in the run summary.

This is post-deployment detection, not a pre-deployment gate. It does not prove private student flows, physical devices, absence of runtime errors, Vercel alias ownership, or catalogue-count parity. Keep isolated write journeys and the release audit for those separate checks. A brief revision change away and back between the two probes is outside this before/after observation.

If it fails, inspect the expected commit and CI/deployment status first. Check the existing [auth-provider recovery runbook](auth-provider-health.md) for provider failures. Preserve the failed report and investigate browser failures; do not turn a passing retry into evidence that the original failure was fixed. Re-run only after a correction or a documented deployment/availability change.

Official references: [GitHub workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run), [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables#vercel_git_commit_sha).

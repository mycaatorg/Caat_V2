# Auth-provider readiness

PROD-135 addresses the deleted Redis database that broke signup while public page checks stayed green. The production health workflow probes the deployed Redis configuration hourly and can be dispatched manually. It makes up to three attempts before failing and publishing an actionable GitHub Actions error/run summary. A later healthy run reports recovery. GitHub email/web notifications depend on the triggering account's Actions notification settings; delivery outside GitHub is not guaranteed. Scheduled notifications go to the workflow creator, then to whoever last changes its cron schedule or re-enables it. During an on-call handover, verify that account and its notification settings; a failed Actions run alone does not page every maintainer. See [GitHub’s notification rules](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs).

## Scope and access

`GET /api/health/auth` requires a dedicated random `AUTH_HEALTH_CHECK_TOKEN` (at least 32 characters) as a Bearer credential. Store the same value in Vercel's production environment and the repository Actions secret. Keep it out of source, logs, command arguments and URLs. The endpoint returns only a generic status, is uncached, and never accepts a student session as authorization. Missing configuration fails closed. Provider calls are limited to a 2.5-second Redis PING with redirects rejected; application credentials stay only in Vercel. This tests provider availability/authentication, not complete student login, CAPTCHA, write permission, database persistence or every rate-limit operation; CI and release journeys cover those separately.

A successful PING has no student-data writes. This is genuine monitoring, not a retention strategy. Do not depend on probes to defeat vendor inactivity policy. GitHub schedules can be delayed or disabled (including inactivity-based disabling for public repositories), so manually verify the workflow remains active at releases. The production Free Tier still has lifecycle/availability limits. No paid plan is authorized or configured by this change; compare a durable production plan and obtain explicit cost approval before upgrading.

## Respond to a failed run

1. Check the latest deployment is READY and owns `www.mycaat.com`. A 401/404 may mean a missing route, mismatched probe secret, or deployment protection; do not disable security to clear it.
2. In Vercel, verify the two existing `UPSTASH_REDIS_REST_*` server variables are present and current. Inspect the CAAT Upstash account for inactive/deleted databases. Never paste credentials into tickets or logs.
3. Check sanitized runtime logs: `[rate-limit] Provider unavailable` and `[auth-health] Provider unavailable`. Allowlisted nested error codes such as `ENOTFOUND` distinguish DNS failures. Raw messages, hostnames, IPs, tokens and arbitrary error names are deliberately excluded.
4. Restore/reconnect the intended database or resolve provider/network access. Preserve auth's fail-closed behaviour. Environment changes require a new deployment.
5. Dispatch **Production auth-provider health** and verify a green run, then complete normal signup/login checks with disposable data when relevant. Record evidence on the incident's Linear ticket. A green health probe alone is not end-to-end auth verification.

## Rotate probe access

Generate a fresh random value securely, update the repository secret and Vercel production variable, redeploy, then dispatch the workflow. A brief failed probe during rotation is possible. The probe token grants only this health endpoint; it cannot read student data or retrieve Redis credentials. Never add it to a `NEXT_PUBLIC_` variable. Preview deployments intentionally have no probe secret unless explicitly provisioned for a controlled test.

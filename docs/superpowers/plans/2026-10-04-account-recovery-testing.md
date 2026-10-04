# Account recovery coverage — PROD-83

The next bounded slice extends the released testing foundation (389 unit/component/API tests, 17.81% whole-runtime line coverage, 87 browser checks). The user has authorized continued implementation, cheaper-agent delegation, verification and release. Tests should demonstrate useful behavior, not inflate counts or hide failures.

## Work and ownership

1. Component/preflight implementer: test actual forgot/reset-password pages and auth preflight. Cover validation, CAPTCHA/rate-limit rejection, loading, retry, session readiness, cleanup, failure preservation and successful navigation. Mock network boundaries only. Report any reproduced product defect before changing production code.
2. Browser implementer: extend the existing isolated auth spec with a unique synthetic account and real local reset email. Request recovery through the UI, validate the email link's loopback destination, change password, prove new credentials work and old credentials fail, then delete the synthetic account. Keep mail/API credentials and reset tokens out of output.
3. Parent: review both diffs, check fixture/CI integration and truthful route coverage boundaries, run full tests/coverage and isolated browser checks, obtain independent review, then push and release only after clean checks.

## Constraints and verification

Use the same source repository and local Supabase/mail stack. No production account or email actions. Keep default CI fast and fail on flaky tests. Use state/network readiness rather than fixed sleeps. Test any discovered defect red before its narrow fix, and measure coverage changes with the existing whole-source configuration.

## Ranked follow-up coverage

After recovery: (1) community authorization and ownership-sensitive actions, (2) application/checklist and document mutation failure recovery, (3) resume formatting/export and representative mobile/cross-browser journeys. Largest uncovered files alone do not determine priority; user impact and missing behavioral assertions do.

Australia-first landing/help/signup copy remains the next product slice (PROD-71), separate from these test changes.

## Verification and review

The parent reproduced the old reset-page bug: an `INITIAL_SESSION` event displayed “Link expired” while server validation was still pending. The fix keeps verification pending, offers retry for temporary failures (including HTTP 429), and ignores stale results after recovery or unmount. The rate-limit case also failed before its correction and passed afterward.

Final local results: 406 unit/component/API tests across 35 files; line coverage 1341/6985 (19.19%), up 1.38 percentage points from the released baseline; 88 browser checks without retries in 52.2 seconds; typecheck, lint and all 12 CI/bootstrap contracts passed.

Independent Claude review found no blocking issue in the core state-handling fix and identified the now-corrected HTTP 429 case. Auth traces remain disabled at file scope because Playwright 1.59 rejects that worker setting inside a describe group; both auth tests contain credentials, and screenshots remain available. The existing 90-second auth-test budget is retained because the real local journey passes well within it; CI timing will be checked before release. The original signup flow is unchanged rather than refactored solely to remove duplicate helper calls.

Remaining gates: final scoped review, clean GitHub checks, release and post-deployment public checks.

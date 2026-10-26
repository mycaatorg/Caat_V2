# Course preparation focus and status (PROD-184)

Active continuation of archived PROD-177. Use existing React controls and live-region semantics; no database or eligibility-policy changes. The user delegated implementation/review/release and prefers continuous execution.

After start/review/reopen/source acknowledgement, focus the next action in the same preparation row once React commits the refreshed data. Fall back to the row, then the section if it disappeared. Preserve focus elsewhere if the user moved during a write. Announce actual refreshed status; failure retains the alert and must not announce success. Keep source/revision protections intact.

1. Reproduce action/acknowledgement/failure/disappearing-row/outside-focus problems in component tests. Observe failures, implement, run focused and full unit/type/lint checks.
2. Extend the existing isolated desktop/phone Chromium/WebKit journey with keyboard and pointer focus assertions, rejected-write recovery, and acknowledgement focus. The acknowledgement browser scenario stages a stale read but uses a real write; database source/revision validation remains covered by existing real RLS tests.
3. One independent whole-change review plus actual Claude review. Fix material findings with failing-then-passing regressions; track minor follow-ups separately.
4. PR/CI/release, deployment and authenticated health verification; update Linear and the checkpoint. Rebase the stacked change onto the released sharing base before opening its PR.

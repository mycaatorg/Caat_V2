# Document refresh implementation — PROD-166

Spec: docs/superpowers/specs/2026-10-27-document-refresh.md

## Task 1: implement and verify refresh reliability

1. Add failing component regressions for accessible retained counts, positive delete warnings, stale zero warnings, quiet automatic refreshes, manual announcements and request cancellation. Add API/pagination regressions for cancellation and bounded failure. Run focused tests; expect new assertions to fail.
2. Add optional cancellation/page limits to evidencePages, wire the usage query and hook, improve row descriptions and delete state, and distinguish manual announcements. Run focused tests; expect all pass.
3. Extend the existing real-data document usage journey with accessible descriptions and retained counts during outage. Run desktop and phone Chromium/WebKit; expect all pass. Run full units, typecheck and lint; investigate/report any failures.
4. Review the whole diff with a fresh independent reviewer and actual Claude; fix important findings with RED→GREEN. Preserve evidence and update Linear.
5. Commit, push, feature PR to develop and passing CI; release to main, exact-main CI, auth health, READY Vercel aliases and live smoke. Mark Done only after verified.

Review focus: stale zero vs positive delete warnings; late abort responses; unmount cleanup; manual retry focus; pagination boundary and partial-result rejection; accessible descriptions for known/unknown data.

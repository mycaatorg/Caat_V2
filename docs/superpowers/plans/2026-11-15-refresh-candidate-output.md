# Refresh candidate output implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make source refresh sample counts unambiguous when the outage guard holds removals (PROD-284).

**Architecture:** Retain the summary object and all refresh decisions. Change only the human-readable sample label from updates to candidates and explain that candidates precede the guard and write checks. Aggregate counts remain authoritative for planned or actual changes.

**Tech Stack:** Existing Node runner and Vitest.

**Spec:** Linear PROD-284, a separately ticketed minor from PROD-281 review. The user has authorized continuous implementation, testing, review and release without repeated design approvals.

## Global Constraints

- No database writes, migrations, provider requests or refresh apply during validation.
- Preserve summary fields and numerical values, guard thresholds and actual write behavior.
- Keep aggregate applied/planned/held counts explicit.
- Use the existing worktree on codex/caat-refresh-candidate-output; retain review evidence.

## Review Focus

- Two awards sharing a missing page in a 49-URL dry run: candidates remain two, applicable updates zero, held rows two, no writes.
- Permitted 1/50 batch: candidates one and applicable updates one.
- Apply samples are candidates too; they must not imply successful writes when a conditional update returns false.
- No change to structured summary consumers or outcome classification.

## Task 1: Clarify sample output

Files: caat-frontend/scripts/refresh-scholarship-sources.mjs and caat-frontend/tests/unit/refresh-scholarship-sources.test.ts.

Interfaces: formatSummary(summary) retains its signature; sample[].updates retains the pre-guard candidate count.

- [ ] Extend the existing shared-page dry-run regression to assert sample candidates=2, aggregate update count zero, held two, and no misleading updates=2 label. Add permitted dry-run and apply conditional-no-op cases.
- [ ] Run focused Vitest; expect failures on the old sample label.
- [ ] Change the printed label to candidates and add a brief explanatory sample heading. No runner behavior change.
- [ ] Run focused tests, types and strict lint; expect success. Use hosted full CI as the full-suite gate, avoiding redundant local full-browser runs for this CLI-only label change.
- [ ] Commit, actual Claude and fresh independent review; resolve important findings and record minor findings separately.
- [ ] PR to develop, hosted CI, then release and verify the exact deployed revision and read-only public journeys. Update Linear only after the scoped work is complete.

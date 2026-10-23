# M3 eligibility and comparison baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the existing major comparison and explain scholarship criteria without confusing recommendation relevance with eligibility.
**Architecture:** Extend the current cached major catalogue and authenticated scholarship detail page. A pure conservative eligibility evaluator returns source freshness and criterion-level evidence; a server-rendered panel displays it. No new storage or sensitive profile questions.
**Tech Stack:** Existing Next.js 16, React 19, Supabase, Vitest.
**Spec:** Linear PROD-75 and PROD-142, approved M3 scope in this conversation.

## Global constraints and design decisions
- Existing comparison remains three broad majors. Specific university-course comparison belongs to PROD-76 and requires verified offering identifiers and sources.
- Scholarship preferences, target majors and graduation-year heuristics are relevance, not proof of citizenship, enrolment, residence, need, gender or GPA.
- Only explicit Australian nationality can be compared to recognized Australian citizenship/country rules. Residency/international status, ambiguous codes and conflicting restrictions stay unknown. Do not collect new sensitive data.
- Verification age uses last_verified_at only; source_last_synced_at is separately labelled. Older than 90 days, future/invalid/missing verification or a missing safe source URL prevents positive/negative eligibility conclusions. Ninety days is a conservative product freshness threshold, not a provider guarantee.
- Never announce overall eligibility. Display criterion evidence and remaining checks; provider decides. Free text and unmodelled requirements remain unknown.
- Relevance badges must not claim nationality access. Preserve ranking behavior but make labels explicitly suggestions, not eligibility.
- No database migrations or paid services in this slice. Full M3 remains underway after this release.

## Review focus
Missing arrays; overlapping included/excluded citizenship; domestic status without citizenship; stale/future dates; unsafe links. Each is covered by evaluator/UI tests.

### Task 1: Existing major comparison (PROD-142)
Files: lib/majors-catalog.ts, components/majors/compare-table.tsx, tests/unit/major-comparison.test.tsx under caat-frontend.
- [ ] Test catalogue-to-render flow with a query adapter that projects only selected columns; careers/coursework must appear. Test empty-field labels.
- [ ] Run focused test, expect missing content failures.
- [ ] Select all Major fields explicitly, change cache key to avoid old partial cached shape, remove unsafe cast, render unavailable labels.
- [ ] Focused tests and full unit suite pass; commit.

### Task 2: Explain eligibility (PROD-75)
Files: lib/scholarship-eligibility.ts; components/scholarships/eligibility-panel.tsx; authenticated scholarship detail page; profile-match.ts; unit tests.
Interface: explainEligibility(profile: Pick<ProfileRow,'nationality'|'student_status'> | null, scholarship: ScholarshipRow, now: Date): EligibilityReport. Report contains criteria (id,label,status,reason), safe sourceUrl, verifiedAt/syncedAt, freshness and counts. Panel accepts report only, never private profile data.
- [ ] Write evaluator tests for matched/unmet Australian citizenship, unknown residency/international and absent profile; conflicting include/exclude and profile; stale/unverified/future data; unsupported criteria and unsafe URLs.
- [ ] Run focused tests, expect missing evaluator.
- [ ] Implement conservative evaluator and server-rendered panel; fetch only authenticated user's nationality/student_status. Include unknown free-text requirements, study level/field/year, institution, GPA, gender and need criteria.
- [ ] Test UI summary/status/source text and correct link sanitization; replace misleading relevance badge language and update its regression expectations.
- [ ] Run unit suite, lint, typecheck, production build, isolated browser CI, real desktop/mobile walkthroughs. Actual Claude plus independent review before merge/release. Record evidence in Linear, keep unfinished roadmap tickets open.

## Progress
Pre-flight: Task 1 and Task 2 share no interfaces. Existing code verified against origin/develop; current working tree clean at start.

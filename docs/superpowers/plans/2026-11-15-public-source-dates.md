# Public source dates implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show visitors how old recorded scholarship details are (PROD-285).

**Architecture:** Reuse scholarshipSourceState and its existing 90-day rule; add source_last_synced_at to the explicit public catalogue projection. Render a small public source note only on selected active detail pages, beside the existing primary actions. No private history, new verification or database mutation.

**Tech Stack:** Existing Next.js server page, React, Vitest, Playwright.

**Spec:** Linear PROD-285; existing source semantics in lib/scholarship-eligibility.ts and components/scholarships/eligibility-panel.tsx. Design choice delegated under the user's standing instruction to continue.

## Design and constraints

Use the existing public page's white (#ffffff), black (#000000), body grey (#404040), border grey (#e5e5e5), pale background (#fafafa) and CAAT red (#9a1a27). Keep existing serif heading/body typography. Left-aligned quiet section with an accessible heading; no warning icon, motion or success badge. Placement: title/amount → tracking and official-source actions → Recorded details → description. Keep line lengths within existing max-width and mobile padding. Archived pages keep their current archive explanation and receive no duplicate active panel.

The alternative of reusing the full eligibility card would imply a profile assessment for a logged-out visitor. A separate status engine would diverge from the existing freshness rules. The small public note reuses those rules without importing profile-specific UI.

Never substitute updated_at or source_last_synced_at for verification. Invalid, impossible and future timestamps are omitted by the existing helper. Date labels use en-AU/UTC consistently with the signed-in eligibility panel. A recent recorded verification remains qualified; provider availability is not guaranteed.

## Review Focus

- A recent import without verification stays unverified.
- Invalid and future dates never appear as proof of freshness.
- Selected duplicate aliases show only that award's dates.
- Archived pages do not regain active tracking or duplicate source messaging.
- The public query selects import date explicitly and does not expose raw payload/history.

## Task 1: Public source-age panel and query

Files: caat-frontend/components/public/ScholarshipSourceNote.tsx (new); app/scholarship/[slug]/page.tsx; lib/public-scholarships.ts; tests/unit/public-scholarship-route.test.tsx; tests/unit/public-scholarship-sitemap.test.ts; tests/e2e/public-smoke.spec.ts.

Interfaces: ScholarshipSourceNote({source: ScholarshipSourceState}) receives only validated metadata; page computes scholarshipSourceState(s, new Date()). Public query returns the same row shape with source_last_synced_at now selected.

- [ ] Add route assertions for stale/recent/no verification/imported-only/future/invalid/selected alias/archived cases and public query projection. Run focused tests and observe the missing panel/date behavior fail.
- [ ] Implement the small source note and page wiring. Copy labels: Recorded details, Recorded verification, Last imported. Stale copy says recorded verification is more than 90 days old; unverified says no valid verification date recorded; recent copy says requirements can still change. Import note explicitly says importing is not new verification.
- [ ] Extend the successful public detail browser journey to require the section and source guidance. Run focused tests, types/lint/full units, build and targeted mobile/desktop browser checks. Inspect screenshots for layout/overflow and date copy.
- [ ] Obtain actual Claude and independent review; resolve Important findings with regression tests. Commit, open PR, require hosted CI and normal release gates. Ticket remains In Progress until live panel/metadata and automated checks pass.

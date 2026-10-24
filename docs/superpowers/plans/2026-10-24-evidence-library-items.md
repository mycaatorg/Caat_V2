# Reusable activities, awards and experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Students save activities, awards and experience once, explicitly import existing work, and reuse it across applications without losing independent tailoring.

**Architecture:** Extend the existing owner-only evidence-link table with a real same-owner item FK. Add a profile library and a separate application card using focused item/import/link services. Existing document links stay separate and their reads filter kind=document.

**Tech Stack:** Existing Next.js/React/TypeScript, Supabase PostgreSQL/RLS, Radix, Vitest, Playwright; no new dependencies.

**Spec:** docs/superpowers/specs/2026-10-23-evidence-library-design.md, slice 2; PROD-153.

## Global Constraints

- Explicit copy import only; never change profiles.activities or resume JSON.
- No submission, score changes, inferred links or invented achievements.
- Every source/link has one owner, enforced by RLS and composite FKs.
- Unlink deletes only the link. Linked sources cannot be deleted until explicitly unlinked.
- Persisted writes select a result back; zero rows is an error. Failed reads offer Retry.
- Additive migration precedes dependent production frontend; test on isolated local Supabase first.
- Existing user authorization covers implementation, additive schema, review, CI and release. No repeated approval needed.

## Implementation rulings

- The shipped schema differs from the design sketch: evidence_items is absent; links currently allow only documents. Extend it, do not recreate it.
- Item link kind is `item`; source kind (activity/award/experience) is authoritative.
- Source revision is a server-assigned UUID changed only on content changes, avoiding device-clock and timestamp precision problems. Source acknowledgements store the exact observed revision.
- Tailoring snapshots the displayed title and full item text (organisation, role, dates, description), so later source changes cannot silently alter any tailored text.
- Use plain text in the library, matching application notes. Resume HTML imports use the existing text conversion utility; free-form resume sections are not guessed into structured experiences. Original rich-text resume remains intact.
- Item deletion uses an explicit confirmation and refuses while linked, with links to applications where it is used; no multistep destructive bulk deletion.
- No arbitrary item cap in this slice; database constraints enforce field lengths, valid kinds and date ordering.

## Review Focus

1. Two tabs editing the same source/link: stale writes fail visibly using server revisions (Tasks 1/2).
2. Duplicate imports and concurrent link attempts: one stable record, no overwritten edits (Tasks 1/2).
3. Source edited while tailoring/acknowledging: only observed revision acknowledged, full tailored text retained (Tasks 2/3).
4. Existing document reads after item links: no phantom unavailable-document rows (Task 2).
5. Partial network errors, mobile/keyboard access, deletion/account cleanup: recoverable UI, protected sources, owner isolation (Tasks 1/3/4).

### Task 1: Database contract

**Files:** new supabase/migrations/20261024150000_evidence_items.sql; types/database.ts; tests/staging/evidence-items-rls.mjs; existing evidence-links-rls.mjs; bootstrap-local.mjs and .github/scripts/bootstrap-local-supabase.mjs.
**Interfaces:** evidence_items fields id,user_id,kind,title,organisation,role,start_date,end_date,is_current,description,origin_key,revision,created_at; application_evidence_links adds source_revision UUID and revision UUID. Clients cannot update source owner/identity/import key or link targets/revisions. Revision trigger stamps every link update; source revisions change on content updates only.
- [x] Write/run real owner/peer/anonymous tests before migration; prove missing table fails.
- [x] Implement validation, owner RLS, narrow grants, immutable links, same-owner FK, import uniqueness, revision triggers, delete protection and account cascade.
- [x] Apply locally; verify creation/edit/duplicate/cross-user/anonymous/date/length/stale-revision/deletion/account deletion with real sessions. Update prior document grant assertions for intentional extensions.
- [x] Commit database contract and test evidence.

### Task 2: Library, import and item-link services

**Files:** lib/evidence-items.ts, lib/evidence-imports.ts, lib/evidence-item-links.ts; tests/unit/evidence-items.test.ts, evidence-imports.test.ts, evidence-item-links.test.ts; lib/evidence-links.ts/document unit tests.
**Interfaces:** EvidenceItem and EvidenceItemInput; listEvidenceItems(), createEvidenceItem(input,originKey?), updateEvidenceItem(seen,input), deleteEvidenceItem(seen), fetchItemUsage(). ImportCandidate {key,label,input}; activityCandidates(strings), experienceCandidates(sectionId,data), fetchImportCandidates(). ItemLink {id,applicationId,itemId,item,revision,sourceRevision,tailoredTitle,tailoredBody}; fetchItemLinks(applicationId), linkItem(applicationId,itemId), unlinkItem(seen), tailorItem(seen,{title,body}), keepItemTailoring(seen), resetItemTailoring(seen), itemSourceChanged(link), evidenceText(item).
- [x] Failing tests: invalid dates/title rejected before writes; zero-row/stale edits fail; duplicate import returns existing without overwriting; malformed resume rows skipped; HTML converted to text; exact observed source version; untouched library and other links; document reader filters document kind.
- [x] Implement services with authenticated owner filters and revision guards. Source deletion FK errors explain where-used recovery.
- [x] Run focused tests, typecheck; commit.

### Task 3: Profile library and application card

**Files:** components/profile/EvidenceLibraryCard.tsx, components/profile/EvidenceItemEditor.tsx, components/applications/hub-evidence-items.tsx, profile/client.tsx, applications/[id]/client.tsx; focused component tests.
**Interfaces:** library owns item/usage read state; editor receives item optional, used count and onSaved; hub card receives applicationId/schoolName and owns isolated read/retry. Functional state updates preserve overlapping completions.
- [x] Failing UI tests: load error differs from empty; failed edit preserves draft; usage blocks deletion; source change preserves tailoring; unlink confirmation keeps source; retry restores card.
- [x] Build library CRUD grouped/filterable by kind, explicit selectable import dialog with duplicate-safe writes, where-used application links; add beside existing extracurricular card.
- [x] Build hub picker, follow-library view, complete tailoring snapshot, source-change notice/Keep mine/reset confirmation, unlink confirmation; add below Documents card. Keep drafts on errors and prevent dismissing an in-flight mutation.
- [x] Verify component tests/typecheck/lint; commit.

### Task 4: Persisted journey, review and release

**Files:** tests/e2e/staging-journeys.spec.ts; test/run documentation.
- [x] Add isolated desktop/phone journey: create/import/edit/reload, one source linked to two applications, independent tailoring, source-edit notice, keep/reset, where-used, unlink, source protection/deletion. Exercise keyboard dialog navigation.
- [ ] Run focused persisted browser, database contracts, full unit/type/lint and complete CI. Inspect responsive UI.
- [x] Independent whole-branch review and actual Claude review; resolve important findings with reproducing tests.
- [ ] PR to develop; exact-head CI; production schema preflight/apply/postflight; release PR to main; deployment SHA/aliases, public routes, auth health and bounded error query. Progress Linear truthfully.

### Verification checkpoint

- Desktop and Pixel 7 Chromium persisted journeys pass with no retries; screenshots inspected. Long resume titles exposed existing profile overflow, fixed in both selector and edit link; regression checks screen width after the resume loads. Keyboard import/open/Escape restores focus.
- Real local owner/peer/anonymous RLS tests pass, including 10,500-character item tailoring and account cleanup. Sixteen bootstrap safety tests pass. Existing document desktop/phone reuse passed.
- Actual Claude Fable review approved implementation, paging/focus/import follow-ups, and final responsive fixes. Conditional CHECK-name concern resolved against production read-only pg_constraint; migration150000 has not yet been applied to production. Independent review found no additional P1/P2.
- Full unit run passed 1,132 before two follow-up tests; both new regressions pass. Final local 1,134 run hit the known PROD-145 resume timeout (five cascading failures; other1,129 passed) under concurrent browser workload. Clean CI must pass before release; no timeout/retry masking.

# Custom essay visibility in application hubs and briefs

> Execute inline using executing-plans and TDD. User delegates product decisions and authorizes reviewed/tested releases. PROD-267 under PROD-77.

**Goal:** A student can see the custom drafts that count toward preparation and open the exact draft from an application hub; printable brief lists titles/status/scope without bodies.
**Architecture:** Extend existing complete owner-scoped hub reads with only custom-prompt ID/title and draft ID/label metadata. Build one row for each applicable custom prompt/scope, selecting the most recently edited draft (stable ID tie-break). Preserve catalogue rows and readiness rules. Add optional exact-draft navigation to existing EssayLine; briefs already map title/status/scope only.
**Stack:** Existing Next.js/TypeScript/Supabase/Vitest/Playwright; no new dependency or migration.
**Spec:** PROD-267 Linear description plus boundaries below; no separate spec file.

## Boundaries
- Read all owned custom prompt IDs/titles and existing draft metadata through evidencePages; stable ordering and terminal reads. No content/body fields. Custom-prompt late failure must reject the hub, not silently omit work.
- Applicable custom drafts have prompt IDs absent from catalogue and school tag null (shared) or this school. Other-school drafts must not appear or determine selected row/navigation. A prompt may have both a shared and a school row.
- One row per custom prompt/scope, newest matching updated_at then ID, labelled with custom prompt title and selected draft label when nonblank. Preserve drafts with missing custom metadata using generic 'Custom essay' fallback; do not invent a catalogue prompt title. No prompt-only row without a draft.
- Add optional draftId to EssayLine. Custom rows link to /essays?prompt=...&draft=... using encoded parameters. Catalogue behavior and readiness remain unchanged. Missing custom metadata shows status/title fallback without a broken editor deep link (navigation only when custom prompt exists). Print retains title/status/scope only, no URL/IDs/content.
- Existing UI account/application reset and error handling remain unchanged. No mutation in hub/brief.

## Task 1: data model and owner reads
- [ ] Unit tests RED: shared/school/foreign drafts; several versions and stable tie; missing custom metadata; empty custom prompt; catalogue drafts never reclassified; complete cap2 tail and late failure; selection excludes body and owner predicates.
- [ ] Extend hub read/assembly minimally; tests GREEN. Keep existing catalogue/readiness tests green.

## Task 2: navigation and printable privacy
- [ ] UI test RED exact custom draft links and absent fallback links; brief model title/scope/status and excludes body/IDs. Implement accessible links within existing row; tests GREEN.
- [ ] Isolated browser journey desktop/emulated phones with >50 custom prompts/drafts and newest other-school version: school/shared rows shown, foreign absent, exact link opens scoped draft, brief metadata only, late custom metadata page failure recovery. Add cap50 gate. Only scoped synthetic rows, cleanup exact IDs.

## Task 3: review and release
- [ ] Full units/types/lint/build and cap50browser pass. Actual Claude plus one fresh whole-delta review. Fix blockers once with RED→GREEN; ticket minors.
- [ ] Feature/develop/release/main CI exact heads, production READY aliases, read-only live/provider/sitemap/identity/CSS checks. Linear Done only after production verification. No human/physical-device claims.

## Review focus
Custom scope parity with readiness; deterministic draft choice with foreign newer versions; missing prompt metadata fallback; complete owner-scoped metadata-only reads and late failure; exact navigation without leaking bodies into briefs; existing catalogue behavior unchanged.

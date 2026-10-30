# Experience library workspace Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, with one fresh whole-branch review after implementation.

**Goal:** Make reusable activities, awards and experience a discoverable workspace rather than a long list buried in Profile (PROD-227).

**Architecture:** Reuse EvidenceLibraryCard and its existing complete owner-scoped readers, editor/import dialogs, optimistic concurrency and application usage. Add an optional workspace presentation and a pure selection helper. A new authenticated route keys the card by account. Profile retains its existing card and gains a link to the workspace.

**Tech Stack:** Existing Next.js, React, Tailwind, Supabase, Vitest, Playwright. No new dependency or schema.

**Description:** This is a focused extension of an existing product surface, as announced in chat under the user's standing instruction to execute without check-ins. Dedicated /workspace/library, sidebar Experience library, exact existing add/edit/import/delete controls. Search title/organisation/role/description, type and application-use filters, newest/oldest/title sorts, 12 rows per page and live result counts. All input changes reset page; mutations clamp page. Clear empty/retry states. No new permissions, invented achievements or automatic linking/submission.

## Design decisions

Use existing white/card and dark-mode tokens, CAAT red #9a1a27 and dark-mode #e06b78, existing typefaces and medium-radius controls. Left-aligned h1 and brief purpose, one content panel with a search toolbar and long-form item rows. Application-use links remain next to their item. No duplicate hero metrics or decorative imagery; the reusable personal work is the content. Small screens wrap actions and controls without horizontal overflow. Keep Profile unchanged except a workspace link.

## Global Constraints

- Owner-only complete reads; account changes clear old content, filters and dialogs.
- Reuse existing CRUD/concurrency guards and dialog focus handling.
- Workspace-only pagination/search; existing Profile/library tests must still pass.
- Do not label created_at as last updated: sort copy is Newest added / Oldest added.
- CI plus real local desktop, Android and iPhone flows; actual 50-row cap gate includes this journey.
- Actual Claude and independent review, production READY/aliases/main/provider/read-only checks; no human or owned-production CRUD claim.

## Review Focus

Exact account switching while reads or editors are open; page clamping after mutations; filters never changing what gets edited/deleted; partial usage failure must not permit deletion; keyboard focus when a saved item exits current filters. Pin these in tasks below where possible; identify untested remainder explicitly at review.

### Task 1: Pure library selection

Produces lib/library-workspace.ts: LibraryFilters {query,kind,usage,sort}; selectLibrary(items,usage,filters):EvidenceItem[]. Searches trimmed case-insensitive text across four fields; filters all/activity/award/experience and all/linked/unlinked; sorts recent/oldest/name with invalid dates last and id tie-breaker. Does not mutate inputs.
- [ ] Write library-workspace.test.ts with combined filters, description/role/org match, linked map, invalid dates/ties and immutability. Run RED missing module.
- [ ] Implement helper, run focused GREEN, commit.

### Task 2: Workspace presentation and route

Consumes Task1; EvidenceLibraryCard({workspace?:boolean}) keeps old Profile behavior by default. New app/(main)/workspace/library/{page,client}.tsx with account-keyed card. Workspace supports 12/page, visible count, clear filters, distinct empty search and empty library, existing actions and application links. Profile workspace link, sidebar Library icon, route registry guard/content entry.
- [ ] Write UI tests for search/filter/pagination/clear, failed usage/retry, clamp after delete, existing edit-save with filtered-out result/focus, account change discards late response/open dialog. RED first.
- [ ] Implement, targeted GREEN including existing evidence-library-ui tests, commit.

### Task 3: Integrated browser and release

- [ ] Add guarded isolated PROD227 @phone journey: 51 owner items + peer item, late-row search, type/usage/sort/page controls, create/edit failure recovery and delete persistence, application usage link/protected-delete; cleanup exact seeded IDs. Extend actual low-cap grep and route coverage. Reuse existing account fixture auth/REST pattern.
- [ ] Build, run desktop/Android/iPhone + route auth gates, inspect screenshots, run real low-cap gate. Then full units/type/lint/safety. All pass without flakes or increased retries.
- [ ] Actual Claude plus independent whole-branch review, one TDD fix pass for blockers; PR/develop/release/main/provider/live evidence in Linear before Done.

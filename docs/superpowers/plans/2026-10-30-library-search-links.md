# Library search links implementation plan

> Use superpowers:executing-plans inline and one fresh whole-branch review.

**Goal:** PROD-229 connects Experience library work to global workspace search and opens the exact owned item.
**Architecture:** Add a fifth metadata-only owner-paginated source to readWorkspaceIndex. Add library kind/filter/copy to search. Server library page awaits searchParams and passes an exact item id to the account-keyed client/card. The card shows the selected item only, with an All library items link; normal browsing remains unchanged. Reuse existing edit/delete, complete usage reads and failure states.
**Specification:** Standing user authorization for continuous product and CI work. Search includes item title, kind, organisation and role; exclude description/body. Deep link /workspace/library?item=<encoded-id>. Exact id chooses only from the loaded owned collection, never bypassing ownership. No new API/schema/dependency.

## Design decisions
Existing CAAT layout, typography and red accents. Add Experience library search filter with count. In targeted view hide browse filters/add/import/pagination; show one matching row and All library items link. Unavailable item gets neutral removed-or-unavailable copy; failure remains Retry, distinct from missing. After deleting selected item retain unavailable state and navigation, not an unrelated row. Account or item changes remount state; query is never treated as authority.

## Global constraints
Metadata only; complete reads under real50rowcap; existing Profile unchanged. No inferred permission or user testing claims. Actual Claude plus independent review, final CI and production verification before Done.

## Review focus
Malformed/missing/foreign item ids; item/account change with pending loads/editor; exact deep link beyond first50; failure in later metadata pages; private description excluded from search; delete in targeted mode cannot reveal unrelated row.

### Task 1: Metadata and exact target
- Extend readWorkspaceIndex tests for fifth source, complete pages, allowlisted metadata, library filtering and encoded exact URL. Expected RED missing library rows, then GREEN implementation.
- Add targeted library UI tests for old item beyond24, missing/foreign target, edit/delete persistence with missing state, changed account/item while reads are pending. Expected RED ordinary full list then GREEN exact card scope.
- Add search library kind/count/copy and async page searchParams props. Type/lint focus testsPASS.

### Task 2: Browser verification and release
- Extend existing PROD22751owned+peer journey: global search finds oldest library item, exact link opens one row, nonowned id unavailable, all-items return restores normal controls. Existing 3phoneplatforms and real50cap gate already run this journey; update registry description.
- Full unit/type/strictlint/build, desktop/Android/iPhone, real lowcap seven journeys; inspect screenshots as needed for changed target layout.
- Actual Claude and independent whole-branch review; one RED/GREEN blocker fix pass. PR/develop/release/main/provider/live proof and Linear update.

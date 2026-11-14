# School-note save ordering implementation plan

> Execute inline with executing-plans and test-driven-development. The user delegates product decisions and authorizes reviewed, verified deployment.

**Goal:** Preserve the latest requested school note through overlapping saves and client navigation.
**Architecture:** One keyed editor per owner and school. Event-owned refs hold current text, persisted text and pending/in-flight state. Debounce, manual Save and navigation flush all request the same serialized drain; pending requests coalesce to the latest text. No render-phase ref writes. The initial snapshot carries its owner ID; the server save validates that expected owner against the current authenticated user before either update or deletion.
**Tech Stack:** Existing React/TypeScript/server action, Vitest and Playwright. No dependency or schema changes.
**Spec:** PROD-270 description and these boundaries; no separate design document.

## Boundaries and decisions
- Keep the 1,500ms debounce, manual Save, 5,000-character limit, private server action and existing status presentation.
- One in-flight save per editor. A request arriving during it records pending work; after settlement send the latest requested current text if dirty. Same-text duplicate requests do not write twice after success.
- Returned errors and thrown errors retain dirty content, show a recoverable message, and permit manual retry. A failed identical request must not create an automatic infinite retry loop.
- Unmount cancels debounce and queues a final dirty flush behind any active request. No post-unmount UI updates. A new school gets its own initial note; old pending writes retain the old school ID.
- Bind every queued write to its original owner; an account change rejects it before table access. Key the editor by owner and school.
- This is per-editor ordering, not cross-tab/server revision conflict resolution. Browser termination may interrupt network delivery; do not claim durable offline or unload saves.
- Existing isolated checkout is reused on codex/caat-school-note-save-order, based on reviewed custom-draft integration aa11011. Do not include this work in release322 or323.

## Task 1: regression and save queue
- [ ] Add tests/unit/school-notes-panel.test.tsx using the real component and deferred server-action boundary. Assert coalescing while first write is held, final persisted latest value, duplicate manual/unload suppression, dirty retry on returned/thrown failures, pending unmount flush, school identity reset and length limit.
- [ ] Run focused Vitest: expected RED on overlapping calls and school identity retention; record actual failures.
- [ ] Implement keyed inner editor and one save drain in app/(main)/schools/[id]/SchoolNotesPanel.tsx. Update refs only in handlers/save settlement, remove the two PROD-248 ref exceptions and the cleanup dependency suppression.
- [ ] Add school-notes-actions.test.ts RED for account changes, missing owner and snapshot owner; update notes-actions.ts and page.tsx to pass and enforce the owner ID. These are necessary privacy boundaries for delayed writes.
- [ ] Focused tests GREEN; strict lint and types PASS.

## Task 2: browser and release
- [ ] Extend the existing school-note persistence journey with editing while a request is delayed and client navigation before debounce; verify reloaded persisted latest text. Desktop/emulated Android/iPhone. Keep synthetic cleanup.
- [ ] Full units, production build, focused built-browser journeys PASS.
- [ ] Actual Claude plus one fresh whole-delta reviewer; fix important findings in one RED/GREEN pass, defer minors in Linear.
- [ ] Feature/develop/release/main CI, READY aliases and live/provider/sitemap/identity checks before Done. Keep release evidence.

## Review focus
Failed save with queued latest text; revert-to-persisted while an older write is pending; duplicate flush after beforeunload; StrictMode setup/cleanup; rapid school navigation and old request settlement. Tests must pin each behavior, with no claim of cross-editor conflict resolution.

# School-note initial load recovery — PROD-274

Execute inline on existing Next.js/React stack; user has delegated design and approved continued fixes/reviews/deployment. Base9b53e3e. No new dependencies or schema changes.

## Problem and design
The school page ignores fetchSchoolNoteAction.error. A failed authenticated read returns an empty note with ownerId, mounting an editable blank and risking replacement of an unseen existing note. Gate editor mounting on successful snapshot+owner. Show My Notes unavailable with Retry loading notes on failures; signed-out users see Sign in instead. Retry uses router.refresh in a transition, so server authorization and read run anew. Do not mount a draft, timer or save handler on failed reads. Sanitize thrown provider/read errors. Successful empty note remains editable. Account-change recovery action remains separate PROD271.

## Work
1. RED component tests: errored owner snapshot cannot edit/save/flush, retry refreshes and rerender recovers original note; signed-out and missing-owner states never mount editor. RED action tests: thrown provider/read failure returns sanitized unavailable, failed auth never queries table, database error preserved as failure, no-row success empty.
2. Implement conditional state in SchoolNotesPanel, pass read error from page, contain thrown load failures. Pin actual page wiring with a focused async page test. Build browser test injects initial note read failure, checks unavailable/no textbox, restores read and retries, verifies original note intact. Keep real auth/storage local only.
3. Focused/full units, types/lint/build, desktop/emulated Android/iPhone browser journeys. Actual Claude and one fresh independent whole-delta review. Important findings one RED/GREEN fix pass. Separate PR after325; full CI/release/live verification beforeDone.

## Review focus
Failure cannot masquerade as empty successful note; no editor cleanup can write failed snapshot; signed-out users not treated as authenticated; retry fetches fresh authorized snapshot; server/private error contents never rendered; real page passes error; no queue/owner binding regression.

# Scholarship comparison (PROD-240)

## Intended behavior

Extend the existing authenticated scholarship catalogue with comparison of two
or three exact records. Selection survives filters and pagination in the same
client visit; refresh or changing accounts clears it. Never save comparison
interest to storage or change bookmarks. Refresh a selected record when it
appears in fresh catalogue props. Do not silently replace off-page choices.

Use the existing course comparison pattern: outlined card selection buttons,
a compact selection tray with remove/clear controls, and a Radix dialog with a
semantic table in a keyboard-focusable horizontal scroll region. Mobile page
must not overflow; comparison scroll is local. Existing black/red theme,
font-display headings and muted borders remain. Counts are announced politely.

Compare recorded amount/frequency, deadline, study level, field, citizenship,
eligibility summary and application requirements. Reuse requirementsChecklist
for deadlines, essay/separate-application rules and source freshness; imports
must never become verification. Include exact detail links and safe official
source links. Unknown values stay unknown; no eligibility verdict, ranking,
financial equivalence, inferred restrictions or AI. Existing source details
may change; prompt checking the provider. No schema/network/write additions.

## Task 1: selection and comparison

Write failing tests for max3, duplicate toggles, cross-page retention, refreshed
selected records, owner reset and missing/source data. Implement a small owner-
scoped selection hook and pure comparison table. Reuse existing helpers.

## Task 2: catalogue and browser flow

Wire optional comparison action on cards and selection tray/dialog on catalogue.
Add a disposable authenticated browser journey covering select2, filter away,
open comparison, exact details, keyboard close and clear; desktop/Android/iPhone.
Retain existing bookmark/details behavior and run full units/types/lint/build.

## Review and release

Actual Claude plus fresh independent whole-branch review. Focus: account changes,
off-page selection preservation, rapid max-limit clicks, date/source truth,
unknown requirements, same-name rows, long text/phone overflow, focus restoration,
no bookmark writes or new network reads. CI and production checks gate release.
Claude quota is currently exhausted until02:30 Australia/Sydney; hold from merge
if actual review is not yet available. Do not include in PR293.

# Attached scholarships in the application brief (PROD-261)

Extend the existing authenticated printable brief using the complete scholarship/tick sources from PROD-260. No new fetch path, schema, dependency or permission. The student chooses Include attached scholarship checklists (off by default). Only exact schoolId attachments enter the document; suggestions and unrelated saved rows never do.

The allowlisted model includes award title/provider, recorded tracking status, source note, inactive notice and existing requirementsChecklist items with recorded preparation ticks. Reuse source wording and safe official URLs. Exclude private essay/document bodies, supporting-work contents and application notes unless their existing separate opt-in is selected. Show unknown and stale source information as such; never imply eligibility or submission.

If the requested source or ticks are unavailable, show a retry/exclusion explanation, disable Print and remove the print portal. The student can Refresh brief or uncheck the section to print core data. Refresh preserves choices but removes stale preview/portal while loading. Account/application remount resets choices. Preview and printed document share one model. Preserve default PDF layout when not selected.

1. Model and client regressions: defaults, exact attachments, source/check semantics, arbitrary text and URL safety, source failure versus true empty, retry/exclusion, refresh and account/application reset. Observe RED before implementation.
2. Implement model/document/control with existing CAAT typography. Add real isolated brief journey; check preview on desktop/Android/iPhone, actual cap50 and a rendered multipage PDF. Preserve existing core brief and resume tests.
3. Full unit/type/lint/build, actual Claude and one independent pinned-delta review, hosted CI and production release gates before Done.

Review focus: owner/app isolation, optional-source incompleteness cannot print, stale response cancellation, safe text and links, notes privacy unchanged, checked rule wording, source-date stability, oversized content and print page breaks. Dates are a snapshot at preparedAt, not a live notification feed.

# Application planning brief implementation plan

> Execute inline with superpowers:executing-plans and one fresh whole-branch review.

**Goal:** PROD-231 gives students a readable private application planning snapshot to print or save as PDF.
**Architecture:** New authenticated /applications/[id]/brief page uses account/application-keyed client and complete fetchApplicationHub core data. Pure buildApplicationBrief returns an allowlisted model: school/country, recorded status/deadline/intended majors, three preparation checks, school/shared essay statuses and school/shared document statuses, generated-at UTC, optional explicitly-included notes. A shared content component renders screen and a direct-body print portal. Add an application-hub link. No schema/dependency/AI.
**Specification:** User requested continued substantial product and testing work. Preview before user-triggered print. No automatic send/share/download; browser Print / Save PDF is user initiated. Core failure and account changes remove preview/print data. Optional catalogue sources are intentionally excluded and do not block core summary.

## Design decisions
CAAT typographic document: small red eyebrow, serif school title, quiet metadata grid, plain section headings and readable tables. Screen preview on a white sheet with dark-mode-aware outer UI; document itself remains white/black for print fidelity. On phones wrap long titles/cells, no horizontal scrolling. Notes off by default and toggled explicitly. Use named A4 page with16mm margins and flowing multipage tables; preserve existing resume portal CSS. Footer explains student-recorded planning, not university submission/confirmation. No readiness percentage or invented eligibility.

## Global constraints
Metadata/status only, no essay bodies, document contents, storage paths or optional catalogue recommendations. Notes opt-in and reset per account/application. Complete core reads depend on PROD230. Keep original resume printing unchanged. Preserve evidence and verify PDF rendering, not just text. No human/AT or production owner-CRUD claim.

## Review focus
Allowlist/privacy and note defaults; account/application/retry transitions while reads pending; print portal removes stale content; button prints exactly preview; date-only timezone stability; long titles/notes and multipage tables; existing resume print CSS isolation; unavailable core data cannot print a partial brief.

### Task 1: Content and preview
- Pure model tests for allowed fields, statuses, notes default/opt-in, no mutation, empty work. RED missing module then GREEN.
- Client tests load/retry, notes included only on checkbox, print invokes browser with current portal, account/application switch ignores old response and removes portal. RED missing client then GREEN implementation.
- Add route and hub link, registry auth/detail classification; style shared preview/print component with new portal selector and namedpage. Build/type/strictlint.

### Task 2: Browser, PDF and release
- Extend the existing51document workspace/hub fixture with brief preview, no private essay bodies, opt-in notes on a dedicated owned fixture (or UI mock test if existing app notes cannot be safely mutated), print interception and multipage Chromium PDF. Test desktop/Android/iPhone preview, all-items/tail and auth guard.
- Inspect PDF extracted text and rendered pages, verify no clipping/blank pages; rerun existing resume print regression. Fullunits/types/build/strictlint and actual50cap suite.
- Actual Claude and fresh independent review; one RED/GREEN blocker fix pass. Final PR/develop/release/main/provider/live before Done.

# Complete application hub implementation plan

> Execute inline with superpowers:executing-plans and one fresh whole-branch review.

**Goal:** PROD-230 stops a database row cap or failed core read from inventing missing preparation work.
**Architecture:** Reuse evidencePages for essay prompt catalogue, owned draft metadata and owned document metadata. Stable sort_order/id for prompts and id for owned rows. Keep existing application ownership query, preparationFor rules and optional-source unavailable flags. Core profile/prompts/drafts/documents failures fail the page honestly with a generic retry message.
**Specification:** Found during next application-planning feature investigation; user authorizes continued fixes and testing. No new schema, dependency, permission or preparation scoring.

## Global constraints
Never return partial core data. Owner filters on every draft/document page. Prompt catalogue remains intentionally shared. No essay bodies or storage paths fetched. Preserve independent optional sources. Do not use a printable summary until underlying hub data is complete.

## Review focus
Short pages before exhaustion; error after initial success; stable tie ordering; ownership per page; existing per-school/shared prompt matching; optional-source recovery unchanged; client response failures retry without claiming missing work.

### Task 1: Complete core readers
- Add capped multi-page core regression and first/later failure tests; adapt existing mock resolver to honor range without changing fixture data. Expected RED omitted tail and silently accepted draft/document/profile failures.
- Use evidencePages and safe core failure message; profile failure rejected. Expected focused hub API/clientGREEN, existing readiness behavior unchanged.

### Task 2: Integrate browser and release
- Extend existing complete workspace fixture with school-tagged documents and application hub assertions; prove51documents including tail at actual50cap and core-read failure/retry. Preserve owned fixture cleanup and existing search counts.
- Full unit/type/strictlint/build, desktop/Android/iPhone flow and actual50cap gate, safety checks. ExpectedPASS no retry widening.
- Claude and fresh independent review, one blocker fix pass if required. Final branch/develop/release/main/provider/live proof before Done; no production owner CRUD or humanAT claim.

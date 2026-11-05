# Complete scholarship sitemap reads (PROD-237)

The public scholarship slug reader stops at a short response, which may be an
API row cap rather than the catalogue's end. Use the existing bounded
`evidencePages` helper and stable updated_at/id ordering. Keep public-only fields,
active/non-null-slug filters, cache identity/tag/revalidation, and the sitemap's
existing static-only fallback on a reader failure.

## Task 1

Add regressions for a lower two-row server cap, an exact cap multiple, tied
timestamps with a unique ID tie-breaker, and a failure after a short first page.
Exercise the real reader and sitemap route with a mocked external query client;
cache is identity in unit tests. Expected: missing later rows, missing ordering,
and silently ignored second-page failure reproduce before the fix.

Replace the loop with evidencePages and add the ID tie-breaker. Require complete
data before mapping it into sitemap entries. Expected: focused tests pass, no
partial catalogue on a later error. Run npm test, typecheck, strict lint, CI and
the production build/browser gates. No private/user data or production writes.

## Review and release

Actual Claude and independent whole-branch review. Review focus: stable ordering
when updated_at ties, actual response offsets, null/empty slugs, late errors,
public-only selection, and preserving the route fallback/cache behavior.
Record findings and release only after exact-head CI. Verify the deployed XML
and its public URL count against a read-only catalogue count.

## Limits and decisions

Use the existing helper's 200-row requests and 1,000-page bound: more requests
than the old 1,000-row batches, amortized by the one-hour cache. The current
catalogue is below the single-sitemap URL limit; splitting sitemaps at future
larger catalogue sizes is outside this pagination fix. Concurrent catalogue
changes can shift an offset scan; no transactional snapshot is claimed.

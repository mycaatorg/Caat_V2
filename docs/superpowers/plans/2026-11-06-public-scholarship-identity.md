# Recover duplicate scholarship links (PROD-238)

Live evidence: 3,467 active rows share 3,439 distinct slugs. Two sampled duplicate
detail routes return500 because maybeSingle rejects multiple records. Preserve
every record/ID/bookmark. A slug is a human-readable alias, not a unique identity.

## Intended behavior

Existing single-listing links keep their detail page. An ambiguous bare link
shows a choice of public listings with provider, amount, recorded deadline and
official source where available. Each choice links with `?award=<record ID>`.
Specific record links must match both slug and ID; invalid/mismatched/repeated
award parameters return404. Never silently choose a different award.

Directory and related cards carry IDs. Sign-up return links retain the selected
ID; signed-in tracking already uses the record ID. Metadata and JSON-LD use the
same selected identity. Generic social images for ambiguous bare links are
acceptable, but must not crash or display an arbitrary award.

Sitemap entries retain bare URLs for unique slugs and add award IDs only to
duplicate-slug entries, producing one distinct URL per active listing. No data
migration, catalogue merge/delete, new auth surface or private data.

## Design

Use the existing public shell and serif headings. Palette: white #ffffff, black
#000000, brand red #9a1a27, muted text #525252 and border #e5e5e5. Left-aligned
heading, short explanation, then a mobile-first list of scholarship choices.
Use factual differences to help students choose; no internal identifiers shown,
decorative metrics or animation. Visible focus and clear link names are required.

## Task 1: data and public identity

Write failing tests for ambiguous bare lookup, exact matching ID, mismatched ID,
later-page error, and duplicate/single sitemap URL construction. Implement a
bounded owner-free catalogue reader and pure URL/selection helpers. Expected:
single links preserved, duplicates unambiguous, no partial/error fallback to a
different award.

## Task 2: render and carry the selected listing

Add route/metadata/choice tests, then wire the detail page, public cards, related
links, signup return and JSON-LD. Keep all fields from the existing public
allowlist. Expected: no500for duplicate slugs, distinct links, invalid404, correct
sign-up return. Verify desktop and mobile with synthetic local records; remove
only created test fixtures from the disposable stack.

## Review and release

Full units, typecheck, strictlint, production build and browser journeys; actual
Claude plus one independent whole-branch review. Review focus: no arbitrary
record selection, invalid IDs, cache identity, canonical/JSON-LD/signup agreement,
same-title duplicates, keyboard/mobile layout, no private data or record writes.
After CI/release, verify both previously500URLs, selected detail URLs and unique
sitemap counts in production. Existing concurrent offset-scan and future sitemap
splitting limitations remain documented separately.

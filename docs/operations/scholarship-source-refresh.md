# Scholarship source refresh (PROD-143)

`caat-frontend/scripts/refresh-scholarship-sources.mjs` checks the page behind every active scholarship's `external_url` and records what it found in `public.scholarship_source_checks`. It is the only thing in this repo that moves `scholarships.last_verified_at`, and it moves it only when a check shows the source page has not changed.

## Why it exists

The scraper (`stealth-startup-2026/scholarship-scraper`) set `last_verified_at` and `source_last_synced_at` to the scrape run's start time, not from a check of each row. By 23 Oct 2026 every row was more than 90 days old, so `lib/scholarship-eligibility.ts` marked every row stale and turned every matched criterion into "unknown". This runner gives `last_verified_at` a real source: a stored check of that page.

## Before the first `--apply`

- **The external scraper must stop writing `last_verified_at` first.** While it still stamps its run time onto that column, any date this runner records is overwritten with an unchecked one. This is a separate change in the scraper repo; do not run `--apply` until it is merged and deployed. (The scraper may keep setting `source_last_synced_at` on a real import: that is what re-baselines a page, see below.)
- Apply `supabase/migrations/20261024090000_scholarship_source_checks.sql` through the normal reviewed release. It stops with an error naming the count if any row already has a future `last_verified_at`; fix those rows first, then re-run it. It takes a 5 s lock timeout so it fails rather than queueing behind live traffic.

## Where to run it, and the key

Run it only where the production service role key already lives: the Mac mini. Never copy the key to a laptop, CI, a file in the repo, a chat, or the command line (it would land in shell history and `ps`). Keep it in an env file outside the repo, readable only by you, and load it with Node's `--env-file`:

```sh
# once, on the mini: ~/.config/caat/source-refresh.env (chmod 600), containing
#   SUPABASE_URL=https://<project>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=<service role key>
cd caat-frontend
node --env-file="$HOME/.config/caat/source-refresh.env" scripts/refresh-scholarship-sources.mjs --limit 50
```

If the key is in the macOS keychain instead, write the env file from it in a private temp file just before the run and delete it afterwards; do not paste it inline. The script refuses to start without both variables.

## Dry run first (the default)

A dry run reads scholarships and earlier checks and fetches each page, but writes nothing: no run row, no check rows, no scholarship updates. It works before the migration is applied: if `scholarship_source_checks` does not exist yet it says so and treats every URL as having no history. It prints:

```
DRY RUN: 50 distinct source urls from 61 active scholarships (run <random id>, not stored).
dry-run: 50 urls checked (run <random id>, not stored)
  baseline    47
  unchanged   0
  changed     0
  unreachable 3
  gone        0
  scholarship rows that --apply would update: 0 (nothing written)
sample:
  baseline    200  https://... rows=4 updates=0 (first stored content hash for this url)
  unreachable 404  https://... rows=1 updates=0 (HTTP 404; first not-found strike, needs a second at least 24 h later)
  unreachable 200  https://... rows=1 updates=0 (redirected to https://...)
  unreachable -    https://... rows=2 updates=0 (network error: fetch failed (ENOTFOUND))
```

Up to three sample lines are printed per outcome. `rows` is how many scholarships share that URL; `updates` is how many of them `--apply` would change.

Options: `--apply` writes; `--limit N` checks the first N distinct URLs; `--concurrency N` (default 4) parallel fetches; `--timeout-ms N` (default 15000) per page; `--url-prefix https://host/path` checks only URLs that start with that prefix (normalised like the URLs: lower-case host, fragment dropped), for one provider.

## Applying

```sh
node --env-file="$HOME/.config/caat/source-refresh.env" scripts/refresh-scholarship-sources.mjs --apply
```

`--apply` first checks that `scholarship_source_checks` and `scholarship_import_runs.check_counts` exist and stops with a clear message if not, before writing anything. It then creates one `scholarship_import_runs` row (`status` started, then succeeded or failed, with `records_seen` = URLs checked, `records_updated` = scholarship rows the guarded updates actually changed, and `check_counts` holding the count per outcome) and one `scholarship_source_checks` row per URL. If a write fails, no new URL starts, URLs already in flight finish, and the run is marked failed with accurate counts; if even that summary cannot be stored, a minimal failed status is written so a run never stays `started`.

Each check's `checked_at` is stamped by the database when the check is stored, and that exact value is what goes onto scholarships. The first `--apply` on a database only records baselines; verification dates start moving on the second run.

Runs and checks are never pruned. A run that has checks cannot be deleted (`ON DELETE RESTRICT`); the history is the evidence behind every verification date.

## Reading the outcomes

| Outcome | Meaning | What changes on `scholarships` |
| --- | --- | --- |
| `baseline` | Page fetched and no accepted hash yet for this URL, or a row on it was re-imported (`source_last_synced_at` later than the accepted check). | Nothing. |
| `unchanged` | Page text hashes the same as the last accepted hash. | `last_verified_at` = this check's `checked_at`, only where the current value is null or earlier (guarded in SQL too). |
| `changed` | Page text differs from the last accepted hash. | Nothing. The check row records it. |
| `unreachable` | Network error, timeout, 429, 5xx, any other non-2xx, a redirect to a different URL, or a 404/410 without a qualifying earlier strike. | Nothing. |
| `gone` | 404 or 410 now, and the previous stored check was also 404/410 (at the same URL) at least 24 h earlier. | `is_active = false` (only while still active); `raw_payload.source_check` records the status, URL, time and run, merged into the row's current `raw_payload`. The row is kept. |

The hash covers the visible text of the page's content area: on `www.sydney.edu.au` (AEM pages with no `<main>`) the `div.content-container`; elsewhere `<main>`, else `<body>`. Scripts, styles, `noscript`, templates, SVG, `<nav>`, `<footer>`, comments and all attribute values are removed and whitespace is collapsed. A redesign that keeps the same words stays `unchanged`; a new amount or date is `changed`. Non-HTML pages (PDFs) are hashed byte for byte. Add a host to `HOST_CONTENT` in the script when a provider's pages have no `<main>`.

A redirect is never hashed into a baseline: if the final URL differs from the requested one the check is `unreachable` with "redirected to ...". Fix the stored `external_url` (a re-import) if the move is permanent.

The "last accepted hash" is the latest `baseline` or `unchanged` check for that URL. A `changed` hash never becomes the reference, so a changed page keeps reporting `changed` and cannot quietly re-verify fields extracted from the old page. It clears when the scraper re-imports the row: a `source_last_synced_at` later than the accepted check makes the next check a new `baseline`, and verification resumes from the run after that.

The panel on a scholarship page shows `last_verified_at` as "Recorded verification" and `source_last_synced_at` as "Last imported". This runner never writes "Last imported".

Verification does not touch `updated_at`, which the sitemap publishes as `lastModified`: the scholarships trigger keeps the old `updated_at` when only `last_verified_at` or `source_last_synced_at` change. Deactivation is a real change and does bump it.

## What it never does

- Delete anything. Gone rows are deactivated; bookmarks keep working.
- Invent or backfill dates. Every timestamp it writes onto a scholarship comes from one stored check. It never writes `now()` onto a scholarship, and the database rejects a `last_verified_at` in the future (`scholarships_last_verified_not_future`).
- Change extracted fields (title, amounts, deadlines, eligibility, description) or `source_last_synced_at`. Only `last_verified_at`, `is_active` and the `source_check` key in `raw_payload`.
- Re-activate a row. Deactivation is one way; reversing it is a manual decision.

## Known limits

- `unchanged` means the page is the same as at its baseline check by this runner, not that the stored fields match the page. Rows imported long before the baseline may already be out of date when the baseline is taken. A spot check of a sample of baseline pages against their rows is the honest way to close that gap.
- One page often carries many sub-awards (one URL, many rows). Any change on that page marks every row on it `changed`, and an unchanged page verifies them all. The runner cannot tell which sub-award changed.
- Passed deadlines are not handled here. A page that still lists last year's closing date can be `unchanged` and verified; deadline expiry belongs to the listing logic, not to this check.
- Pages that need JavaScript to render, block bots (403), or rotate tokens in visible text will report `unreachable` or `changed` every time. Provider-wide redirects (for example to a new site) show as `unreachable` until the URLs are re-imported.
- The re-baseline rule trusts `source_last_synced_at`. If the scraper stamps it with its run's start time and the run began before the accepted check, that import is not detected.
- No per-host rate limit beyond `--concurrency`. Keep it at 4 or lower for the large provider sites.
- Nothing schedules it yet. Run it by hand on the mini until the dry-run numbers look right.

## Tests

- Unit: `npx vitest run tests/unit/refresh-scholarship-sources.test.ts` (fetch and database are mocked).
- Isolated stack: `node tests/staging/scholarship-source-checks.mjs` with the local settings from `caat-frontend/tests/staging/README.md` (loopback only). CI runs it after `course-rls.mjs`.

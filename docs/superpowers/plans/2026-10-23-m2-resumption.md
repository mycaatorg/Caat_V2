# CAAT M2 resumption — 23 October 2026

The owner resumed the Australia-first upgrade and requested short summaries,
accurate Linear progress, and an independent review (preferably Claude).

## Scope and tickets

- PROD-71/73: existing Australia-first landing/copy and progressive onboarding.
- PROD-74: finish the inherited compact Today overview, expanded/paginated lists,
  URL recovery, searchable shortlist categories, and completed-task/Undo UX.
- PROD-72/104: finish unordered multiword scholarship search across title,
  provider, university, fields and tags, conservative typo tolerance, exact-first
  ranking, stable pagination and preserved filters/restricted IDs.
- PROD-103: reject returned and thrown deadline-source failures; Today shows its
  retry screen instead of an incomplete successful feed.
- PROD-105: failed toast Undo preserves the recently completed task in place.
- PROD-106: replace the six-task loader cap with owner-scoped 200-row database
  pages, stable due-date/ID ordering, and failure propagation for every page.

The inherited changes in 15 files were preserved before editing at
`/tmp/caat-resume-20261023-original`. Work continues in the existing
`feat/caat-m2-australian-plan` worktree. No production data was used for write
verification and no production migrations were applied.

## Verification

- 719 unit tests pass, 58 files. Whole-runtime line coverage 48.17%; existing
  floors unchanged. Typecheck and lint pass with no new warnings.
- 12 isolation/bootstrap/discovery/route-contract checks pass.
- 101 browser checks pass against a production build on isolated loopback
  Supabase, with strict flaky detection and no failures/retries.
- Real PostgreSQL search regressions pass and roll back all fixtures. Added
  genuinely fuzzy-only ranking fixtures, school-name matching and short-typo
  rejection; the older ranking fixture accidentally contained an exact field.
- Populated-account walkthrough: task 11 is reachable, survives URL reload,
  completes and restores via Undo; 25 saved awards support page two, reload,
  search and status filters. Desktop 1440px and mobile 390px screenshots checked;
  no horizontal overflow or browser page errors. Synthetic account and awards
  were removed in cleanup.
- Independent Codex reviews found PROD-105 and PROD-106; both reproduced with
  failing tests before fixes and passed re-review. PROD-103 also passed review.
- 14 additional phone Chromium/WebKit checks pass against the same build.
- Claude reviewed the incremental M2 source/diff read-only and found no blockers;
  it did not independently execute tests. Its stale Undo-after-delete finding
  is fixed as PROD-130, with two red/green cases and Codex re-review.
  Nonblocking ordering, pagination recovery, URL flash and search-limit guidance
  suggestions are tracked in PROD-131 (Backlog). Compact task detail is intentional.
- PROD-129 pins PR and nightly browser jobs to Ubuntu 24.04: the first GitHub
  run failed before tests on Ubuntu 26.04, unsupported by locked Playwright.
  The replacement run is pending; local browser results above remain valid.

## Search measurement

4,200 fictional scholarships plus the isolated seed record, 15 runs per case:

| Local RPC scenario | Median | p95 |
| --- | ---: | ---: |
| Anonymous browse | 12 ms | 15 ms |
| Personalised browse | 31 ms | 33 ms |
| Engineering search | 57 ms | 59 ms |
| Engineering merit | 100 ms | 100 ms |
| Reordered words | 100 ms | 105 ms |
| Misspelled engineering merit | 102 ms | 104 ms |
| Location + field filters | 4 ms | 5 ms |

The three multiword variants all returned 26 matches. These are local RPC
measurements, not production page latency. The synthetic catalogue was removed.

## Review and release boundary

Draft PR #177 is open against `develop`, preserving the existing branch's disabled
Vercel preview setting. This is unreleased work; tickets remain In Review until
integration/release evidence warrants advancing them.

The existing owner-review requirement in the 7 October M2 spec still applies.
Production needs the onboarding migration before the code deploys, plus the new
scholarship-search migration to deliver improved matching:

1. `caat-frontend/supabase/migrations/20261007100000_student_onboarding_profile_fields.sql`
2. `caat-frontend/supabase/migrations/20261010130000_scholarship_search_matching.sql`

Both are transactional. The search RPC parameter names/types match the prior
migration. Before applying, confirm pg_trgm is installed in public: the earlier
migration uses the default extension schema and does not prove the live schema.
Obtain approval for this concrete production migration
and M2 release, then verify the production schema, merge through the existing
PR-to-develop/release process and verify the deployed revision. Other held
community/document migrations and PRs are separate work, not bundled here.

## Reproduction environment

Isolated test copy: `violets-mac-mini:/Users/violet/caat-staging/m2-resume-20261023`.
Runner: `M2_DIR=m2-resume-20261023/caat-frontend python3 /Users/violet/caat-staging/m2-run.py`.
`runtime.json` and account files contain credentials and must not be printed.

The stopped `caat-test` Colima profile was restarted. Next.js rejects a
node_modules symlink outside its root; use an actual local dependency directory
in this test copy. This infrastructure issue was fixed before the successful
production build and browser run.

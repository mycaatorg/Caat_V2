# Local full-stack staging fixtures

This directory contains a schema snapshot and deterministic synthetic fixtures for disposable local Supabase only. The snapshot was generated from the production database's **schema metadata only** (42 public tables, 335 columns, constraints, indexes, RLS/policies, functions/triggers, sequences, extensions, buckets, and table/sequence ACLs). No user rows, credentials, secrets, production storage objects, or external data are included. Provenance date: 2026-10-04. Schema fingerprint/source reference: parent task's `/tmp/caat-schema-only.json` and `/tmp/caat-schema-grants.json`.

Before keeping a function or trigger definition, the definitions were checked for URLs, outbound network/email/webhook/cron calls, and embedded credentials. The 12 functions and 10 triggers are SQL/PLpgSQL data operations (updated-at maintenance, community parent/child cleanup, moderation, and local search/profile helpers). `delete_own_account` deletes application rows and the matching `auth.users` row; it is included to reproduce schema behavior but is never called by bootstrap or seeding. There are no custom `auth.users` triggers, so the user script explicitly creates `profiles` rows.

## Start on a disposable local Supabase instance

The checked-in config uses project ID `caat-test`, selects API/database/mail ports 55431/55432/55434, disables Studio and external edge/analytics/image/pooler services, and leaves migrations/seeds disabled. **The Docker network below supplies the loopback binding; the TOML port settings alone do not.** Use Supabase CLI 2.90.0, a disposable Docker context, Node 20+, and `psql`. From `caat-frontend`:

```sh
CAAT_TEST_STACK=$(mktemp -d)
mkdir -p "$CAAT_TEST_STACK/supabase"
cp tests/staging/config.toml "$CAAT_TEST_STACK/supabase/config.toml"
docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 caat-supabase
supabase --network-id caat-supabase --workdir "$CAAT_TEST_STACK" start --exclude realtime,studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta
```

Read this local stack's connection settings with `supabase --workdir "$CAAT_TEST_STACK" status`; never commit its keys or test passwords. Set only local values in your shell:

```sh
export SUPABASE_DB_URL='postgresql://postgres:<local-db-password>@127.0.0.1:55432/postgres'
export SUPABASE_URL='http://127.0.0.1:55431'
export SUPABASE_ANON_KEY='<local-anon-key>'
export SUPABASE_SERVICE_ROLE_KEY='<local-service-role-key>'
export E2E_TEST_PASSWORD='<disposable-local-password-at-least-12-chars>'
node tests/staging/setup-local.mjs
```

The DB bootstrap accepts only loopback and known local Supabase DB ports (54322 or 55432); it refuses to run if app tables already exist. User seeding accepts only loopback and local API ports (54321 or 55431). Do not put production connection values in these variables. `seed-users.mjs` never prints its key/password. The seed creates two confirmed test users and explicit profile rows, then setup inserts synthetic Australian school/major/scholarship/essay catalog records. The user-owned community group fixture is deliberately seeded only after the Auth accounts exist. DB passwords are passed to libpq through its process environment rather than command arguments. All fixture rows use `E2E Test` names and stable UUIDs prefixed `e2000000`.

## Snapshot fidelity and known boundaries

The metadata did not contain enum types or views; none were present in the exported schema. The single `schools.id` sequence is recreated as its identity sequence. The Supabase platform must supply the `auth` and `storage` schemas, `auth.uid()`, `auth.users`, `storage.objects`, `storage.foldername()`, and built-in roles; those managed platform objects are not recreated here. The local image also needs the six captured extensions (`plpgsql` is PostgreSQL built-in; the generated SQL installs the remaining five). The exported grant snapshot covers public table and sequence ACLs only; it does not include function ACL/owner/config, schema ACLs, extension versions, or managed `auth`/`storage` internals. Check any local migration differences before treating this as a complete production clone. After setup, `node --test tests/staging/safety.test.mjs` verifies the guard helper and `node tests/staging/rls-smoke.mjs` performs real owner/peer row and private-document-storage RLS checks; these scripts use only generated synthetic rows and clean up their own random test artifacts.

## Community migration and database regression checks

The snapshot remains the historical baseline. Fresh bootstrap additionally applies `supabase/migrations/20261004090000_secure_community_groups_and_content.sql` before loading fixtures. On an existing **disposable local** stack, run `node tests/staging/apply-community-migration.mjs`; use `--reapply` when validating an edited migration. The helper's marker is only a convenience for reuse, not proof of full policy integrity.

Run `node tests/staging/community-rls.mjs` with the local settings above after setup. It tests private content and related rows with real owner, requester, and anonymous sessions, public joins, direct role/status forgery, concurrent approvals, and reply/scope constraints. It creates only synthetic rows/users and requires cleanup. CI runs it alongside `rls-smoke.mjs`; both are separate from mocked server-action tests.

**Production release gate:** compare live policy/function/trigger metadata and ownership with the reviewed migration before applying it. Run the migration transactionally in the CAAT project, verify the resulting metadata, then release the app that uses the new approval RPCs. Treat both steps as one release window with owner approve/reject use paused: the previous approval write path will be denied after migration. Prepare and verify the app build first, activate it immediately after the database change, then resume approvals only after a successful check. Audit request status/membership consistency for the release window; do not infer approval from a toast alone. Do not deploy the intermediate compensation implementation. Never use these local bootstrap/probe scripts against production. Existing membership and reply anomalies need a separate read-only audit; this migration does not rewrite historical data. Recovery should retain the tighter privacy rules and use a forward fix, rather than restoring vulnerable policies.

The release audit must also confirm the unique `(post_id, reporter_id)` constraint on `community_reports`, its `AFTER INSERT` binding to `check_post_reports`, the existing function body, and the poll-count RPC signature. The report trigger now has the privileges needed to enforce its existing auto-hide thresholds (five reports, or three reports from accounts older than seven days); this behavior needs to be included in the release notes. A duplicate-report regression proves a single account cannot inflate the count on the reviewed schema. Stop the release if live constraints or trigger bindings differ.

## Browser verification and CI

Set `CAAT_ISOLATED_E2E=1`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100`, `E2E_TEST_EMAIL=e2e.student@caat.local.test`, the seeded `E2E_TEST_PASSWORD`, and this stack's `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Then `CI=true npm run test:e2e:ci` builds once and runs the Chromium suite against a loopback production server. Keep service-role and database credentials out of the app/browser process; they are needed only for setup and RLS checks. The CI helper scopes them to those child processes.

The same source repository supplies local and GitHub environments. GitHub creates a fresh stack for every run, runs setup, owner/peer RLS and community permission checks, then runs the browser suite. Authenticated routes never use production database credentials, including page loads that can create profile, dashboard, or resume rows. The route manifest records the successful render checks and remaining journey boundaries; whole-source unit coverage is a separate metric.

The auth spec also requests a password reset through the UI and reads its unique synthetic account's email from the local Mailpit API at `http://127.0.0.1:55434`. It validates the exact local Auth verification origin and reset-page redirect before following the link, proves the old password fails and the new one works, and deletes the account through settings. Auth-spec traces are disabled to avoid recording passwords or recovery tokens; failure screenshots remain enabled. This is local email delivery verification, not verification of the production email provider.

For a public deployment check, `PLAYWRIGHT_BASE_URL=https://<deployment> npm run test:e2e:public` exercises public pages and signed-out redirects without authenticated writes. The full legacy suite remains a manual-only workflow; its presence is not a claim that every legacy journey has been verified in the PR job.

The isolated community spec also aborts one post request before it reaches the server, verifies draft retention and error feedback, retries, then reloads to confirm one saved post. This proves recovery from that transport failure; it does not claim idempotency when a server commits but its response is lost.

Private access remains required after leaving a group, including for author operations through these policies. Historical membership provenance and safe removal of former members’ own content are explicit follow-up concerns; this change does not claim to solve them.

While PROD-85 awaits its live database gate, `vercel.json` disables automatic deployment only for `codex/caat-community-permission-tests`. GitHub CI still verifies a production build against disposable Supabase. Remove this exception after the live migration is verified, then verify the Vercel build in `caats-projects`. The setting is documented at https://vercel.com/docs/project-configuration/git-configuration#gitdeploymentenabled.

## Phone checks (PROD-91)

Two phone engines run outside the PR gate, only when `CAAT_PHONE=1` is set (the npm scripts set it): Android-sized Chromium (Pixel 7, 412px) and iPhone-sized WebKit (iPhone 13, 390px). Install the WebKit build once with `npx playwright install webkit`.

- `npm run test:e2e:phone:public`: the read-only public checks, plus no sideways scrolling on every public page, the landing menu (`aria-expanded`) and keyboard access to sign in. It is safe against production with `PLAYWRIGHT_BASE_URL=https://mycaat.com`. Measured on the Mac mini: 96 tests in about 30 s.
- `npm run test:e2e:phone`: isolated stack only (it needs `CAAT_ISOLATED_E2E=1` and loopback URLs). It checks that every signed-in page in the route manifest fits the screen, that the phone menu opens, reaches a tool, takes focus and closes on Escape and after navigating, and it runs the four journeys tagged `@phone`: essay autosave, resume reload, application tracking and failed-save recovery. Measured: 14 tests in about 1.2 min. It passed three runs in a row with no retries.

Not verified: Tab-key reachability on WebKit. Safari skips links and buttons on Tab unless the user changes a setting, so that check is skipped there. Firefox and real devices are also not covered. Adding these to CI would cost about 2 min per run plus about 75 MiB of WebKit download; propose a manual `workflow_dispatch` job before any schedule.

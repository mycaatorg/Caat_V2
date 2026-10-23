# Source change notifications for saved scholarships — PROD-79

Design only. Nothing here exists yet. Builds on PROD-143 slice 1 (`scholarship_source_checks`, `scripts/refresh-scholarship-sources.mjs`, `docs/operations/scholarship-source-refresh.md`), the unified deadlines feed (`lib/unified-deadlines.ts`), Today (`lib/today.ts`, `lib/today-data.ts`), the application hub (PROD-147/148/77) and the scholarship detail page.

## Intent

When the official source behind a scholarship a student saved really changes, tell that student once, in the place they already look (Today, the application hub, the scholarship page), and let them stop hearing about it. Never turn a failed fetch, a blocked site or a reworded page into "your deadline changed". A wrong notice costs more trust than a missing one: students act on deadlines.

Why now: PROD-143 gives us, for the first time, a stored record of each source check. PROD-79 turns the small subset of those checks that mean something into notices. Today there is no change history at all (no `--apply` has run; blocked on PROD-151), so the first slice must ship dark and light up only as real, reviewed evidence arrives.

## Verified reconnaissance, 23 October 2026

Read from `origin/develop` (fetched 23 Oct) and `origin/codex/caat-community-notifications`.

- **Source checks.** `public.scholarship_source_checks` (migration `caat-frontend/supabase/migrations/20261024090000_scholarship_source_checks.sql`): one row per **normalised URL** per run (`url`, `checked_at` stamped by the database, `http_status`, `final_url`, `content_hash`, `outcome` in baseline|unchanged|changed|unreachable|gone|unanchored, `detail`, `run_id` → `scholarship_import_runs` with `check_counts`). RLS on, no policies, grants to `service_role` only. Checks are keyed by URL, not by scholarship: the runner groups rows with `normaliseUrl()` in JS (`groupRowsByUrl`), and many rows share one page. There is no SQL-side way to map a scholarship to its checks today.
- **Outcomes that mean something.** `gone` = 404/410 twice at least 24 h apart; the runner calls `scholarship_mark_gone(p_id, p_check)` which sets `is_active = false` and merges `raw_payload.source_check`, only while active. `changed` writes nothing to `scholarships` and keeps reporting `changed` until a re-import re-baselines the page. `unchanged` advances `last_verified_at` only for anchored rows. `unreachable` covers errors, timeouts, 429/5xx, any other non-2xx, redirects and a first 404 strike.
- **Dry run.** 3,390 URLs: 1,652 fetchable, 1,738 unreachable. UniMelb and Monash (about 45% of active rows) sit behind Cloudflare challenges and will always be `unreachable`.
- **Scholarship fields.** `scholarships.deadline_at` is `timestamptz`; `user_school_applications.deadline_at` and `calendar_events.event_date` are `date`; `user_scholarships.deadline_at` is `timestamptz`. `mergeDeadlines` takes `deadline_at.slice(0, 10)` of the ISO string, i.e. the **UTC** date.
- **Saved items.** `user_bookmarked_scholarships`: PK `(user_id, scholarship_id)`, FK to `scholarships` `ON DELETE CASCADE`, `status` check interested|applied|awarded|not_selected, `school_id`, `created_at`. Owner SELECT/INSERT/DELETE policies, no UPDATE policy (see the PROD-148/77 spec: status changes on an existing bookmark are probably broken; this design reads `status` and inherits that bug's fix, it does not depend on writing it).
- **Today.** `deriveTasks` has kinds deadline-soon|set-deadline|start-essay|upload-documents, `SOON_DAYS = 14`, scholarship tasks only while status is `interested`; `daysBetween(todayISO, dateISO)` compares calendar dates with `Date.UTC`. `loadToday` computes `todayISO` with `zonedTodayISO(tz)` from the `caat-tz` cookie (default Australia/Sydney), but `fetchUnifiedDeadlines` computes its own `todayKey()` in the server's local zone (UTC on Vercel). The two can disagree for part of each day.
- **Existing notification code.** `public.notifications` (community only): `actor_id uuid NOT NULL` FK `auth.users`, `post_id`/`comment_id` FKs, `type` check limited to like|comment|reply|follow|join_request|request_approved|request_rejected, `is_read`, `message`; no INSERT policy by design (PROD-86 release gate); read by `app/(main)/communities/actions/notifications.ts`, `app/(main)/communities/notifications/page.tsx`, `MarkRead.tsx`, `components/communities/NotificationBell.tsx`. `codex/caat-community-notifications` (PROD-100, unmerged) moves inserts into AFTER triggers with a dedup index and swallow-on-failure; `codex/caat-join-request-notify` adds `lib/notification-href.ts` and a join-request trigger.
- **No email, no preferences, no scheduler.** No Resend/SMTP/send code in the app (only Supabase Auth mail). `app/(main)/settings/` has only data export and account deletion. `vercel.json` has no crons. `.github/workflows/auth-provider-health.yml` is the only active schedule; `nightly-e2e.yml` cron is commented out. The refresh runner is run by hand on the Mac mini, which is the only place the service-role key may live.

## Goals

1. Record, per scholarship, the official source URL, when it was last checked, and what that check found, and show the student an honest label for scholarships they saved.
2. Derive per-scholarship **change events** only from verified evidence, and fan them out once per student who saved the scholarship before the event.
3. Surface unread events in Today (new task kinds), on the hub's tracked-scholarship card and on the scholarship page, one notice per student per event, at most one Today task per scholarship.
4. Stop notices for scholarships that are unsaved, awarded or not selected.
5. Leave a clear, gated path to outbound email with student-controlled channel and frequency, default off.

## Non-goals

- Re-extracting fields, diffing deadlines automatically, or any LLM step. Field changes enter only through a human-reviewed re-extraction (slice 2).
- Changes to applications, calendar events or custom scholarships (`user_scholarships` have no source checks; the student owns those dates).
- Reworking the community bell or `public.notifications`.
- Scheduling the refresh runner (PROD-143's concern).
- Push notifications, SMS, digests in slice 1.

## Anti-goals (hard rules)

- **Never notify from `unreachable`, `unanchored`, `baseline` or a lone `changed` check.** A failed fetch, a Cloudflare challenge, a redirect or a first 404 is absence of evidence.
- **Never imply a deadline changed when only the page hash changed.** A `changed` hash says the visible text differs; it can be a new sub-award, a news banner or a date format. Only a reviewed re-extraction with a before/after deadline may say "the deadline moved".
- **No outbound email until change detection is validated on real history** (see "Gate for outbound email") and the owner approves the provider.
- No notice for an event that happened before the student saved the scholarship: the scholarship page already shows its state.
- No duplicate notices: one row per (student, event), and Today shows one task per scholarship however many unread events it has.
- Never expose `scholarship_source_checks` (URLs, hashes, details, run ids) to students beyond the narrow read below.

## Constraints

- Owner-only RLS on every student-facing table; no INSERT policy for students on notice rows (same reason as `public.notifications`: a student must not forge a notice).
- Additive migrations only, applied through the reviewed release **before** the code that depends on them. Every RLS policy, grant or SECURITY DEFINER function below needs owner approval before it is written into a migration.
- No paid service (email provider, scheduler) without approval.
- The service-role key stays on the mini. Anything that writes events runs there.
- Sequencing with PROD-143: the per-row link table (below) should land **before the first `--apply`**. Then every stored check has its rows recorded and nothing needs a backfill. If `--apply` runs first, a one-off backfill using the runner's own `normaliseUrl` is required (never a SQL re-implementation of it).

## Data model

All in one additive migration, `caat-frontend/supabase/migrations/2026MMDDhhmmss_scholarship_source_notices.sql`, with the same shape as the PROD-143 migration (`BEGIN`, `SET LOCAL lock_timeout = '5s'`, prerequisite checks that abort, `NOTIFY pgrst`).

### 1. `scholarship_source_check_rows` (service role only)

Which scholarship rows a check covered, so SQL can answer "latest check for this scholarship" without re-implementing URL normalisation.

```
check_id        bigint NOT NULL REFERENCES scholarship_source_checks(id) ON DELETE RESTRICT
scholarship_id  uuid   NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE
PRIMARY KEY (check_id, scholarship_id)
INDEX (scholarship_id, check_id DESC)
```

RLS on, no policies, grants to `service_role` only (copy the checks table's REVOKE/GRANT block). Written by the runner in `--apply`, right after `recordCheck`, from the `rows` it already holds for that URL. A failed link write is a failed check write: the existing "stop starting new URLs, mark run failed" path applies. Volume is about one row per active scholarship per run.

### 2. `scholarship_source_events` (service role only)

One row per verified change to one scholarship.

```
id              bigserial PRIMARY KEY
scholarship_id  uuid NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE
kind            text NOT NULL CHECK (kind IN ('gone', 'details_changed'))
check_id        bigint NOT NULL REFERENCES scholarship_source_checks(id) ON DELETE RESTRICT
occurred_at     timestamptz NOT NULL   -- the evidence check's checked_at, never now()
changes         jsonb                  -- details_changed only: {"deadline_at": {"from": "2026-11-01", "to": "2026-11-15"}, ...}
reviewed_by     text                   -- details_changed only: who approved the re-extraction
created_at      timestamptz NOT NULL DEFAULT now()
UNIQUE (scholarship_id, kind, check_id)
CHECK ((kind = 'gone') = (changes IS NULL AND reviewed_by IS NULL))
```

What qualifies as a verified change in slice 1 and 2:

| Evidence | Event | Who writes it |
| --- | --- | --- |
| `gone` check that actually deactivated the row (`scholarship_mark_gone` returned the id) | `gone` | Runner, atomically with the deactivation (below). Slice 1. |
| A `changed` check for the row's URL, followed by a human-reviewed re-extraction whose recorded fields differ from the stored ones | `details_changed` with `changes` holding only the fields that differ (deadline as Sydney date, opening date, amount, eligibility text hash) | Reviewed-change script on the mini. Slice 2. |
| `changed` alone, `unreachable`, `unanchored`, `baseline`, `unchanged` | none | — |

A `details_changed` event whose `changes` is empty is rejected (the re-extraction confirmed nothing moved; the page only reworded). A `deadline_at` change is recorded only when the **Sydney calendar date** differs (see Timezones), so a time-of-day or offset rewrite never becomes a "deadline moved" notice.

**Atomic `gone` event.** Add `scholarship_mark_gone_with_event(p_id uuid, p_check jsonb, p_check_id bigint) RETURNS uuid`, `SECURITY INVOKER`, `SET search_path = ''`, service role only: one statement with a CTE that runs the existing UPDATE (`WHERE id = p_id AND is_active`) and inserts the event from its `RETURNING` row, `ON CONFLICT DO NOTHING`. The runner switches to it; the old function stays (additive). Doing it in two runner calls would leave a deactivated row with no event if the second call failed, and the runner only reads active rows, so it would never retry.

**Reviewed change (slice 2).** `scholarship_record_reviewed_change(p_scholarship_id uuid, p_check_id bigint, p_fields jsonb, p_reviewer text)`, service role only: requires that `p_check_id` is a `changed` check linked to that scholarship in `scholarship_source_check_rows` and is the latest check for it; computes `changes` against the current row inside the function (not from caller input); updates the fields and `source_last_synced_at` (the extraction time, a real re-import, so the next refresh re-baselines the page); inserts the event. Empty diff → no update, no event, returns null.

### 3. `scholarship_source_notices` (per student)

One row per (student, event). Denormalised so students never read the events table.

```
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid NOT NULL
scholarship_id  uuid NOT NULL
event_id        bigint NOT NULL REFERENCES scholarship_source_events(id) ON DELETE CASCADE
kind            text NOT NULL CHECK (kind IN ('gone', 'details_changed'))
occurred_at     timestamptz NOT NULL
changes         jsonb
created_at      timestamptz NOT NULL DEFAULT now()
read_at         timestamptz
email_sent_at   timestamptz            -- slice 3; null until then
email_attempts  smallint NOT NULL DEFAULT 0
email_last_error text
UNIQUE (user_id, event_id)
FOREIGN KEY (user_id, scholarship_id) REFERENCES user_bookmarked_scholarships(user_id, scholarship_id) ON DELETE CASCADE
INDEX (user_id) WHERE read_at IS NULL
```

- **Fan-out.** `AFTER INSERT` trigger on `scholarship_source_events` inserts one notice for every bookmark of that scholarship with `created_at <= NEW.occurred_at` and `status IN ('interested', 'applied')`, `ON CONFLICT (user_id, event_id) DO NOTHING`. Unlike the PROD-100 community triggers, it does **not** swallow errors: a failed fan-out rolls back the event (and, for `gone`, the deactivation), the runner records a failed write, and the row is still active for the next run. A lost notice is worse than a delayed one.
- **Duplicates.** The unique key makes re-delivery of the same event impossible; the composite FK means unsaving deletes the notices and re-saving does not bring them back.
- **RLS.** Enable RLS. Policy `SELECT` to `authenticated` using `user_id = auth.uid()`. No INSERT or DELETE policy for students. `UPDATE` policy `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())` plus `REVOKE UPDATE` on the table and `GRANT UPDATE (read_at)` to `authenticated`, so a student can mark their own notice read and nothing else. Needs owner approval.
- **Why not reuse `public.notifications`.** It needs an `actor_id NOT NULL` user, its type check and dedup index are community-shaped, and loosening it touches the PROD-86 release gate and the unmerged PROD-100 triggers. A separate table costs one migration and keeps the community bell untouched. A later bell can union both.

### 4. Student read path: `scholarship_source_status(p_ids uuid[])`

Students need "last checked <date> and what it found" for scholarships they saved, and nothing else from the checks table. Choice: **a `SECURITY DEFINER` function**, not a view.

- Postgres views cannot carry RLS policies of their own; a view over a no-policy table either runs as invoker (returns nothing) or as definer (Supabase's linter flags security-definer views, and the filter by caller would live in a view nobody reviews as a security boundary). A function makes the boundary explicit, takes bounded input and is easy to test.
- Signature: `RETURNS TABLE (scholarship_id uuid, last_checked_at timestamptz, status text, last_reached_at timestamptz)`, `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''`. `REVOKE ALL FROM PUBLIC, anon`; `GRANT EXECUTE TO authenticated`. Rejects arrays over 200 ids.
- Returns rows only for ids in `p_ids` that the caller has in `user_bookmarked_scholarships` (`user_id = auth.uid()`). Saved-only matches the ticket and avoids publishing the crawl state of the whole catalogue; see owner question 2.
- `last_checked_at` = `checked_at` of the latest linked check (any outcome). `last_reached_at` = latest linked check that is not `unreachable`. `status` is a label, never the raw outcome, URL, hash or detail:

| Latest outcome | `status` | Page copy |
| --- | --- | --- |
| none | `not_checked` | "Not yet checked against the provider's page." |
| `unchanged`, `unanchored` | `unchanged` | "Last checked 20 Oct 2026: the provider's page was unchanged." |
| `baseline` | `recorded` | "Last checked 20 Oct 2026: page recorded, nothing to compare yet." |
| `changed` | `changed_unreviewed` | "Last checked 20 Oct 2026: the provider's page has been updated since these details were recorded. Check it before relying on them." (No field is named.) |
| `unreachable` | `unreachable` | "Last checked 20 Oct 2026: could not be checked." plus, when `last_reached_at` exists, "Last reached 1 Oct 2026." |
| `gone` | `gone` | "The provider's page was not found on 20 Oct 2026. This scholarship is no longer listed." |

`unreachable` stays neutral on purpose: for UniMelb and Monash it is permanent and says nothing about the scholarship. It never creates a task, never colours a card red, and the eligibility panel's existing freshness copy (`components/scholarships/eligibility-panel.tsx`) already carries the "check the provider" message.

## Surfacing (slice 1, in-app only)

New pure module `caat-frontend/lib/source-notices.ts` (label mapping, copy, task derivation), unit tested without Supabase.

- **Today.** `TaskKind` gains `"source-gone"` and `"source-changed"`. `TodayInput` gains `sourceNotices: { id, scholarshipId, title, kind, occurredAt, changes }[]`, loaded in `loadToday` as an owner read of unread notices (`read_at IS NULL`) joined client-side to the bookmark rows it already loads. Rules:
  - Only for bookmarks whose current status is `interested` (same rule as deadline-soon). `applied` keeps the notice for the hub and page but gets no task.
  - One task per scholarship: if it has several unread notices, `gone` wins, else the newest `details_changed`.
  - A `source-gone` task replaces that scholarship's `deadline-soon` task (a gone page should not also say "closes in 5 days").
  - Copy: gone → "<title> is no longer listed by its provider" / "Its page has returned not found since <date>. Check with the provider, or remove it from your saved list." Changed with a deadline diff → "<title>: deadline moved to <new date>" / "It was <old date>. Confirmed from the provider's page on <date>." Changed without one → "<title>: details updated" / "<fields> changed on the provider's page. Review before you apply."
  - Ordering: these tasks go in `soon` with `dueISO` = the scholarship's current deadline when it has one, else first in `rest`.
  - The task has a "Got it" control (server action) setting `read_at = now()` for every unread notice of that scholarship. Opening the scholarship page does not mark it read (students skim; the explicit control is the record).
- **Application hub.** In the tracked-scholarship card (`fetchTrackedForSchool` / hub scholarship panel), one line per scholarship with an unread notice ("No longer listed (20 Oct)" / "Deadline moved to 15 Nov"). Read-only; reuses the same derivation.
- **Scholarship page.** Under the eligibility panel, a "Source check" line from `scholarship_source_status` for saved scholarships, using the table above. Not shown for unsaved ones. Builder must confirm the page still renders an inactive (`gone`) row for a student who saved it: it calls `notFound()` when the select returns nothing, and the `scholarships` SELECT policy may filter `is_active`.
- **Unified deadlines.** `mergeDeadlines` keeps gone rows (bookmarks still work), but the calendar row for a gone scholarship carries a `sourceStatus: "gone"` flag so the UI can strike it through rather than present it as a live deadline.

## Preferences

- **Slice 1: none stored.** In-app notices cannot be switched off, only marked read, and they are limited to scholarships the student chose to save. No preferences table, no settings UI.
- **Slice 3 (with email):** `user_notification_preferences (user_id PK FK auth.users ON DELETE CASCADE, source_changes_email text NOT NULL DEFAULT 'off' CHECK (IN ('off','immediate','weekly')), updated_at)`, owner SELECT/INSERT/UPDATE policies. A missing row means off. A "Notifications" section on `/settings`. Every email carries a one-click "stop these emails" link that sets `off`. `delete_own_account` and the settings export include the table.

## Stop rules

| Situation | Effect |
| --- | --- |
| Student unsaves the scholarship | Composite FK cascade deletes its notices; no future fan-out (no bookmark). |
| Status `awarded` or `not_selected` | No new notices (fan-out filter); existing ones hidden from Today, hub and email. |
| Status `applied` | Notices created and shown on hub/page; no Today task; email only for `gone` (slice 3). |
| Notice read | Never shown as new again; never emailed after `read_at` is set. |
| Scholarship deactivated (`gone`) | One `gone` event; deactivation is one-way, so no further events unless an owner re-activates it manually. |
| Scholarship deadline passed | No `source-changed` Today task when the current Sydney deadline date is before today; the hub/page line remains. |
| Account deleted | `user_id` cascades through `user_bookmarked_scholarships` → notices. `delete_own_account` needs no change; the builder confirms with the staging test. |

## Timezones and dates

- Catalogue deadlines are date-only facts in Australian eastern time (AEST/AEDT, `Australia/Sydney`) stored in a `timestamptz`. The canonical deadline date is `Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' })` of `deadline_at`, not `slice(0, 10)`. Add `sydneyDateOf(ts)` next to `zonedTodayISO` in `lib/today-data.ts` and use it in `mergeDeadlines` for `scholarships` rows. The builder first measures how production values are stored (count of `deadline_at` by UTC time of day) and records it in the PR: if they are all `00:00Z`, the UTC slice and the Sydney date agree and the change is a no-op guard; if any are `13:00Z`/`14:00Z` (Sydney midnight), today's feed is off by one for those rows and this fixes it.
- "Today" for a student is `zonedTodayISO(student tz)` from the `caat-tz` cookie, default Sydney, exactly as `loadToday` does. Pass that `todayISO` into `fetchUnifiedDeadlines` instead of its own `todayKey()` so Today and the feed agree.
- Day arithmetic reuses `daysBetween(todayISO, dateISO)` from `lib/today.ts`: both sides are `YYYY-MM-DD`, compared as calendar days. Do not compare `Date` objects.
- Event dates (`occurred_at`, `last_checked_at`) are instants; display them as a date in the student's zone ("20 Oct 2026"), never with a time.
- A `details_changed` deadline diff stores `from`/`to` as Sydney dates. Equal dates mean no deadline change.

## Failure handling

- **Refresh failures never become notices.** Only `gone` (two 404/410 strikes 24 h apart, at the same URL, after which the row actually deactivated) and reviewed re-extractions write events.
- **Write atomicity.** Deactivation + event + fan-out run in one statement/transaction; any failure rolls all three back and the runner's existing failed-write path stops the run. The next run retries because the row is still active.
- **Read failures.** If `scholarship_source_status` or the notices read fails, Today and the hub render without the line and without the tasks, and log; they never show "not yet checked" for a failed read (same "a failed read must not look like an empty account" rule as `loadToday`). The scholarship page shows nothing rather than a wrong label.
- **Mass-event guard.** Before inserting events, the runner counts how many `gone` events this run would write; above a threshold (default 25, or more than 2% of checked URLs) it records the checks but skips deactivation and events, marks the run `failed` with the reason, and needs a human `--allow-mass-gone` re-run. A provider outage that returns 404 site-wide must not deactivate and notify hundreds of rows.
- **Email delivery (slice 3).** Sender selects notices with `email_sent_at IS NULL AND read_at IS NULL AND email_attempts < 3` for students whose preference is not off, sends with the notice id as the provider idempotency key, sets `email_sent_at` on success, increments `email_attempts` and stores a short `email_last_error` on failure, backs off between attempts, and never sends a notice older than 14 days. Bounces/complaints set the student's preference to off. A failed send never affects the in-app notice.

## Gate for outbound email

Email stays off (no code path, not just a flag) until all of these hold and the owner signs off:

1. PROD-151 merged and deployed; `--apply` running on a schedule on the mini for at least 4 consecutive weeks.
2. Every `gone` event in that window reviewed by a person against the live page: zero false positives, and the mass-event guard has never fired falsely.
3. At least one real `details_changed` event produced through the reviewed path end to end.
4. In-app notices live for those weeks with no duplicate or wrong-scholarship reports.
5. Provider approved (cost, sender domain, DPA), and the sender's home decided (mini vs Vercel cron with a service key: owner question 3).

## Slice 1: one PR

Ships dark: with no `--apply` history it renders only "Not yet checked" labels on saved scholarships.

1. Migration (applied through the reviewed release before merging the code): `scholarship_source_check_rows`, `scholarship_source_events` (both kinds allowed by the check), `scholarship_source_notices` with trigger, RLS and column grant, `scholarship_mark_gone_with_event`, `scholarship_source_status`. Prerequisite check that `scholarship_source_checks` exists.
2. Runner: write link rows in `--apply`; switch to `scholarship_mark_gone_with_event`; mass-gone guard; extend `tests/unit/refresh-scholarship-sources.test.ts`; update the operations doc.
3. `lib/source-notices.ts` + unit tests (labels, one task per scholarship, gone beats changed, status filters, Sydney dates, `daysBetween` edge cases across the AEDT switches on 4 Oct 2026 and 4 Apr 2027).
4. Today: new task kinds in `lib/today.ts`, loader in `lib/today-data.ts`, rendering and "Got it" action in `components/today/TodayView.tsx`; extend `today.test.ts`, `today-data.test.ts`, `today-view.test.tsx`.
5. Scholarship page "Source check" line.
6. Staging test `tests/staging/scholarship-source-notices.mjs`, run in CI after `scholarship-source-checks.mjs`: student A cannot read B's notices or status; anon cannot execute the function; a student cannot insert notices or update any column but `read_at`; the function returns nothing for unsaved ids; fan-out skips bookmarks newer than the event and awarded/not_selected ones; inserting the same event twice yields one notice; unsaving cascades; a failing fan-out rolls back the deactivation.

The hub line and the `sourceStatus` flag on the calendar can move to a follow-up PR if the first one is too large. `details_changed` writing (slice 2) and preferences + email (slice 3) are separate PRs, each with its own migration.

## Left to the builder

- Exact migration timestamp, index names, and whether `scholarship_source_status` is SQL or PL/pgSQL.
- Copy polish within the rules above, and the visual treatment of the new task kinds (neutral, not alarm red).
- Where the "Got it" action lives (`app/(main)/today/actions.ts` or a shared notices action).
- The mass-gone threshold values, if the first `--apply` numbers suggest different ones.
- Whether to backfill link rows (only if `--apply` ran before this lands).
- Measuring the stored time-of-day of `scholarships.deadline_at` and reporting it in the PR.

## Owner questions

1. **RLS approval.** May the migration add: an owner SELECT policy and an owner UPDATE policy limited by column grant to `read_at` on `scholarship_source_notices`; the `SECURITY DEFINER` function `scholarship_source_status` executable by `authenticated`; and `scholarship_mark_gone_with_event` for the service role?
2. **Who sees source status.** Saved scholarships only (this design), or the "Last checked" label on every catalogue scholarship page (would need the function to accept any active id, exposing crawl state publicly)?
3. **Who reviews re-extractions and where email would run.** Is the human review for `details_changed` done in the scraper repo's re-import (then it must emit the diff) or by a CAAT admin script on the mini? And for slice 3, may a sender run on the mini (key stays there) or should it be a Vercel cron, which would put a service key in Vercel?

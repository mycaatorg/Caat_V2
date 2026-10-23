# Evidence library: reuse achievements, experience and documents across applications (PROD-78)

Design only. Nothing here exists yet. No migration in this document has been applied, and none may be applied without the owner's approval of the RLS below.

## Intent and why

A student applying to six universities currently re-enters the same things six times, or cannot reuse them at all:

- A document can be tagged to **one** school (`documents.school_id`). Using the same portfolio PDF for a second university means uploading it again, which also spends one of the 50 document slots.
- Activities are a bare `text[]` on `profiles` with no IDs, so nothing can point at "this activity".
- Experience lives inside resume JSON (`resume_sections.structured_data`), copied per resume. Awards are not stored anywhere structured; they appear only as free text in resumes (Education "Notes / achievements", custom sections).

PROD-78 adds a per-student **evidence library** of reusable items with stable IDs, and **links** from an application to those items. Each link can be **tailored** for that application without touching the library item or any other application. The library item is the single source; links never copy it unless the student tailors.

## Verified reconnaissance, 23 October 2026

Read at `origin/develop` 1d1520f (the local checkout was 15 commits behind and was not changed). Schema facts are from `caat-frontend/tests/staging/schema.snapshot.json` (production metadata, provenance 4 October 2026) and `caat-frontend/supabase/migrations/`. There is no `supabase/schema.sql` in the repo. PROD-148 hub code was read from `origin/codex/caat-course-application-bridge` (unmerged).

### Tables that already hold evidence

| Table | Ownership column | RLS | Policies | FKs and delete behaviour |
|---|---|---|---|---|
| `profiles` | `id` (= auth uid) | on | SELECT/INSERT/UPDATE own (`auth.uid() = id`), no DELETE | `id` → `auth.users` CASCADE. `activities text[]` holds activities with no IDs. `default_resume_id` → `resumes` SET NULL |
| `resumes` | `user_id` (→ `profiles.id`) | on | all four, own | `user_id` → `profiles` CASCADE |
| `resume_sections` | none of its own; via `resume_id` | on | all four, `EXISTS (resumes r WHERE r.id = resume_id AND r.user_id = auth.uid())` | `resume_id` → `resumes` CASCADE. Experience entries sit in `structured_data` jsonb with client-generated `id`s, one copy per resume |
| `documents` | `user_id` | on | SELECT/INSERT/UPDATE/DELETE own (`auth.uid() = user_id`); UPDATE has no WITH CHECK, so USING applies to the new row | `user_id` → `auth.users` **NO ACTION** (deleted explicitly in `delete_own_account`). `school_id` → `schools` SET NULL. No `updated_at` trigger; the app sets `updated_at` on status change and reupload, and `uploaded_at` only on upload and reupload |
| storage bucket `user-documents` | first path segment = uid | on (`storage.objects`) | select/insert/update/delete where `foldername(name)[1] = auth.uid()` | private, 10 MB limit; objects not removed by account deletion |
| `essay_drafts` | `user_id` | on | all four for `authenticated`, own | `user_id` → `auth.users` CASCADE; `school_id` → `schools` SET NULL; `prompt_id` has **no FK** (catalogue or custom prompt). One `is_current` per (user, prompt) by partial unique index. `updated_at` trigger |
| `essay_prompts` | catalogue | on | SELECT for `authenticated` | `scope` = `shared` or `per_school` |
| `custom_essay_prompts` | `user_id` | on | ALL own, no WITH CHECK (USING applies) | `user_id` → `auth.users` CASCADE |
| `standardised_test_scores` | `profile_id` | on | all four own | `profile_id` → `profiles` CASCADE |
| `user_recommenders` | `user_id` | on | ALL own both ways | CASCADE |
| `user_school_applications` | `user_id` | on | ALL own both ways | `user_id` → `auth.users` CASCADE; `school_id` → `schools` CASCADE; `UNIQUE (user_id, school_id)` |
| `user_scholarships` | `user_id` | on | ALL own both ways | CASCADE; `school_id` SET NULL |
| `user_course_bookmarks` (PROD-76) | `user_id` | on | SELECT/INSERT/DELETE own using `(select auth.uid())`, explicit grants | `course_id` → `course_offerings` RESTRICT |

There is no awards, achievements or extracurricular table.

### How things attach to a school today (PROD-147 / PROD-148)

- "Shared" means `school_id IS NULL`. A draft or document tagged with a `school_id` belongs to that school only. The hub's "Attach a document for X" opens `/documents?school=<id>` and uploads with that tag.
- `lib/preparation-checklist.ts` is the one rule for the hub, the applications list and the dashboard: 3 steps (deadline set; an essay for this school or shared; a document tagged here or an untagged key-category document). Application status is not a step.
- `fetchApplicationHub` (client-side, browser Supabase client) reads the application with `.eq("user_id", user.id)`, then reads profile, prompts, drafts and documents in parallel, each owner-filtered. A failed prompts read throws; drafts and documents read errors are currently not checked (they fall through as empty). Not in scope here, noted for the builder.
- PROD-148 (branch above) sets the card pattern this design follows: a card-specific owner-scoped read inside the hub's `Promise.all`, returned as `{ items, unavailable }`, and a separate exported fetcher so the card's own **Retry** re-reads only that card. Unavailable never renders as empty. The saved-courses card is not a preparation step.
- `delete_own_account()` deletes applications before documents, so anything that cascades from applications is gone before the documents delete runs.

## Goals

1. Save activities, awards and experience once, as library items with stable IDs, and reuse them on any application.
2. Reuse an existing document on any number of applications without re-uploading it.
3. Show where each library item and document is used (which applications, and whether tailored there).
4. Tailor an item for one application; the tailoring lives on that application's link only.
5. When the source changes after an application tailored it, say so on that application and let the student choose; never merge or overwrite.

## Non-goals

- Essays. Drafts already have a per-school model (`school_id`, shared vs per-school prompts). They are not moved into the library.
- Test scores and recommenders. They are already single rows per student and are not per-application content.
- Scholarship applications as link targets (see owner question 3).
- Auto-filling or submitting anything to a university.
- Changing the 3-step preparation checklist (see owner question 1).

## Anti-goals (things this must never do)

- Silently change one application's content because another application, or the library, was edited while a tailored version exists.
- Delete a library item or document because a link was removed.
- Infer links (by name, category or school). Every link comes from a click.
- Rewrite `profiles.activities` or resume JSON when importing into the library.

## Constraints

- **Owner-only RLS** on every new table, using `(select auth.uid()) = user_id`, explicit `REVOKE ALL ... FROM anon, authenticated` then narrow grants, matching `20261023070000_course_offerings.sql`. RLS changes and new policies need the owner's approval before they are applied.
- **Stable IDs.** Library items are `uuid` rows edited in place, never deleted and re-created on edit. Links reference IDs, never text.
- **Unlink never deletes the source.** Unlink deletes the link row only. No trigger or cascade runs from a link to a source.
- **No silent overwrite.** Tailoring writes only the link row. Source edits never write link rows.
- **Additive migrations, applied before dependent code.** New tables, plus one additive unique constraint on each of two existing tables (below). No column is dropped or retyped. The migration is applied to production (after approval) before the PR that reads it is merged and deployed.
- **Ownership is verified before schema work**: the builder first re-reads the live production policies and constraints for `documents` and `user_school_applications` (the snapshot is from 4 October and predates PROD-76/147/148) and confirms the table owner and grants match this document.

## Data model

### Decision: one items table, one link table with typed FK columns

Considered:

| Option | For | Against |
|---|---|---|
| A. One link table per kind (`application_document_links`, `application_item_links`) | Plain FKs | Two sets of RLS to approve and test, two "where used" queries, the hub and badges union them anyway |
| B. One polymorphic link table: `kind` + `item_id uuid` with no FK | One query | No referential integrity, no DB-enforced ownership; a link can point at someone else's row or a deleted one |
| **C. One link table with `kind` and one nullable FK column per source table, exactly one set** | One RLS set, one "where used" query, real FKs, DB-enforced same-owner | A new source table later needs one more nullable column and a CHECK update (additive) |

**Chosen: C.** Documents already exist as rows with IDs, so they are linked directly. Activities, awards and experience share a shape (title, organisation, role, dates, description), so they live in one new `evidence_items` table distinguished by `kind`, rather than three near-identical tables.

### `evidence_items` (new)

```
id                  uuid primary key default gen_random_uuid()
user_id             uuid not null references auth.users(id) on delete cascade
kind                text not null check (kind in ('activity','award','experience'))
title               text not null check (length(btrim(title)) between 1 and 200)
organisation        text            -- club, employer, awarding body
role                text
start_date          date
end_date            date
is_current          boolean not null default false
description         text            -- sanitised rich text, same editor as resume entries
origin              jsonb           -- where it was imported from, for de-duplication only
origin_key          text            -- e.g. 'resume:<section_id>:<entry_id>' or 'activity:<lowercased text>'
content_updated_at  timestamptz not null default now()
created_at          timestamptz not null default now()
updated_at          timestamptz not null default now()
unique (id, user_id)
unique (user_id, origin_key)   -- an import can't be made twice; null origin_key is free
```

- A trigger sets `updated_at` on every update and `content_updated_at` only when `title, organisation, role, start_date, end_date, is_current, description` change. `content_updated_at` is what "source updated since" compares against.
- Imports copy; they never write back to `profiles.activities` or `resume_sections`.

### `application_evidence_links` (new)

```
id                  uuid primary key default gen_random_uuid()
user_id             uuid not null references auth.users(id) on delete cascade
application_id      uuid not null
kind                text not null check (kind in ('document','activity','award','experience'))
document_id         uuid
evidence_item_id    uuid
tailored_title      text check (tailored_title is null or length(tailored_title) <= 200)
tailored_body       text check (tailored_body is null or length(tailored_body) <= 10000)
tailored_at         timestamptz          -- null = follows the library
source_seen_at      timestamptz not null default now()
sort_order          integer not null default 0
created_at          timestamptz not null default now()
updated_at          timestamptz not null default now()

foreign key (application_id, user_id) references user_school_applications(id, user_id) on delete cascade
foreign key (document_id, user_id)    references documents(id, user_id)                (no action)
foreign key (evidence_item_id, user_id) references evidence_items(id, user_id)         (no action)
check (num_nonnulls(document_id, evidence_item_id) = 1)
check ((kind = 'document') = (document_id is not null))
unique (application_id, document_id)        -- partial: where document_id is not null
unique (application_id, evidence_item_id)   -- partial: where evidence_item_id is not null
index (user_id, document_id), index (user_id, evidence_item_id), index (application_id)
```

- **Same-owner is enforced by composite FKs**, not only by RLS: a link's `user_id` must equal the application's and the source's `user_id`. This needs `UNIQUE (id, user_id)` added to `user_school_applications` and `documents`. That is additive (id is already unique, so it cannot fail on existing data) but it touches two existing tables, so it is part of the owner approval. Fallback if the owner refuses: `WITH CHECK` subqueries on INSERT (`EXISTS` own application and own source), which RLS evaluates for clients but not for the service role.
- **Deleting an application** cascades its links. Sources are untouched.
- **Deleting a source that is still linked** is refused by the FK (NO ACTION, checked at end of statement, so `delete_own_account` and account-level cascades still succeed because links go with applications and with `user_id` first). The UI never lets the student hit that error: it shows "Used in N applications" and offers "Remove from N applications and delete", which deletes the links, then the source, in that order. Nothing is removed without that confirmation.
- `kind` on the link duplicates `evidence_items.kind` for documents vs items only; for items, the item's own `kind` is authoritative and the link's kind is set from it on insert (the builder can drop the item sub-kinds from the link CHECK if simpler).

### RLS and grants (needs owner approval)

```
alter table ... enable row level security;
revoke all on ... from anon, authenticated;

-- evidence_items
grant select, insert, update, delete on evidence_items to authenticated;
policies: select/insert/update/delete to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)

-- application_evidence_links
grant select, insert, delete on application_evidence_links to authenticated;
grant update (tailored_title, tailored_body, tailored_at, source_seen_at, sort_order, updated_at)
  on application_evidence_links to authenticated;   -- a link can't be re-pointed
policies: same four, owner-only both ways
grant all on both to service_role;
```

Column-level UPDATE means a link's application or source can never be changed after creation; "move" is unlink plus link. `delete_own_account()` gains explicit deletes for both tables (links first), keeping its exhaustive style, although the CASCADEs already cover them.

## Version and update semantics

| Link state | What the application shows | When the source changes |
|---|---|---|
| **Follows library** (`tailored_at` null) | The live source | Shows the new source. This is the point of the library. Editors of the source say so before save: "Used in 3 applications. Changes show in the 2 that aren't tailored." |
| **Tailored** (`tailored_at` set) | `tailored_title` / `tailored_body` (falling back to source fields left null) | Nothing changes on the application. If `source_changed_at > source_seen_at` the link shows **"Library version updated since you tailored this"** with two actions: **Keep mine** (sets `source_seen_at = now()`) and **Use library version** (clears the tailored fields and `tailored_at`, after a confirm). No merge, no auto-apply |

- `source_changed_at` is `evidence_items.content_updated_at` for items and `documents.uploaded_at` for documents. `documents.updated_at` is **not** used because a review status change also bumps it, which would cry wolf.
- Tailoring a **document** means a per-application title and note (for example "Submit as supplementary portfolio"), never an edited file. A different file for one university is a separate upload, linked instead.
- Reuploading a document (`reuploadDocument`, same id, new file) is a source change: tailored links flag it; untailored links simply show the new file.
- Saving a tailoring sets `tailored_at = now()` and `source_seen_at = now()` in the same update. It is written with `.eq("id", linkId).eq("user_id", uid)` and an `.eq("updated_at", seenUpdatedAt)` guard; zero rows back means "Changed in another tab. Reload", not a silent last-write-wins.
- There is no stored history of sources or tailorings in the first version. A `base_snapshot jsonb` on the link (to show what changed) is a possible later addition.

## "Where used" query

One owner-scoped read covers every badge:

```ts
supabase
  .from("application_evidence_links")
  .select("id, document_id, evidence_item_id, tailored_at, source_seen_at, user_school_applications!inner(id, schools(name))")
  .eq("user_id", user.id)
```

Grouped client-side by `document_id` / `evidence_item_id` into `{ count, tailoredCount, applications: [{ id, schoolName, tailored }] }`. For one source, add `.eq("document_id", id)`. The documents page also keeps showing the existing `school_id` tag, which is a separate, older mechanism (one school per file) and is not counted as a link.

## UI touchpoints

1. **Hub, Documents card** (`applications/[id]/client.tsx`). "For this school" lists `school_id`-tagged documents as today, plus linked documents marked "From your library", each with Tailor and Remove (unlink). The dashed action becomes two: "Attach a new document" (today's upload flow) and **"Use a document you already have"** (picker of the student's documents, excluding ones already linked or tagged here). A tailored link with a newer source shows the "updated since" line. Remove says "Removes it from this application only. The file stays in Documents."
2. **Hub, new "Activities, awards and experience" card**, below Documents. Lists linked items with tailored text where set; "Add from your library" picker; empty state links to the profile library. Read failure shows "Couldn't load your library items. Retry", using the card's own fetcher, never the empty copy.
3. **Documents page** (`/documents`). Each row gets a "Used in N applications" badge (popover lists schools, tailored ones marked). Delete on a used document shows the confirm described above.
4. **Profile page** (`/profile`). A new "Library" card next to `ExtracurricularsCard`: items grouped by kind, each with "Used in N", add/edit/delete, and two explicit imports: "Add from my activities" (one item per `profiles.activities` string) and "Add from a resume" (experience entries, picking which). Imports de-duplicate by `origin_key`.

None of these change the 3-step preparation score.

## Hub data pattern

- `fetchApplicationHub` adds `readEvidenceLinks(user.id, applicationId)` to its `Promise.all`, mapped to `{ links, unavailable }` exactly like PROD-148's `readSavedCourses`. It selects links with the joined source columns needed to render (`documents(id, file_name, status, uploaded_at)`, `evidence_items(id, kind, title, organisation, role, start_date, end_date, description, content_updated_at)`), `.eq("user_id", user.id).eq("application_id", applicationId)`.
- Exported `fetchEvidenceLinksForApplication(applicationId)` is the cards' Retry.
- Writes live in a new `lib/evidence-links.ts`: `linkSource`, `unlink`, `saveTailoring`, `resetToLibrary`, `acknowledgeSourceChange`. Each filters by `user_id`, selects `id` back and treats zero rows as a failure (as `assertApplicationWritten` does). None of them touches `documents` or `evidence_items`; a unit test asserts that by checking which tables the mock client was called with.
- Duplicate link (unique violation 23505 from a second tab) is read before sanitising and treated as "already added", returning the existing link.

## Minimal first slice (one PR)

**Documents reused across applications.** Smallest change that proves the model end to end, because documents already have stable IDs.

1. Migration: `application_evidence_links` with the document column only active in practice, plus `evidence_items` and its trigger (created now so the owner approves RLS once), the two `UNIQUE (id, user_id)` additions, grants, policies, and the `delete_own_account` update. Applied to production after approval, before merge.
2. `lib/evidence-links.ts` (link, unlink, tailor title/note, keep mine, use library version) for documents.
3. Hub Documents card: "Use a document you already have", linked rows, Remove, Tailor, updated-since line, unavailable + Retry.
4. Documents page: "Used in N applications" badge and the delete confirm.
5. Tests: unit (grouping, updated-since rule, write paths touch only the link table, 23505 handling), RLS script in `tests/staging/` like `course-rls.mjs` (another user cannot read, insert against, update or delete links; a link to another user's document or application is rejected by the FK), and one e2e journey: link one document to two applications, tailor on one, reupload the file, see the flag on the tailored one only, unlink, file still in Documents.

Slice 2: profile Library card, imports, hub items card. Slice 3 (optional): `base_snapshot` diff view.

## Left to the builder

- Exact copy, picker component, sort order UI, icons.
- Whether the link `kind` keeps item sub-kinds or only `document` / `item`.
- Per-student caps (suggest 200 items, matching the spirit of the 50-document cap) and their messages.
- Sanitisation of `description` / `tailored_body` (reuse the resume rich-text path).
- Fixing the hub's unchecked drafts/documents read errors if touched anyway (separate ticket preferred).
- Test fixtures for the synthetic school 900001 in disposable stacks.

## Open questions for the owner

1. **Checklist.** Should a document linked to an application count as "A document attached here" in the 3-step preparation rule (this changes the hub, the applications list and the dashboard together)? Default in this design: no, links do not change the score.
2. **Activities source of truth.** Should the library replace `profiles.activities` as where activities live (with a one-off migration), or sit alongside it with explicit import as designed here?
3. **Scope of "application".** Are university applications (`user_school_applications`) the only link target for PROD-78, or should scholarship applications (`user_bookmarked_scholarships` / `user_scholarships`) also take links now? Default: universities only; the link table can take a second target column later.

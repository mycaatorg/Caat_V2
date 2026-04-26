# CAAT V2 — Security Audit Report

**Audit Date:** 2026-04-26
**Audited Branch:** `develop`
**Scope:** Full codebase (Next.js 15 App Router + Supabase) — frontend, server actions, SQL migrations, RLS policies, middleware, CI/CD
**Previous Audit:** 2026-04-17

---

## Executive Summary

Substantial progress has been made since the prior audit. Many of the original 30 findings have been remediated:

- ✅ **Stored XSS in resume preview (A1, A2)** — `escapeHtml()` applied in all guided editors; `RichTextEditor` uses Tiptap which produces only sanitised whitelist HTML
- ✅ **`javascript:` URLs (A3)** — `safeHref()` helper enforces http/https-only on user-controlled hrefs
- ✅ **Resume IDOR (B1, B2, B3)** — ownership checks added in `deleteSection`, `deleteResume`, `saveResumeState`
- ✅ **Document IDOR (B4)** — `getDocumentSignedUrl` rejects paths not prefixed with the user's id
- ✅ **Storage path trust (B5)** — `deleteDocument` and `reuploadDocument` re-fetch path from DB
- ✅ **PostgREST filter injection (C1)** — special chars stripped in school search
- ✅ **File upload validation (E1)** — magic-byte signature checking added to documents and avatars
- ✅ **Document count limit (E3)** — 50 per user enforced
- ✅ **Mass assignment (D4)** — explicit allowlist in `updateProfile`
- ✅ **CSP / HSTS / source maps (H1, H2, H4)** — all three added to `next.config.ts`
- ✅ **Server-side mutation layer (D2/D3 partial)** — Communities feature was rebuilt around Server Actions with `createSupabaseServer`
- ✅ **Hardcoded test credentials (J1)** — moved to `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` env vars (with safe fallbacks)

However, the new Communities feature (groups, posts, comments, reports, blocks, follows, notifications, join requests — 1,086 lines of server actions, 7 new tables) introduces a fresh set of vulnerabilities that did not exist in the previous audit. The most serious are **privacy bypasses for private community groups** and **anonymity leakage**.

This audit identifies **22 findings**: **5 Critical/High**, **9 Medium**, **8 Low**. Of these, **14 are new** and **8 are pre-existing items not yet remediated**.

---

## Table of Contents

1. [Findings](#findings)
   - [A. Authorization & Access Control](#a-authorization--access-control)
   - [B. Anonymity & Privacy Leakage](#b-anonymity--privacy-leakage)
   - [C. Abuse / Spam / Notification Flooding](#c-abuse--spam--notification-flooding)
   - [D. Authentication & Session Management](#d-authentication--session-management)
   - [E. File Upload & Storage Security](#e-file-upload--storage-security)
   - [F. Input Validation & Data Limits](#f-input-validation--data-limits)
   - [G. Rate Limiting & Anti-Automation](#g-rate-limiting--anti-automation)
   - [H. Information Leakage](#h-information-leakage)
   - [I. Query / Filter Injection](#i-query--filter-injection)
   - [J. Bugs With Security Implications](#j-bugs-with-security-implications)
2. [Summary Matrix](#summary-matrix)
3. [Remediation Plan](#remediation-plan)

---

## Findings

---

### A. Authorization & Access Control

#### A1 — Private community group posts readable by non-members (CRITICAL)

| Field | Detail |
|-------|--------|
| **Severity** | **CRITICAL** |
| **Files** | `caat-frontend/app/(main)/communities/actions.ts:1015-1037` (`fetchGroupPostsAction`) |
| **Description** | The action fetches all posts where `group_id = ?` and `is_hidden = false` — but does **not** verify that the caller is a member of the group, regardless of privacy. The page-level UI in `c/[slug]/page.tsx:33` short-circuits to a "request to join" screen for private non-members, but the server action itself is exposed as a directly-invokable POST endpoint. |
| **Evidence** | `query = supabase.from("community_posts").select(...).eq("group_id", groupId).eq("is_hidden", false)` — no membership check before the query. RLS on `community_posts` is `USING (is_hidden = FALSE)`, which does not filter by group membership. |
| **Impact** | Any authenticated user can call `fetchGroupPostsAction(privateGroupId, cursor)` directly (e.g. via DevTools `fetch()` to the action endpoint) and read every post in any private group, including post authorship, content, attached resumes, scores, etc. The privacy guarantee for private communities is purely cosmetic. |
| **Reproducer** | Open DevTools on `/communities`, find the action's POST endpoint, call it with the UUID of a private group you do not belong to. |

#### A2 — Anyone can post to any community group (HIGH)

| Field | Detail |
|-------|--------|
| **Severity** | **HIGH** |
| **Files** | `caat-frontend/app/(main)/communities/actions.ts:158-216` (`createPostAction`) |
| **Description** | The `group_id` parameter is accepted from the client and inserted into `community_posts` without any check that the user is a member of the group. RLS on `community_posts` only enforces `auth.uid() = user_id`. |
| **Impact** | A non-member can post to any group — including private ones — by passing the group's UUID. Combined with A1, an attacker can fully participate in a private community without being admitted. |

#### A3 — Anyone can comment on any post in any private group (MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `caat-frontend/app/(main)/communities/actions.ts:596-631` (`addCommentAction`); RLS in `create_communities_tables.sql:172-178` |
| **Description** | The `comments_select` and `comments_insert` policies are `USING (TRUE)` and `WITH CHECK (auth.uid() = user_id)` — making all comments globally readable and writable by any authenticated user as long as they know the `post_id`. Combined with A1 (post IDs in private groups are leakable), comments on private group posts are likewise leakable and writable. |
| **Impact** | Comment-level privacy mirrors the broken post-level privacy. |

#### A4 — Block list not enforced on user profile feed or group feed (MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `actions.ts:326-345` (`fetchPostsByUserAction`), `actions.ts:1015-1037` (`fetchGroupPostsAction`), `actions.ts:349-371` (`searchPostsAction`) |
| **Description** | Only `fetchPostsAction` (the home feed) filters out blocked users. `fetchPostsByUserAction`, `fetchGroupPostsAction`, and `searchPostsAction` do **not** apply the block list. |
| **Impact** | A blocked user remains fully visible — and can still be followed, replied to, and reported — on the victim's profile page, in any shared group, and via search. The block feature gives a false sense of safety. |

#### A5 — No approval/rejection action for private group join requests (MEDIUM — broken feature)

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `caat-frontend/app/(main)/communities/actions.ts` (no exports for approve/reject); `supabase/migrations/communities_v5_join_requests.sql:43-49` defines `owner_manage_requests` policy but no client/action consumes it |
| **Description** | The migration creates the `community_group_requests` table and exposes an "owner manages requests" RLS policy, but no server action implements approval or rejection. Owners cannot admit users to private groups; users cannot be promoted to members from `pending` to `approved`. |
| **Impact** | The private-group feature is half-implemented. Functionally, no one can ever join a private group through the intended workflow. (Meanwhile A2 lets attackers bypass the workflow entirely.) |

---

### B. Anonymity & Privacy Leakage

#### B1 — Anonymous posts leak `user_id` in API response (HIGH)

| Field | Detail |
|-------|--------|
| **Severity** | **HIGH** |
| **Files** | `caat-frontend/app/(main)/communities/actions.ts:79-110` (`enrichPosts` mapping) |
| **Description** | When `is_anonymous = true`, the code correctly sets `author = null` (so the UI hides the name). But it still returns `user_id: row.user_id` in the very same object. Any caller of the action receives the de-anonymising id alongside the post. |
| **Evidence** | Lines 86-89: `const author: PostAuthor | null = isAnon ? null : ...` (good) followed by `user_id: row.user_id as string` (leak). |
| **Impact** | Any user can map every "anonymous" post back to its author by inspecting the network response. The anonymity feature provides no actual anonymity. This is particularly damaging given the topic tags include sensitive content (TEST_SCORES, APPLICATION_RESULTS — accepted/rejected). |

#### B2 — Profile lookup-by-id is unauthenticated and unrestricted (LOW)

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | Multiple `supabase.from("profiles").select(...).eq("id", X)` calls; profile RLS not visible in code |
| **Description** | The `profiles` table is queried liberally with `.select("id, first_name, last_name, avatar_url")` without RLS verification at the application layer. If the `profiles` table's RLS policy is `SELECT USING (true)` (consistent with `community_profile_settings`), then anyone can enumerate all users. The code references columns including `birth_date`, `phone`, `linkedin`, `github`, `nationality`, `current_location`, `school_name`, `target_majors` — these must not be in the SELECT-USING-true policy. |
| **Impact** | Without seeing the actual `profiles` RLS, this is an unverifiable risk. Needs manual confirmation in the Supabase dashboard. |

---

### C. Abuse / Spam / Notification Flooding

#### C1 — Notification flood via like toggling (MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `actions.ts:486-505` (`toggleLikeAction`) |
| **Description** | Each transition from "unliked → liked" inserts a fresh row into `notifications` with no deduplication or rate cap. An attacker can scripted-toggle a like on a target post in a tight loop, generating thousands of notification rows for the post owner. |
| **Impact** | Storage bloat, push-notification flooding (if mobile is added later), and a denial-of-service against the victim's notification UI. |

#### C2 — Notification flood via follow toggling (MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `actions.ts:412-420` (`followUserAction`) |
| **Description** | The action inserts a `community_follows` row (idempotent due to PK) **and** a notification row (NOT idempotent). Calling `followUserAction(target)` repeatedly produces duplicate "started following you" notifications even though the follow itself only succeeds once. There is also no check that the follow insert succeeded before sending the notification. |
| **Impact** | Same notification flood pattern as C1. Also noisy/buggy UX. |

#### C3 — Comment spam: no per-post rate limit, no spam detection beyond a small profanity word list (MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `actions.ts:596-631` (`addCommentAction`); `caat-frontend/lib/profanity-filter.ts` |
| **Description** | The profanity filter is a small static list (~20 words), trivially bypassable with leetspeak (`f@ck`, `fuk`, unicode look-alikes), spaces, or any non-English language. There is no per-user-per-post comment rate limit. |
| **Impact** | A single user can dump thousands of comments on a post, including any non-blocked language including spam, slurs in foreign languages, or repeated harassing content. |

#### C4 — Auto-hide threshold of 3 reports is exploitable (LOW–MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** (mitigated by `UNIQUE(post_id, reporter_id)`, but escalates if signups are unrestricted) |
| **Files** | `create_communities_tables.sql:121-139` (`check_post_reports` trigger) |
| **Description** | A post is auto-hidden after 3 unique reporters. Combined with no signup rate limit (G1), an attacker with three sock-puppet accounts can hide any post on the platform. There is no minimum account age, no minimum reporter trust score, no admin review queue. |
| **Impact** | Any post can be censored by a small Sybil cluster. Note: hidden posts can still be deleted by the original author, but they cannot SELECT them (the policy is `USING (is_hidden = FALSE)`), so they don't even know which of their own posts have been hidden. |

#### C5 — Self-reporting is allowed (LOW)

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | `actions.ts:677-683` (`reportPostAction`) |
| **Description** | No check that `reporter_id != post.user_id`. A user can report their own post, contributing toward the 3-report auto-hide threshold. |
| **Impact** | Marginal contribution to C4. Trivial to fix. |

---

### D. Authentication & Session Management

#### D1 — `getSession()` still used in reset-password page (LOW)

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | `caat-frontend/app/reset-password/page.tsx:27` |
| **Description** | Per Supabase's own security advisory, `getSession()` reads JWT from local storage without server validation. The original D1 was for bookmark buttons (now fixed); this single remaining usage is in the reset-password gate. The risk is small because the consequence is only "show or hide the form" — the actual `updateUser({ password })` call is server-validated by Supabase. |
| **Impact** | Minor UX-level bypass at most. Cosmetic. |

#### D2 — All non-Communities mutations remain client-side (MEDIUM, architectural)

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `app/(main)/profile/api.ts`, `app/(main)/applications/api.ts`, `app/(main)/documents/api.ts`, `components/dashboard/api.ts`, `components/resume-builder/api.ts`, `components/essays/api.ts`, `components/profile/AvatarUpload.tsx`, `app/(main)/scholarships/*` |
| **Description** | Communities was migrated to Server Actions, but every other feature (profile, applications, documents, dashboard, resume builder, essays, scholarships) still uses direct browser → Supabase calls. This means: no place to enforce per-action rate limits, no place to validate input lengths server-side, no place to check record-creation caps. The original D2 is partially open. |
| **Impact** | Defence-in-depth for the rest of the app remains absent. Compromise of the anon key (e.g. via one of the client-side XSS sinks if a new one is introduced) lets the attacker do everything via the JS SDK. |

#### D3 — No CAPTCHA on signup, login, or password reset (HIGH)

| Field | Detail |
|-------|--------|
| **Severity** | **HIGH** |
| **Files** | `caat-frontend/components/login-form.tsx`, `caat-frontend/components/signup-form.tsx`, `caat-frontend/app/forgot-password/page.tsx` |
| **Description** | None of the three auth-related forms include any anti-bot challenge. Combined with G1 (no rate limiting beyond Supabase defaults), an attacker can: (a) brute-force credentials, (b) flood password-reset emails to harvest valid email addresses, (c) script-create new accounts at scale (which then enables C3, C4, A1/A2 abuse). |
| **Impact** | Enables every other abuse pattern in this audit. |

---

### E. File Upload & Storage Security

#### E2 — File size limit only on client (MEDIUM, unchanged from prior audit)

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `app/(main)/documents/api.ts` (no size check), `components/profile/AvatarUpload.tsx:60` (`MAX_FILE_SIZE = 5MB` only client-side) |
| **Description** | Magic-byte validation now confirms file *type* server-side, but no equivalent server-side check on file *size*. An attacker bypassing the client can upload up to Supabase's bucket-level limit. |
| **Impact** | Storage cost / quota abuse. |

#### E5 — Storage bucket policies still not visible in code (MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | (Configuration, not code) |
| **Description** | RLS policies for `user-documents` and `profile-avatars` buckets exist (presumably) only in the Supabase dashboard and cannot be audited here. Confirm: (a) `user-documents` is private and scoped to `auth.uid()`-prefixed paths; (b) `profile-avatars` upload is restricted to image MIME types; (c) per-bucket file size limit is set. |
| **Impact** | Not directly exploitable but unverifiable. |

#### E6 — Avatar and document file paths are predictable (LOW)

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | `app/(main)/documents/api.ts:89` (`{user.id}/{category}/{Date.now()}_{name}`); `components/profile/AvatarUpload.tsx` (`{userId}/avatar.{ext}`) |
| **Description** | Storage paths are deterministic given user id + filename. For documents this is mitigated by signed URLs and the `B4` ownership check. For avatars, the bucket is *public* — anyone who can guess a user's id and extension gets their avatar. Not necessarily sensitive. |
| **Impact** | Marginal fingerprinting / scraping vector. |

---

### F. Input Validation & Data Limits

#### F1 — Input length validation missing on most fields (MEDIUM, partially unchanged)

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | All form components except community posts/comments and group names |
| **Description** | The community feature now enforces `content <= 2000` for posts (`actions.ts:172`), `<= 1000` for comments (`actions.ts:607`), and `name 3-50` for groups (`actions.ts:856-857`). DB-level CHECKs back these up (`create_communities_tables.sql:11,28`). However: |
| | • Group **description** has no length cap (action accepts any size, no DB CHECK) |
| | • Post field-level: `result_card.program`, `result_card.university_name`, `score_card.score`, `poll_options[].text` have no caps |
| | • Profile fields: name, phone, LinkedIn, GitHub, school name, etc. — no caps anywhere |
| | • Resume-builder structured-data fields: `bullets[]`, `company`, `title`, `institution` — no caps |
| | • Essay drafts: no cap on `content` (already RLS-scoped, but a single user can stuff megabytes per draft × N drafts) |
| | • Application notes, todo content, scholarship custom fields — no caps |
| **Impact** | Database bloat, render-perf regressions, and storage cost abuse. Any single user can bloat their row beyond reasonable limits. |

#### F2 — Zod still installed but not used outside of Communities action validation (MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `caat-frontend/package.json` includes `"zod": "^4.2.1"`; no imports anywhere |
| **Description** | The Communities server actions validate by hand (length + allow-list checks). Zod schemas would be more robust, prevent regressions, and standardise validation across all server actions. |

#### F3 — No per-user record creation caps for most resources (MEDIUM, mostly unchanged)

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | All resource creation endpoints |
| **Description** | Documents have a 50-cap (good). No caps elsewhere: posts, comments, groups, follows, blocks, bookmarks, applications, scholarships, recommenders, todos, dashboard widgets, resumes, resume sections, essay drafts, custom essay prompts. |
| **Impact** | A single account can create unlimited rows of any type. |

---

### G. Rate Limiting & Anti-Automation

#### G1 — Zero application-level rate limiting (HIGH, unchanged)

| Field | Detail |
|-------|--------|
| **Severity** | **HIGH** |
| **Files** | (Absent application-wide) |
| **Description** | No rate limiter (Upstash, `next-rate-limit`, Vercel KV, etc.) is used anywhere. Even though Communities went through Server Actions — the natural place to gate by IP/user — none of those actions wrap a rate-limit check. The auth flows still depend entirely on Supabase GoTrue's defaults (which are configurable per project but not visible from the code). |
| **Impact** | Brute force on login, signup spam, comment/post/follow spam, notification floods (C1, C2), auto-hide abuse (C4) all become trivial at scale. |

---

### H. Information Leakage

#### H1 — Raw Supabase error messages still bubble up to users (MEDIUM, unchanged)

| Field | Detail |
|-------|--------|
| **Severity** | **MEDIUM** |
| **Files** | `caat-frontend/app/(main)/communities/actions.ts:439` (`return { error: error?.message ?? null }` in `updatePrivacySettingsAction`); same pattern in many other actions; `caat-frontend/app/login/page.tsx` and signup form catch and display `err.message`. |
| **Description** | Postgres / Supabase error messages can include constraint names, column names, schema details, and PostgREST internals. These are returned verbatim to clients. |
| **Impact** | Schema fingerprinting; assists an attacker mapping the database. |

#### H2 — `console.error` still leaks errors in production (LOW, unchanged)

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | Multiple (`ResumeBuilderShell.tsx:143,237`, `error.tsx`, `AvatarUpload.tsx`, etc.) |
| **Description** | Some sites guard with `process.env.NODE_ENV !== "production"` (good), others don't. |

#### H3 — Overly broad `.select("*")` queries (LOW, unchanged)

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | Many — communities actions especially (`actions.ts:134, 552, 613, 868, 928, 1053`); essays, profile, scholarships |
| **Description** | If new sensitive columns are added later, they will leak by default. Concrete examples that would matter today: `community_posts.user_id` (the B1 anonymity leak is a direct consequence), `community_groups.creator_id`, `community_comments.user_id`. |

---

### I. Query / Filter Injection

#### I1 — LIKE wildcard escaping missing in 3 community search functions (LOW)

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | `actions.ts:156` (`searchSchoolsAction`), `actions.ts:364` (`searchPostsAction`), `actions.ts:889` (`fetchGroupsAction`) |
| **Description** | All three use `q.ilike("…", \`%${query.trim()}%\`)` without escaping `%` or `_`. The fix already exists in `app/(main)/applications/api.ts:85` (`safeQuery = query.replace(/[\\%_]/g, "\\$&")`) but was not applied to these. |
| **Impact** | A `%` in user input matches everything; a query of just `_` matches every single-character row. Useful for enumeration but not a true injection. |

---

### J. Bugs With Security Implications

#### J1 — `requestJoinGroupAction` writes to a non-existent column (`message`) (LOW — broken feature)

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** (functional bug, security implication: silent failure) |
| **Files** | `caat-frontend/app/(main)/communities/actions.ts:983-989`; migrations show `notifications` table never adds a `message` column |
| **Description** | The code does `supabase.from("notifications").insert({ … message: \`${requesterName} requested to join ${groupRow.name}\` })` — but no migration creates this column. Either the insert silently drops the field (PostgREST default) or fails. |
| **Impact** | The owner-notification side of the join-request flow does not work. Combined with A5 (no approval action), the entire private-group flow is non-functional through legitimate means — but A1/A2 means the privacy was never enforced anyway. |

#### J2 — Notifications schema lacks a `message` column for join requests (LOW)

Same root cause as J1; this is the schema-side observation. The `notifications_type_check` constraint was extended to allow `join_request`, but the table has no field to store the request context. Either add a `message TEXT` column or remove the field from the insert.

#### J3 — Hidden posts cannot be seen or managed by their author (LOW)

| Field | Detail |
|-------|--------|
| **Severity** | **LOW** |
| **Files** | `create_communities_tables.sql:154-156` (`posts_select USING (is_hidden = FALSE)`) |
| **Description** | When a post is auto-hidden by C4, the original author cannot SELECT it, so they don't know which post was hidden. They can still DELETE it (the DELETE policy is `USING (auth.uid() = user_id)` — no `is_hidden` check) — but only if they happen to know the id. |
| **Impact** | UX-level transparency issue; users have no recourse. Combined with C4, this enables silent content removal. |

---

## Summary Matrix

| ID | Category | Severity | Status | Finding |
|----|----------|----------|--------|---------|
| A1 | Authz | **CRITICAL** | NEW | Private group posts readable via `fetchGroupPostsAction` regardless of membership |
| A2 | Authz | **HIGH** | NEW | `createPostAction` accepts `group_id` without membership check |
| A3 | Authz | MEDIUM | NEW | All comments globally readable/writable; private group comments leak |
| A4 | Authz | MEDIUM | NEW | Block list not enforced on profile, group, or search feeds |
| A5 | Authz | MEDIUM | NEW | No approve/reject action for join requests; flow incomplete |
| B1 | Privacy | **HIGH** | NEW | Anonymous posts return `user_id` — anonymity is cosmetic only |
| B2 | Privacy | LOW | NEW | Profile RLS not visible in code; needs manual confirmation |
| C1 | Abuse | MEDIUM | NEW | Notification flood via like-toggle |
| C2 | Abuse | MEDIUM | NEW | Notification flood via repeated follow |
| C3 | Abuse | MEDIUM | NEW | Profanity filter trivially bypassable; no comment rate limit |
| C4 | Abuse | LOW–MED | NEW | 3-report auto-hide exploitable with sock-puppets |
| C5 | Abuse | LOW | NEW | Self-reporting allowed |
| D1 | Auth | LOW | UNCHANGED | `getSession()` in reset-password gate |
| D2 | Auth | MEDIUM | PARTIAL | Most non-Communities mutations still client-side |
| D3 | Auth | **HIGH** | UNCHANGED | No CAPTCHA on signup/login/forgot-password |
| E2 | Upload | MEDIUM | UNCHANGED | File size validated only client-side |
| E5 | Upload | MEDIUM | UNCHANGED | Storage bucket RLS not in code |
| E6 | Upload | LOW | NEW | Predictable storage paths for avatars (public bucket) |
| F1 | Validation | MEDIUM | PARTIAL | Length caps only on community content; rest of app uncapped |
| F2 | Validation | MEDIUM | UNCHANGED | Zod installed but not used (outside ad-hoc validation in actions) |
| F3 | Validation | MEDIUM | PARTIAL | Document cap exists; no caps on posts, follows, comments, etc. |
| G1 | Rate Limit | **HIGH** | UNCHANGED | No application-level rate limiting anywhere |
| H1 | Leakage | MEDIUM | UNCHANGED | Raw Supabase error messages returned to clients |
| H2 | Leakage | LOW | UNCHANGED | `console.error` in production |
| H3 | Leakage | LOW | UNCHANGED | `.select("*")` queries |
| I1 | Injection | LOW | NEW | LIKE wildcards not escaped in 3 community search functions |
| J1 | Bug-Security | LOW | NEW | `requestJoinGroupAction` writes to non-existent `message` column |
| J2 | Bug-Security | LOW | NEW | Notifications schema lacks `message` column for join requests |
| J3 | Bug-UX | LOW | NEW | Authors cannot see/manage hidden posts |

**Totals: 5 High/Critical · 9 Medium · 8 Low** (one Low–Medium straddler counted as Low)

---

## Remediation Plan

The detailed, ordered, code-level plan is in [`SECURITY_REMEDIATION_PLAN.md`](./SECURITY_REMEDIATION_PLAN.md). High-level grouping below.

### Immediate (this sprint)

1. **A1, A2, A3 — Enforce group membership in server actions.** Add a membership check at the top of `fetchGroupPostsAction`, `createPostAction` (when `group_id` is provided), and any future per-group action. For private groups, require an active `community_group_members` row. Optionally also tighten RLS policies on `community_posts` to gate by `EXISTS (… community_group_members …)` for posts where `group_id IS NOT NULL AND group.is_private`.
2. **B1 — Strip `user_id` from anonymous post responses.** In `enrichPosts`, set `user_id` to `null` (or to a stable per-post salted hash if you need same-author thread grouping) when `is_anonymous = true`. Same for any future anonymous comment feature.
3. **D3 — Add CAPTCHA to login/signup/forgot-password.** Cloudflare Turnstile is the lowest-friction option. Required before G1's rate-limiter to prevent the rate-limiter being trivially bypassed by IP rotation.
4. **G1 — Implement rate limiting.** Wrap every Server Action with an Upstash Redis rate limiter (or Vercel KV equivalent). Suggested per-user-per-minute caps: post create 5; comment 30; follow 60; like 120; report 10; group create 2; auth attempts 5/IP/minute.

### Next sprint (2 weeks)

5. **A4 — Apply block filter consistently.** Refactor block-list fetch into a shared helper; call it from `fetchPostsByUserAction`, `fetchGroupPostsAction`, `searchPostsAction`. Also exclude blocked-by-target relationships symmetrically.
6. **A5, J1, J2 — Finish the private-group flow.** Either add `approveJoinRequestAction` / `rejectJoinRequestAction` and `message TEXT` column, or revert the half-built join-request feature and document private groups as invite-only-by-creator.
7. **C1, C2 — Notification deduplication.** Either store `(user_id, actor_id, type, post_id)` as a unique constraint on `notifications` (with `ON CONFLICT DO NOTHING`), or check for an existing recent notification before inserting.
8. **C3 — Replace static profanity filter** with a server-side moderation pipeline (Perspective API, OpenAI moderation, etc.) and add per-user-per-post comment rate limit (e.g. 10/hour).
9. **C4 — Raise auto-hide threshold and add admin review.** Move from naïve count of 3 to a model with reporter trust score, account age check, or an admin queue.
10. **D2 — Migrate profile, applications, documents, dashboard, resumes, essays, scholarships to Server Actions.** This unlocks proper rate limiting and validation everywhere.
11. **F1, F2, F3 — Define Zod schemas** for every resource model (or share Postgres CHECKs via a generator). Apply length caps and per-user record limits in the new server-action layer.

### Backlog (low priority)

12. **C5** — Reject `reportPostAction` when `reporter_id == post.user_id`.
13. **D1** — Replace remaining `getSession()` with `getUser()` in `reset-password/page.tsx`.
14. **E2** — Add server-side file-size check.
15. **E5** — Document and version-control storage bucket policies as SQL migrations.
16. **E6** — Add a random suffix to avatar paths (or move avatars off the public bucket and use signed URLs).
17. **H1** — Wrap server actions in a generic try/catch that logs to Sentry and returns a sanitised error to the client.
18. **H2, H3** — Audit `console.error` calls and `.select("*")` queries; replace with explicit column lists where applicable.
19. **I1** — Apply the existing LIKE escaping helper to the three community search functions.
20. **J3** — Either let authors see their own hidden posts (extend the SELECT policy with `OR auth.uid() = user_id`), or notify them via the notifications table when a post of theirs is hidden.

---

## Appendix — Files touched during audit (read-only)

```
caat-frontend/middleware.ts
caat-frontend/next.config.ts
caat-frontend/lib/supabase-server.ts
caat-frontend/lib/safe-href.ts
caat-frontend/lib/document-utils.ts
caat-frontend/lib/profanity-filter.ts
caat-frontend/src/lib/supabaseClient.ts
caat-frontend/app/(main)/communities/actions.ts
caat-frontend/app/(main)/communities/c/[slug]/page.tsx
caat-frontend/app/(main)/documents/api.ts
caat-frontend/app/(main)/applications/api.ts
caat-frontend/app/(main)/profile/api.ts
caat-frontend/app/(main)/schools/page.tsx
caat-frontend/app/login/page.tsx
caat-frontend/app/signup/page.tsx
caat-frontend/app/forgot-password/page.tsx
caat-frontend/app/reset-password/page.tsx
caat-frontend/components/login-form.tsx
caat-frontend/components/signup-form.tsx
caat-frontend/components/RichTextEditor.tsx
caat-frontend/components/profile/AvatarUpload.tsx
caat-frontend/components/communities/PostCard.tsx
caat-frontend/components/communities/GroupFeedClient.tsx
caat-frontend/components/communities/CommentItem.tsx
caat-frontend/components/resume-builder/api.ts
caat-frontend/components/resume-builder/SectionEditorPanel.tsx
caat-frontend/components/resume-builder/ResumePreviewPanel.tsx
caat-frontend/components/resume-builder/editors/ExperienceGuided.tsx
caat-frontend/components/essays/api.ts
supabase/migrations/*.sql (all)
```

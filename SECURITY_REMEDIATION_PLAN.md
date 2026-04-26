# CAAT V2 — Security Remediation Plan

**Plan Date:** 2026-04-26
**Companion Audit:** [`SECURITY_AUDIT_REPORT.md`](./SECURITY_AUDIT_REPORT.md)
**Total findings:** 22 · 5 high/critical · 9 medium · 8 low

---

## How to use this document

This is the working order to address every finding in the audit. Items are grouped into three execution phases by priority. Each entry includes the audit ID, file paths, a concrete code fix, and a verification step. Tackle Phase 1 in the next sprint, Phase 2 in the following 2-week cycle, Phase 3 as backlog.

---

## Phase 1 — Critical / High (next sprint)

These four items together close every remaining critical and high finding. They are ordered by dependency: rate limiting needs CAPTCHA in front of it to be effective, and group membership enforcement is independent and can land in parallel.

### P1.1 — Enforce private group membership (A1, A2, A3)

**Files to change:**
- `caat-frontend/app/(main)/communities/actions.ts`
- (optional) `supabase/migrations/communities_v6_group_rls_tightening.sql` (new)

**Fix outline:**

Add a single helper at the top of `actions.ts`:

```ts
async function assertCanReadGroup(
  supabase: SupabaseClient,
  groupId: string,
  userId: string | undefined
): Promise<{ allowed: boolean; isMember: boolean; isPrivate: boolean }> {
  const { data: group } = await supabase
    .from("community_groups")
    .select("is_private, creator_id")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return { allowed: false, isMember: false, isPrivate: false };

  if (!group.is_private) return { allowed: true, isMember: false, isPrivate: false };

  if (!userId) return { allowed: false, isMember: false, isPrivate: true };
  if (userId === group.creator_id) return { allowed: true, isMember: true, isPrivate: true };

  const { data: membership } = await supabase
    .from("community_group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  return { allowed: !!membership, isMember: !!membership, isPrivate: true };
}
```

Then call it at the top of:
- `fetchGroupPostsAction(groupId, …)` — return `{ posts: [], nextCursor: null }` if not allowed
- `createPostAction({ group_id, … })` — when `group_id` is non-null, return `{ post: null, error: "Not authorized" }` if not allowed (also covers public groups: optionally require membership for public-group posting too — judgment call)
- `fetchGroupAction(slug)` — already returns minimal data; optionally suppress `member_count` / `post_count` for non-members of private groups

**Defence-in-depth (recommended):** also tighten RLS so the database itself rejects cross-group reads. New migration:

```sql
DROP POLICY IF EXISTS "posts_select" ON community_posts;

CREATE POLICY "posts_select" ON community_posts
  FOR SELECT TO authenticated
  USING (
    is_hidden = FALSE
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM community_groups g
        WHERE g.id = community_posts.group_id
          AND (g.is_private = FALSE OR g.creator_id = auth.uid()
               OR EXISTS (
                 SELECT 1 FROM community_group_members m
                 WHERE m.group_id = g.id AND m.user_id = auth.uid()
               ))
      )
    )
  );
```

Same shape for `community_comments` to address A3.

**Verification:**
1. Sign in as user A. Create a private group. Get its `id` from network tab.
2. Sign in as user B (in another browser / private window).
3. Open DevTools → Network → invoke the action endpoint directly with user A's group id.
4. Expected: `{ posts: [] }` with no leak.
5. Expected: `createPostAction` returns `Not authorized` when called with user A's `group_id`.
6. Repeat after the RLS migration: even with a forged client, the DB rejects.

---

### P1.2 — Strip `user_id` from anonymous posts (B1)

**File:** `caat-frontend/app/(main)/communities/actions.ts:79-110`

**Fix:**

In `enrichPosts`, change the return mapping so `user_id` is masked when `is_anonymous`:

```ts
return rows.map((row) => {
  const isAnon = (row.is_anonymous as boolean | null) ?? false;
  const p = profileMap.get(row.user_id as string) ?? null;
  const author: PostAuthor | null = isAnon
    ? null
    : (p ? { ... } : null);
  return {
    id: row.id as string,
    user_id: isAnon ? "anonymous" : (row.user_id as string),  // ← was: row.user_id as string
    // ... rest unchanged
  };
});
```

If you need consistent same-author grouping under anonymity (e.g. "this is the same anonymous user across replies in a thread"), use a deterministic-but-non-reversible token instead of `"anonymous"`:

```ts
import { createHash } from "node:crypto";
const ANON_SALT = process.env.ANON_USER_SALT!; // store in Supabase secrets

function anonId(realId: string, postId: string): string {
  return createHash("sha256").update(`${ANON_SALT}:${realId}:${postId}`).digest("hex").slice(0, 16);
}
```

**Also patch:** any other action that returns `user_id` for posts. Grep:
```bash
grep -rn "row.user_id\|user_id: " caat-frontend/app/\(main\)/communities/actions.ts
```

**Verification:**
1. Make an anonymous post as user A.
2. Open the network response in DevTools as user B.
3. Confirm `user_id` is `"anonymous"` (or a hash) — never user A's real id.
4. Confirm the UI still functions for anonymous posts.

---

### P1.3 — Add CAPTCHA to auth forms (D3)

**Files to change:**
- `caat-frontend/components/login-form.tsx`
- `caat-frontend/components/signup-form.tsx`
- `caat-frontend/app/forgot-password/page.tsx`
- (optional) Server-side verification action

**Fix outline:**

Use Cloudflare Turnstile (free, privacy-friendly, no PII):

1. Add `<Turnstile siteKey={...} onVerify={setToken} />` (via `@marsidev/react-turnstile` or vanilla script).
2. Submit the resulting `token` to a new server action `verifyTurnstileAction(token)` that calls Cloudflare's `siteverify` endpoint with the secret key (env var, server-only).
3. Block the actual `signInWithPassword` / `signUp` / `resetPasswordForEmail` call until the token is verified.

```ts
// caat-frontend/lib/turnstile.ts
"use server";
export async function verifyTurnstile(token: string): Promise<boolean> {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
    }),
  });
  const data = await res.json();
  return data.success === true;
}
```

**Verification:**
1. With JS automation (Playwright/curl), attempt 100 logins with random emails.
2. Confirm Turnstile blocks the requests after the first that lacks a token.

---

### P1.4 — Implement application-level rate limiting (G1)

**Files to add:**
- `caat-frontend/lib/rate-limit.ts`
- Wrap critical actions in `caat-frontend/app/(main)/communities/actions.ts`

**Fix outline:**

Use Upstash Ratelimit (works on Vercel Edge & Node):

```ts
// caat-frontend/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export const ratelimits = {
  postCreate:    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,   "1 m") }),
  commentCreate: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30,  "1 m") }),
  followAction:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60,  "1 m") }),
  likeAction:    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, "1 m") }),
  reportAction:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10,  "1 h") }),
  groupCreate:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(2,   "1 h") }),
  authAttempt:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,   "1 m") }),
};

export async function gate(limiter: Ratelimit, key: string) {
  const { success, reset } = await limiter.limit(key);
  if (!success) {
    const retryIn = Math.ceil((reset - Date.now()) / 1000);
    throw new Error(`Too many requests. Try again in ${retryIn}s.`);
  }
}
```

Then in each action:

```ts
import { gate, ratelimits } from "@/lib/rate-limit";

export async function createPostAction(input) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { post: null, error: "Not signed in" };

  await gate(ratelimits.postCreate, `post:${user.id}`); // ← new

  // ... rest unchanged
}
```

For auth flows, gate by IP since the user isn't logged in yet:
```ts
// Inside a server action invoked from the form:
import { headers } from "next/headers";
const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "unknown";
await gate(ratelimits.authAttempt, `auth:${ip}`);
```

**Env vars:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

**Verification:**
1. Script 10 `createPostAction` calls in 60 seconds.
2. Expected: first 5 succeed, remaining 5 return `Too many requests…`.
3. Wait 1 minute; can post again.

---

## Phase 2 — Medium (next 2 weeks)

### P2.1 — Apply block filter consistently (A4)

**Files:**
- `caat-frontend/app/(main)/communities/actions.ts:326-345, 349-371, 1015-1037`

Extract the existing block lookup (currently inline in `fetchPostsAction`) into a helper:

```ts
async function fetchBlockedIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const [byMe, blockedMe] = await Promise.all([
    supabase.from("community_blocks").select("blocked_id").eq("blocker_id", userId),
    supabase.from("community_blocks").select("blocker_id").eq("blocked_id", userId),
  ]);
  return [
    ...((byMe.data ?? []).map((r) => r.blocked_id as string)),
    ...((blockedMe.data ?? []).map((r) => r.blocker_id as string)),
  ];
}
```

Call it in `fetchPostsByUserAction`, `fetchGroupPostsAction`, `searchPostsAction` and apply `.not("user_id", "in", \`(${ids.join(",")})\`)` when non-empty. (Watch out for empty array — Supabase rejects `in ()`; skip the filter when empty.)

For `fetchPostsByUserAction(userId)` specifically: if the *target* `userId` is in the viewer's block list (or vice-versa), return `{ posts: [], nextCursor: null }` immediately — the entire profile should be hidden.

---

### P2.2 — Finish or revert the join-request flow (A5, J1, J2)

**Decision required:** ship the feature or remove it.

**To ship:** add a migration:

```sql
-- supabase/migrations/communities_v6_join_request_message.sql
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
```

And add two server actions:

```ts
export async function approveJoinRequestAction(groupId: string, userId: string) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Verify caller owns the group
  const { data: group } = await supabase
    .from("community_groups")
    .select("creator_id, name")
    .eq("id", groupId)
    .single();
  if (!group || group.creator_id !== user.id) return { error: "Not authorized" };

  await supabase.from("community_group_members").insert({ group_id: groupId, user_id: userId, role: "member" });
  await supabase.from("community_group_requests").update({ status: "approved" }).eq("group_id", groupId).eq("user_id", userId);

  await supabase.from("notifications").insert({
    user_id: userId,
    actor_id: user.id,
    type: "follow",  // or new "request_approved" type — extend the CHECK constraint if so
    post_id: null,
    message: `Your request to join ${group.name} was approved`,
  });
  return { error: null };
}

export async function rejectJoinRequestAction(groupId: string, userId: string) { /* analogous */ }
```

**To revert:** delete A5/J1 references (lines 977-989 in `actions.ts`) and document private groups as creator-managed only. Cleaner option.

---

### P2.3 — Notification deduplication (C1, C2)

**Schema migration:**

```sql
-- supabase/migrations/communities_v6_notification_dedup.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedup
  ON public.notifications (user_id, actor_id, type, COALESCE(post_id, '00000000-0000-0000-0000-000000000000'::uuid));
```

Then change inserts to be tolerant of conflicts:

```ts
await supabase.from("notifications").upsert({
  user_id: post.user_id, actor_id: user.id, type: "like", post_id: postId
}, { onConflict: "user_id,actor_id,type,post_id", ignoreDuplicates: true });
```

This means likes/follows produce at most one notification per (recipient, actor, post) tuple regardless of how often someone toggles. If you want re-notification after a long gap, soft-delete old notifications periodically or include a date bucket in the constraint.

---

### P2.4 — Better content moderation (C3)

Two layers:

**Layer 1 (quick):** add a per-user-per-post comment cap:

```ts
const recent = await supabase
  .from("community_comments")
  .select("id", { count: "exact", head: true })
  .eq("user_id", user.id)
  .eq("post_id", postId)
  .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
if ((recent.count ?? 0) >= 10) return { comment: null, error: "Comment rate limit reached on this post" };
```

**Layer 2 (proper):** call OpenAI Moderation API or Perspective API in `addCommentAction` / `createPostAction`. If `flagged === true`, reject. Cache results by content hash so repeated identical content doesn't re-bill.

---

### P2.5 — Tighten auto-hide / report system (C4, C5)

```ts
// In reportPostAction, before insert:
const { data: post } = await supabase.from("community_posts").select("user_id").eq("id", postId).single();
if (post?.user_id === user.id) return { error: "Cannot report your own post" };
```

For the threshold — change the trigger to require either:
- 5+ unique reports (instead of 3), OR
- 3+ reports from accounts older than 7 days

```sql
CREATE OR REPLACE FUNCTION check_post_reports() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  recent_count INT;
  trusted_count INT;
BEGIN
  SELECT COUNT(*) INTO recent_count FROM community_reports WHERE post_id = NEW.post_id;
  SELECT COUNT(*) INTO trusted_count
    FROM community_reports r
    JOIN auth.users u ON u.id = r.reporter_id
    WHERE r.post_id = NEW.post_id AND u.created_at < now() - interval '7 days';
  IF recent_count >= 5 OR trusted_count >= 3 THEN
    UPDATE community_posts SET is_hidden = TRUE WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$;
```

Long-term: add an `admin_review` table and a moderator role.

---

### P2.6 — Migrate non-Communities mutations to Server Actions (D2)

Highest-value targets, in this order:

1. **AvatarUpload** — currently uses `supabase.storage.upload` from client. Move to a server action `uploadAvatarAction(formData)` that does magic-byte verification + size check + storage upload + DB update. (Server actions support `FormData` + binary uploads.)
2. **Documents API** (`app/(main)/documents/api.ts`) — add server-side equivalents; gate with rate limit.
3. **Profile / Applications / Resume builder / Essays / Scholarships** — each has a 1-2 hour migration. Establish the pattern with #1, then propagate.

After each migration, you can layer in:
- Zod schema validation (P2.7)
- Rate limit gates (uses the helper from P1.4)
- Per-user record caps (P2.8)

---

### P2.7 — Zod schemas (F1, F2)

Create `caat-frontend/lib/schemas/`:

```ts
// caat-frontend/lib/schemas/community.ts
import { z } from "zod";

export const PostInputSchema = z.object({
  content: z.string().trim().max(2000),
  topic_tag: z.enum(["APPLICATION_RESULTS","ESSAYS","TEST_SCORES","EXTRACURRICULARS","ADVICE","SCHOLARSHIPS"]),
  result_card: z.object({
    outcome: z.enum(["accepted","waitlisted","rejected"]),
    university_name: z.string().max(200),
    program: z.string().max(200).optional(),
  }).nullable().optional(),
  // ...
});

// in createPostAction:
const parsed = PostInputSchema.safeParse(input);
if (!parsed.success) return { post: null, error: parsed.error.issues[0]?.message ?? "Invalid input" };
```

Build schemas for: post, comment, group, application, profile update, document upload, resume section, essay draft, scholarship.

---

### P2.8 — Per-user record caps (F3)

Add caps similar to documents (E3, already at 50). Suggested:
- 100 posts/user/day (enforced by rate-limit) and 5,000 lifetime
- 10,000 follows
- 100 saves
- 20 groups owned
- 10 resumes
- 10 custom essay prompts

Each cap is a `count('exact')` check before insert in the corresponding action.

---

## Phase 3 — Low (backlog)

| ID | One-line fix |
|----|--------------|
| **C5** | Reject self-reports — see P2.5 above. |
| **D1** | `caat-frontend/app/reset-password/page.tsx:27` — replace `getSession()` with `getUser()`. |
| **E2** | In `uploadDocument` / `reuploadDocument` server actions: `if (file.size > MAX) throw new Error(...)`. Set bucket-level limit too. |
| **E5** | Add `supabase/migrations/storage_policies.sql` capturing the dashboard-configured bucket policies in code. |
| **E6** | Add a random suffix to avatar storage path: `${userId}/${crypto.randomUUID()}.${ext}` and store the path in `profiles.avatar_path` instead of inferring it. |
| **H1** | Wrap server actions in a `try { … } catch (e) { logToSentry(e); return { error: "Something went wrong" }; }`. Never return `error.message` from Supabase to the client. |
| **H2** | Audit `console.error` calls; gate behind `if (process.env.NODE_ENV !== "production")` or replace with Sentry. |
| **H3** | Replace `.select("*")` with explicit column lists, especially in actions that return data over the wire. |
| **I1** | Apply `query.replace(/[\\%_]/g, "\\$&")` in `searchSchoolsAction`, `searchPostsAction`, `fetchGroupsAction`. |
| **J3** | Extend `posts_select` policy: `USING (is_hidden = FALSE OR auth.uid() = user_id)`. Or notify on auto-hide. |

---

## Tracking

When a finding is fixed:
1. Reference the audit ID in the commit message: e.g. `fix(security/A1): enforce private group membership in fetchGroupPostsAction`
2. Add a one-line "Fixed in commit `<sha>` on `<date>`" entry to a dated changelog at the bottom of `SECURITY_AUDIT_REPORT.md`
3. Re-run audit (rebase against develop and re-grep) at the end of each phase
4. Re-time-stamp both files

---

## Phase tracking — current status

- Phase 1: 0/4 items complete
- Phase 2: 0/8 items complete
- Phase 3: 0/10 items complete

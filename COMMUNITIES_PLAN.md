# CAAT Communities — Implementation Plan

## Stack additions
- `react-intersection-observer` — infinite scroll trigger
- `@tanstack/react-query` — client-side fetching, caching, optimistic updates

---

## Phase 1 — Data layer
- [x] Write migration: all 7 tables + indexes
- [x] Write RLS policies for all tables
- [x] Enable Supabase Realtime on: community_posts, community_likes, community_comments, notifications
- [x] Install react-intersection-observer and @tanstack/react-query

## Phase 2 — Feed skeleton
- [x] `app/(main)/communities/page.tsx` — server component, first 20 posts, cursor pagination
- [x] `PostCard` component — content, topic tag, author, timestamp, like/comment counts, stubbed actions
- [x] Feed client wrapper — receives initial posts, intersection observer triggers load more, appends pages

## Phase 3 — Post creation
- [ ] `CreatePostForm` — TipTap editor (plain text, 2000 char limit), topic tag dropdown, server action
- [ ] `ResultCard` component — Accepted / Waitlisted / Rejected + university name, attaches to post
- [ ] `ScoreCard` component — SAT / ACT / IB + score, attaches to post
- [ ] Attach CAAT resume link to post — dropdown from user's saved resumes

## Phase 4 — Engagement
- [ ] Like button — React Query optimistic mutation, upsert/delete community_likes, Realtime count sync
- [ ] Comment thread — load on post expand, add comment form, server action insert
- [ ] Reply to comment — one level deep, inline reply form per comment
- [ ] Save post — toggle server action on community_saves, saved list on profile
- [ ] Share post — copy /communities/[postId] to clipboard, single post server-rendered route

## Phase 5 — Social graph
- [ ] Follow/unfollow button — server action on community_follows
- [ ] Following feed tab — query filters posts to followee IDs only
- [ ] Community profile page `app/(main)/communities/profile/[userId]/page.tsx`
- [ ] Privacy controls — toggle which CAAT profile fields show on community profile

## Phase 6 — Notifications
- [ ] Notification insert — server action writes notifications row on like/comment/reply
- [ ] Notification bell — nav component, Realtime subscription on notifications where user_id = me
- [ ] Notification dropdown — list recent, click navigates to post, marks as read

## Phase 7 — Moderation
- [ ] Report button — post dropdown, server action inserts community_reports row
- [ ] Auto-hide trigger — Supabase DB function sets is_hidden = true at 3 unique reports
- [ ] Profanity filter — word-list check in server action before insert

---

## Key decisions
- Cursor pagination on (created_at, id) — no skips/duplicates as new posts arrive
- Optimistic updates via React Query onMutate for likes — rollback on error
- Realtime subscriptions scoped to feed page mount only — unsubscribe on unmount
- result_card and score_card as JSONB columns — no extra tables needed
- All writes via Server Actions — keeps auth server-side, consistent with rest of app

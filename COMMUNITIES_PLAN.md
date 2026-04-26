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
- [x] `CreatePostForm` — plain text textarea (2000 char limit), topic tag dropdown, server action
- [x] `ResultCard` inputs — Accepted / Waitlisted / Rejected + university name + program, inline toggle
- [x] `ScoreCard` inputs — exam select + score input, inline toggle
- [ ] Attach CAAT resume link to post — dropdown from user's saved resumes (deferred to Phase 5)

## Phase 4 — Engagement
- [x] Like button — useOptimistic toggle, toggleLikeAction server action
- [x] Comment thread — lazy load on expand, add comment form, server action insert
- [x] Reply to comment — one level deep, inline reply form per CommentItem
- [x] Save post — useOptimistic toggle, toggleSaveAction server action
- [x] Share post — copy /communities/[postId] to clipboard + single post route

## Phase 5 — Social graph
- [x] Follow/unfollow button — useOptimistic toggle, followUserAction / unfollowUserAction
- [x] Following feed tab — FeedTabs component, fetchPostsAction(followingOnly) filters to followees
- [x] Community profile page — avatar, name, school, year, countries, majors, stats, posts
- [x] Privacy controls — PrivacySettingsPanel with checkboxes, updatePrivacySettingsAction

## Phase 6 — Notifications
- [x] Notification insert — like inserts for post author, comment/reply inserts for post + parent comment author
- [x] Notification bell — Realtime subscription (INSERT on notifications), live unread badge
- [x] Notification dropdown — list with actor, message, post snippet, timestamp; marks all read on open

## Phase 7 — Moderation
- [x] Report button — kebab menu on PostCard, reportPostAction upserts to community_reports
- [x] Delete post — kebab menu (own posts only), deletePostAction + removes from feed instantly
- [x] Auto-hide trigger — already in DB migration (check_post_reports fires at 3 reports)
- [x] Profanity filter — word-list check in createPostAction and addCommentAction before insert

---

## Key decisions
- Cursor pagination on (created_at, id) — no skips/duplicates as new posts arrive
- Optimistic updates via React Query onMutate for likes — rollback on error
- Realtime subscriptions scoped to feed page mount only — unsubscribe on unmount
- result_card and score_card as JSONB columns — no extra tables needed
- All writes via Server Actions — keeps auth server-side, consistent with rest of app

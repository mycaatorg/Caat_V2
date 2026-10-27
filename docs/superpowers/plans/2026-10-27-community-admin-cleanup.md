# Community admin cleanup implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, then one fresh whole-branch review.

**Goal:** Auth Admin can delete a disposable account with community posts and their children without depending on the caller's search path.
**Architecture:** Replace only public.delete_post_children(), qualifying existing references and pinning empty search_path. Preserve its trigger signature, SECURITY DEFINER, owner, grants, trigger binding and cleanup scope. No RLS or application changes.
**Tech Stack:** PostgreSQL, Supabase Auth Admin/REST, existing local-only Node contract runner.
**Spec:** PROD-196 and the reproduced auth-only search_path failure; user authorizes autonomous reviewed fixes.

## Global constraints
- No production user deletes as verification; disposable loopback users only.
- Preserve unrelated peer posts and interactions.
- Keep existing seven child-table deletes and comment-like-first ordering.
- Additive function replacement only; no permission widening or data rewrite.
- Preserve review/test evidence.

## Review focus
Auth caller search_path; children authored by peers; unrelated peer data; rollback on failure; fresh CI bootstrap coverage.

## Task 1: Remove the cleanup trigger's caller-path dependency
- [x] Add tests/staging/community-admin-cleanup.mjs: create two disposable users with posts and child interactions, delete one through real Auth Admin, assert owner and all post children disappear while peer post/children remain. Clean exact created fixtures on success/failure. Verify REST peer cannot delete owner's post.
- [x] Observe RED against current local schema: Auth Admin returns Database error deleting user.
- [x] Add migration20261027050000_community_admin_cleanup.sql with qualified public tables and empty search_path; apply locally.
- [x] Observe GREEN; run existing community RLS/owned-content/resume-sharing contracts, full unit suite and bootstrap safety checks.
- [x] Wire migration and contract into fresh CI bootstrap, document boundary; commit.
- [ ] Actual Claude and independent whole-branch reviews; fix material findings with failing regression first. Defer minors to Linear.
- [ ] PR CI then reviewed production function replacement with before/after metadata checks; release through develop/main and verify exact-main CI/auth/deployment/live checks. No production deletion probe.

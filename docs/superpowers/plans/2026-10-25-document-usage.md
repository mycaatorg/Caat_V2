# PROD-164 implementation plan
Spec: docs/superpowers/specs/2026-10-25-document-usage.md
Base: b24c892 (PROD-162), isolated branch codex/caat-document-usage.

## Task 1: Usage service and library UI
Write failing service/UI regressions. Return named application metadata with stable pagination and explicit owner/kind filters. Add one shared refresh hook with request-sequence guard and reusable accessible dialog; replace badges and unknown delete warning. Preserve other vault behavior. Run focused tests, lint/typecheck and full unit suite; commit.

## Task 2: Browser verification
Loopback-only owned synthetic document linked to two applications, named links, tailoring badge, navigation, Escape/focus, failure/retry, unlink/focus refresh and source preservation. Preserve pre-existing applications; cleanup only created fixtures. Desktop + phone zero retries. Commit.

## Task 3: Review/release
Fresh whole-branch review and real Claude review. Resolve important findings with tests, ticket nonblocking follow-ups. Feature PR only merges after PROD-162 release, then normal develop/main release with exact-head CI, deployed SHA/aliases and auth health.

## Review Focus
Owner/RLS joins, response cap, duplicate/fallback metadata, stale refresh responses, background refresh focus stability, delete warnings on unknown data, dialog overflow and link navigation, fixture cleanup safety. No source/tailoring mutation should result from inspecting usage.

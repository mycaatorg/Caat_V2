# Source challenge guard implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Cloudflare challenge documents from becoming scholarship evidence (PROD-294).

**Architecture:** Detect the documented `cf-mitigated: challenge` response header in `checkUrl`, cancel the body and return an explicit error with no content hash. Existing classification records it as unreachable. Read the persisted detail when loading prior checks so a challenged 404/410 cannot become a missing-page strike later.

**Tech Stack:** Existing Node fetch, Supabase client and Vitest; no dependencies or schema changes.

**Spec:** The short design below. User has authorized autonomous implementation, review, CI and release.

## Short design and approaches

Cloudflare documents its challenge response header at https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/. Use that explicit signal rather than broad page-text matching that could reject genuine awards. Ordinary automated Chromium probes also received challenges, so a browser fallback is not included. This guard protects evidence integrity; it does not restore blocked-provider access or repair previously contaminated history.

## Global constraints

- Preserve observed HTTP status/final URL, existing ordinary HTML/PDF hashing and dry-run write prohibition.
- Challenge content gets no hash, baseline, verification or deactivation. Preserve its diagnostic in history and exclude it as a later missing-page strike.
- No browser dependencies, CAPTCHA interaction, cookie copying, new database fields or production data writes during validation.

## Review focus

1. Successful HTTP status must not override the challenge signal.
2. Existing matching baseline hashes must not permit a challenged response to verify rows.
3. A challenged 404/410 must not count as a missing-page strike on a subsequent run.
4. Body cancellation failure must not erase the explicit challenge diagnosis.
5. Ordinary HTML/PDF without the signal must retain existing behavior, even if their text mentions a challenge.

## Task 1: Reject challenges throughout the check/history path

**Files:** `caat-frontend/scripts/refresh-scholarship-sources.mjs`, `caat-frontend/tests/unit/refresh-scholarship-sources.test.ts`, `docs/operations/scholarship-source-refresh.md`.

**Interfaces:** Keep `checkUrl`, `classifyCheck` and `runRefresh` return shapes; add optional `detail` to prior-check input and select it from existing history. Use one stable internal challenge-detail constant for persistence and prior-check exclusion.

- [ ] Add tests for HTTP200/403/404 challenge responses in apply and dry-run, including no reference and a matching reference; prove no hash or scholarship writes and a clear sample diagnostic.
- [ ] Add a subsequent-run regression that uses the real Supabase store reader and projected history fields to prove challenged missing responses do not become strikes. Cover 404 and 410.
- [ ] Add fetch-level cleanup and ordinary HTML/PDF compatibility cases. Observe meaningful RED before changing production code.
- [ ] Implement the header check before status/body handling and exclude the persisted challenge marker from previous strikes; document the scope and limitations.
- [ ] Run focused tests, full units, types and strict lint; request actual Claude and independent review; commit and run hosted CI.
- [ ] Merge through the established develop/main release path, verify deployment and public journeys, and record evidence in Linear.

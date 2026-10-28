# PROD-137 and PROD-145: CI runtimes and bounded test workers

User explicitly requested continued internal CI/CD and testing improvements. Existing tickets are the spec.

## Scope
Pin official current action releases by full commit SHA; use Node24 action internals and separately test project commands on Node24. Set read-only contents permissions and disable persisted checkout credentials. Disable automatic caching in auth-health and discovery jobs, which do not install packages. Preserve explicit dependency caches in test jobs, Supabase CLI2.90.0, Ubuntu24.04 browser compatibility, coverage floors, all existing jobs/triggers and production health secret boundary. Bound discovery runtime. Bound Vitest to2workers to reduce local CPU/memory contention; do not increase timeouts or add retries.

## Evidence and tasks
1. Official GitHub release/tag/action.yml review saved in ignored workspace. Prepare workflow/config edits. Existing local default suite reproduced6editor failures; same source with2vmworkers1340/1340PASS28.71s and2forkworkers1340/1340PASS93.42s.
2. Run discovery/safety contracts, full coverage, typecheck/lint, YAML syntax checks. ActualClaude and fresh independent review. Do not claim complete timeout-cancellation isolation from a worker limit; retain PROD145 follow-up if unresolved.
3. Create PR separate from190; wait for featureCI then integrate and release through exact-mainCI, authprobe, Vercel and live checks. Remote runs prove fresh install/build/browser behavior with pinned actions and Node24. Update Linear with precise evidence.

## Review Focus
Workflow permission/caching changes, action runtime versus test Node, pin provenance, nested Supabase actions, retained test gates and artifacts, concurrency mitigation limits. No assertions, coverage floors, retries or timeouts are weakened.

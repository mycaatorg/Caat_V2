# Concurrent application-task retry repair

> Execute inline with executing-plans and TDD. User authorizes reviewed/tested fixes and deployment. PROD-269 is a priority follow-up to shipped PROD-264; release322 held.

**Goal:** Simultaneous identical create_application_task requests return the same single task/link, with ownership and changed-payload conflicts preserved.
**Architecture:** A forward CREATE OR REPLACE FUNCTION migration changes only the INSERT conflict handler from a single named primary-key arbiter to ON CONFLICT DO NOTHING across all unique constraints. Existing owner-scoped exact-payload/link postcondition remains authoritative. Retain SECURITY INVOKER, validation, grants, atomic rollback and RLS.
**Stack:** PostgreSQL/Supabase; existing real local DB/REST integration regressions and CI. No frontend feature change.
**Spec:** PROD-269 issue plus boundaries here. Official semantics: https://www.postgresql.org/docs/18/sql-insert.html (omitted conflict_target handles all usable unique constraints for DO NOTHING).

## Evidence and constraints
- DevelopCI42115236563 at5cf1b0e failed real concurrent create test on user_todos_id_user_id_key. Feature/release264 prior runs passed. Do not call this infrastructure flakiness or rerun untilgreen.
- Local repeated concurrent probe reproduced23505; fixture cleanup ran. No duplicate task or data loss observed.
- Do not rewrite applied20261106030000 migration. Add20261106040000_application_task_retry_conflicts.sql; wirebootstrap afterpreviousmigration.
- No widening grants, SECURITYDEFINER, overwrites, conflict retries in JS, or removed assertions.
- Only synthetic local writes until reviewedCI; production change is the exact verified forward function migration once.

## Task 1: reproduce and fix
- [ ] Expand application-tasks-rls real DB concurrency regression to30rounds of8identical deliveries, assert identical DTOs andexact1task/link. Observe RED against originalRPC.
- [ ] Add simultaneous different-payload and different-owner sameUUID races: exactlyonewinner;loser error;winnerdata/linkpreserved. Existing validation/atomicrollback/cascades/grants stay.
- [ ] Apply forwardmigration once locally, runalltaskRPCsecurity/integrity testsGREEN. Repeattargetedconcurrencytestwhereuseful toverifyracecoverage,notmaskfailures.
- [ ] Bootstrapmigrationcontracts andtype/lint/unit/buildappropriatechecks. No frontendbehaviorchange.

## Task 2: review and release
- [ ] ActualClaude plusonefreshwhole-deltareviewer. FiximportantfindingsoncewithRED→GREEN.
- [ ] FeatureCI thenmergedevelop; rewrite release322title/body around266+269andwaitexactheaddevelop/releaseCI.
- [ ] Applyproductionforwardmigrationonceonlyaftergates;verifyfunction/grants/ownerRLS/schema. Merge322main,READYaliases,mainCI,provider/live50/sitemap/identity/CSS.
- [ ] Linear269Doneonlyafterproductionproof;266samecombinedreleaseproof. Recordearlierfailureandrepairhonestly.

## Review focus
All unique arbiters versus primary-key-only; RLS with conflicts on another owner's task; identical vs changed retry postconditions; speculative insertion/transaction visibility; atomic task/link rollback; immutable identities/grants and forward-migration order; stress test cleanup and absence of production writes in test paths.

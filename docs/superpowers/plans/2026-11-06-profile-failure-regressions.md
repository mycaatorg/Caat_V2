# Community profile failure regressions

> Execute inline with superpowers:executing-plans; one fresh whole-delta review plus actual Claude review.

**Goal/spec:** PROD-259: independently protect each profile-related failure and authenticated early exit without changing the existing user flow.
**Architecture/stack:** Existing TypeScript server action and Vitest Supabase mock. No dependency, schema or permission changes.

- [x] Replace the shared follows-failure case with independent privacy, followers, following and follow-state cases. Identify reads by filters/terminal methods, not invocation order. Assert safe stage/code, generic error, null profile and exactly one failing dependency.
- [x] Add returned auth-error case with a supplied user; assert neither RPC nor table queries. Strengthen the missing-user assertion to cover both query interfaces.
- [x] Demonstrate each new case detects its own temporarily disabled guard, restoring source in a finally block. Keep these mutations out of the committed change.
- [x] Remove only the unreachable authenticated ternary and optional user-id access. Run focused tests, full unit suite, types and lint. Existing privacy/missing-user/success tests must remain green.
- [ ] Review the whole delta, record rulings, then require hosted CI and normal release gates before Done.

**Review focus:** distinguishing three reads of the same table; no raw backend details in logged output; returned auth errors with non-null users; valid absent profiles; existing privacy defaults and follow-state semantics.

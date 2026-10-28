# PROD-199: fast fresh-database migration guard

Spec: Linear PROD-199. Extract post-synthetic-baseline SQL steps into an explicit ordered plan, preserving seed positions. Validate every migration filename from20261023070000 onward is present exactly once and ordered. Reject unknown steps. Run the pure contract in existing discovery tests before browser startup, and validate again before the local bootstrap mutates an empty database. Earlier migrations stay represented by snapshot/adapters. New migrations must use current timestamps, not be backdated into the baseline.

Tasks: write missing/duplicate/reordered/nonexistent/unknown-step fixtures and actual repository contract RED; implement pure plan validation and bootstrap consumption GREEN; check step sequence equivalence; review with actualClaude and one fresh independent reviewer; run freshCI then release through existing gates. No database permissions, schema or application changes.

Review focus: fail-closed validation, preserved seed order and safety checks, no database calls in discovery, new migration omission detected without test edits, explicitbaseline semantics.

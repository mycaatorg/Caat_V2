# Query-aware mobile viewport regression coverage (PROD-251)

Strengthen the five existing viewport hook tests so their media-query double evaluates the query received from production. The observable contract is mobile below 768 CSS pixels, desktop at or above 768, with matching subscriptions and SSR hydration. Do not alter production code or add dependencies.

1. Demonstrate the current test gap: temporarily mutate the hook query to max-width: 767px; existing tests incorrectly pass. Restore the hook in a finally block.
2. Make the test double query-aware for width range and min/max-width queries, rejecting unsupported queries. Preserve listener registration and cleanup. Exercise real hook output at literal boundary widths.
3. Repeat the mutation: the fractional-width assertion must now fail. Restore production and require the five tests, full unit suite, typecheck and lint to pass.
4. Obtain actual Claude and one independent whole-branch review, then PR/CI and verified integration.

Review focus: ensure the double responds to the actual query, does not hardcode 768, and does not conceal subscription/hydration errors. Native fractional browser layout is outside this test-only change; do not claim physical-device or native fractional testing.

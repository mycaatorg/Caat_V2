# Community retry persistence proof (PROD-95)

The existing failed-post/retry journey intermittently matched two rendered bodies after reload. Ten repeated current production-build runs pass; the original incident's exact cause remains unproven. Strengthen evidence without hiding real duplicate posts or relaxing strict flaky detection.

Verify owner-scoped database cardinality after retry and reload. Match visible post card roots rather than hidden streaming copies. Deterministically insert a hidden replica in the test DOM and prove the active-card assertion remains stable; inserting a second visible replica must still fail the uniqueness check. This is test instrumentation, not an assertion that the historical failure's cause has been reproduced. Preserve cleanup even if the page is unavailable. No application, database or dependency changes.

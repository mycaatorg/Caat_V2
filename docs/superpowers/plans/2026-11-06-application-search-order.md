# Application school search ordering (PROD-255)

Make Add university results follow the latest query. Preserve the existing 300ms debounce, school API, duplicate-add guard and failed-add retry. A new query clears outdated choices; clearing or closing cancels pending work and invalidates in-flight results. Unmount cancels timers and ignores late success/failure. Current failures remain reported and stop searching.

1. Add delayed-promise regressions for reversed responses, old rejection while current request is pending, immediate stale-choice clearing, blank during debounce/in-flight, panel close/reopen and unmount. Observe failures before implementation.
2. Use a request generation ref; increment on every query/reset/unmount, guard results/errors/finally. Reset query/results/loading on close and successful add. Keep current request errors distinct from empty successful results.
3. Run focused/full units, coverage, types/lint, production build and real isolated browser add-school flow. Review pinned diff with actual Claude and one fresh independent reviewer. Require hosted CI and exact production verification.

Review focus: StrictMode cleanup, A-to-B-to-A query races, current versus stale errors, close/unmount at debounce versus in-flight boundaries, async add success while another search is running. Transport is not aborted; stale requests finish harmlessly. No production student writes during verification.
